// ===================================
// "Set dates" on several items at once — the multi-select on a category list.
//
// Asked for by a vessel (8 Oct 2026) for the weeks after annual servicing, when
// thirty or forty items come back with the same inspection date and the same
// next one. Opening each item to change one date is the job this replaces.
//
// It edits the items IN PLACE: same id, so the printed QR labels still resolve;
// attachments, certificate links (a certificate links by item id), flags and the
// signed inspection trail are never touched. Only the fields the person filled
// in change — a date left blank keeps every item's own date, because "the same
// next inspection" rarely means "and wipe the expiries too".
//
// Pure on purpose: scripts/check-bulk-edit.ts runs it without a phone.
// ===================================

import { EquipmentItem } from '../types/equipment';

export interface BulkPatch {
  /**
   * ISO YYYY-MM-DD sets it; `null` CLEARS it on every chosen item (a date put in
   * the wrong field across a batch — asked for 8 Oct 2026); left out = each item
   * keeps its own.
   */
  nextInspection?: string | null;
  expiry?: string | null;
  /** Added under the item's existing comments, never written over them. */
  note?: string;
}

export const isEmptyPatch = (p: BulkPatch) =>
  p.nextInspection === undefined && p.expiry === undefined && !p.note?.trim();

/**
 * The category's items with the patch applied to the chosen ones, in the same
 * order, plus how many actually changed (an item already holding the date is
 * left alone, and its `updatedAt` too, so a sync does not see an edit).
 */
export function applyBulk(
  items: EquipmentItem[],
  ids: ReadonlySet<string>,
  patch: BulkPatch,
  now: number = Date.now()
): { items: EquipmentItem[]; changed: number } {
  const note = patch.note?.trim();
  let changed = 0;
  const out = items.map((it) => {
    if (!ids.has(it.id)) return it;
    const next: EquipmentItem = { ...it };
    for (const f of ['nextInspection', 'expiry'] as const) {
      const v = patch[f];
      // Deleted, not set to '': complianceDate falls back with `??`.
      if (v === null) delete next[f];
      else if (v) next[f] = v;
    }
    if (note) {
      const old = it.remarks?.trim();
      // The same note twice (a second tap of Apply) is one note.
      if (!old?.split('\n').some((line) => line.trim() === note)) next.remarks = old ? `${old}\n${note}` : note;
    }
    const same =
      next.nextInspection === it.nextInspection && next.expiry === it.expiry && next.remarks === it.remarks;
    if (same) return it;
    changed++;
    return { ...next, updatedAt: now };
  });
  return { items: out, changed };
}
