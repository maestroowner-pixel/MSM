// ===================================
// SOPEP — the Shipboard Oil Pollution Emergency Plan's equipment and drills
// (MARPOL Annex I reg. 37). Asked for on 10 Oct 2026: "the SOPEP locker
// inventory, and the drills, marked there too".
//
//   SopepItem    one line of the locker: what, how many must be there, where.
//   SopepCheck   an inventory check — what was counted, line by line, signed.
//                Append-only: each check stays as it was done.
//   SopepDrill   an oil-spill drill — scenario, who took part, lessons, signed.
//                Append-only.
// ===================================

import type { SignProof } from '../services/signature';

import type { Versioned } from '../services/versions';
/**
 * A SOPEP locker — a vessel may keep several (engine room, bow, bunker station),
 * each named and placed, each with a QR label that opens its contents when
 * scanned (14 Oct 2026, as InventoryLens does it: the QR carries the locker's
 * short id only — msm://sopep/<id> — so a renamed or moved locker keeps its
 * label).
 */
export interface SopepLocker {
  id: string;
  name: string;
  /** The short ID on its label and typed to open it — SP-01 (15 Oct 2026, as the stores'). */
  code?: string;
  location?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

/** The locker every item belonged to before there were several — the one an item with no `lockerId` is in. */
export const MAIN_LOCKER = 'main';
export const lockerOf = (i: Pick<SopepItem, 'lockerId'>) => i.lockerId || MAIN_LOCKER;

/** The vessel's lockers, in order — the first one ("SOPEP locker") there even before it is saved. */
export function sopepLockers(list: SopepLocker[]): SopepLocker[] {
  const live = list.filter((l) => !l.deleted);
  const main = live.find((l) => l.id === MAIN_LOCKER) ?? { id: MAIN_LOCKER, name: 'SOPEP locker', order: 0, updatedAt: 0 };
  return [main, ...live.filter((l) => l.id !== MAIN_LOCKER)].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** The first locker's ID until one is given. */
export const MAIN_LOCKER_CODE = 'SP-01';
/** A locker's ID — its own, or SP-01 for the first. */
export const lockerCode = (l: Pick<SopepLocker, 'id' | 'code'>) => l.code || (l.id === MAIN_LOCKER ? MAIN_LOCKER_CODE : '');
/** The next free ID — SP-02 after SP-01. */
export function nextLockerCode(list: Pick<SopepLocker, 'id' | 'code'>[]): string {
  const taken = new Set(list.map((l) => lockerCode(l).toUpperCase()));
  for (let n = 1; ; n++) {
    const c = `SP-${String(n).padStart(2, '0')}`;
    if (!taken.has(c)) return c;
  }
}

export interface SopepItem {
  id: string;
  name: string;
  /** Which locker (SopepLocker id); absent = the first, MAIN_LOCKER. */
  lockerId?: string;
  /** Quantity required by the plan. */
  required: number;
  unit?: string;
  location?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

export interface SopepCheck extends Versioned {
  id: string;
  date: string;
  /** Counted quantity by item id. */
  counted: Record<string, number>;
  /** Item ids found damaged / expired / to replace. */
  defective?: string[];
  remarks?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export interface SopepDrill extends Versioned {
  id: string;
  date: string;
  time?: string;
  scenario: string;
  participants: string[];
  minutes?: number;
  /** What went well, what to improve, actions. */
  lessons?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

/** A typical yacht SOPEP locker — a starting list the vessel edits to its plan. */
export const SOPEP_STARTER: { name: string; required: number; unit?: string }[] = [
  { name: 'Oil absorbent pads', required: 100, unit: 'pcs' },
  { name: 'Oil absorbent socks / booms', required: 6, unit: 'pcs' },
  { name: 'Oil absorbent granules / sawdust', required: 2, unit: 'bags' },
  { name: 'Oil absorbent roll', required: 1, unit: 'roll' },
  { name: 'Scupper plugs', required: 6, unit: 'pcs' },
  { name: 'Plastic scoops / shovels', required: 2, unit: 'pcs' },
  { name: 'Buckets', required: 2, unit: 'pcs' },
  { name: 'Squeegees', required: 2, unit: 'pcs' },
  { name: 'Empty drum / container for oily waste', required: 1, unit: 'pcs' },
  { name: 'Heavy-duty waste bags', required: 20, unit: 'pcs' },
  { name: 'Chemical-resistant gloves', required: 4, unit: 'pairs' },
  { name: 'Safety goggles', required: 2, unit: 'pcs' },
  { name: 'Disposable coveralls', required: 4, unit: 'pcs' },
  { name: 'Rubber boots', required: 2, unit: 'pairs' },
  { name: 'Hand cleaner / degreaser (approved)', required: 1, unit: 'pcs' },
  { name: 'Portable pump for oil transfer', required: 1, unit: 'pcs' },
];
