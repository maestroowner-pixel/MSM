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

export type DpSlot = 0 | 1 | 2; // 0 none · 1 Active (at the desk, in control) · 2 Passive (watching)

export interface DpLine {
  id: string;
  text: string;
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
/** The well-specific / activity-specific operating guidance condition (ASOG / WSOG / CAM). */
export type AsogStatus = 'green' | 'blue' | 'yellow' | 'red';

export interface DpCheck {
  id: string;
  templateId: string;
  title: string;
  where: DpWhere;
  /** ms — when it was signed. */
  at: number;
  /** The operation / field / installation it was done for. */
  operation?: string;
  asog?: AsogStatus;
  lines: DpLine[];
  results: Record<string, DpResult>;
  remarks?: string;
  by: string;
  byRank?: string;
  byKey?: string;
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
