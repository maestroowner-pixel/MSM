// ===================================
// Crew appraisals (plan item 40, 3 Nov 2026). STCW / MLC and every crewing
// office: a seafarer is appraised at the END OF THE CONTRACT and, on a long
// trip, ONCE A YEAR — the company decides on re-hiring and promotion from it.
//
// THE RECORD is one appraisal of one person: why (contract end / annual /
// other), the period, a score per criterion (1–5, absent = not applicable),
// strengths, what to improve, training needs, whether to re-hire, promotion.
//
// THE WAY is append-only STEPS (as a change's, types/moc.ts): the appraiser
// signs → the person appraised reads it and signs, agreeing or not, with a
// comment (or the appraiser records that they refused to sign) → the Master
// countersigns. The Master as appraiser needs no countersignature. Content is
// fixed once the appraiser signed; a draft or an appraisal not yet signed by
// the person may be cancelled, with the reason. Never deleted.
//
// Officers and the Master only — synced `officers: true` (crew devices never
// receive it), rules `crew_appraisals` isAdmin; the office reads.
// ===================================

import type { SignProof } from '../services/signature';

export type AppraisalReason = 'contract' | 'annual' | 'other';
export const APPRAISAL_REASONS: AppraisalReason[] = ['contract', 'annual', 'other'];

/** English — for the papers; the screens use t('ap.reason.<k>'). */
export const APPRAISAL_REASON_LABEL: Record<AppraisalReason, string> = {
  contract: 'End of contract',
  annual: 'Annual',
  other: 'Other',
};

export type Score = 1 | 2 | 3 | 4 | 5;

/** English — for the papers; the screens use t('ap.score.<n>'). */
export const SCORE_LABEL: Record<Score, string> = { 1: 'Unsatisfactory', 2: 'Needs improvement', 3: 'Meets requirements', 4: 'Good', 5: 'Excellent' };

/**
 * The criteria. **Ids are permanent** — they key every stored score; re-word
 * freely, never re-use an id for a different question. `officers`: asked only
 * of an officer (isOfficerRank).
 */
export const CRITERIA: { id: string; label: string; officers?: boolean }[] = [
  { id: 'knowledge', label: 'Professional knowledge and skill' },
  { id: 'quality', label: 'Quality of work' },
  { id: 'safety', label: 'Safety awareness and SMS compliance' },
  { id: 'reliability', label: 'Reliability and punctuality' },
  { id: 'teamwork', label: 'Teamwork and attitude' },
  { id: 'communication', label: 'Communication and English' },
  { id: 'conduct', label: 'Conduct, sobriety and appearance' },
  { id: 'initiative', label: 'Initiative' },
  { id: 'leadership', label: 'Leadership and supervision', officers: true },
];

/**
 * The company's own appraisal form (13 Nov 2026: "the company's own form — its
 * criteria and sections, or its paper form read by AI"). One per vessel
 * (`ap_form/form`), set by the Master or the office; absent or `off` = the app's
 * standard criteria above. A new appraisal takes a COPY (`CrewAppraisal.form`),
 * so changing the form never rewrites one already written.
 */
export interface ApFormItem {
  /** Permanent within the form: it keys the score or the answer. A line that keeps its text keeps its id. */
  id: string;
  text: string;
  /** Absent = a criterion scored on the scale; `section` = a heading; `text` = a question answered in words. */
  kind?: 'section' | 'text';
  /** Asked only of an officer (isOfficerRank). */
  officers?: boolean;
}

export interface ApFormSnap {
  title: string;
  /** The scale's words, the lowest score first (2–10 points): ["Poor", "Fair", "Good", "Excellent"]. */
  scale: string[];
  items: ApFormItem[];
}

export interface ApForm extends ApFormSnap {
  id: 'form';
  /** Back to the app's standard form; the company's wording is kept. */
  off?: boolean;
  by?: string;
  updatedAt: number;
}

