// ===================================
// Spare parts — stock arithmetic, as pure functions (see types/spares.ts for
// why stock is a sum of movements rather than a stored number).
// ===================================

import { JobPart, MoveKind, SpareMove, SparePart } from '../types/spares';
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
  extra: Partial<Pick<SpareMove, 'note' | 'doneId' | 'jobTitle' | 'machineName'>> = {}
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
