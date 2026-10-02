// ===================================
// "Update from Excel" — reconcile a workbook with the register already held.
//
// Why this exists: the two older import modes both destroy something. "Replace
// all" gives every item a NEW id, and the id is what a printed QR label encodes,
// what every signed inspection points at, and what attachments and certificate
// links hang off — so correcting one cell in Excel and importing again silently
// orphaned the whole ship's labels and history. "Append" duplicates. A vessel
// that builds its list gradually (a customer asked for exactly that, 14 Sep 2026)
// needs a third way: find each row's existing item, change what changed, add
// what is new, and SHOW what the file no longer mentions before anything goes.
//
// Pure: no storage, no React Native — scripts/check-register-update.ts runs it.
// ===================================

import { CategoryKey, EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';

/** Fields a workbook column can set. Everything else on an item is the app's own. */
const SHEET_FIELDS = [
  'no', 'type', 'make', 'size', 'serial', 'deck', 'position', 'persons', 'quantity',
  'manufactureDate', 'nextInspection', 'expiry', 'remarks',
] as const;
type SheetField = (typeof SHEET_FIELDS)[number];

export interface ItemChange {
  before: EquipmentItem;
  after: EquipmentItem;
  /** Human-readable field names that differ ("Location", "Expiry"…). */
  fields: string[];
}

export interface UpdatePlan {
  changed: ItemChange[];
  unchanged: EquipmentItem[];
  added: EquipmentItem[];
  /** In the register, not in the file. Removed only if the user says so. */
  missing: EquipmentItem[];
  /** How each file row found its item — shown so a surprising match can be questioned. */
  matchedBy: { id: number; serial: number; details: number };
}

const FIELD_LABEL: Record<SheetField, string> = {
  no: 'No',
  type: 'Type',
  make: 'Make',
  size: 'Size',
  serial: 'Serial',
  deck: 'Deck',
  position: 'Location',
  persons: 'Persons',
  quantity: 'Qty',
  manufactureDate: 'Manufacture date',
  nextInspection: 'Next inspection',
  expiry: 'Expiry',
  remarks: 'Comments',
};

const key = (v: unknown): string => (v == null ? '' : String(v).trim().toLowerCase().replace(/\s+/g, ' '));
const serialKey = (v: unknown): string => key(v).replace(/[\s\-_./]/g, '');

/** The row as the parser left it: its values, plus which columns its sheet had. */
function columnsOf(row: EquipmentItem): Set<string> | null {
  const f = (row as any)._fields as string[] | undefined;
  return f ? new Set(f) : null;
}

/**
 * The item after the row has been applied to it.
 *
 * - A column the sheet HAS sets the field — and an emptied cell clears it, so a
 *   comment deleted in Excel is deleted here.
 * - A column the sheet does NOT have leaves the field alone: a vessel's own list
 *   with no Persons column must not wipe every liferaft's capacity.
 * - "Exp / Inspc." / "Due" writes the date the ITEM's category is judged by. The
 *   item keeps its category — the app's filing wins over a guess from the row's
 *   words, because a vessel may have re-filed it on purpose.
 * - Extras merge (new column values over old); id, attachments, flags and
 *   monthly checks are never touched.
 */
function applyRow(before: EquipmentItem, row: EquipmentItem): { after: EquipmentItem; fields: string[] } {
  const cols = columnsOf(row);
  const after: EquipmentItem = { ...before };
  const fields: string[] = [];
  const set = (f: SheetField, value: unknown) => {
    const empty = value == null || value === '';
    const old = (before as any)[f];
    if (empty) {
      if (old == null || old === '') return;
      delete (after as any)[f];
    } else {
      if (key(old) === key(value)) return;
      (after as any)[f] = value;
    }
    fields.push(FIELD_LABEL[f]);
  };

  for (const f of SHEET_FIELDS) {
    if (f === 'expiry' || f === 'nextInspection') continue;
    if (cols ? cols.has(f) : (row as any)[f] != null) set(f, (row as any)[f]);
  }

  // Dates: explicit Expiry / Next Inspection columns, then the combined column.
  const rowDateField = CATEGORY_MAP[row.category]?.dateField ?? 'expiry';
  // The field "Due" was READ from on export — complianceDate's own order: the
  // category's field, else whichever of the two the item actually has. A
  // liferaft holding only an expiry exported that expiry as its Due, and writing
  // it back into next inspection moved the date on every round trip.
  const primary = CATEGORY_MAP[before.category]?.dateField ?? 'nextInspection';
  const secondary = primary === 'expiry' ? 'nextInspection' : 'expiry';
  const itemDateField = before[primary] == null && before[secondary] != null ? secondary : primary;
  const compliance = cols?.has('compliance') ? row[rowDateField] : undefined;
  for (const f of ['expiry', 'nextInspection'] as const) {
    if (cols ? cols.has(f) : row[f] != null) set(f, row[f]);
    else if (cols?.has('compliance') && f === itemDateField) set(f, compliance);
  }

  if (row.extra && Object.keys(row.extra).length) {
    const merged = { ...(before.extra ?? {}) };
    let touched = false;
    for (const [k, v] of Object.entries(row.extra)) {
      if (key(merged[k]) !== key(v)) {
        merged[k] = v;
        touched = true;
      }
    }
    if (touched) {
      after.extra = merged;
      fields.push('Other columns');
    }
  }

  if (fields.length) after.updatedAt = Date.now();
  return { after, fields };
}

/** Category + number + what + where — the identity of an item with no serial. */
function detailsKey(it: EquipmentItem): string | null {
  const parts = [key(it.no), key(it.type), key(it.deck), key(it.position)];
  if (!parts[0] && !parts[3]) return null; // "a lifejacket" alone identifies nothing
  return `${it.category}|${parts.join('|')}`;
}

/**
 * The identity of last resort, for a row `detailsKey` refuses: no number and no
 * location, so nothing says WHICH lifejacket — but everything it does say is the
 * same as an item already held.
 *
 * Without this such a row matched nothing and was ADDED, on every update: a
 * register of un-numbered, un-located items grew by its own length each time the
 * same workbook was loaded, while the copies already held were listed as "not in
 * the file". A vessel reached three times its real inventory that way (2 Oct
 * 2026). Pairing in order is the same answer the ten identical lifejackets get
 * above, and for the same reason — it keeps ten items ten. It also catches a
 * serial that has stopped being unique BECAUSE of those copies, which is why the
 * serial is part of the key rather than a reason to skip it.
 */
function twinKey(it: EquipmentItem): string | null {
  const parts = [key(it.type), key(it.make), key(it.size), serialKey(it.serial), key(it.deck)];
  if (!parts[0] && !parts[3]) return null;
  return `${it.category}|${parts.join('|')}`;
}

/**
 * Decide, row by row, which existing item each row is.
 *
 * In order of certainty:
 *  1. **MSM ID** — the id our export writes. Exact, whatever else was edited.
 *  2. **Serial** — when it is unique on both sides. A serial shared by two items
 *     (a data-entry slip) matches nothing rather than the wrong one.
 *  3. **Category + No + Type + Deck + Location**, for lists without either. Ten
 *     identical lifejackets in one locker are paired in order: which physical
 *     jacket is "the third" cannot be known from the sheet, and pairing keeps
 *     ten items ten rather than ten new and ten missing.
 *  4. **Everything else the row says**, for a row with neither a number nor a
 *     location — see `twinKey`.
 * Each existing item is claimed at most once.
 *
 * `covers` limits what can be MISSING, not what can match: a workbook holding
 * only the Liferafts sheet says nothing about the fire detectors, and listing
 * all of them as "not in the file" would put the whole ship one tick away from
 * deletion. Matching still searches every item, so a row finds an item a
 * vessel has since re-filed under another category.
 */
export function planUpdate(
  existing: EquipmentItem[],
  rows: EquipmentItem[],
  covers: (category: CategoryKey) => boolean = () => true
): UpdatePlan {
  const byId = new Map(existing.map((it) => [it.id, it]));
  const claimed = new Set<string>();
  const pairs: Array<[EquipmentItem, EquipmentItem]> = [];
  let pending: EquipmentItem[] = [];
  const matchedBy = { id: 0, serial: 0, details: 0 };

  // 1. MSM ID
  for (const row of rows) {
    const id = (row as any)._msmId as string | undefined;
    const hit = id ? byId.get(id) : undefined;
    if (hit && !claimed.has(hit.id)) {
      claimed.add(hit.id);
      pairs.push([hit, row]);
      matchedBy.id++;
    } else {
      pending.push(row);
    }
  }

  // 2. Serial, unique on both sides
  const count = (list: EquipmentItem[]) => {
    const m = new Map<string, number>();
    for (const it of list) {
      const s = serialKey(it.serial);
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  };
  const free = () => existing.filter((it) => !claimed.has(it.id));
  const itemSerials = count(free());
  const rowSerials = count(pending);
  const bySerial = new Map(free().map((it) => [serialKey(it.serial), it]));
  pending = pending.filter((row) => {
    const s = serialKey(row.serial);
    if (!s || itemSerials.get(s) !== 1 || rowSerials.get(s) !== 1) return true;
    const hit = bySerial.get(s)!;
    claimed.add(hit.id);
    pairs.push([hit, row]);
    matchedBy.serial++;
    return false;
  });

  // 3. Details, paired in order within each identical group
  const groups = new Map<string, EquipmentItem[]>();
  const twins = new Map<string, EquipmentItem[]>();
  for (const it of free()) {
    const k = detailsKey(it);
    if (k) groups.set(k, [...(groups.get(k) ?? []), it]);
    else {
      const t = twinKey(it);
      if (t) twins.set(t, [...(twins.get(t) ?? []), it]);
    }
  }
  const added: EquipmentItem[] = [];
  // A row whose MSM ID names an item no longer in the register (deleted since the
  // export) comes back under that id, so its printed label works again. Seeded
  // with every live id, so it can never collide with one.
  const ids = new Set(existing.map((it) => it.id));
  for (const row of pending) {
    const k = detailsKey(row);
    const t = k ? null : twinKey(row);
    const hit = k ? groups.get(k)?.shift() : t ? twins.get(t)?.shift() : undefined;
    if (hit) {
      claimed.add(hit.id);
      pairs.push([hit, row]);
      matchedBy.details++;
    } else {
      added.push(storable(row, ids));
    }
  }

  const changed: ItemChange[] = [];
  const unchanged: EquipmentItem[] = [];
  for (const [before, row] of pairs) {
    const { after, fields } = applyRow(before, row);
    if (fields.length) changed.push({ before, after, fields });
    else unchanged.push(before);
  }
  const missing = existing.filter((it) => !claimed.has(it.id) && covers(it.category));
  return { changed, unchanged, added, missing, matchedBy };
}

/** The register after the plan, per category. Categories not mentioned stay as they were. */
export function applyPlan(
  existingByCategory: Partial<Record<CategoryKey, EquipmentItem[]>>,
  plan: UpdatePlan,
  removeMissing: boolean
): Partial<Record<CategoryKey, EquipmentItem[]>> {
  const replaced = new Map(plan.changed.map((c) => [c.before.id, c.after]));
  const dropped = new Set(removeMissing ? plan.missing.map((it) => it.id) : []);
  const out: Partial<Record<CategoryKey, EquipmentItem[]>> = {};
  for (const [cat, list] of Object.entries(existingByCategory)) {
    out[cat] = (list ?? []).filter((it) => !dropped.has(it.id)).map((it) => replaced.get(it.id) ?? it);
  }
  for (const it of plan.added) out[it.category] = [...(out[it.category] ?? []), it];
  return out;
}

/**
 * A parsed row made fit to store: the parser's notes removed.
 *
 * Also used by "Replace all": a row that carries an MSM ID keeps that id, so
 * even a full replace of a register exported from this app leaves its printed
 * labels pointing at the same items. `seen` stops a row pasted twice in Excel
 * from producing two items with one id.
 */
export function storable(row: EquipmentItem, seen?: Set<string>): EquipmentItem {
  const { _fields, _msmId, ...rest } = row as any;
  const out = rest as EquipmentItem;
  if (seen && typeof _msmId === 'string' && _msmId && !seen.has(_msmId)) {
    seen.add(_msmId);
    out.id = _msmId;
  }
  return out;
}
