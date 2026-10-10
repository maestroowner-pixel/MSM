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

export interface SopepItem {
  id: string;
  name: string;
  /** Quantity required by the plan. */
  required: number;
  unit?: string;
  location?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

export interface SopepCheck {
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

export interface SopepDrill {
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
