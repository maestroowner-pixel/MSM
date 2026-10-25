// ===================================
// Engine-room rounds / daily log (backlog #9, Oct 2026).
//
// A watch engineer fills a form of readings (RPM, temperatures, pressures,
// tank levels, …) at every watch change, signs it, and the record is kept.
// The template is customisable per vessel; the snapshot on each entry is what
// makes history readable even after the template changes.
// ===================================

import type { SignProof } from '../services/signature';
import type { WatchPeriod } from './deckLog';

export type WatchParamType = 'number' | 'text';

/** One line in the template — a named measurement with a unit and an optional normal range. */
export interface WatchParam {
  id: string;
  name: string;
  /** Short unit label: "°C", "bar", "rpm", "kW", or "" for plain text. */
  unit: string;
  type: WatchParamType;
  /** Inclusive lower bound of the normal operating range (number params only). */
  normalMin?: number;
  /** Inclusive upper bound of the normal operating range (number params only). */
  normalMax?: number;
}

/** The vessel's round template — one active template is the norm. */
export interface WatchTemplate {
  id: string;
  name: string;
  params: WatchParam[];
  updatedAt: number;
  deleted?: boolean;
}

/** One completed round — immutable once signed. */
export interface WatchEntry {
  id: string;
  templateId: string;
  /** Snapshot of params at signing time so history is readable after template changes. */
  params: WatchParam[];
  /** paramId → raw string value (number params parse to float; empty means not recorded). */
  values: Record<string, string>;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (local) */
  time: string;
  /** Watch period (00-04 … 20-00, or other) — absent on entries made before 25 Oct 2026. */
  period?: WatchPeriod;
  /** Machinery state, events, the reason a reading is out of range. */
  remarks?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}
