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

export interface AppraisalScore {
  id: string;
  /** Absent = not applicable. */
  score?: Score;
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
