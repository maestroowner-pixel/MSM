// ===================================
// Register sync without "last device to open the app wins".
//
// THE FAILURE (a vessel, 14 Sep 2026): "all of the equipment keeps deleting
// itself when I open the app on a phone, or switch back to the website." The
// register travels as ONE document that is replaced whole, and a device pushed
// its local copy on every connect and on every return to the foreground — before
// it had looked at the vessel's copy. A phone holding an old or empty register
// therefore wrote it over the ship's the moment it was picked up; the website did
// the same on the next tab switch. Nothing was ever compared.
//
// The fix is a BASE: the vessel copy this device last agreed with. From it:
//   - a device whose data has not changed since the base never writes — it only
//     takes what the vessel has;
//   - a device that HAS changed something, while the vessel also moved on, merges
//     three ways (base / mine / vessel) item by item, so an edit on one side and
//     an edit or deletion on the other both survive the way they were meant;
//   - a device with no base at all (just joined, reinstalled) takes the vessel's
//     register and never overwrites a non-empty one.
// The write itself is compare-and-set on `registerUpdatedAt` (firebaseService),
// so two devices merging at once cannot both "win".
//
// Pure: no storage, no Firebase — scripts/check-register-update.ts runs it.
// ===================================

import { EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { normalizeCompressorState } from '../types/compressor';

export interface RegisterParts {
  categories: Record<string, EquipmentItem[]>;
  vessel_info?: any;
  certificates?: Certificate[];
  compressor?: any;
}

export type Part = 'categories' | 'vessel_info' | 'certificates' | 'compressor';
export const PARTS: Part[] = ['categories', 'vessel_info', 'certificates', 'compressor'];
export type PartHashes = Record<Part, string>;

/** What this device last agreed with the vessel on. Stored per device. */
export interface SyncBase {
  /** The vessel copy's `registerUpdatedAt` at that moment. */
  cloudAt: number;
  /** The vessel copy itself, as JSON — the "base" of a three-way merge. */
  cloudJson: string;
  /** This device's data at that moment, hashed per part — "has anything changed here?" */
  local: PartHashes;
}

/** Same data, same string: empty buckets dropped, keys sorted, absent = empty. */
function canonical(blob: RegisterParts): Record<Part, unknown> {
  const cats: Record<string, EquipmentItem[]> = {};
  for (const key of Object.keys(blob.categories ?? {}).sort()) {
    const list = blob.categories[key];
    if (Array.isArray(list) && list.length) cats[key] = list;
  }
  return {
    categories: cats,
    vessel_info: blob.vessel_info ?? null,
    certificates: blob.certificates ?? [],
    compressor: normalizeCompressorState(blob.compressor ?? null),
  };
}

/** djb2 over JSON — a change detector, not a security measure. */
function hash(value: unknown): string {
  const s = JSON.stringify(value) ?? '';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

export function partHashes(blob: RegisterParts): PartHashes {
  const c = canonical(blob);
  return {
    categories: hash(c.categories),
    vessel_info: hash(c.vessel_info),
    certificates: hash(c.certificates),
    compressor: hash(c.compressor),
  };
}

/** Which parts of this device's data differ from the base. */
export function changedParts(local: RegisterParts, base: PartHashes): Record<Part, boolean> {
  const now = partHashes(local);
  return {
    categories: now.categories !== base.categories,
    vessel_info: now.vessel_info !== base.vessel_info,
    certificates: now.certificates !== base.certificates,
    compressor: now.compressor !== base.compressor,
  };
}

export function anyChanged(c: Record<Part, boolean>): boolean {
  return PARTS.some((p) => c[p]);
}

export function itemCount(blob: RegisterParts | null | undefined): number {
  return Object.values(blob?.categories ?? {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
}

type Keyed = { id: string; updatedAt?: number };

/**
 * Three-way merge of one list by id.
 *
 *  - on both sides: whichever side changed it since the base wins; if both did,
 *    the later `updatedAt` (a tie goes to the vessel, which already has it);
 *  - only here: new here → kept; was in the base, so the vessel deleted it →
 *    kept only if it was edited here since (an edit is a stronger statement than
 *    a deletion nobody on this device saw);
 *  - only on the vessel: the mirror image;
 *  - only in the base: deleted on both sides → gone.
 *
 * Order: this device's order, then what only the vessel has, in its order.
 */
export function mergeById<T extends Keyed>(base: T[], mine: T[], theirs: T[]): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const m = new Map(mine.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  const same = (x?: T, y?: T) => hash(x ?? null) === hash(y ?? null);
  const out: T[] = [];

  for (const x of mine) {
    const was = b.get(x.id);
    const other = t.get(x.id);
    if (other) {
      const iChanged = !same(x, was);
      const theyChanged = !same(other, was);
      if (iChanged && !theyChanged) out.push(x);
      else if (theyChanged && !iChanged) out.push(other);
      else out.push((x.updatedAt ?? 0) > (other.updatedAt ?? 0) ? x : other);
    } else if (!was || !same(x, was)) {
      out.push(x);
    }
  }
  for (const y of theirs) {
    if (m.has(y.id)) continue;
    const was = b.get(y.id);
    if (!was || !same(y, was)) out.push(y);
  }
  return out;
}

/**
 * One item, one category — after the buckets have been merged separately.
 *
 * `mergeById` runs per category, and cannot see across them. That is fine until
 * an item MOVES (services/storage `moveItem`): the move is a deletion from one
 * bucket and an insertion into another, and if the other device edited that item
 * in its old category before hearing about the move, the deletion is out-voted by
 * the edit and the item survives in both. Two rows, one id, two categories — the
 * grid shows it twice and neither copy is wrong on its own.
 *
 * The newest `updatedAt` wins, which is the move: it stamps the item on its way
 * across, so a move beats an edit made before it and loses to one made after.
 */
function dedupeAcrossCategories(
  categories: Record<string, EquipmentItem[]>
): Record<string, EquipmentItem[]> {
  const best = new Map<string, { key: string; at: number }>();
  for (const [key, items] of Object.entries(categories)) {
    for (const it of items) {
      const seen = best.get(it.id);
      if (!seen || (it.updatedAt ?? 0) > seen.at) best.set(it.id, { key, at: it.updatedAt ?? 0 });
    }
  }
  const out: Record<string, EquipmentItem[]> = {};
  for (const [key, items] of Object.entries(categories)) {
    out[key] = items.filter((it) => best.get(it.id)?.key === key);
  }
  return out;
}

/**
 * Merge the whole register. Items and certificates merge by id; the vessel
 * details and the compressor log are single records, so they are taken from
 * this device when it changed them and from the vessel otherwise.
 */
export function mergeRegister(
  base: RegisterParts,
  mine: RegisterParts,
  theirs: RegisterParts,
  changedHere: Record<Part, boolean>
): RegisterParts {
  const keys = new Set([
    ...Object.keys(base.categories ?? {}),
    ...Object.keys(mine.categories ?? {}),
    ...Object.keys(theirs.categories ?? {}),
  ]);
  const categories: Record<string, EquipmentItem[]> = {};
  for (const k of keys) {
    categories[k] = changedHere.categories
      ? mergeById(base.categories?.[k] ?? [], mine.categories?.[k] ?? [], theirs.categories?.[k] ?? [])
      : theirs.categories?.[k] ?? [];
  }
  return {
    categories: dedupeAcrossCategories(categories),
    vessel_info: changedHere.vessel_info ? mine.vessel_info : theirs.vessel_info ?? mine.vessel_info,
    certificates: changedHere.certificates
      ? mergeById(base.certificates ?? [], mine.certificates ?? [], theirs.certificates ?? [])
      : theirs.certificates ?? mine.certificates,
    compressor: changedHere.compressor ? mine.compressor : theirs.compressor ?? mine.compressor,
  };
}

// ---- Decisions ---------------------------------------------------------------
// What a pull and a push should DO, as pure functions — so the rules above can be
// driven through whole scenarios (two devices, one vessel) without Firebase, and
// firebaseService only carries them out.

export type PullDecision =
  /** The vessel copy is the one this device is based on. */
  | { kind: 'current'; needsPush: boolean }
  /** Take the vessel's copy as it is. */
  | { kind: 'take' }
  /** An empty vessel register over a device that has never synced and holds items. */
  | { kind: 'refuse-empty' }
  /** Both sides changed since the base. */
  | { kind: 'merge'; changed: Record<Part, boolean> };

export function decidePull(
  base: SyncBase | null,
  local: RegisterParts,
  cloudAt: number,
  cloud: RegisterParts
): PullDecision {
  if (base && base.cloudAt === cloudAt) return { kind: 'current', needsPush: anyChanged(changedParts(local, base.local)) };
  if (!base) {
    if (itemCount(cloud) === 0 && itemCount(local) > 0) return { kind: 'refuse-empty' };
    if (itemCount(local) === 0) return { kind: 'take' };
    // Both hold a register and nothing says which is newer. This is every device
    // on its first sync after the update that introduced the base — including a
    // website holding the good copy while the vessel holds a phone's stale one.
    // Taking the vessel's would finish off exactly the loss this file exists to
    // stop, so the two are UNITED by id (an empty base: nothing counts as
    // deleted). The worst case is an item that should be gone showing up again,
    // which anyone can see and delete; a missing item nobody notices.
    // The vessel's details and compressor log are the vessel's.
    return {
      kind: 'merge',
      changed: { categories: true, certificates: true, vessel_info: false, compressor: false },
    };
  }
  const changed = changedParts(local, base.local);
  return anyChanged(changed) ? { kind: 'merge', changed } : { kind: 'take' };
}

export type PushDecision = 'write' | 'skip' | 'conflict';

export function decidePush(
  base: SyncBase | null,
  local: RegisterParts,
  cloudAt: number,
  cloud: RegisterParts | null,
  force: boolean
): PushDecision {
  if (force) return 'write';
  if (!base) return itemCount(cloud) > 0 ? 'skip' : 'write';
  if (!anyChanged(changedParts(local, base.local))) return 'skip';
  return cloudAt === base.cloudAt ? 'write' : 'conflict';
}

// ---- Buckets this build cannot name ------------------------------------------
//
// A build knows a fixed set of categories: the built-ins, plus the vessel's own
// once the categories collection has been read, plus a module's if that module is
// switched on (constants/modules.ts). The REGISTER, though, is one document for
// the whole vessel, and the other devices may know more categories than this one
// does — a module on where this build has it off, a vessel category created an
// hour ago and not yet received.
//
// Those buckets must survive a round trip through this device untouched. It never
// draws them, never merges them item by item and never asks what is in them; it
// only refuses to claim they do not exist. Leaving them out of an outgoing
// register is indistinguishable from deleting them, and the next device to pull
// deletes them for everybody.

/** Bucket keys in a pulled register that this build has no heading for. */
export function foreignKeys(known: string[], blob: RegisterParts): string[] {
  const k = new Set(known);
  return Object.keys(blob.categories ?? {})
    .filter((key) => !k.has(key) && (blob.categories?.[key]?.length ?? 0) > 0)
    .sort();
}

/**
 * The register this device sends: its own buckets, with the unnameable ones
 * carried through. `own` wins on any key it holds — a bucket this build CAN read
 * is its own business, and a stale copy must never shadow it.
 */
export function outgoingRegister(own: RegisterParts, foreign: Record<string, EquipmentItem[]>): RegisterParts {
  const categories: Record<string, EquipmentItem[]> = { ...(own.categories ?? {}) };
  for (const [key, items] of Object.entries(foreign)) {
    if (categories[key] === undefined) categories[key] = items;
  }
  return { ...own, categories };
}
