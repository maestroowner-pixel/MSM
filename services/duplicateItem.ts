// ===================================
// "Duplicate" on the item screen — a new item that starts as a copy of this one.
//
// Asked for by a vessel adding its dive cylinders one at a time (8 Oct 2026):
// twelve identical tanks differ only in their serial numbers, and typing the
// type, make, size, deck, location and test dates twelve times is the job this
// replaces.
//
// WHAT IS COPIED is what describes the KIND of item and where it lives. WHAT IS
// NOT is what belongs to the one physical object: its id (the QR label), its
// serial, its photos and documents, its flag and its monthly ticks. Certificates
// link by item id, so none follow — a copy is not covered by a certificate until
// someone says it is. Signed inspections are found by item id too, so the copy
// starts with no history, which is the truth.
//
// The item number moves to the next one not already used in the category
// ("01-DT" → "02-DT"), because two items under one number is the thing a vessel
// that numbers its gear cannot have. A number with no digits to step is left
// empty for the person to fill in.
//
// Pure on purpose: scripts/check-bulk-edit.ts runs it without a phone.
// ===================================

import { EquipmentItem } from '../types/equipment';

/** Fields that belong to the one physical object, never to a copy. */
const OWN = ['serial', 'attachments', 'flagged', 'flagNote', 'monthlyChecks'] as const;

const norm = (v: unknown) => (v == null ? '' : String(v).trim().toLowerCase());

/**
 * The next free number after `no` among `taken`: the LAST run of digits is
 * stepped and keeps its zero padding ("09-DT" → "10-DT", "DT 7" → "DT 8").
 * Returns undefined when there is nothing to step.
 */
export function nextNumber(no: number | string | undefined, taken: Array<number | string | undefined>): number | string | undefined {
  if (no == null || String(no).trim() === '') return undefined;
  const used = new Set(taken.map(norm));
  if (typeof no === 'number') {
    let n = no + 1;
    while (used.has(norm(n))) n++;
    return n;
  }
  const m = no.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return undefined;
  const [, head, digits, tail] = m;
  let n = parseInt(digits, 10) + 1;
  const make = (k: number) => `${head}${String(k).padStart(digits.length, '0')}${tail}`;
  while (used.has(norm(make(n)))) n++;
  return make(n);
}

/** A new, UNSAVED item seeded from `src`. `siblings` is the category it joins. */
export function duplicateItem(src: EquipmentItem, newId: string, siblings: EquipmentItem[], now: number = Date.now()): EquipmentItem {
  const copy: EquipmentItem = { ...src, id: newId, updatedAt: now };
  for (const f of OWN) delete (copy as any)[f];
  const no = nextNumber(src.no, siblings.map((s) => s.no));
  if (no === undefined) delete copy.no;
  else copy.no = no;
  if (src.extra) copy.extra = { ...src.extra };
  return copy;
}
