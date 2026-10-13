// ===================================
// Hospital — stock by batch, expiry, what to order, the controlled drugs
// register, the medical log's numbers, and the Excel list (types/hospital.ts).
// Pure: no storage, no React.
// ===================================

import { HospitalCategory, MED_SCALE, NURSING_SCALE, ScaleMedicine, ScaleNursing } from '../constants/medScale';
import { CheckLine, Issued, MedCheck, MedItem, MedKind, MedMove, MedOrder, MedTreatment } from '../types/hospital';

export interface Batch {
  key: string;
  batchNo?: string;
  expiry?: string;
  qty: number;
}

export const batchKey = (b: { batchNo?: string; expiry?: string }) => `${(b.batchNo ?? '').trim().toUpperCase()}|${b.expiry ?? ''}`;

const order = (a: MedMove, b: MedMove) => a.at - b.at || a.id.localeCompare(b.id);

/** What is aboard, batch by batch, for every item — earliest expiry first. */
export function stockByItem(moves: MedMove[]): Map<string, Batch[]> {
  const per = new Map<string, Map<string, Batch>>();
  for (const m of [...moves].sort(order)) {
    const map = per.get(m.itemId) ?? new Map<string, Batch>();
    const k = batchKey(m);
    const b = map.get(k) ?? { key: k, ...(m.batchNo?.trim() ? { batchNo: m.batchNo.trim() } : {}), ...(m.expiry ? { expiry: m.expiry } : {}), qty: 0 };
    if (m.kind === 'received') b.qty += m.qty;
    else if (m.kind === 'issued' || m.kind === 'disposed') b.qty -= m.qty;
    else b.qty = m.qty; // a count sets the batch
    map.set(k, b);
    per.set(m.itemId, map);
  }
  const out = new Map<string, Batch[]>();
  for (const [id, map] of per) out.set(id, [...map.values()].filter((b) => b.qty > 0).sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999')));
  return out;
}

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const daysTo = (today: string, iso: string) => Math.round((day(iso) - day(today)) / 86400000);

export type ExpiryState = 'expired' | 'soon' | 'later' | 'ok' | 'none';
/** expired; within 30 days; within 90 days; later; no date. */
export function expiryState(today: string, expiry?: string): ExpiryState {
  if (!expiry) return 'none';
  const d = daysTo(today, expiry);
  return d < 0 ? 'expired' : d <= 30 ? 'soon' : d <= 90 ? 'later' : 'ok';
}

export interface ItemStatus {
  item: MedItem;
  batches: Batch[];
  /** Everything aboard. */
  onHand: number;
  /** Aboard and in date. */
  usable: number;
  expired: number;
  /** The earliest expiry of what is in date. */
  next?: string;
  nextState: ExpiryState;
  short: number;
}

export function itemStatus(item: MedItem, batches: Batch[], today: string): ItemStatus {
  const onHand = batches.reduce((s, b) => s + b.qty, 0);
  const expired = batches.filter((b) => expiryState(today, b.expiry) === 'expired').reduce((s, b) => s + b.qty, 0);
  const usable = onHand - expired;
  const next = batches.find((b) => expiryState(today, b.expiry) !== 'expired' && b.expiry)?.expiry;
  return { item, batches, onHand, usable, expired, ...(next ? { next } : {}), nextState: expiryState(today, next), short: Math.max(0, item.required - usable) };
}

export function chestStatus(items: MedItem[], moves: MedMove[], today: string): ItemStatus[] {
  const stock = stockByItem(moves);
  return items.filter((i) => !i.deleted).map((i) => itemStatus(i, stock.get(i.id) ?? [], today));
}

export function chestCounts(rows: ItemStatus[]) {
  return {
    expired: rows.filter((r) => r.expired > 0).length,
    soon: rows.filter((r) => r.nextState === 'soon').length,
    short: rows.filter((r) => r.short > 0).length,
  };
}

/** The batch to take from: in date, the soonest to expire, enough of it if possible. */
export function pickBatch(batches: Batch[], qty: number, today: string): Batch | undefined {
  const ok = batches.filter((b) => expiryState(today, b.expiry) !== 'expired');
  return ok.find((b) => b.qty >= qty) ?? ok[0];
}

/** "2027-03" → last day of the month; "2027-03-15" stays; Excel serials and dates too. */
export function normExpiry(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // A month alone ("2027-03", "03/2027") means to the end of that month.
  const ym = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  const my = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  const y = ym ? Number(ym[1]) : my ? Number(my[2]) : 0;
  const mo = ym ? Number(ym[2]) : my ? Number(my[1]) : 0;
  if (y && mo >= 1 && mo <= 12) return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  return undefined;
}

// ---- the medical log ----

export const nextMedNo = (list: MedTreatment[], date: string) => nextNo('MED', list, date);

export const sortTreatments = (list: MedTreatment[]) => [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.no.localeCompare(a.no));

/** Follow-ups due by today and not yet written. */
export function followUpsDue(list: MedTreatment[], today: string): MedTreatment[] {
  const done = new Set(list.map((t) => t.followUpOf).filter(Boolean));
  return list.filter((t) => t.followUp && t.followUp <= today && !done.has(t.id));
}

export const issuedText = (x: Issued) => `${x.name} ${x.qty} ${x.unit}${x.dose ? ` — ${x.dose}` : ''}`;

// ---- the controlled drugs register ----

export interface RegisterLine {
  move: MedMove;
  in: number;
  out: number;
  balance: number;
}

/** Every move of one item, oldest first, with the balance after it. */
export function registerLines(itemId: string, moves: MedMove[]): RegisterLine[] {
  const own = moves.filter((m) => m.itemId === itemId).sort(order);
  const batches = new Map<string, number>();
  const total = () => [...batches.values()].reduce((s, q) => s + q, 0);
  return own.map((m) => {
    const k = batchKey(m);
    const before = total();
    const cur = batches.get(k) ?? 0;
    const next = m.kind === 'received' ? cur + m.qty : m.kind === 'count' ? m.qty : cur - m.qty;
    batches.set(k, next);
    const after = total();
    return { move: m, in: Math.max(0, after - before), out: Math.max(0, before - after), balance: after };
  });
}

/** The last count of the controlled drugs — the Master counts them monthly. */
export function lastControlledCount(items: MedItem[], moves: MedMove[]): string | undefined {
  const ids = new Set(items.filter((i) => i.controlled && !i.deleted).map((i) => i.id));
  return moves.filter((m) => ids.has(m.itemId) && m.kind === 'count').map((m) => m.date).sort().pop();
}

export const MOVE_LABEL: Record<MedMove['kind'], string> = { received: 'Received', issued: 'Issued', disposed: 'Disposed', count: 'Counted' };

// ---- the Excel list ----

export const SHEET_HEAD = ['Name', 'Strength / form', 'Unit', 'Required', 'Kind', 'Location', 'Controlled', 'Batch', 'Expiry', 'Quantity'];

export interface SheetLine {
  name: string;
  strength?: string;
  unit: string;
  required: number;
  kind: MedKind;
  location?: string;
  controlled: boolean;
  batchNo?: string;
  expiry?: string;
  qty?: number;
}

const KIND_WORDS: [RegExp, MedKind][] = [[/equip|device|instrument/i, 'equipment'], [/dress|consum|bandage|dispos/i, 'consumable']];

/** The rows of a medical list: a header row with "Name" somewhere, then one line per batch. */
export function readSheet(rows: unknown[][]): { lines: SheetLine[]; skipped: number } {
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  // The header row is the first with a name column AND at least one more column
  // we know — a title like "Medicine chest" above it is not a header.
  const known = [/^(name|item|medicine|description)/, /strength|form|dosage/, /^(unit|uom)/, /^(required|min|req)|scale/, /^(batch|lot)/, /^exp/, /^(quantity|qty|stock)|on hand|aboard/, /location|^where|^stowed/, /controlled|narcotic/];
  const h = rows.findIndex((r) => {
    const cells = r.map(norm);
    return cells.some((c) => known[0].test(c)) && known.slice(1).filter((k) => cells.some((c) => k.test(c))).length >= 1;
  });
  if (h < 0) return { lines: [], skipped: rows.length };
  const head = rows[h].map(norm);
  const col = (...keys: RegExp[]) => head.findIndex((c) => keys.some((k) => k.test(c)));
  const c = {
    name: col(/^name/, /^item/, /^medicine/, /^description/),
    strength: col(/strength/, /form/, /dosage/),
    unit: col(/^unit/, /^uom/),
    required: col(/^required/, /^min/, /scale/, /^req/),
    kind: col(/^kind/, /^type/, /^category/),
    location: col(/location/, /^where/, /^stowed/),
    controlled: col(/controlled/, /narcotic/, /^cd$/),
    batch: col(/^batch/, /^lot/),
    expiry: col(/^expir/, /^exp/, /best before/),
    qty: col(/^quantity/, /^qty/, /on hand/, /aboard/, /^stock/),
  };
  const lines: SheetLine[] = [];
  let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    const name = String(r[c.name] ?? '').trim();
    if (!name) {
      if (r.some((x) => String(x ?? '').trim())) skipped++;
      continue;
    }
    const num = (i: number) => (i < 0 ? undefined : Number(String(r[i] ?? '').replace(',', '.').trim()));
    const req = num(c.required);
    const q = num(c.qty);
    const kindText = c.kind >= 0 ? String(r[c.kind] ?? '') : '';
    const ctl = c.controlled >= 0 ? norm(r[c.controlled]) : '';
    lines.push({
      name,
      ...(c.strength >= 0 && String(r[c.strength] ?? '').trim() ? { strength: String(r[c.strength]).trim() } : {}),
      unit: (c.unit >= 0 && String(r[c.unit] ?? '').trim()) || 'pcs',
      required: req != null && Number.isFinite(req) ? req : 0,
      kind: KIND_WORDS.find(([re]) => re.test(kindText))?.[1] ?? 'medicine',
      ...(c.location >= 0 && String(r[c.location] ?? '').trim() ? { location: String(r[c.location]).trim() } : {}),
      controlled: /^(y|yes|x|1|true|cd|да)$/.test(ctl),
      ...(c.batch >= 0 && String(r[c.batch] ?? '').trim() ? { batchNo: String(r[c.batch]).trim() } : {}),
      ...(c.expiry >= 0 && normExpiry(r[c.expiry]) ? { expiry: normExpiry(r[c.expiry]) } : {}),
      ...(q != null && Number.isFinite(q) && String(r[c.qty] ?? '').trim() !== '' ? { qty: q } : {}),
    });
  }
  return { lines, skipped };
}

