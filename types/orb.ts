// ===================================
// Oil Record Book, Part I — machinery space operations (MARPOL Annex I,
// Appendix III; form as amended by MEPC.187(59)). Asked to follow the Garbage
// Record Book (10–11 Oct 2026).
//
// One entry is one operation under one code, with the item numbers the form
// uses; `text` is the line as it reads in the book. Signed by the officer in
// charge; the Master signs each month. Changed or deleted only by the Master,
// with the reason, as a new version (services/versions).
// ===================================

import type { SignProof } from '../services/signature';
import type { Versioned } from '../services/versions';

export type OrbCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export const ORB_CODE: Record<OrbCode, string> = {
  A: 'Ballasting or cleaning of oil fuel tanks',
  B: 'Discharge of dirty ballast or cleaning water from oil fuel tanks',
  C: 'Collection, transfer and disposal of oil residues (sludge)',
  D: 'Non-automatic discharge overboard, transfer or disposal of bilge water',
  E: 'Automatic discharge overboard or disposal of bilge water',
  F: 'Condition of the oil filtering equipment',
  G: 'Accidental or other exceptional discharges of oil',
  H: 'Bunkering of fuel or bulk lubricating oil',
  I: 'Additional operational procedures and general remarks',
};

/** How bilge water / residues went (D 15, C 12). */
export type OrbMethod = 'ows' | 'holding' | 'shore' | 'incinerator' | 'tank';
export const ORB_METHOD: Record<OrbMethod, string> = {
  ows: 'Through 15 ppm equipment overboard',
  holding: 'Transferred to holding / sludge tank',
  shore: 'To reception facility',
  incinerator: 'Incinerated',
  tank: 'Transferred to another tank',
};

export interface OrbEntry extends Versioned {
  id: string;
  date: string;
  time?: string;
  code: OrbCode;
  /** Tank(s) concerned. */
  tank?: string;
  /** m³ (or tonnes for H, as `unit`). */
  quantity?: number;
  unit?: 'm3' | 't';
  /** C 11: sludge retained in the tank, m³. */
  retained?: number;
  method?: OrbMethod;
  /** Ship's position or port. */
  place?: string;
  /** D 14 / E / F: start and stop, hh:mm. */
  start?: string;
  stop?: string;
  /** H: grade of oil (MGO, lube oil SAE 40…), and the BDN. */
  grade?: string;
  bdnNo?: string;
  /** Reception facility receipt (C 12, D 15.3). */
  receiptNo?: string;
  remarks?: string;
  /** The line as it reads in the book (services/orb orbText). */
  text: string;
  by: string;
  byRank?: string;
  /** The signer's id (crew id or `device:<id>`) — the user ID a true copy prints (MEPC.312 §6.3). */
  byId?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export interface OrbMasterSign {
  /** `orb_<yyyy-mm>` */
  id: string;
  month: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  /** The entry versions this signature verified (services/verification) — absent before 2.68. */
  covers?: string[];
  /** contentHash of each covered version (services/seal), since 2.69. */
  coverHashes?: string[];
  /** The Master's id — checked against the key register. */
  byId?: string;
  updatedAt: number;
}
