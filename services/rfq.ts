// ===================================
// Request for quotation — quotes compared, the order awarded, a supplier's record
// (types/orders.ts Quote / Award, types/suppliers.ts). Pure functions, no side effects.
//
// The rules the screens rely on:
//   - a quote's total = Σ unit price × qty − discount + delivery, over the lines
//     it prices; it is COMPLETE only when it prices every line;
//   - quotes are ranked only against quotes in the same currency (the one most
//     quotes came in) — another currency is listed, never converted by guess;
//   - the cheapest is the lowest COMPLETE quote: a cheaper quote that leaves out
//     lines is not cheaper;
//   - awarding anyone but the cheapest needs a reason, kept on the order.
// ===================================

import { OrderLine, PurchaseOrder, Quote } from '../types/orders';
import { Supplier } from '../types/suppliers';
import { isoCurrency, round2 } from './finance';

export interface QuoteTotal {
  goods: number;
  discount: number;
  delivery: number;
  total: number;
  /** Lines with a price. */
  priced: number;
  /** Lines neither priced nor marked unavailable — the supplier has not answered them. */
  missing: string[];
  unavailable: string[];
  complete: boolean;
}

export function quoteTotal(o: PurchaseOrder, q: Quote): QuoteTotal {
  const no = new Set(q.unavailable ?? []);
  let goods = 0;
  let priced = 0;
  const missing: string[] = [];
  const unavailable: string[] = [];
  for (const l of o.lines) {
    const p = no.has(l.id) ? undefined : q.prices[l.id];
    if (p != null && Number.isFinite(p)) {
      goods += p * l.qty;
      priced++;
    } else if (no.has(l.id)) unavailable.push(l.id);
    else missing.push(l.id);
  }
  goods = round2(goods);
  const discount = round2(goods * ((q.discountPct ?? 0) / 100));
  const delivery = round2(q.delivery ?? 0);
  return { goods, discount, delivery, total: round2(goods - discount + delivery), priced, missing, unavailable, complete: o.lines.length > 0 && priced === o.lines.length };
}

/** Answered with prices (not declined, not still waiting). */
export const answered = (q: Quote) => !!q.receivedAt && !q.declined;

export interface Comparison {
  /** The currency the ranking is in; null with no answered quote. */
  currency: string | null;
  /** Answered quotes in that currency, complete ones first, then by total. */
  ranked: { q: Quote; t: QuoteTotal }[];
  /** Answered quotes in another currency — shown, not ranked. */
  other: { q: Quote; t: QuoteTotal }[];
  /** The lowest complete quote in the ranking currency. */
  cheapestId: string | null;
  /** Per line id: the quote ids with the lowest unit price (in the ranking currency). */
  bestByLine: Record<string, string[]>;
  /** Asked, no answer yet. */
  waiting: Quote[];
  declined: Quote[];
}

export function compareQuotes(o: PurchaseOrder): Comparison {
  const quotes = o.quotes ?? [];
  const ans = quotes.filter(answered);
  const counts = new Map<string, number>();
  for (const q of ans) counts.set(q.currency, (counts.get(q.currency) ?? 0) + 1);
  // Most quotes win; a tie goes to the first quote received.
  let currency: string | null = null;
  for (const q of ans) if (currency == null || (counts.get(q.currency) ?? 0) > (counts.get(currency) ?? 0)) currency = q.currency;
  const withT = (q: Quote) => ({ q, t: quoteTotal(o, q) });
  const ranked = ans.filter((q) => q.currency === currency).map(withT)
    .sort((a, b) => Number(b.t.complete) - Number(a.t.complete) || a.t.total - b.t.total);
  const other = ans.filter((q) => q.currency !== currency).map(withT);
  const cheapestId = ranked.find((r) => r.t.complete)?.q.id ?? null;
  const bestByLine: Record<string, string[]> = {};
  for (const l of o.lines) {
    let low = Infinity;
    let ids: string[] = [];
    for (const { q } of ranked) {
      if (q.unavailable?.includes(l.id)) continue;
      const p = q.prices[l.id];
      if (p == null || !Number.isFinite(p)) continue;
      if (p < low) { low = p; ids = [q.id]; } else if (p === low) ids.push(q.id);
    }
    if (ids.length) bestByLine[l.id] = ids;
  }
  return {
    currency, ranked, other, cheapestId, bestByLine,
    waiting: quotes.filter((q) => !q.receivedAt),
    declined: quotes.filter((q) => !!q.receivedAt && q.declined),
  };
}

