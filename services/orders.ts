// ===================================
// Purchase orders — utilities.
// Pure functions, no side effects.
// ===================================

import { ORDER_DEPT_CODE, OrderDept, OrderLine, OrderStatus, PurchaseOrder } from '../types/orders';
import { uid } from '../utils/id';

/** Next PO number for a department and year: PO-BR-001-2026, per-dept sequence. */
export function nextOrderNo(existing: PurchaseOrder[], dept: OrderDept, year = new Date().getFullYear()): string {
  const code = ORDER_DEPT_CODE[dept];
  const prefix = `PO-${code}-`;
  const suffix = `-${year}`;
  const nums = existing
    .map((o) => o.no)
    .filter((n) => n.startsWith(prefix) && n.endsWith(suffix))
    .map((n) => parseInt(n.slice(prefix.length, n.length - suffix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}${suffix}`;
}

/** Total lines across an order */
export const lineCount = (o: PurchaseOrder): number => o.lines.length;

/** Total value if prices are set */
export function orderValue(o: PurchaseOrder): number | undefined {
  const prices = o.lines.filter((l) => l.unitPrice != null && l.unitPrice > 0);
  if (!prices.length) return undefined;
  return prices.reduce((s, l) => s + (l.unitPrice! * l.qty), 0);
}

/** Whether all lines are fully received */
export function allReceived(o: PurchaseOrder): boolean {
  return o.lines.length > 0 && o.lines.every((l) => (l.qtyReceived ?? 0) >= l.qty);
}

/** Whether any line is partially received */
export function anyReceived(o: PurchaseOrder): boolean {
  return o.lines.some((l) => (l.qtyReceived ?? 0) > 0);
}

/** Status to show from delivery state (call after marking lines received) */
export function derivedStatus(o: PurchaseOrder): OrderStatus {
  if (o.status === 'cancelled' || o.status === 'draft' || o.status === 'standby') return o.status;
  if (allReceived(o)) return 'received';
  if (anyReceived(o)) return 'partial';
  return o.status;
}

/** Copy an order as a new draft template — strips delivery state, issues new ids. */
export function copyOrder(o: PurchaseOrder, existing: PurchaseOrder[]): PurchaseOrder {
  return {
    ...o,
    id: uid('po'),
    no: nextOrderNo(existing, o.dept),
    status: 'draft',
    date: new Date().toISOString().slice(0, 10),
    by: '',
    byRank: undefined,
    sentAt: undefined,
    sentBy: undefined,
    receivedAt: undefined,
    receivedBy: undefined,
    deliveries: undefined,
    lines: o.lines.map((l) => ({ ...l, id: uid('ol'), qtyReceived: undefined })),
    at: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Orders that are not archived (draft, sent, partial) */
export const openOrders = (list: PurchaseOrder[]): PurchaseOrder[] =>
  list.filter((o) => !o.deleted && o.status !== 'received' && o.status !== 'cancelled');

/** Open orders for a given department */
export const openForDept = (list: PurchaseOrder[], dept: OrderDept): PurchaseOrder[] =>
  openOrders(list).filter((o) => o.dept === dept);

/** All orders for a department, newest first */
export const ordersForDept = (list: PurchaseOrder[], dept: OrderDept): PurchaseOrder[] =>
  list.filter((o) => !o.deleted && o.dept === dept).sort((a, b) => b.at - a.at);

/** Journal: all orders, newest first */
export const journalOrders = (list: PurchaseOrder[]): PurchaseOrder[] =>
  list.filter((o) => !o.deleted).sort((a, b) => b.at - a.at);

/** Completion percentage 0–100 based on per-line fractions so mixed units (m, L, pcs) don't get summed. */
export function completionPct(o: PurchaseOrder): number {
  if (!o.lines.length) return 0;
  const sum = o.lines.reduce((s, l) => s + (l.qty > 0 ? Math.min((l.qtyReceived ?? 0) / l.qty, 1) : 0), 0);
  return Math.round((sum / o.lines.length) * 100);
}

/** Currency string for a line (e.g. "€ 1 250.00") */
export function priceStr(l: OrderLine): string {
  if (l.unitPrice == null) return '';
  const sym = l.currency ?? '€';
  return `${sym} ${l.unitPrice.toFixed(2)}`;
}

/** Line total string */
export function lineTotalStr(l: OrderLine): string {
  if (l.unitPrice == null) return '';
  const sym = l.currency ?? '€';
  return `${sym} ${(l.unitPrice * l.qty).toFixed(2)}`;
}