const key = (name: string, strength?: string) => `${name.trim().toLowerCase()}|${(strength ?? '').trim().toLowerCase()}`;

/**
 * What loading the sheet does: items matched by name and strength are updated,
 * new ones added; every line with a quantity becomes a count of that batch.
 */
export function planImport(lines: SheetLine[], items: MedItem[]): { update: MedItem[]; add: Omit<MedItem, 'id' | 'order' | 'updatedAt'>[]; counts: { key: string; line: SheetLine }[] } {
  const have = new Map(items.filter((i) => !i.deleted).map((i) => [key(i.name, i.strength), i]));
  const update = new Map<string, MedItem>();
  const add = new Map<string, Omit<MedItem, 'id' | 'order' | 'updatedAt'>>();
  const counts: { key: string; line: SheetLine }[] = [];
  for (const l of lines) {
    const k = key(l.name, l.strength);
    const fields = { name: l.name, ...(l.strength ? { strength: l.strength } : {}), unit: l.unit, required: l.required, kind: l.kind, ...(l.location ? { location: l.location } : {}), ...(l.controlled ? { controlled: true } : {}) };
    const old = have.get(k);
    if (old) update.set(k, { ...old, ...fields, required: Math.max(update.get(k)?.required ?? 0, l.required) });
    else if (!add.has(k)) add.set(k, fields);
    if (l.qty != null) counts.push({ key: k, line: l });
  }
  return { update: [...update.values()], add: [...add.values()], counts };
}

