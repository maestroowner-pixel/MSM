// ===================================
// An item's manual (21 Nov 2026, the owner's idea: "a tag in the crane cabin —
// scan it, the manual opens"). One of the item's attachments is marked as its
// manual; a manual label (msm://manual/<id>, services/crewQr) or an item tag
// written with that payload opens it at once. Phones keep a copy of every
// manual on the device (services/attachments keepManuals), so it opens offline.
// Pure: no imports from React Native.
// ===================================

import { Attachment, EquipmentItem } from '../types/equipment';
import { Machine } from '../types/pms';

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

// ---- a PMS machine's manual (step 2, 21 Nov 2026) ----------------------------
// A machine has no attachments: it keeps one manual of its own (`Machine.manual`).
// The label and the tag are the same msm://manual/<id> as an item's — ids never
// collide (uid with a prefix), so the code finds whichever holds it.

type MachineLike = Pick<Machine, 'id' | 'name' | 'manual' | 'scrapped' | 'location' | 'serial' | 'maker' | 'model'>;

/** The machine's manual as an attachment — what opening, keeping and the menu already take. */
export function machineManual(m?: Pick<Machine, 'id' | 'manual'> | null): Attachment | undefined {
  if (!m?.manual?.url) return undefined;
  return { id: `man_${m.id}`, kind: /^data:image\//i.test(m.manual.url) || /\.(jpe?g|png|heic|webp)$/i.test(m.manual.name) ? 'photo' : 'document', uri: m.manual.url, name: m.manual.name, addedAt: m.manual.addedAt, manual: true };
}

/** Cloud-only machine manuals — what a phone keeps a copy of, beside the items'. */
export const remoteMachineManuals = (machines: Pick<Machine, 'id' | 'manual'>[]): Attachment[] =>
  machines.map(machineManual).filter((a): a is Attachment => !!a && /^https?:/i.test(a.uri));

/**
 * What a manual code opens: the item, else the machine. A scrapped machine's label
 * leads to the unit fitted in its place (`scrapped.replacedBy`, followed to the end):
 * the sticker in the engine room outlives the pump it was put on.
 */
export function manualTarget<I extends { id: string }, M extends MachineLike>(
  id: string, items: I[], machines: M[], scrapped: M[] = [],
): { kind: 'item'; item: I } | { kind: 'machine'; machine: M; via?: M } | null {
  const item = items.find((x) => x.id === id);
  if (item) return { kind: 'item', item };
  const all = [...machines, ...scrapped];
  let m = all.find((x) => x.id === id);
  if (!m) return null;
  const first = m;
  const seen = new Set<string>();
  while (m.scrapped?.replacedBy && !seen.has(m.id)) {
    seen.add(m.id);
    const next = all.find((x) => x.id === m!.scrapped!.replacedBy);
    if (!next) break;
    m = next;
  }
  return m === first ? { kind: 'machine', machine: m } : { kind: 'machine', machine: m, via: first };
}

/**
 * A machine on a label sheet: the label screen draws equipment items, so the machine
 * is put in their shape — the name as the title, its place and serial below, no date
 * and no category (a category the register does not know prints none).
 */
export function machineLabelItem(m: MachineLike): EquipmentItem {
  const type = [m.name, [m.maker, m.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  return { id: m.id, category: 'pms_machine' as EquipmentItem['category'], type, ...(m.serial ? { serial: m.serial } : {}), ...(m.location ? { position: m.location } : {}) } as EquipmentItem;
}
