// ===================================
// Stores (types/stores.ts) — what is in each storeroom, batch by batch; what is
// below the minimum or out of date; what each crew member holds; the Excel
// sheet in and out. Pure: no storage, no React.
// ===================================

import { Batch, daysTo, expiryState, normExpiry, stockByItem } from './hospital';
import { StoreItem, StoreKind, StoreMove, storeItemTitle } from '../types/stores';
import type { MedMove } from '../types/hospital';
import { uid } from '../utils/id';

export interface StoreStatus {
  item: StoreItem;
  batches: Batch[];
  onHand: number;
  /** In out-of-date batches. */
  expired: number;
  /** Usable — on hand and in date. */
  usable: number;
  /** Below the minimum by this much (0 = fine). */
  short: number;
  /** The soonest expiry of what is in date. */
  next?: string;
  /** In date but expiring soon (provisions 7 days, PPE 30). */
  soon: boolean;
}

/** The moves are the same shape as the medicine chest's — the same batch arithmetic. */
const asMed = (moves: StoreMove[]) => moves as unknown as MedMove[];

export function storeStatus(items: StoreItem[], moves: StoreMove[], today: string): StoreStatus[] {
  const stock = stockByItem(asMed(moves));
  return items.filter((i) => !i.deleted).map((item) => {
    const batches = stock.get(item.id) ?? [];
    const onHand = batches.reduce((n, b) => n + b.qty, 0);
    const expired = batches.filter((b) => expiryState(today, b.expiry) === 'expired').reduce((n, b) => n + b.qty, 0);
    const usable = onHand - expired;
    const next = batches.map((b) => b.expiry).filter((e): e is string => !!e && e >= today).sort()[0];
    const soon = !!next && daysTo(today, next) <= (item.store === 'provisions' ? 7 : 30);
    return { item, batches, onHand, expired, usable, short: Math.max(0, item.min - usable), ...(next ? { next } : {}), soon };
  });
}

export function storeCounts(rows: StoreStatus[]) {
  return { items: rows.length, short: rows.filter((r) => r.short > 0).length, out: rows.filter((r) => r.usable <= 0).length, expired: rows.filter((r) => r.expired > 0).length, soon: rows.filter((r) => r.soon).length };
}

/** The oldest in-date batch first — what is issued. */
export function batchToIssue(batches: Batch[], today: string): Batch | undefined {
  return batches.filter((b) => b.qty > 0 && expiryState(today, b.expiry) !== 'expired').sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))[0] ?? batches.find((b) => b.qty > 0);
}

/** What each crew member holds from the PPE store: issued less returned, item by item. */
export function heldByPerson(items: StoreItem[], moves: StoreMove[]): Map<string, { item: StoreItem; qty: number; last: string }[]> {
  const out = new Map<string, Map<string, { item: StoreItem; qty: number; last: string }>>();
  for (const m of [...moves].sort((a, b) => a.at - b.at)) {
    if (!m.to || (m.kind !== 'issued' && m.kind !== 'returned')) continue;
    const item = items.find((i) => i.id === m.itemId);
    if (!item) continue;
    const per = out.get(m.to) ?? new Map();
    const cur = per.get(item.id) ?? { item, qty: 0, last: m.date };
    cur.qty += m.kind === 'issued' ? m.qty : -m.qty;
    cur.last = m.date;
    per.set(item.id, cur);
    out.set(m.to, per);
  }
  const res = new Map<string, { item: StoreItem; qty: number; last: string }[]>();
  for (const [who, per] of out) {
    const list = [...per.values()].filter((x) => x.qty > 0).sort((a, b) => a.item.name.localeCompare(b.item.name));
    if (list.length) res.set(who, list);
  }
  return res;
}

/** To order: below the minimum — up to the minimum, as many as are short. */
export const toOrder = (rows: StoreStatus[]) => rows.filter((r) => r.short > 0).map((r) => ({ item: r.item, need: r.short }));

export const nextStoreNo = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;

// ---- Excel ----

export const STORE_HEAD = ['Name ★', 'Category', 'Size', 'Unit', 'Min', 'Location', 'Quantity', 'Expiry'];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace('★', '').trim();
const ALIASES: Record<string, string[]> = {
  name: ['name', 'item', 'description', 'product', 'article'],
  category: ['category', 'group', 'section', 'store', 'type'],
  size: ['size'],
  unit: ['unit', 'uom', 'pack'],
  min: ['min', 'minimum', 'min stock', 'reorder level', 'par'],
  location: ['location', 'place', 'shelf', 'where'],
  qty: ['quantity', 'qty', 'on hand', 'stock', 'count'],
  expiry: ['expiry', 'best before', 'bb', 'use by', 'exp', 'expiry date'],
};

