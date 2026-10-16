// ===================================
// Dynamic positioning (16 Oct 2026, for vessels working on DP — "DP checklists
// and the confirmation letter generator, the letter from SDM").
//
//   DpTemplate  a DP checklist — the app ships four (services/dp.ts); a vessel
//               rewords them to its DP Operations Manual / ASOG, or adds its own.
//   DpCheck     one checklist worked and signed: a frozen copy of the lines it
//               was signed against, never edited (as an inspection).
//   DpDay       one DPO's DP time on one day: 48 half-hours, Active or Passive
//               (as the Nautical Institute logbook counts it).
//   DpInfo      what the confirmation letter needs about the company and the
//               vessel, once (one row, id 'info').
// ===================================

import type { SignProof } from '../services/signature';

export type DpSlot = 0 | 1 | 2; // 0 none · 1 Active (at the desk, in control) · 2 Passive (watching)

/**
 * One line of a DP checklist. Plain, it is answered Yes / No / N/A. With
 * `options` it is answered by one of them ("Not used / Monitor / Selected").
 * With `value` it also takes a reading under that label ("Hdg", "Pitch/Roll");
 * a line with a `value` and no `options` is a reading only ("Position gain").
 * `head` makes it a section heading, not a question. (16 Oct 2026, from the
 * owner's Arrival DP Checklist, annex 42.)
 */
export interface DpLine {
  id: string;
  text: string;
  options?: string[];
  /** Of `options`, the answers that mean something is wrong (written with "!": {Good|!No good}). */
  bad?: string[];
  value?: string;
  head?: boolean;
  /**
   * On a heading: the section is a TABLE, laid out as the paper checklist —
   * every line under it is a row with these cells ("Available {Yes|!No}",
   * "Noise"). A cell with options is chosen, without them it is written.
   */
  cols?: DpCol[];
  /**
   * Not a question (a vessel's own form, 16 Oct 2026): `field` a header field
   * (Location, Project, Client), `text` a written paragraph (brief description of
   * the operation), `sketch` a drawing by hand (own vessel, rig, wind and current).
   * The answer is in `values[id]` — the drawing as an SVG path. A checklist with
   * its own fields shows them instead of the standard Field / Offshore unit /
   * Conditions.
   */
  kind?: 'field' | 'text' | 'sketch';
}

export interface DpCol {
  name: string;
  options?: string[];
  bad?: string[];
}

export type DpWhere = 'bridge' | 'engine';

export interface DpTemplate {
  id: string;
  title: string;
  where: DpWhere;
  lines: DpLine[];
  /** A built-in the vessel has switched off — a tombstone, never a deletion (rows merge by id). */
  off?: boolean;
  updatedAt: number;
}

export type DpResult = 'pass' | 'fail' | 'na';

/** Where the vessel was — decimal degrees, north and east positive. */
export interface DpPosition {
  lat: number;
  lon: number;
}

/** The conditions at the time, as the Arrival DP Checklist heads them — all free text. */
export interface DpConditions {
  waterDepth?: string;
  windSpeed?: string;
  windDir?: string;
  currentSpeed?: string;
  currentDir?: string;
  waveHeight?: string;
  waveDir?: string;
}
/** The well-specific / activity-specific operating guidance condition (ASOG / WSOG / CAM). */
export type AsogStatus = 'green' | 'blue' | 'yellow' | 'red';

export interface DpCheck {
  id: string;
  templateId: string;
  title: string;
  where: DpWhere;
  /** ms — when it was signed: the checklist's date and time, set by the app, not typed. */
  at: number;
  /** Ship's time offset at the time ("+01:00"), so the record reads in the time it was kept. */
  shipOffset?: string;
  /** Where it was filled in — REQUIRED (16 Oct 2026; firestore.rules refuses a record without it). */
  position: DpPosition;
  /** The operation / field it was done for. */
  operation?: string;
  /** The offshore unit / installation. */
  unit?: string;
  conditions?: DpConditions;
  asog?: AsogStatus;
  lines: DpLine[];
  /** Yes / No / N/A as pass / fail / na; an option line stores the option chosen; a table cell is keyed `${lineId}#${col}`. */
  results: Record<string, string>;
  /** Readings, by line id (a table cell by `${lineId}#${col}`). */
  values?: Record<string, string>;
  remarks?: string;
  /** The first signature — the DPO handing over the watch (or doing the check). */
  by: string;
  byRank?: string;
  byKey?: string;
  /** How it was confirmed — PIN, by hand (with the drawing) or fingerprint (services/signature.ts). */
  byWith?: SignProof;
  /** The second signature — the DPO taking over (16 Oct 2026: "two sign it — name and
   *  position, usually those changing the watch"). Required on records from that day. */
  by2?: string;
  by2Rank?: string;
  by2Key?: string;
  by2With?: SignProof;
  updatedAt: number;
}

export interface DpDay {
  /** `${crewId}_${date}` — one DPO, one day. */
  id: string;
  crewId: string;
  /** The name and rank at the time, so the letter still reads right when the person has left. */
  name: string;
  rank?: string;
  date: string; // yyyy-mm-dd
  slots: DpSlot[]; // 48 × 30 min
  deleted?: boolean;
  updatedAt: number;
}

export interface DpInfo {
  id: 'info';
  company?: string;
  grt?: string;
  dpClass?: string;
  signatoryName?: string;
  signatoryRank?: string;
  contacts?: string;
  updatedAt: number;
}
