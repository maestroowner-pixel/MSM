// ===================================
// Garbage Record Book, Part I — MARPOL Annex V, form as revised by
// resolution MEPC.295(71) (in force 1 March 2018).
//
// Every discharge into the sea, delivery to a reception facility and
// incineration is an entry: date and time, the ship's position (or the port),
// the category, the estimated amount in m³, how it went, and the signature of
// the officer in charge. The Master signs each completed page — here, each
// month. Part II (cargo residues) does not apply to a yacht and is left out.
//
// Entries are append-only, as in the paper book: a mistake is put right by a
// further entry that says what it corrects, never by changing the first.
// ===================================

import type { SignProof } from '../services/signature';

/** MARPOL Annex V categories for Part I. */
export type GarbageCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export const GARBAGE_CATEGORY: Record<GarbageCategory, string> = {
  A: 'Plastics',
  B: 'Food wastes',
  C: 'Domestic wastes',
  D: 'Cooking oil',
  E: 'Incinerator ashes',
  F: 'Operational wastes',
  G: 'Animal carcass(es)',
  H: 'Fishing gear',
  I: 'E-waste',
};

export type GarbageMethod = 'shore' | 'sea' | 'incineration' | 'accidental';

export const GARBAGE_METHOD: Record<GarbageMethod, string> = {
  shore: 'To reception facility',
  sea: 'Discharged into sea',
  incineration: 'Incinerated',
  accidental: 'Accidental / exceptional discharge or loss',
};

export interface GarbageEntry {
  id: string;
  /** yyyy-mm-dd and hh:mm, ship's time. */
  date: string;
  time: string;
  category: GarbageCategory;
  method: GarbageMethod;
  /** Estimated amount, m³. */
  volume: number;
  /** In port: its name. */
  port?: string;
  /** At sea: position as written ("38°45.2'N 002°10.6'E"). */
  position?: string;
  /** At sea: distance from the nearest land, nautical miles. */
  distanceNm?: number;
  /** Food waste comminuted / ground to < 25 mm (allows 3 nm instead of 12). */
  comminuted?: boolean;
  /** Reception facility receipt number. */
  receiptNo?: string;
  /** Garbage container / skip / bin number (on board or at the facility). */
  containerNo?: string;
  remarks?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

/** The Master's signature for a month's page(s). */
export interface GarbageMasterSign {
  /** `grb_<yyyy-mm>` */
  id: string;
  month: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}
