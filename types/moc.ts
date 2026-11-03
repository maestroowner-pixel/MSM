// ===================================
// Management of Change — MOC (plan item 38, 3 Nov 2026). ISM Code 1.2.2.2 and
// 10: a change to the way the vessel works is assessed and approved BEFORE it is
// made, and checked after. What changes: a procedure, the equipment (a new
// winch, a bypassed alarm, a different fuel), the crew (one deckhand fewer, a
// new rank), the organisation (a new manager, a new trade), anything else.
//
// THE RECORD is the change: what, why, permanent or until when, the ISM
// documents it touches (and the revision each was at), the risk assessment it
// was approved on (frozen onto it, as a deferral's), the actions that carry it
// out — each with whom, by when, signed done — and the Master's signed closure
// with a word on whether it worked.
//
// THE WAY is append-only STEPS (as a requisition's, services/poApproval), and
// the stage is read from them: an officer submits → the Master approves (with
// an approved risk assessment) or returns it → where the office is in the loop
// it approves, returns or rejects it → the actions → the Master closes it.
// Officers write it; never deleted (a change not made is cancelled, with why).
// ===================================

import type { SignProof } from '../services/signature';
import type { RaSnapshot } from './permits';

export type MocKind = 'procedure' | 'equipment' | 'crew' | 'organisation' | 'other';
export const MOC_KINDS: MocKind[] = ['procedure', 'equipment', 'crew', 'organisation', 'other'];

/** English — for the papers; the screens use t('moc.kind.<k>'). */
export const MOC_KIND_LABEL: Record<MocKind, string> = {
  procedure: 'Procedure / SMS',
  equipment: 'Equipment / systems',
  crew: 'Crew / manning',
  organisation: 'Organisation / management',
  other: 'Other',
};

export type MocStepKind =
  | 'submit' //        an officer → the Master
  | 'master' //        the Master approves (→ the office, where it is in the loop)
  | 'masterReturn' //  the Master returns it to the officer, with the reason
  | 'office' //        the office approves
  | 'officeReturn' //  the office returns it for rework, with the reason
  | 'reject' //        the Master or the office rejects it, with the reason — final
  | 'cancel' //        withdrawn aboard before it was approved, with the reason — final
  | 'close'; //        the Master closes it, signed, with whether it worked — final

export interface MocStep {
  kind: MocStepKind;
  by: string;
  byRank?: string;
  at: number;
  note?: string;
  signedWith?: SignProof;
}

/** One thing to do to carry the change out: update the procedure, train the crew, fit the part. */
export interface MocAction {
  id: string;
  text: string;
  /** Who does it — a name or a rank. */
  owner: string;
  /** By when, yyyy-mm-dd. */
  due: string;
  doneAt?: number;
  doneBy?: string;
  doneByRank?: string;
  doneNote?: string;
}

/** An ISM document the change touches, with the revision it was at when named. */
export interface MocDoc {
  id: string;
  title: string;
  docNo?: string;
  rev: number;
}

export interface ManagementOfChange {
  id: string;
  /** MOC-2026-01 — this vessel's number, by year. */
  no: string;
  kind: MocKind;
  title: string;
  /** The change, as it will be. */
  what: string;
  /** Why it is needed. */
  why: string;
  /** Until when, yyyy-mm-dd — a temporary change (a bypass, a stand-in); absent = permanent. */
  until?: string;
  docs?: MocDoc[];
  /** The risk assessment made for it (RiskAssessment.mocId). */
  raId?: string;
  /** That assessment as it was approved, frozen by the Master's approval. */
  ra?: RaSnapshot;
  /** The office approves it before it is made. */
  needsOffice: boolean;
  actions: MocAction[];
  steps: MocStep[];
  raisedBy: string;
  raisedByRank?: string;
  at: number;
  updatedAt: number;
}