/** Purchase-order lines carry a symbol for the four common currencies (screens/OrderSc). */
const SYMBOL_OF: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥' };
export const lineCurrency = (iso: string) => SYMBOL_OF[iso] ?? iso;

/** What awarding `quoteId` needs: a reason when it is not the cheapest; never a quote not in. */
export function awardProblem(o: PurchaseOrder, quoteId: string, reason?: string): string | null {
  const q = o.quotes?.find((x) => x.id === quoteId);
  if (!q || !answered(q)) return 'rfq.p.notIn';
  const c = compareQuotes(o);
  const cheapest = c.cheapestId === q.id;
  if (!cheapest && (reason ?? '').trim().length < 3) return 'rfq.p.reason';
  return null;
}

/**
 * The order with the supplier chosen: supplier, their reference and their prices
 * written onto the lines (a line they cannot supply keeps what it had), and the
 * award with who, when and why. The caller checks awardProblem first.
 */
export function awardOrder(o: PurchaseOrder, quoteId: string, by: string, today: string, reason?: string): PurchaseOrder {
  const q = o.quotes!.find((x) => x.id === quoteId)!;
  const c = compareQuotes(o);
  const t = quoteTotal(o, q);
  const cur = lineCurrency(q.currency);
  const lines: OrderLine[] = o.lines.map((l) => {
    const p = q.unavailable?.includes(l.id) ? undefined : q.prices[l.id];
    return p != null ? { ...l, unitPrice: p, currency: cur } : l;
  });
  return {
    ...o,
    supplier: q.supplier,
    ...(q.supplierId ? { supplierId: q.supplierId } : { supplierId: undefined }),
    ...(q.ref ? { supplierRef: q.ref } : {}),
    lines,
    award: {
      quoteId: q.id, supplier: q.supplier, at: today, by, total: t.total, currency: q.currency,
      cheapest: c.cheapestId === q.id,
      compared: c.ranked.filter((r) => r.t.complete).length,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    },
    updatedAt: Date.now(),
  };
}

// ---- a filled-in quotation sheet back into a quote -------------------------

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return undefined;
  // "1.234,50" and "1,234.50" both mean 1234.5; a lone comma is a decimal comma.
  const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const n = last < 0 ? Number(s) : Number(s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1));
  return Number.isFinite(n) ? n : undefined;
};
const NO = new Set(['n', 'no', 'not available', 'n/a', 'na', 'nil', '0', 'нет']);

export interface SheetQuote {
  prices: Record<string, number>;
  unavailable: string[];
  /** Rows matched to a line of this order. */
  matched: number;
  /** Rows with a Line ID this order does not have (a sheet from another order). */
  foreign: number;
  leadDays?: number;
  delivery?: number;
  discountPct?: number;
  ref?: string;
}

/**
 * Read the sheet the supplier filled in (services/rfqSheet.ts rfqSheet): the row
 * headed "Line ID" starts the table; a price in "Unit price", "No" in "Available"
 * marks a line they cannot supply; below the lines, "Delivery charge", "Discount %" and
 * "Your quotation no." carry their value in the Unit price column. Null when the sheet
 * has no Line ID column.
 */
export function quoteFromSheet(o: PurchaseOrder, rows: unknown[][]): SheetQuote | null {
  const h = rows.findIndex((r) => r.some((c) => norm(c) === 'line id'));
  if (h < 0) return null;
  const head = rows[h].map(norm);
  const col = (re: RegExp) => head.findIndex((c) => re.test(c));
  const cId = head.indexOf('line id');
  const cPrice = col(/unit price/);
  const cAvail = col(/^available/);
  const cLead = col(/lead/);
  const cDesc = head.indexOf('description');
  const ids = new Set(o.lines.map((l) => l.id));
  const out: SheetQuote = { prices: {}, unavailable: [], matched: 0, foreign: 0 };
  let lead = 0;
  for (const r of rows.slice(h + 1)) {
    const id = String(r[cId] ?? '').trim();
    if (!id) {
      const label = cDesc >= 0 ? norm(r[cDesc]) : '';
      const v = cPrice >= 0 ? r[cPrice] : undefined;
      if (label.startsWith('delivery')) out.delivery = toNum(v);
      else if (label.startsWith('discount')) out.discountPct = toNum(v);
      else if (label.startsWith('your quotation') && String(v ?? '').trim()) out.ref = String(v).trim();
      continue;
    }
    if (!ids.has(id)) { out.foreign++; continue; }
    out.matched++;
    if (cAvail >= 0 && NO.has(norm(r[cAvail]))) { out.unavailable.push(id); continue; }
    const p = cPrice >= 0 ? toNum(r[cPrice]) : undefined;
    if (p != null) out.prices[id] = p;
    const d = cLead >= 0 ? toNum(r[cLead]) : undefined;
    if (d != null && d > lead) lead = d;
  }
  if (lead) out.leadDays = lead;
  return out;
}

