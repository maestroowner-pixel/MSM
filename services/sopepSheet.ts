// ===================================
// A SOPEP locker's list from Excel (15 Oct 2026, the gear on SOPEP: "load the
// locker's list from xlsx", as InventoryLens fills a locker). Pure — check:gangway
// tests it.
//
// Columns are found by their heading, in any order and under the names people
// use: Item / Name / Description, Quantity / Required / Qty, Unit, Location /
// Shelf / Place. A line is matched to the locker's list by its name — the
// quantity, unit and place updated — or added.
// ===================================

import { SopepItem, lockerOf } from '../types/sopep';
import { uid } from '../utils/id';

export const SOPEP_HEAD = ['Item ★', 'Quantity required', 'Unit', 'Place in the locker'];

export const sopepTemplateRows = (): unknown[][] => [SOPEP_HEAD, ['Example: Oil absorbent pads', 100, 'pcs', 'Shelf 1']];

const norm = (s: string) => s.toLowerCase().replace(/[★*:]/g, '').replace(/\s+/g, ' ').trim();
const ALIASES: Record<'name' | 'qty' | 'unit' | 'place', string[]> = {
  name: ['item', 'name', 'description', 'equipment', 'article'],
  qty: ['quantity required', 'required', 'quantity', 'qty', 'number', 'no.', 'amount'],
  unit: ['unit', 'uom', 'units'],
  place: ['place in the locker', 'place', 'location', 'shelf', 'where', 'stowage'],
};

export interface SopepLine { name: string; required?: number; unit?: string; location?: string }

export function readSopepSheet(rows: unknown[][]): SopepLine[] {
  const find = (head: string[], k: keyof typeof ALIASES) => {
    for (const a of ALIASES[k]) { const i = head.findIndex((h) => h === a); if (i >= 0) return i; }
    for (const a of ALIASES[k]) { const i = head.findIndex((h) => h.startsWith(a)); if (i >= 0) return i; }
    return -1;
  };
  const headAt = rows.findIndex((r) => { const h = ((r ?? []) as unknown[]).map((c) => norm(String(c ?? ''))); return find(h, 'name') >= 0 && find(h, 'qty') >= 0; });
  if (headAt < 0) throw new Error('No "Item" column with "Quantity" beside it — use the SOPEP template.');
  const head = (rows[headAt] as unknown[]).map((c) => norm(String(c ?? '')));
  const at = { name: find(head, 'name'), qty: find(head, 'qty'), unit: find(head, 'unit'), place: find(head, 'place') };
  const txt = (r: unknown[], i: number) => (i < 0 || r[i] == null ? '' : String(r[i]).trim());
  const out: SopepLine[] = [];
  for (const r of rows.slice(headAt + 1) as unknown[][]) {
    const name = txt(r ?? [], at.name).replace(/\s+/g, ' ');
    if (!name || /^example\b/i.test(name)) continue;
    const q = Number(txt(r, at.qty).replace(',', '.'));
    out.push({ name, ...(txt(r, at.qty) && Number.isFinite(q) ? { required: q } : {}), ...(txt(r, at.unit) ? { unit: txt(r, at.unit) } : {}), ...(txt(r, at.place) ? { location: txt(r, at.place) } : {}) });
  }
  return out;
}

/** The lines into one locker: matched by name there, or added to it. */
export function planSopepImport(lines: SopepLine[], items: SopepItem[], lockerId: string, mainId: string, now = Date.now()) {
  const key = (n: string) => n.trim().toLowerCase();
  const have = new Map(items.filter((i) => !i.deleted && lockerOf(i) === lockerId).map((i) => [key(i.name), i]));
  const save: SopepItem[] = [];
  const added: string[] = [];
  const updated: string[] = [];
  let order = items.length;
  for (const l of lines) {
    const old = have.get(key(l.name));
    const it: SopepItem = {
      ...(old ?? { id: uid('sop'), name: l.name, required: 0, order: order++, ...(lockerId !== mainId ? { lockerId } : {}) }),
      ...(l.required != null ? { required: l.required } : {}),
      ...(l.unit ? { unit: l.unit } : {}),
      ...(l.location ? { location: l.location } : {}),
      updatedAt: now,
    } as SopepItem;
    save.push(it);
    have.set(key(it.name), it);
    (old ? updated : added).push(it.name);
  }
  return { save, added, updated };
}
