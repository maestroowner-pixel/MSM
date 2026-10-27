// ===================================
// Finance — the APA's balance and statement, and the budget against what was
// spent (types/finance.ts). Pure functions, no side effects.
//
// What counts, once:
//   - an entry taken out by a reversing entry counts for nothing, and neither
//     does the reversal — both stay on the statement, marked;
//   - a payment from the APA is in its fund's currency (at the entry's rate);
//   - a purchase order counts against the budget for what was RECEIVED (spent)
//     and what is still to come on it (committed) — unless an APA payment names
//     it, and then the payment is what counts;
//   - an amount in another currency than the budget's is not guessed at: it is
//     left out and counted, so the screen can say so.
// ===================================

import { ApaEntry, ApaFund, BudgetLine, CENTRE_LABEL, COST_CENTRES, CostCentre } from '../types/finance';
import { OrderDept, OrderLine, PurchaseOrder } from '../types/orders';

/** Purchase-order lines carry a symbol (screens/OrderSc), finance an ISO code. */
const SYMBOL: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY' };
export const isoCurrency = (c?: string): string => (c ? SYMBOL[c] ?? c.toUpperCase() : 'EUR');

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** "EUR 12,345.60" — formatted by hand: Intl is not on every Hermes build. */
export function money(n: number, currency: string): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(round2(n)).toFixed(2).split('.');
  return `${neg ? '−' : ''}${currency} ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/** The entry in its fund's currency; null when the currencies differ and there is no rate. */
export function inFund(e: ApaEntry, fund: ApaFund): number | null {
  if (e.currency === fund.currency) return e.amount;
  return e.rate && e.rate > 0 ? round2(e.amount * e.rate) : null;
}

/** What stops an entry being saved — an i18n key under `fin.p.` (null: fine). */
export function entryProblem(e: Partial<ApaEntry>, fund: ApaFund | undefined): string | null {
  if (!fund) return 'fin.p.fund';
  if (fund.closed) return 'fin.p.closed';
  if (!e.date) return 'fin.p.date';
  if (e.date < fund.opened) return 'fin.p.beforeOpened';
  if (!(typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount > 0)) return 'fin.p.amount';
  if (!e.description?.trim()) return 'fin.p.what';
  if (e.kind === 'out' && !e.centre) return 'fin.p.centre';
  if (e.currency && e.currency !== fund.currency && !(e.rate && e.rate > 0)) return 'fin.p.rate';
  return null;
}

/** Ids that count for nothing: every reversed entry and every reversal. */
export function cancelledIds(entries: ApaEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (e.reverses) {
      out.add(e.id);
      out.add(e.reverses);
    }
  }
  return out;
}

const byDate = (a: ApaEntry, b: ApaEntry) => a.date.localeCompare(b.date) || a.at - b.at;

export interface FundSummary {
  /** The period's entries, reversals included, in date order. */
  rows: ApaEntry[];
  opening: number;
  received: number;
  spent: number;
  closing: number;
  byCentre: Partial<Record<CostCentre, number>>;
}

/** A fund's statement for a period (no `from`: since it opened; no `to`: until now). */
export function fundSummary(fund: ApaFund, entries: ApaEntry[], from?: string, to?: string): FundSummary {
  const mine = entries.filter((e) => e.fundId === fund.id).sort(byDate);
  const gone = cancelledIds(mine);
  const sum: FundSummary = { rows: [], opening: 0, received: 0, spent: 0, closing: 0, byCentre: {} };
  for (const e of mine) {
    if (to && e.date > to) continue;
    const before = !!from && e.date < from;
    if (!before) sum.rows.push(e);
    if (gone.has(e.id)) continue;
    const v = inFund(e, fund) ?? 0;
    const signed = e.kind === 'in' ? v : -v;
    if (before) {
      sum.opening += signed;
      continue;
    }
    if (e.kind === 'in') sum.received += v;
    else {
      sum.spent += v;
      const c = e.centre ?? 'other';
      sum.byCentre[c] = round2((sum.byCentre[c] ?? 0) + v);
    }
  }
  sum.opening = round2(sum.opening);
  sum.received = round2(sum.received);
  sum.spent = round2(sum.spent);
  sum.closing = round2(sum.opening + sum.received - sum.spent);
  return sum;
}

/** The funds still taking entries, newest first. */
export const openFunds = (funds: ApaFund[]) => funds.filter((f) => !f.deleted && !f.closed).sort((a, b) => b.opened.localeCompare(a.opened));

// ---- Budget ---------------------------------------------------------------

export const DEPT_CENTRE: Record<OrderDept, CostCentre> = { bridge: 'bridge', engine: 'engine', deck: 'deck', accommodation: 'interior', galley: 'galley', medical: 'medical' };

/** A line's cost centre: its own "Budget" field when it names one, else its order's department. */
export function lineCentre(l: OrderLine, o: PurchaseOrder): CostCentre {
  const b = l.budget?.trim().toLowerCase();
  if (b) {
    const hit = COST_CENTRES.find((c) => c === b || CENTRE_LABEL[c].toLowerCase() === b);
    if (hit) return hit;
  }
  return DEPT_CENTRE[o.dept] ?? 'other';
}

export interface BudgetRow {
  centre: CostCentre;
  budget: number;
  /** Paid from the APA. */
  apa: number;
  /** Received on purchase orders. */
  orders: number;
  /** Still to come on orders sent. */
  committed: number;
  spent: number;
  /** budget − spent − committed */
  left: number;
  /** (spent + committed) / budget; null without a budget. */
  used: number | null;
}

export interface BudgetYear {
  rows: BudgetRow[];
  total: BudgetRow;
  /** Amounts left out: in another currency than the budget's. */
  skipped: number;
}

/** The budget currency of a year: its lines', else the newest fund's, else EUR. */
export function budgetCurrency(year: number, budgets: BudgetLine[], funds: ApaFund[]): string {
  return budgets.find((b) => b.year === year)?.currency ?? openFunds(funds)[0]?.currency ?? funds.find((f) => !f.deleted)?.currency ?? 'EUR';
}

const COUNTED: PurchaseOrder['status'][] = ['sent', 'partial', 'received'];

export function budgetYear(year: number, currency: string, budgets: BudgetLine[], funds: ApaFund[], entries: ApaEntry[], orders: PurchaseOrder[]): BudgetYear {
  const y = String(year);
  const acc = new Map<CostCentre, BudgetRow>();
  const row = (c: CostCentre) => {
    let r = acc.get(c);
    if (!r) acc.set(c, (r = { centre: c, budget: 0, apa: 0, orders: 0, committed: 0, spent: 0, left: 0, used: null }));
    return r;
  };
  let skipped = 0;
  for (const b of budgets) {
    if (b.year !== year || !(b.amount > 0)) continue;
    if (b.currency !== currency) skipped++;
    else row(b.centre).budget += b.amount;
  }
  const gone = cancelledIds(entries);
  const fundOf = new Map(funds.map((f) => [f.id, f]));
  const paidOrders = new Set<string>();
  for (const e of entries) {
    if (gone.has(e.id)) continue;
    if (e.poId) paidOrders.add(e.poId);
    if (e.kind !== 'out' || !e.date.startsWith(y)) continue;
    const f = fundOf.get(e.fundId);
    const v = f ? inFund(e, f) : null;
    if (!f || v == null || f.currency !== currency) {
      skipped++;
      continue;
    }
    row(e.centre ?? 'other').apa += v;
  }
  for (const o of orders) {
    if (o.deleted || !COUNTED.includes(o.status) || paidOrders.has(o.id) || !o.date.startsWith(y)) continue;
    for (const l of o.lines) {
      if (!(l.unitPrice && l.unitPrice > 0)) continue;
      if (isoCurrency(l.currency) !== currency) {
        skipped++;
        continue;
      }
      const got = Math.min(l.qtyReceived ?? 0, l.qty);
      const r = row(lineCentre(l, o));
      r.orders += l.unitPrice * got;
      if (o.status !== 'received') r.committed += l.unitPrice * Math.max(l.qty - got, 0);
    }
  }
  const finish = (r: BudgetRow): BudgetRow => {
    const spent = round2(r.apa + r.orders);
    return { ...r, budget: round2(r.budget), apa: round2(r.apa), orders: round2(r.orders), committed: round2(r.committed), spent, left: round2(r.budget - spent - r.committed), used: r.budget > 0 ? (spent + r.committed) / r.budget : null };
  };
  const rows = COST_CENTRES.filter((c) => acc.has(c)).map((c) => finish(acc.get(c)!));
  const total = finish(rows.reduce((t, r) => ({ ...t, budget: t.budget + r.budget, apa: t.apa + r.apa, orders: t.orders + r.orders, committed: t.committed + r.committed }), { centre: 'other' as CostCentre, budget: 0, apa: 0, orders: 0, committed: 0, spent: 0, left: 0, used: null } as BudgetRow));
  return { rows, total, skipped };
}

/** Cost centres past their budget (spent + committed), for the Board. */
export const overBudget = (y: BudgetYear) => y.rows.filter((r) => r.budget > 0 && r.used != null && r.used > 1);
