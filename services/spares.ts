// ===================================
// Spare parts — stock arithmetic, as pure functions (see types/spares.ts for
// why stock is a sum of movements rather than a stored number).
// ===================================

import { JobPart, MoveKind, SpareMove, SparePart, SpareSupplier } from '../types/spares';
import { uid } from '../utils/id';

export type StockStatus = 'out' | 'low' | 'ok';

/** Stock on hand per part id, from every movement. */
export function stockByPart(moves: SpareMove[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of moves) out.set(m.partId, round(((out.get(m.partId) ?? 0) + m.delta)));
  return out;
}

/** Floating-point litres must not show as 2.9999999. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function stockStatus(part: SparePart, onHand: number): StockStatus {
  if (onHand <= 0) return 'out';
  if (part.minQty != null && onHand <= part.minQty) return 'low';
  return 'ok';
}

/** Lines out of stock and at or below their re-order level (Dashboard strip). */
export function toOrderCounts(parts: SparePart[], stock: Map<string, number>): { out: number; low: number } {
  let out = 0;
  let low = 0;
  for (const p of parts) {
    const s = stockStatus(p, stock.get(p.id) ?? 0);
    if (s === 'out') out += 1;
    else if (s === 'low') low += 1;
  }
  return { out, low };
}

const STATUS_RANK: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 };
export function statusRank(s: StockStatus): number {
  return STATUS_RANK[s];
}

export function unitOf(p: Pick<SparePart, 'unit'>): string {
  return p.unit?.trim() || 'pcs';
}

/** "3 pcs", "2.5 l". */
export function qtyText(n: number, p: Pick<SparePart, 'unit'>): string {
  return `${round(n)} ${unitOf(p)}`;
}

interface Signer {
  by: string;
  byRank?: string;
}

/** A movement of `kind`. A count is turned into the difference it makes. */
export function makeMove(
  part: SparePart,
  kind: MoveKind,
  amount: number,
  onHand: number,
  signer: Signer,
  date: string,
  extra: Partial<Pick<SpareMove, 'note' | 'doneId' | 'jobTitle' | 'machineName' | 'expiry'>> = {}
): SpareMove {
  const delta =
    kind === 'received' ? Math.abs(amount)
    : kind === 'used' ? -Math.abs(amount)
    : kind === 'count' ? round(amount - onHand)
    : amount;
  const now = Date.now();
  return {
    id: uid('mv'),
    partId: part.id,
    partName: part.name,
    kind,
    delta,
    ...(kind === 'count' ? { counted: amount } : {}),
    date,
    by: signer.by,
    ...(signer.byRank ? { byRank: signer.byRank } : {}),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null && v !== '')),
    at: now,
    updatedAt: now,
  };
}

/**
 * The parts a job takes, as "used" movements tied to its completion.
 * Parts no longer in the stores (removed) are skipped, not failed: the job was
 * done whatever the book says.
 */
export function movesForJob(
  parts: JobPart[] | undefined,
  byId: Map<string, SparePart>,
  stock: Map<string, number>,
  signer: Signer,
  date: string,
  ctx: { doneId: string; jobTitle: string; machineName: string }
): SpareMove[] {
  const out: SpareMove[] = [];
  for (const jp of parts ?? []) {
    const p = byId.get(jp.partId);
    if (!p || !(jp.qty > 0)) continue;
    out.push(makeMove(p, 'used', jp.qty, stock.get(p.id) ?? 0, signer, date, ctx));
  }
  return out;
}

export const MOVE_LABEL: Record<MoveKind, string> = {
  received: 'Received',
  used: 'Used',
  count: 'Stocktake',
  adjust: 'Adjusted',
};

export function moveText(m: SpareMove, p: Pick<SparePart, 'unit'>): string {
  const sign = m.delta > 0 ? '+' : m.delta < 0 ? '−' : '±';
  const amt = `${sign}${qtyText(Math.abs(m.delta), p)}`;
  if (m.kind === 'count') return `Counted ${qtyText(m.counted ?? 0, p)} (${amt})`;
  return `${MOVE_LABEL[m.kind]} ${amt}`;
}

// ---- Ordering, shelf life, consumption (15 Oct 2026, TM Master comparison, item 3) ----

/**
 * How many to order: up to the maximum when one is set, otherwise one over the
 * re-order level. Nothing while the stock is above the re-order level.
 */
export function orderQty(part: Pick<SparePart, 'minQty' | 'maxQty'>, onHand: number): number {
  const low = onHand <= 0 || (part.minQty != null && onHand <= part.minQty);
  if (!low) return 0;
  if (part.maxQty != null && part.maxQty > onHand) return round(part.maxQty - onHand);
  return Math.max(1, round((part.minQty ?? 0) - onHand + 1));
}

export interface Batch {
  qty: number;
  expiry?: string;
}

/**
 * What is on the shelf by expiry date, from the movements: each delivery is a
 * batch with its date; what is used or counted short comes off the batch that
 * expires first (the one an engineer takes); what is counted over is a batch
 * with no date. Batches without a date sort last.
 */
export function batchesOnHand(moves: SpareMove[]): Batch[] {
  const sorted = [...moves].sort((a, b) => a.at - b.at || a.date.localeCompare(b.date));
  let batches: Batch[] = [];
  const order = (x: Batch) => x.expiry ?? '9999-99-99';
  for (const m of sorted) {
    if (m.delta > 0) batches.push({ qty: m.delta, ...(m.kind === 'received' && m.expiry ? { expiry: m.expiry } : {}) });
    else if (m.delta < 0) {
      let take = -m.delta;
      batches.sort((a, b) => order(a).localeCompare(order(b)));
      for (const b of batches) {
        const t = Math.min(b.qty, take);
        b.qty = round(b.qty - t);
        take = round(take - t);
        if (take <= 0) break;
      }
    }
    batches = batches.filter((b) => b.qty > 0);
  }
  return batches.sort((a, b) => order(a).localeCompare(order(b)));
}

/** The first expiry date still on the shelf, with how many expire then. */
export function firstExpiry(moves: SpareMove[]): Batch | undefined {
  const dated = batchesOnHand(moves).filter((b) => b.expiry);
  if (!dated.length) return undefined;
  const e = dated[0].expiry!;
  return { expiry: e, qty: round(dated.filter((b) => b.expiry === e).reduce((sum, b) => sum + b.qty, 0)) };
}

/** Used per calendar year, the last `years` years, newest first (TM Master's consumption). */
export function usedByYear(moves: SpareMove[], today: string, years = 3): { year: number; used: number }[] {
  const y0 = Number(today.slice(0, 4));
  return Array.from({ length: years }, (_, i) => {
    const year = y0 - i;
    const used = moves.filter((m) => m.kind === 'used' && m.date.startsWith(String(year))).reduce((sum, m) => sum - m.delta, 0);
    return { year, used: round(used) };
  });
}

/** "EUR 42.50" — the price as quoted. */
export function priceText(x: Pick<SpareSupplier, 'price' | 'currency'>): string {
  return x.price != null ? `${x.currency?.trim() || 'EUR'} ${x.price.toFixed(2)}` : '';
}
