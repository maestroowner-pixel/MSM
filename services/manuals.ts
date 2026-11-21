// ===================================
// An item's manual (21 Nov 2026, the owner's idea: "a tag in the crane cabin —
// scan it, the manual opens"). One of the item's attachments is marked as its
// manual; a manual label (msm://manual/<id>, services/crewQr) or an item tag
// written with that payload opens it at once. Phones keep a copy of every
// manual on the device (services/attachments keepManuals), so it opens offline.
// Pure: no imports from React Native.
// ===================================

import { Attachment, EquipmentItem } from '../types/equipment';

/** The attachment marked as the item's manual. */
export const manualOf = (item?: Pick<EquipmentItem, 'attachments'> | null): Attachment | undefined =>
  item?.attachments?.find((a) => a.manual);

/** The list with `id` as the only manual — or none, with null. */
export function markManual(list: Attachment[] = [], id: string | null): Attachment[] {
  return list.map((a) => {
    const on = a.id === id;
    if (!!a.manual === on) return a;
    const { manual: _drop, ...rest } = a;
    return on ? { ...rest, manual: true } : rest;
  });
}

/** Manuals that live in the cloud only (a link) — what a phone should keep a copy of. */
export const remoteManuals = (items: Pick<EquipmentItem, 'attachments'>[]): Attachment[] =>
  items.map(manualOf).filter((a): a is Attachment => !!a && /^https?:/i.test(a.uri));