/**
 * Criteria by the work done (13 Nov 2026: "criteria by position — the crane
 * operator's hours from the log, the DPO's DP time"). A person with crane log
 * entries or DP time in the period — or whose rank says so — is also scored on
 * that work, and the record carries what the books say for the period.
 * **Ids are permanent**, as CRITERIA's.
 */
export type ApRole = 'crane' | 'dp';
export const AP_ROLES: ApRole[] = ['crane', 'dp'];
export const AP_ROLE_TITLE: Record<ApRole, string> = { crane: 'Crane operation', dp: 'DP operation' };
export const ROLE_CRITERIA: Record<ApRole, { id: string; label: string }[]> = {
  crane: [
    { id: 'craneSafe', label: 'Safe lifting: rigging, load and SWL limits' },
    { id: 'craneSignals', label: 'Signals and communication with the banksman and slinger' },
    { id: 'craneChecks', label: 'Pre-use checks and reporting crane defects' },
  ],
  dp: [
    { id: 'dpWatch', label: 'DP watchkeeping and position awareness' },
    { id: 'dpAsog', label: 'ASOG / WSOG knowledge and response to DP alarms' },
    { id: 'dpRecords', label: 'DP checklists, log and handover' },
  ],
};

/** What the books say for the period — copied onto the record, so the paper stays true when the log changes. */
export interface ApRoleFacts {
  role: ApRole;
  /** Crane: hours at the controls; DP: Active hours. */
  hours: number;
  /** Days worked (crane) / DP days (≥ 2 h, as the letter counts them). */
  days: number;
  /** Crane: lifts counted, and the entries without a count ("120+"). */
  lifts?: number;
  uncounted?: number;
  /** Crane: load tests worked at the controls. */
  tests?: number;
  /** DP: DP drills attended (present on the attendance list), live or desktop. */
  drills?: number;
  /** Crane: "Knuckle-boom crane No. 2 (Palfinger, SWL 12 t)", most hours first. */
  cranes?: string[];
}

export interface AppraisalScore {
  id: string;
  /** Absent = not applicable. 1 … the scale's length (5 on the standard form). */
  score?: number;
  note?: string;
}

export type Rehire = 'yes' | 'reservations' | 'no';
export const REHIRES: Rehire[] = ['yes', 'reservations', 'no'];
export const REHIRE_LABEL: Record<Rehire, string> = { yes: 'Yes', reservations: 'With reservations', no: 'No' };

export type AppraisalStepKind =
  | 'appraiser' // the appraiser signs it (asMaster: the Master is the appraiser)
  | 'crew' //      the person appraised signs it, agreeing or not
  | 'refused' //   the appraiser records that the person would not sign, with the reason
  | 'master' //    the Master countersigns — final
  | 'cancel'; //   withdrawn before the person signed, with the reason — final

export interface AppraisalStep {
  kind: AppraisalStepKind;
  by: string;
  byRank?: string;
  at: number;
  note?: string;
  /** The person's answer (`crew`). */
  agree?: boolean;
  /** The appraiser is the Master (`appraiser`) — no countersignature follows. */
  asMaster?: boolean;
  signedWith?: SignProof;
}

export interface CrewAppraisal {
  id: string;
  crewId: string;
  /** The person and rank as they were — the crew list changes, the appraisal does not. */
  name: string;
  rank?: string;
  reason: AppraisalReason;
  /** What "other" was: promotion, transfer, at the person's request. */
  reasonNote?: string;
  /** yyyy-mm-dd — the period it covers. */
  from: string;
  to: string;
  scores: AppraisalScore[];
  /** The company's form it was written on (a copy); absent = the standard criteria. */
  form?: ApFormSnap;
  /** Answers to the form's written questions, by item id. */
  answers?: Record<string, string>;
  /** The work by position (crane, DP) — its criteria are asked, its figures printed. Fixed with the rest once the appraiser signs. */
  roles?: ApRoleFacts[];
  strengths?: string;
  improve?: string;
  training?: string;
  rehire?: Rehire;
  promote?: boolean;
  steps: AppraisalStep[];
  /** Who started it. */
  by: string;
  byRank?: string;
  at: number;
  updatedAt: number;
}