// ---- a supplier's record, from the orders ----------------------------------

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export interface LastPrice { key: string; description: string; price: number; currency: string; date: string; poNo: string }

export interface SupplierStats {
  /** Quotes asked of them, answered (with prices), won. */
  asked: number;
  answered: number;
  won: number;
  /** Mean days from asking to their answer. */
  replyDays: number | null;
  /** Orders placed with them (sent, partly or fully received). */
  orders: number;
  received: number;
  /** Received orders that had a delivery date, and those received by it. */
  withDate: number;
  onTime: number;
  /** Received orders that came in one delivery. */
  complete: number;
  /** The last price charged per item (part no., IMPA or description), newest first. */
  lastPrices: LastPrice[];
}

/** A supplier's record from the orders — matched by directory id, else by name. */
export function supplierStats(s: Pick<Supplier, 'id' | 'name'>, orders: PurchaseOrder[]): SupplierStats {
  const isThem = (id?: string, name?: string) => (id ? id === s.id : same(name, s.name));
  let asked = 0, ans = 0, won = 0, replySum = 0, replyN = 0;
  let placed = 0, received = 0, withDate = 0, onTime = 0, complete = 0;
  const prices = new Map<string, LastPrice>();
  const live = orders.filter((o) => !o.deleted).sort((a, b) => b.date.localeCompare(a.date));
  for (const o of live) {
    for (const q of o.quotes ?? []) {
      if (!isThem(q.supplierId, q.supplier)) continue;
      asked++;
      if (answered(q)) {
        ans++;
        if (q.receivedAt) { replySum += Math.max(0, days(q.askedAt, q.receivedAt)); replyN++; }
      }
      if (o.award?.quoteId === q.id) won++;
    }
    if (!isThem(o.supplierId, o.supplier) || !['sent', 'partial', 'received'].includes(o.status)) continue;
    placed++;
    if (o.status === 'received') {
      received++;
      if ((o.deliveries?.length ?? 0) <= 1) complete++;
      if (o.deliveryDate && o.receivedAt) {
        withDate++;
        if (o.receivedAt <= o.deliveryDate) onTime++;
      }
    }
    for (const l of o.lines) {
      if (l.unitPrice == null) continue;
      const key = (l.partNo || l.impa || l.description).trim().toLowerCase();
      if (!key || prices.has(key)) continue; // newest order first — the first seen is the last price
      prices.set(key, { key, description: l.description, price: l.unitPrice, currency: isoCurrency(l.currency), date: o.date, poNo: o.no });
    }
  }
  return {
    asked, answered: ans, won, replyDays: replyN ? Math.round((replySum / replyN) * 10) / 10 : null,
    orders: placed, received, withDate, onTime, complete, lastPrices: [...prices.values()],
  };
}

/** Directory entries that match what is typed — name first, then contact/ports/country. */
export function findSuppliers(list: Supplier[], q: string): Supplier[] {
  const s = q.trim().toLowerCase();
  const live = list.filter((x) => !x.deleted);
  if (!s) return [...live].sort((a, b) => a.name.localeCompare(b.name));
  const score = (x: Supplier) => (x.name.toLowerCase().startsWith(s) ? 0 : x.name.toLowerCase().includes(s) ? 1 : [x.contact, x.ports, x.country, x.email].some((f) => f?.toLowerCase().includes(s)) ? 2 : 9);
  return live.map((x) => [x, score(x)] as const).filter(([, n]) => n < 9).sort((a, b) => a[1] - b[1] || a[0].name.localeCompare(b[0].name)).map(([x]) => x);
}
