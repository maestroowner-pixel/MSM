// ===================================
// Check groups — items looked at together and signed off once (Jez, 2 Nov 2026).
//
// "The Chief Mate checks all the crew cabin EEBDs every week — in place, gauge in
// the green. Scanning every one is extra time and administration." And for the
// immersion suits it is worse than slow: they hang side by side in sealed bags,
// and taking each out to reach its label risks the bag the check is about.
//
// So an item may carry a `checkGroup` name ("Crew cabin EEBDs"). Items of one
// category with the same name (case and spacing ignored) are one group, and the
// group is signed ONCE — but the trail still gets ONE RECORD PER ITEM, all with
// the same answers, signer and moment, and `verification.method = 'group'`.
// That is the whole design: the due list, rounds, the report's "not inspected"
// section and each item's history keep working unchanged, and an auditor reads
// "Group check: Crew cabin EEBDs (12 items)" where a scan would have been.
//
// Where the vessel requires a scan, the group is no exception: its own label —
// one sticker on the locker or in the corridor — is scanned once (groupQrPayload),
// and only the Master may sign without it, with a reason, as for an item. The
// person who LOOKED signs; the officer reviewing it closes the round.
//
// A group check cannot FAIL. A fail has to name the unit that is wrong, so the
// signer unticks it instead: it stays outstanding and is inspected on its own,
// where the defect is raised against it.
//
// One category per group, because the checklist is the category's.
//
// Pure on purpose: scripts/check-groups.ts runs it without a phone.
// ===================================

import type { CategoryKey, EquipmentItem } from '../types/equipment';

/** "  Crew  cabin EEBDs " and "crew cabin eebds" are one group. */
export function groupKey(name: string | undefined | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The name as it is shown — tidied, the first spelling met wins. */
export function groupLabel(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export interface CheckGroup {
  /** `<category>|<groupKey>` — unique across the register. */
  id: string;
  category: CategoryKey;
  name: string;
  items: EquipmentItem[];
}

export const checkGroupId = (category: CategoryKey, name: string) => `${category}|${groupKey(name)}`;

/** Every check group in these items, by category then name; items in their given order. */
export function checkGroupsOf(items: EquipmentItem[]): CheckGroup[] {
  const map = new Map<string, CheckGroup>();
  for (const it of items) {
    if (!groupKey(it.checkGroup)) continue;
    const id = checkGroupId(it.category, it.checkGroup!);
    const g = map.get(id);
    if (g) g.items.push(it);
    else map.set(id, { id, category: it.category, name: groupLabel(it.checkGroup!), items: [it] });
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** The group with this id, or null when no item carries it any more. */
export function findGroup(items: EquipmentItem[], id: string): CheckGroup | null {
  return checkGroupsOf(items).find((g) => g.id === id) ?? null;
}

/** Names already used in a category — the suggestions when grouping a selection. */
export function groupNames(items: EquipmentItem[], category: CategoryKey): string[] {
  return checkGroupsOf(items.filter((it) => it.category === category)).map((g) => g.name);
}

/**
 * Put the chosen items into a group (or take them out with an empty name), in
 * place: same ids, so labels, the trail and certificates are untouched. Items
 * already in that group keep their `updatedAt`, so a sync sees no edit.
 */
export function applyGroup(
  items: EquipmentItem[],
  ids: ReadonlySet<string>,
  name: string,
  now: number = Date.now()
): { items: EquipmentItem[]; changed: number } {
  const label = groupLabel(name);
  let changed = 0;
  const out = items.map((it) => {
    if (!ids.has(it.id)) return it;
    if (groupKey(it.checkGroup) === groupKey(label) && (it.checkGroup ?? '') === label) return it;
    changed++;
    const next: EquipmentItem = { ...it, updatedAt: now } as EquipmentItem;
    if (label) next.checkGroup = label;
    else delete next.checkGroup;
    return next;
  });
  return { items: out, changed };
}

/**
 * The group's own label — one sticker where the group is kept: the immersion suit
 * locker door, the cabin corridor (Jez, 2 Nov 2026). Scanned, it is the proof of
 * presence for the whole group, as an item's label is for one item. It carries
 * the group id (category + name), so relabelling an item into the group needs no
 * new sticker; renaming the group does.
 */
export const GROUP_QR_SCHEME = 'msm://group/';
export function groupQrPayload(id: string): string {
  return `${GROUP_QR_SCHEME}${encodeURIComponent(id)}`;
}
export function parseGroupQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= GROUP_QR_SCHEME.length || s.slice(0, GROUP_QR_SCHEME.length).toLowerCase() !== GROUP_QR_SCHEME) return null;
  try {
    return decodeURIComponent(s.slice(GROUP_QR_SCHEME.length)).trim() || null;
  } catch {
    return null;
  }
}

/** The scan-proof key of a group (services/signingPolicy keeps proofs by key). */
export const groupProofKey = (id: string) => `group:${id}`;