export interface StoreSheetLine { name: string; category?: string; size?: string; unit?: string; min?: number; location?: string; qty?: number; expiry?: string }

export function readStoreSheet(rows: unknown[][]): StoreSheetLine[] {
  const find = (head: string[], k: string) => {
    for (const a of ALIASES[k]) { const i = head.findIndex((h) => h === a); if (i >= 0) return i; }
    for (const a of ALIASES[k]) { const i = head.findIndex((h) => h.startsWith(a)); if (i >= 0) return i; }
    return -1;
  };
  const headAt = rows.findIndex((r) => { const h = (r as unknown[]).map((c) => norm(String(c ?? ''))); return find(h, 'name') >= 0 && ['qty', 'unit', 'min', 'category', 'size'].some((k) => find(h, k) >= 0); });
  if (headAt < 0) throw new Error('No "Name" column with Quantity, Unit or Min beside it — use the store template.');
  const head = (rows[headAt] as unknown[]).map((c) => norm(String(c ?? '')));
  const at = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, find(head, k)])) as Record<string, number>;
  const txt = (r: unknown[], k: string) => { const v = at[k] >= 0 ? r[at[k]] : undefined; const s = v == null ? '' : String(v).trim(); return s || undefined; };
  const num = (r: unknown[], k: string) => { const s = txt(r, k); const n = s == null ? NaN : Number(s.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
  const out: StoreSheetLine[] = [];
  for (const r of rows.slice(headAt + 1) as unknown[][]) {
    const name = txt(r, 'name');
    if (!name || /^example\b/i.test(name)) continue;
    const exp = at.expiry >= 0 ? r[at.expiry] : undefined;
    const line: StoreSheetLine = { name: name.replace(/\s+/g, ' '), category: txt(r, 'category'), size: txt(r, 'size'), unit: txt(r, 'unit'), min: num(r, 'min'), location: txt(r, 'location'), qty: num(r, 'qty'), expiry: exp == null || exp === '' ? undefined : normExpiry(exp) };
    out.push(Object.fromEntries(Object.entries(line).filter(([, v]) => v !== undefined)) as unknown as StoreSheetLine);
  }
  return out;
}

/** A sheet into the store: matched by name and size — updated, or added; a quantity is counted into its batch. */
export function planStoreImport(lines: StoreSheetLine[], items: StoreItem[], store: StoreKind) {
  const key = (n: string, s?: string) => `${n.trim().toLowerCase()}|${(s ?? '').trim().toLowerCase()}`;
  const have = new Map(items.filter((i) => !i.deleted && i.store === store).map((i) => [key(i.name, i.size), i]));
  const save: StoreItem[] = [];
  const counts: { itemId: string; qty: number; expiry?: string }[] = [];
  const added: string[] = [];
  const updated: string[] = [];
  let order = items.length;
  const now = Date.now();
  for (const l of lines) {
    const old = have.get(key(l.name, l.size));
    const it: StoreItem = {
      ...(old ?? { id: uid('sto'), store, name: l.name, unit: l.unit ?? 'pcs', min: 0, order: order++, updatedAt: now }),
      ...Object.fromEntries(Object.entries({ category: l.category, size: l.size, unit: l.unit, min: l.min, location: l.location }).filter(([, v]) => v !== undefined)),
      updatedAt: now,
    } as StoreItem;
    save.push(it);
    have.set(key(it.name, it.size), it);
    (old ? updated : added).push(storeItemTitle(it));
    if (l.qty != null) counts.push({ itemId: it.id, qty: l.qty, ...(l.expiry ? { expiry: l.expiry } : {}) });
  }
  return { save, counts, added, updated };
}

/** The store as a sheet in the template's columns — one line per batch. */
export function storeSheet(rows: StoreStatus[]): unknown[][] {
  const out: unknown[][] = [STORE_HEAD];
  for (const r of rows) {
    const base = [r.item.name, r.item.category ?? '', r.item.size ?? '', r.item.unit, r.item.min, r.item.location ?? ''];
    if (!r.batches.length) out.push([...base, 0, '']);
    for (const b of r.batches) out.push([...base, b.qty, b.expiry ?? '']);
  }
  return out;
}

export const storeTemplateRows = (store: StoreKind): unknown[][] => [STORE_HEAD, store === 'ppe' ? ['Example: Coveralls', 'Body', 'L', 'pcs', 2, 'Crew store, shelf 2', 4, ''] : ['Example: Pasta, penne 500 g', 'Dry store', '', 'packs', 10, 'Dry store, rack B', 24, '06/27']];
