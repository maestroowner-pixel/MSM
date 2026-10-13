// ===================================
// Hospital — stock by batch, expiry, what to order, the controlled drugs
// register, the medical log's numbers, and the Excel list (types/hospital.ts).
// Pure: no storage, no React.
// ===================================

import { HospitalCategory, IMGS_REFERENCE, MED_SCALE, NURSING_SCALE, ScaleMedicine, ScaleNursing } from '../constants/medScale';
import { CheckLine, Issued, LandingReason, MedCheck, MedItem, MedKind, MedMove, MedOrder, MedTreatment } from '../types/hospital';

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
    if (m.kind === 'received' || m.kind === 'returned') b.qty += m.qty;
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
  // A month alone ("2027-03", "03/2027", "11/27" as on the box) means to the end of that month.
  const ym = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  const my = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  const myShort = /^(\d{1,2})[-/.](\d{2})$/.exec(s);
  const y = ym ? Number(ym[1]) : my ? Number(my[2]) : myShort ? 2000 + Number(myShort[2]) : 0;
  const mo = ym ? Number(ym[2]) : my ? Number(my[1]) : myShort ? Number(myShort[1]) : 0;
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
    const next = m.kind === 'received' || m.kind === 'returned' ? cur + m.qty : m.kind === 'count' ? m.qty : cur - m.qty;
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

export const MOVE_LABEL: Record<MedMove['kind'], string> = { received: 'Received', issued: 'Issued', returned: 'Returned by the patient', disposed: 'Disposed', count: 'Counted' };

/** Given back so far against a log entry, item by item. */
export function returnedFor(treatmentId: string, moves: MedMove[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of moves) if (x.treatmentId === treatmentId && x.kind === 'returned') m.set(x.itemId, (m.get(x.itemId) ?? 0) + x.qty);
  return m;
}

// ---- the Excel list ----

export const SHEET_HEAD = ['List No.', 'Name', 'Strength / form', 'Unit', 'Required', 'Kind', 'Location', 'Cabinet', 'Cell', 'Controlled', 'Batch', 'Expiry', 'Quantity'];