export const itemKey = key;

/** The list as a sheet — one row per batch aboard (an item with none gets one row). */
export function sheetOf(rows: ItemStatus[]): unknown[][] {
  const out: unknown[][] = [SHEET_HEAD];
  for (const r of rows) {
    const base = [r.item.name, r.item.strength ?? '', r.item.unit, r.item.required, r.item.kind, r.item.location ?? '', r.item.controlled ? 'yes' : ''];
    if (!r.batches.length) out.push([...base, '', '', '']);
    for (const b of r.batches) out.push([...base, b.batchNo ?? '', b.expiry ?? '', b.qty]);
  }
  return out;
}

// ---- orders: delivered in parts, at different times ----

export function nextNo(prefix: string, list: { no: string }[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^${prefix}-${y}-(\\d+)$`);
  const top = list.reduce((m, t) => Math.max(m, Number(re.exec(t.no)?.[1] ?? 0)), 0);
  return `${prefix}-${y}-${String(top + 1).padStart(3, '0')}`;
}

/** Received so far against each line of an order. */
export function receivedByLine(order: MedOrder, moves: MedMove[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of moves) if (x.orderId === order.id && x.kind === 'received' && x.lineId) m.set(x.lineId, (m.get(x.lineId) ?? 0) + x.qty);
  return m;
}

export type OrderState = 'open' | 'part' | 'done' | 'closed';
export function orderState(order: MedOrder, moves: MedMove[]): OrderState {
  const got = receivedByLine(order, moves);
  const all = order.lines.every((l) => (got.get(l.id) ?? 0) >= l.qty);
  if (all && order.lines.length) return 'done';
  if (order.closedAt) return 'closed';
  return [...got.values()].some((q) => q > 0) ? 'part' : 'open';
}
export const ORDER_STATE_LABEL: Record<OrderState, string> = { open: 'Ordered — nothing received', part: 'Part received', done: 'Complete', closed: 'Closed — not all delivered' };
export const isArchived = (s: OrderState) => s === 'done' || s === 'closed';

/** Overdue: past its expected date and not complete. */
export const orderOverdue = (order: MedOrder, moves: MedMove[], today: string) => !!order.due && order.due < today && !isArchived(orderState(order, moves));

/** What is still to come, item by item, from the open orders. */
export function onOrderByItem(orders: MedOrder[], moves: MedMove[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of orders) {
    if (isArchived(orderState(o, moves))) continue;
    const got = receivedByLine(o, moves);
    for (const l of o.lines) {
      const left = Math.max(0, l.qty - (got.get(l.id) ?? 0));
      if (left) out.set(l.itemId, (out.get(l.itemId) ?? 0) + left);
    }
  }
  return out;
}

export function sortOrders(list: MedOrder[]): MedOrder[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
}

// ---- inventory ----

/** The lines to count: every batch the books show, and one empty line for an item with none. */
export function checkLinesFor(rows: ItemStatus[]): CheckLine[] {
  const out: CheckLine[] = [];
  for (const r of rows) {
    if (!r.batches.length) out.push({ itemId: r.item.id, name: r.item.name, expected: 0, counted: 0 });
    for (const b of r.batches) out.push({ itemId: r.item.id, name: r.item.name, ...(b.batchNo ? { batchNo: b.batchNo } : {}), ...(b.expiry ? { expiry: b.expiry } : {}), expected: b.qty, counted: b.qty });
  }
  return out;
}

export const differences = (c: Pick<MedCheck, 'lines'>) => c.lines.filter((l) => l.counted !== l.expected);

// ---- the scale (constants/medScale.ts) ----

/** The chest for a hospital category: the medicines required in it, and the equipment. */
export function scaleItems(cat: HospitalCategory): Omit<MedItem, 'id' | 'order' | 'updatedAt'>[] {
  const meds = MED_SCALE.filter((m) => m.req[cat] != null).map((m) => ({
    name: m.name, strength: m.strength, unit: unitOf(m.form), required: m.req[cat]!, kind: 'medicine' as MedKind, group: m.group,
    ...(m.atc ? { code: m.atc } : {}), ...(m.controlled ? { controlled: true } : {}),
  }));
  const nurs = NURSING_SCALE.filter((n) => n.qty > 0).map((n) => ({
    name: n.name, ...(n.description && n.description !== n.name ? { strength: n.description } : {}), unit: 'pcs', required: n.qty,
    kind: (/bandage|suture|dressing|gauze|compress|plaster|glove|swab/i.test(`${n.group} ${n.name}`) ? 'consumable' : 'equipment') as MedKind, group: n.group, code: n.code,
  }));
  return [...meds, ...nurs];
}

const UNITS: Record<string, string> = { tablet: 'tablets', capsule: 'capsules', ampoule: 'ampoules', vial: 'vials', sachet: 'sachets', suppository: 'suppositories', patch: 'patches', inhaler: 'inhalers', spray: 'sprays' };
const unitOf = (form: string) => UNITS[form.toLowerCase()] ?? (/(cream|ointment|gel)/i.test(form) ? 'tubes' : /(drops|solution|lotion|liquid)/i.test(form) ? 'bottles' : 'pcs');

/** The WHO IMGS entry for an item — by code, or by name (and form) — with its reference text. */
export function scaleEntry(item: Pick<MedItem, 'name' | 'strength' | 'code'>): { med?: ScaleMedicine; nursing?: ScaleNursing } {
  const n = item.name.trim().toLowerCase();
  const nursing = NURSING_SCALE.find((x) => (item.code && x.code === item.code) || x.name.toLowerCase() === n);
  if (nursing) return { nursing };
  const all = MED_SCALE.filter((m) => m.name.toLowerCase() === n);
  const med = all.find((m) => (item.strength ?? '').toLowerCase() === m.strength.toLowerCase()) ?? all[0];
  return med ? { med } : {};
}

/** What to order: short of the scale, or expiring within 90 days — never more than the scale. */
export function toOrder(rows: ItemStatus[], today: string, onOrder: Map<string, number> = new Map()): { item: MedItem; short: number; expiring: number; need: number }[] {
  return rows
    .map((r) => {
      const expiring = r.batches.filter((b) => ['soon', 'later'].includes(expiryState(today, b.expiry))).reduce((s, b) => s + b.qty, 0);
      const need = Math.max(0, Math.min(r.item.required, r.short + expiring) - (onOrder.get(r.item.id) ?? 0));
      return { item: r.item, short: r.short, expiring, need };
    })
    .filter((x) => x.need > 0);
}
