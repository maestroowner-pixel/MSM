// ===================================
// Record books kept the same way — one screen, one record shape, a spec per
// book (services/logbooks.ts). Sewage (MARPOL Annex IV) and Ballast Water
// (BWM Convention, Appendix II), asked for on 11 Oct 2026 after the Oil and
// Garbage Record Books.
//
// One entry is one operation under one code; `text` is the line as it reads in
// the book. Signed by the officer in charge; the Master signs each month and
// alone changes or deletes an entry, as a new version (services/versions).
// ===================================

import type { SignProof } from '../services/signature';
import type { Versioned } from '../services/versions';

export type BookKey = 'sewage' | 'ballast';

/** Every field a book's codes may ask for. */
export type LogField = 'tank' | 'quantity' | 'method' | 'place' | 'placeEnd' | 'start' | 'stop' | 'distance' | 'speed' | 'depth' | 'treated' | 'receiptNo';

export interface LogEntry extends Versioned {
  id: string;
  book: BookKey;
  date: string;
  time?: string;
  code: string;
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
  remarks?: string;
  text: string;
  by: string;
  byRank?: string;
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
  updatedAt: number;
}