export interface SheetLine {
  name: string;
  strength?: string;
  unit: string;
  required: number;
  kind: MedKind;
  location?: string;
  listNo?: string;
  cabinet?: string;
  cell?: string;
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
  const known = [/^(name|item|medicine|description)/, /strength|form|dosage/, /^(unit|uom)/, /^(required|min|req)|scale/, /^(batch|lot)/, /^exp/, /^(quantity|qty|stock)|on hand|aboard/, /location|^where|^stowed/, /controlled|narcotic/, /^list|who|^no\.?$/, /cabinet|locker|cupboard/, /^cell|shelf|drawer|compartment/];
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
    listNo: col(/^list/, /who/, /^no\.?$/, /^#$/, /^ref/),
    cabinet: col(/cabinet/, /locker/, /cupboard/),
    cell: col(/^cell/, /shelf/, /drawer/, /compartment/, /^box/, /^bin/),
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
      ...(c.listNo >= 0 && String(r[c.listNo] ?? '').trim() ? { listNo: String(r[c.listNo]).trim() } : {}),
      ...(c.cabinet >= 0 && String(r[c.cabinet] ?? '').trim() ? { cabinet: String(r[c.cabinet]).trim() } : {}),
      ...(c.cell >= 0 && String(r[c.cell] ?? '').trim() ? { cell: String(r[c.cell]).trim() } : {}),
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
    const fields = { name: l.name, ...(l.strength ? { strength: l.strength } : {}), unit: l.unit, required: l.required, kind: l.kind, ...(l.location ? { location: l.location } : {}), ...(l.listNo ? { listNo: l.listNo } : {}), ...(l.cabinet ? { cabinet: l.cabinet } : {}), ...(l.cell ? { cell: l.cell } : {}), ...(l.controlled ? { controlled: true } : {}) };
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
    const base = [r.item.listNo ?? '', r.item.name, r.item.strength ?? '', r.item.unit, r.item.required, r.item.kind, r.item.location ?? '', r.item.cabinet ?? '', r.item.cell ?? '', r.item.controlled ? 'yes' : ''];
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
  // In the order one walks the chest: room, cabinet, cell.
  for (const r of [...rows].sort((a, b) => comparePlace(a.item, b.item) || a.item.name.localeCompare(b.item.name))) {
    const place = placeText(r.item);
    const base = { itemId: r.item.id, name: [r.item.name, r.item.strength].filter(Boolean).join(' '), ...(place ? { place } : {}) };
    if (!r.batches.length) out.push({ ...base, expected: 0, counted: 0 });
    for (const b of r.batches) out.push({ ...base, ...(b.batchNo ? { batchNo: b.batchNo } : {}), ...(b.expiry ? { expiry: b.expiry } : {}), expected: b.qty, counted: b.qty });
  }
  return out;
}

export const CHECK_KIND_LABEL: Record<NonNullable<MedCheck['kind']>, string> = { inventory: 'Inventory', cd: 'Controlled drugs count', handover: 'Controlled drugs handover', landing: 'Landing report', 'landing-cd': 'Landing report — controlled drugs' };

export const isLanding = (c: Pick<MedCheck, 'kind'>) => c.kind === 'landing' || c.kind === 'landing-cd';

// ---- landing: out-of-date stock handed ashore for destruction ----

/** The list No. an item goes by — its own, or the WHO / IMGS number from the scale (constants/medScale.ts). */
export function listNoOf(item: Pick<MedItem, 'name' | 'strength' | 'code' | 'listNo'>): string | undefined {
  if (item.listNo?.trim()) return item.listNo.trim();
  const e = scaleEntry(item);
  return e.med?.who ?? e.nursing?.code;
}

/** One batch as a landing line — the whole batch, as the books hold it. */
export function landingLine(r: ItemStatus, b: { batchNo?: string; expiry?: string; qty: number }, reason: LandingReason): CheckLine {
  const listNo = listNoOf(r.item);
  const place = placeText(r.item);
  return {
    itemId: r.item.id, name: r.item.name, ...(r.item.strength ? { strength: r.item.strength } : {}), unit: r.item.unit, ...(listNo ? { listNo } : {}), ...(place ? { place } : {}),
    ...(b.batchNo ? { batchNo: b.batchNo } : {}), ...(b.expiry ? { expiry: b.expiry } : {}), expected: b.qty, counted: b.qty, ...(r.item.controlled ? { controlled: true } : {}), reason,
  };
}

/**
 * What goes ashore: every out-of-date batch still on the books — the controlled
 * drugs on their own report (`cd`), everything else on the other.
 */
export function landingLinesFor(rows: ItemStatus[], today: string, cd: boolean): CheckLine[] {
  const out: CheckLine[] = [];
  for (const r of [...rows].sort((a, b) => (a.item.listNo ? 0 : 1) - (b.item.listNo ? 0 : 1) || a.item.name.localeCompare(b.item.name))) {
    if (!!r.item.controlled !== cd) continue;
    for (const b of r.batches) if (b.qty > 0 && expiryState(today, b.expiry) === 'expired') out.push(landingLine(r, b, 'expired'));
  }
  return out;
}

export const differences = (c: Pick<MedCheck, 'lines'>) => c.lines.filter((l) => l.counted !== l.expected);

// ---- the scale (constants/medScale.ts) ----

/** The chest for a hospital category: the medicines required in it, and the equipment. */
export function scaleItems(cat: HospitalCategory): Omit<MedItem, 'id' | 'order' | 'updatedAt'>[] {
  const meds = MED_SCALE.filter((m) => m.req[cat] != null).map((m) => ({
    name: m.name, strength: m.strength, unit: unitOf(m.form), required: m.req[cat]!, kind: 'medicine' as MedKind, group: m.group,
    ...(m.atc ? { code: m.atc } : {}), ...(m.who ? { listNo: m.who } : {}), ...(m.controlled ? { controlled: true } : {}),
  }));
  const nurs = NURSING_SCALE.filter((n) => n.qty > 0).map((n) => ({
    name: n.name, ...(n.description && n.description !== n.name ? { strength: n.description } : {}), unit: 'pcs', required: n.qty,
    kind: (/bandage|suture|dressing|gauze|compress|plaster|glove|swab/i.test(`${n.group} ${n.name}`) ? 'consumable' : 'equipment') as MedKind, group: n.group, code: n.code, listNo: n.code,
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

/**
 * What the reference says about an item, for the "i" on its panel: the scale's
 * entry (indication, ATC, WHO No., IMGS text) or the IMGS medicine entry of the
 * same name; the equipment's IMGS code and note. `text` empty = nothing there.
 */
export function referenceOf(item: Pick<MedItem, 'name' | 'strength' | 'code' | 'listNo'>): { facts: string[]; text: string } {
  const e = scaleEntry(item);
  const n = item.name.trim().toLowerCase();
  // By exact name only, and only for an item not on the scale: where the scale holds the
  // medicine without a reference (morphine, permethrin — the guide's form differs) none is shown.
  const imgs = IMGS_REFERENCE.find((r) => r.name.toLowerCase() === n);
  if (e.nursing) return { facts: [`IMGS ${e.nursing.code}`, e.nursing.group, e.nursing.description !== e.nursing.name ? e.nursing.description : ''].filter(Boolean), text: e.nursing.ref ?? '' };
  const m = e.med;
  return {
    facts: [listNoOf(item) ?? '', m?.indication ? `For: ${m.indication}` : '', m?.atc ? `ATC ${m.atc}` : '', m?.controlled ? 'Controlled drug' : ''].filter(Boolean),
    text: m ? m.ref ?? '' : imgs?.text ?? '',
  };
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

// ---- the register's order (13 Oct 2026: "sort by purpose, by expiry, alphabetically") ----

/** What an item is for: its own group, or the WHO IMGS group by its name, or its kind. */
export function purposeOf(item: MedItem): string {
  if (item.group?.trim()) return item.group.trim();
  const s = scaleEntry(item);
  return s.med?.group ?? s.nursing?.group ?? ({ medicine: 'Other medicines', equipment: 'Other equipment', consumable: 'Other dressings & consumables' } as Record<MedKind, string>)[item.kind];
}

/** The soonest expiry of anything aboard, out of date included. */
export const earliestExpiry = (r: ItemStatus) => r.batches.map((b) => b.expiry).filter(Boolean).sort()[0] as string | undefined;

export type ChestSort = 'attention' | 'purpose' | 'expiry' | 'name' | 'place' | 'list';
const attention = (r: ItemStatus) => (r.expired ? 0 : r.nextState === 'soon' ? 1 : r.short ? 2 : r.nextState === 'later' ? 3 : 4);
const byName = (a: ItemStatus, b: ItemStatus) => a.item.name.localeCompare(b.item.name) || (a.item.strength ?? '').localeCompare(b.item.strength ?? '');

export function sortChest(rows: ItemStatus[], by: ChestSort): ItemStatus[] {
  const out = [...rows];
  if (by === 'name') return out.sort(byName);
  if (by === 'place') return out.sort((a, b) => comparePlace(a.item, b.item) || byName(a, b));
  if (by === 'list') return out.sort((a, b) => (a.item.listNo ? 0 : 1) - (b.item.listNo ? 0 : 1) || (a.item.listNo ?? '').localeCompare(b.item.listNo ?? '', undefined, { numeric: true }) || byName(a, b));
  if (by === 'expiry') return out.sort((a, b) => (earliestExpiry(a) ?? '9999').localeCompare(earliestExpiry(b) ?? '9999') || byName(a, b));
  if (by === 'purpose') return out.sort((a, b) => purposeOf(a.item).localeCompare(purposeOf(b.item)) || byName(a, b));
  return out.sort((a, b) => attention(a) - attention(b) || byName(a, b));
}

/** Search by name: every word in the name, strength or code. */
export function matchesName(item: MedItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${item.name} ${item.strength ?? ''} ${item.code ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

// ---- as Marine Hospital Manager shows it (13 Oct 2026: "look at the logic in MHM") ----

export type StockLevel = 'empty' | 'critical' | 'low' | 'adequate' | 'good';
/** In date against the scale: none, < 25 %, < 50 %, < 100 %, full (MHM's stock status). */
export function stockLevel(r: ItemStatus): StockLevel {
  if (r.usable <= 0) return 'empty';
  if (!r.item.required) return 'good';
  const p = (r.usable / r.item.required) * 100;
  return p < 25 ? 'critical' : p < 50 ? 'low' : p < 100 ? 'adequate' : 'good';
}
export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = { empty: 'Out of stock', critical: 'Critical', low: 'Low stock', adequate: 'Adequate', good: 'In stock' };

/** The group's mark, as in MHM's category pills. */
export function purposeIcon(group: string): string {
  // MaterialCommunityIcons names (components/MciIcon) — the app's own icons, not emoji (13 Oct 2026).
  const g = group.toLowerCase();
  const table: [RegExp, string][] = [
    [/pain|fever|analges/, 'thermometer'], [/cardio/, 'heart-pulse'], [/gastro/, 'stomach'], [/infect|antibio/, 'bacteria-outline'], [/respir/, 'lungs'], [/derma|skin/, 'lotion-outline'],
    [/nervous|psych/, 'brain'], [/eye|ear/, 'eye-outline'], [/allerg/, 'flower-pollen-outline'], [/emergenc/, 'ambulance'], [/rehydr/, 'water-outline'], [/vaccin/, 'needle'], [/dental/, 'tooth-outline'],
    [/women/, 'human-female'], [/resusc|oxygen/, 'gas-cylinder'], [/bandage|suture|dressing/, 'bandage'], [/instrument/, 'content-cut'], [/examin|monitor/, 'stethoscope'],
    [/inject|cathet/, 'needle'], [/nursing/, 'bed-outline'], [/immobil|splint/, 'bone'], [/disinfect|protect/, 'hand-wash-outline'], [/equipment/, 'toolbox-outline'],
  ];
  return table.find(([re]) => re.test(g))?.[1] ?? 'pill';
}

/** MHM's search: name, strength, code (ATC / IMGS), and what it is for. */
export function matchesSearch(item: MedItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const s = scaleEntry(item);
  const hay = `${item.name} ${item.strength ?? ''} ${item.code ?? ''} ${item.listNo ?? ''} ${item.location ?? ''} ${item.cabinet ?? ''} ${item.cell ?? ''} ${s.med?.atc ?? ''} ${s.med?.indication ?? ''} ${s.nursing?.code ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** "11/27" — a batch's expiry as on MHM's badges. */
export const mmYY = (iso?: string) => (iso ? `${iso.slice(5, 7)}/${iso.slice(2, 4)}` : 'no exp');

// ---- where it is (13 Oct 2026: "location in the cabinet, cell number, list number — it is very important to find one's way") ----

/** "Hospital · cabinet A · cell 3" — the room, the cabinet, the cell. */
export function placeText(item: Pick<MedItem, 'location' | 'cabinet' | 'cell'>): string {
  const cab = item.cabinet?.trim();
  const cell = item.cell?.trim();
  return [item.location?.trim(), cab ? (/^[a-z0-9]{1,3}$/i.test(cab) ? `cabinet ${cab}` : cab) : null, cell ? (/^[a-z0-9]{1,4}$/i.test(cell) ? `cell ${cell}` : cell) : null].filter(Boolean).join(' · ');
}
/** Room, then cabinet, then cell — "cell 2" before "cell 10"; what has no place goes last. */
export function comparePlace(a: Pick<MedItem, 'location' | 'cabinet' | 'cell'>, b: Pick<MedItem, 'location' | 'cabinet' | 'cell'>): number {
  for (const k of ['location', 'cabinet', 'cell'] as const) {
    const x = a[k]?.trim() ?? '';
    const y = b[k]?.trim() ?? '';
    if (x === y) continue;
    if (!x) return 1;
    if (!y) return -1;
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
  }
  return 0;
}

/**
 * A batch as the crew knows it — by its expiry, MM/YY as on the box (13 Oct
 * 2026: "batch = exp mm/yy"); the lot number, where one was written, beside it.
 */
export function batchLabel(b: { batchNo?: string; expiry?: string }): string {
  if (!b.expiry) return b.batchNo ? `lot ${b.batchNo} · no expiry` : 'no expiry';
  return `${mmYY(b.expiry)}${b.batchNo ? ` · lot ${b.batchNo}` : ''}`;
}
