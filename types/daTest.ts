// ===================================
// Drug and alcohol tests (plan item 42, 3 Nov 2026). STCW A-VIII/1 (no more
// than 0.05 % BAC or 0.25 mg/l in the breath on watch), the company's D&A
// policy and the oil majors' inspections (an unannounced test within the
// period the policy sets) ask for a log of who was tested, when, why, how and
// with what result.
//
// THREE RECORDS, all written once:
//   DaTest     — one test session: why (unannounced, random, after an incident,
//                for cause, before joining, follow-up), who carried it out, the
//                breathalyser and the drug kit, the limit, signed;
//   DaResult   — one person's result in it (a document of its own, so the
//                rules can see the name is masked);
//   DaFollowUp — later: the laboratory's result of a non-negative screen, and
//                what was done about a positive or a refusal.
//
// A RESULT IS HEALTH DATA. The cloud holds the person's name as its first and
// last letter ("Jez Dodd" → "J…d") and never the crew id; the full name stays
// on the device the test was recorded on (as the medical log's patient). The
// Board works from the vessel's dates and counts, which need no names.
//
// Officers and the Master only (synced `officers: true`); the office reads.
// ===================================

import type { SignProof } from '../services/signature';

export type DaReason = 'unannounced' | 'random' | 'postIncident' | 'cause' | 'preJoining' | 'followUp';
export const DA_REASONS: DaReason[] = ['unannounced', 'random', 'postIncident', 'cause', 'preJoining', 'followUp'];
/** The tests that count as the policy's unannounced test. */
export const DA_UNANNOUNCED: DaReason[] = ['unannounced', 'random'];

/** English — for the papers; the screens use t('da.reason.<k>'). */
export const DA_REASON_LABEL: Record<DaReason, string> = {
  unannounced: 'Unannounced',
  random: 'Random selection',
  postIncident: 'After an incident',
  cause: 'Reasonable cause',
  preJoining: 'Before joining',
  followUp: 'Follow-up',
};

/** STCW A-VIII/1 para 10: 0.25 mg/l of alcohol in the breath (0.05 % BAC). */
export const STCW_BREATH_LIMIT = 0.25;

export interface DaTest {
  id: string;
  /** DA-2026-001 */
  no: string;
  /** yyyy-mm-dd, hh:mm ship's time */
  date: string;
  time?: string;
  reason: DaReason;
  /** The incident, the cause, the person followed up — what the reason was. */
  ref?: string;
  alcohol: boolean;
  drugs: boolean;
  /** mg/l in the breath the readings were judged against (a reading above it is positive). */
  limit: number;
  /** The breathalyser: make, serial, last calibrated. */
  device?: string;
  /** The drug screening kit: make, lot, expiry. */
  kit?: string;
  /** Who carried it out: the Master, or the testing company and its tester. */
  tester: string;
  external?: boolean;
  witness?: string;
  /** Picked at random: n of the people aboard. */
  drawn?: { n: number; of: number };
  /** People tested — their results are DaResult with this testId. */
  count: number;
  /** Who recorded and signed it. */
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export type DrugScreen = 'neg' | 'nonNeg';

export interface DaResult {
  id: string;
  testId: string;
  /** On the device it was recorded on only — never sent. */
  crewId?: string;
  /** Masked in the cloud ("J…d"). */
  name: string;
  rank?: string;
  /** mg/l in the breath — the first reading, and the confirming one (15–20 min later) when the first was above the limit. */
  alcohol?: number;
  confirm?: number;
  drugs?: DrugScreen;
  /** A non-negative screen sent to the laboratory: the sample / chain-of-custody number. */
  sample?: string;
  /** Refused to be tested — the reason given. */
  refused?: string;
  at: number;
  updatedAt: number;
}

export type DaFollowKind = 'lab' | 'action';

export interface DaFollowUp {
  id: string;
  testId: string;
  resultId: string;
  kind: DaFollowKind;
  /** The laboratory's result (`lab`). */
  lab?: 'neg' | 'pos';
  /** The laboratory's report number. */
  ref?: string;
  /** What was done (`action`): relieved of duty, the company informed, signed off… */
  note?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

/** The vessel's D&A policy — one record, id 'policy'; the Master sets it. */
export interface DaPolicy {
  id: 'policy';
  /** An unannounced test at least this often (months). */
  months: number;
  /** mg/l in the breath. */
  limit: number;
  by?: string;
  updatedAt: number;
}

export const DA_DEFAULT_POLICY: DaPolicy = { id: 'policy', months: 12, limit: STCW_BREATH_LIMIT, updatedAt: 0 };
export const DA_MONTHS = [3, 6, 12];
