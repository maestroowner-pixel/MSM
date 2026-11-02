// ===================================
// A delivery received against a purchase order puts what came into stock: a line
// that came from the spares (`spareId`) books a `received` movement on the part,
// one from a store's list (`storeItemId`) a `received` move on the store item —
// the quantity that came IN THIS DELIVERY, never the order's total, so a second
// delivery of a short line adds only what it brought. Lines typed by hand have no
// stock to book. Pure; checked by `npm run check:orderexport`.
// ===================================

import { PurchaseOrder } from '../types/orders';
import { SpareMove, SparePart } from '../types/spares';
import { StoreItem, StoreMove } from '../types/stores';
import { makeMove } from './spares';
import { uid } from '../utils/id';

export interface Receiver { by: string; byRank?: string }

export function receiptMoves(
  o: PurchaseOrder, came: Record<string, number>, spares: SparePart[], spareStock: Map<string, number>, storeItems: StoreItem[], who: Receiver, date: string, now = Date.now(),
): { spareMoves: SpareMove[]; storeMoves: StoreMove[] } {
  const spareMoves: SpareMove[] = [];
  const storeMoves: StoreMove[] = [];
  const note = `${o.no}${o.supplier ? ` · ${o.supplier}` : ''}`;
  for (const l of o.lines) {
    const q = came[l.id] ?? 0;
    if (!(q > 0)) continue;
    const part = l.spareId ? spares.find((p) => p.id === l.spareId && !p.deleted) : undefined;
    if (part) spareMoves.push({ ...makeMove(part, 'received', q, spareStock.get(part.id) ?? 0, who, date, { note }), at: now });
    const item = l.storeItemId ? storeItems.find((i) => i.id === l.storeItemId && !i.deleted) : undefined;
    if (item) storeMoves.push({ id: uid('stm'), itemId: item.id, kind: 'received', qty: q, date, note, by: who.by, ...(who.byRank ? { byRank: who.byRank } : {}), at: now, updatedAt: now });
  }
  return { spareMoves, storeMoves };
}
