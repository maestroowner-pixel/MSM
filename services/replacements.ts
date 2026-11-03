// ===================================
// Equipment replaced (Sven, 3 Nov 2026): "the auditor will check records of
// replaced items, defects we found on our monthly rounds". Before this a
// replacement was an edit — the new serial and expiry typed over the old ones,
// and nothing left to show that the EEBD in cabin 4 is not the one of last year.
//
// A replacement is an ItemMovement (`dir: 'replaced'`) in the item's lifecycle:
// append-only, signed, synced with the rest (`item_movements`, officers). It
// records the whole unit or one part (battery, cartridge, light…), why, and the
// details before → after; the same signature writes the new details onto the
// item, which keeps its id — the label on the bulkhead still points at it. When
// the item has an open defect, the replacement may close it in the same step.
//
// Pure; `npm run check:replacements`.
// ===================================

import type { EquipmentItem } from '../types/equipment';
import type { ItemMovement, ReplaceSnap } from '../types/movement';
import type { SignProof } from './signature';

export type ReplaceReason = 'expired' | 'defect' | 'used' | 'lost' | 'service' | 'other';
export const REPLACE_REASONS: ReplaceReason[] = ['expired', 'defect', 'used', 'lost', 'service', 'other'];
export const REASON_EN: Record<ReplaceReason, string> = {
  expired: 'Expired',
  defect: 'Defective',
  used: 'Used',
  lost: 'Lost or missing',
  service: 'Service exchange',
  other: 'Other',
};

/** Parts commonly replaced on safety equipment — offered as chips; any other may be typed. */
export const COMMON_PARTS = ['Battery', 'Light', 'Cartridge / cylinder', 'Hydrostatic release', 'Firing head', 'Hose / nozzle', 'Bag / case'];

export const SNAP_KEYS: (keyof ReplaceSnap)[] = ['make', 'type', 'serial', 'manufactureDate', 'nextInspection', 'expiry'];
const DATE_KEYS = new Set<keyof ReplaceSnap>(['manufactureDate', 'nextInspection', 'expiry']);
const LABEL: Record<keyof ReplaceSnap, string> = { make: 'make', type: 'type', serial: 'serial', manufactureDate: 'made', nextInspection: 'next inspection', expiry: 'expiry' };

export interface ReplaceForm {
  what: 'unit' | 'part';
  /** The part, when not the whole unit. */
  part?: string;
  reason: ReplaceReason;
  /** yyyy-mm-dd */
  date: string;
  note?: string;
  /** The new details, as typed; blank = unchanged. */
  after: ReplaceSnap;
  /** Close this inspection's open defect with the same signature. */
  defectInspId?: string;
}

export function snapOf(it: EquipmentItem): ReplaceSnap {
  const out: ReplaceSnap = {};
  for (const k of SNAP_KEYS) {
    const v = it[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** What the form changes: before and after of each field typed with a new value. */
export function changesOf(it: EquipmentItem, after: ReplaceSnap): { before: ReplaceSnap; after: ReplaceSnap } {
  const was = snapOf(it);
  const b: ReplaceSnap = {};
  const a: ReplaceSnap = {};
  for (const k of SNAP_KEYS) {
    const v = after[k]?.trim();
    if (!v || v === was[k]) continue;
    a[k] = v;
    if (was[k]) b[k] = was[k];
  }
  return { before: b, after: a };
}

/** Why the form cannot be signed yet, or null. */
export function formProblem(it: EquipmentItem, f: ReplaceForm): 'part' | 'nothing' | 'date' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'date';
  if (f.what === 'part' && !f.part?.trim()) return 'part';
  // A whole unit replaced with nothing about the new one (no serial, no dates) leaves
  // nothing an auditor could match to the equipment in front of him.
  if (f.what === 'unit' && !Object.keys(changesOf(it, f.after).after).length) return 'nothing';
  return null;
}

const snapLabel = (it: EquipmentItem) => [it.no, it.type ?? it.make].filter((x) => x != null && String(x).trim()).join(' ');

/** The signed record and the item as it is now. */
export function replace(
  it: EquipmentItem,
  f: ReplaceForm,
  by: { name: string; rank?: string },
  now: number,
  newId: (prefix: string) => string,
  proof?: SignProof
): { movement: ItemMovement; item: EquipmentItem } {
  const problem = formProblem(it, f);
  if (problem) throw new Error(problem);
  const { before, after } = changesOf(it, f.after);
  const movement: ItemMovement = {
    id: newId('repl'),
    itemId: it.id,
    itemCategory: it.category,
    itemSnap: snapLabel(it),
    dir: 'replaced',
    date: f.date,
    reason: REASON_EN[f.reason],
    ...(f.what === 'part' ? { part: f.part!.trim() } : {}),
    ...(Object.keys(before).length ? { before } : {}),
    ...(Object.keys(after).length ? { after } : {}),
    ...(f.note?.trim() ? { notes: f.note.trim() } : {}),
    ...(f.defectInspId ? { defectInspId: f.defectInspId } : {}),
    by: by.name,
    ...(by.rank ? { byRank: by.rank } : {}),
    ...(proof ? { signedWith: proof } : {}),
    updatedAt: now,
  };
  return { movement, item: { ...it, ...after, updatedAt: now } as EquipmentItem };
}

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const show = (k: keyof ReplaceSnap, v?: string) => (v ? (DATE_KEYS.has(k) ? dmy(v) : v) : '—');

/** "Unit replaced" / "Battery replaced" — English: it is printed in the report. */
export const whatLine = (m: Pick<ItemMovement, 'part'>) => (m.part ? `${m.part} replaced` : 'Unit replaced');

/** "serial A123 → B456; expiry 01.03.2026 → 01.03.2031" */
export function changeLine(m: Pick<ItemMovement, 'before' | 'after'>): string {
  return SNAP_KEYS.filter((k) => m.after?.[k])
    .map((k) => `${LABEL[k]} ${show(k, m.before?.[k])} → ${show(k, m.after![k])}`)
    .join('; ');
}

/** Replacements of these items dated inside [from, to] (yyyy-mm-dd), oldest first. */
export function replacedIn(movements: ItemMovement[], itemIds: Set<string>, from: string, to: string): ItemMovement[] {
  return movements
    .filter((m) => m.dir === 'replaced' && !m.deleted && itemIds.has(m.itemId) && m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt);
}
