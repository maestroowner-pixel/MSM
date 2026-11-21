// ===================================
// Record books kept the same way — one screen, one record shape, a spec per
// book (services/logbooks.ts). Sewage (MARPOL Annex IV) and Ballast Water
// (BWM Convention, Appendix II), asked for on 11 Oct 2026 after the Oil and
// Garbage Record Books. Fuel oil changeover (MARPOL Annex VI reg. 14.6) and
// the ODS Record Book (Annex VI reg. 12.6) joined on 26 Oct 2026, for flag
// approval of the electronic record books.
//
// One entry is one operation under one code; `text` is the line as it reads in
// the book. Signed by the officer in charge; the Master signs each month and
// alone changes or deletes an entry, as a new version (services/versions).
// ===================================

import type { SignProof } from '../services/signature';
import type { Versioned } from '../services/versions';

export type BookKey = 'sewage' | 'ballast' | 'fuelChange' | 'ods';

/** Every field a book's codes may ask for. */
export type LogField = 'tank' | 'quantity' | 'method' | 'place' | 'placeEnd' | 'start' | 'stop' | 'distance' | 'speed' | 'depth' | 'treated' | 'receiptNo' | 'sulphur' | 'equipment' | 'substance' | 'mass' | 'rob' | 'bwmp' | 'treatment' | 'facility' | 'area';

export interface LogEntry extends Versioned {
  id: string;
  book: BookKey;
  date: string;
  time?: string;
  code: string;
  /** The ship's zone of `date`/`time` ("+02:00"), frozen when signed (utils/shipTime entryZone); since 2.77. */
  shipOffset?: string;
  tank?: string;
  /** m³ */
  quantity?: number;
  method?: string;
  /** Position or port (at the start). */
  place?: string;
  /** Position at the end (exchange, discharge). */
  placeEnd?: string;
  start?: string;
  stop?: string;
  /** Distance from the nearest land, nm. */
  distance?: number;
  /** Ship's speed, knots. */
  speed?: number;
  /** Water depth, m. */
  depth?: number;
  /** Treated by the approved system (BWMS / STP). */
  treated?: boolean;
  receiptNo?: string;
  /** Sulphur content of the fuel changed to, % m/m. */
  sulphur?: number;
  /** The equipment an ODS entry concerns (as in the IAPP list). */
  equipment?: string;
  /** The substance, e.g. R-22, Halon 1301. */
  substance?: string;
  /** kg — ODS are recorded by mass. */
  mass?: number;
  /** m³ — the final total quantity on board after the operation (BWRB 2025 form, MEPC.369(80)); since 2.78. */
  rob?: number;
  /** Conducted in accordance with the approved Ballast Water Management Plan; since 2.78. */
  bwmp?: boolean;
  /** The ballast water treatment method, as the officer words it ("BWMS UV", "none — exchange D-1"); since 2.78. */
  treatment?: string;
  /** The port-based or reception facility's name; since 2.78. */
  facility?: string;
  /** The designated exchange area (BWM reg. B-4.2), instead of distance and depth; since 2.78. */
  area?: string;
  remarks?: string;
  text: string;
  by: string;
  byRank?: string;
  /** The signer's id (crew id or `device:<id>`) — the user ID a true copy prints (MEPC.312 §6.3). */
  byId?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export interface LogMonthSign {
  /** `<book>_<yyyy-mm>` */
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
