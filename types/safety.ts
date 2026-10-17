// ===================================
// QHSE — safety observation cards and non-conformities with corrective and
// preventive actions (NC / CAPA). Asked for on 11 Oct 2026: "NC/CAPA — да, и в
// план QHSE safety observation cards".
//
// THE TWO, and how they meet. An observation card is anybody's: a deckhand who
// sees a missing guard, an unsafe act, a near miss — or something done well —
// fills one in on the spot, with his name or without it. An officer reviews it;
// most cards end there ("talked to the crew, fixed"). One that shows a gap in
// the SMS becomes a NON-CONFORMITY (ISM Code 9 and 10): what was found, against
// which requirement, the root cause, and the actions — each with whom, by when,
// and done when — until the Master closes it, signed, with a word on whether it
// worked. NCs also come straight from audits, PSC, flag and class, incidents.
//
// ANONYMOUS means anonymous: the card does not carry the name. Firestore knows
// which device wrote it, the app does not show it.
// ===================================

import type { SignProof } from '../services/signature';

export type ObsKind = 'unsafe_act' | 'unsafe_condition' | 'near_miss' | 'good_practice';

export const OBS_KINDS: { key: ObsKind; label: string; icon: string }[] = [
  { key: 'unsafe_condition', label: 'Unsafe condition', icon: 'alert-outline' },
  { key: 'unsafe_act', label: 'Unsafe act', icon: 'account-alert-outline' },
  { key: 'near_miss', label: 'Near miss', icon: 'alert-octagon-outline' },
  { key: 'good_practice', label: 'Good practice', icon: 'thumb-up-outline' },
];
export const OBS_KIND_LABEL = Object.fromEntries(OBS_KINDS.map((k) => [k.key, k.label])) as Record<ObsKind, string>;

export const OBS_TOPICS = [
  'PPE', 'Housekeeping', 'Working aloft', 'Enclosed space', 'Hot work', 'Lifting & mooring', 'Electrical', 'Machinery',
  'Tender & water sports', 'Galley & hygiene', 'Fire safety', 'Environment', 'Navigation & watchkeeping', 'Procedures', 'Other',
];

export interface SafetyObservation {
  id: string;
  /** When it was seen, yyyy-mm-dd. */
  date: string;
  kind: ObsKind;
  topic: string;
  location?: string;
  what: string;
  /** What was done there and then. */
  action?: string;
  /** The work was stopped (Stop Work Authority). */
  stoppedWork?: boolean;
  /** Absent when the card is anonymous. */
  by?: string;
  byRank?: string;
  anonymous?: boolean;
  at: number;
  /** An officer's review — the only thing that changes on a card. */
  reviewedAt?: number;
  reviewedBy?: string;
  reviewedByRank?: string;
  review?: string;
  /** The non-conformity it was raised as. */
  ncId?: string;
  /** Submitted via the public QR form, not from an enrolled device. */
  via?: 'qr';
  updatedAt: number;
}

export type NcSource = 'observation' | 'near_miss' | 'incident' | 'internal_audit' | 'external_audit' | 'psc' | 'flag_class' | 'inspection' | 'other';
export const NC_SOURCES: { key: NcSource; label: string }[] = [
  { key: 'observation', label: 'Safety observation' },
  { key: 'near_miss', label: 'Near miss' },
  { key: 'incident', label: 'Incident / accident' },
  { key: 'internal_audit', label: 'Internal audit' },
  { key: 'external_audit', label: 'External audit (DOC / SMC)' },
  { key: 'psc', label: 'Port State Control' },
  { key: 'flag_class', label: 'Flag / class survey' },
  { key: 'inspection', label: 'Inspection / drill' },
  { key: 'other', label: 'Other' },
];
export const NC_SOURCE_LABEL = Object.fromEntries(NC_SOURCES.map((s) => [s.key, s.label])) as Record<NcSource, string>;

/** Observation (a remark, room to improve) · non-conformity · major NC (a serious threat, ISM 1.1.10). */
export type NcGrade = 'observation' | 'nc' | 'major';
export const NC_GRADES: { key: NcGrade; label: string }[] = [
  { key: 'observation', label: 'Observation' },
  { key: 'nc', label: 'Non-conformity' },
  { key: 'major', label: 'Major NC' },
];
export const NC_GRADE_LABEL = Object.fromEntries(NC_GRADES.map((g) => [g.key, g.label])) as Record<NcGrade, string>;

/** Correction — put right what was found; corrective — remove the cause; preventive — stop it elsewhere. */
export type CapaKind = 'correction' | 'corrective' | 'preventive';
export const CAPA_KIND_LABEL: Record<CapaKind, string> = { correction: 'Correction', corrective: 'Corrective', preventive: 'Preventive' };

export interface CapaAction {
  id: string;
  kind: CapaKind;
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

export interface NonConformity {
  id: string;
  /** NC-2026-003 — this vessel's number, by year. */
  no: string;
  /** When it was found, yyyy-mm-dd. */
  date: string;
  source: NcSource;
  /** Audit / PSC report number, incident reference. */
  sourceRef?: string;
  /** The observation card it came from. */
  obsId?: string;
  grade: NcGrade;
  title: string;
  what: string;
  where?: string;
  /** The requirement not met — ISM 10.2, SMS chapter, SOLAS reg. */
  requirement?: string;
  rootCause?: string;
  actions: CapaAction[];
  raisedBy: string;
  raisedByRank?: string;
  raisedAt: number;
  /** Closed by the Master, signed, with whether the actions worked. */
  closedAt?: number;
  closedBy?: string;
  closedByRank?: string;
  closedWith?: SignProof;
  effectiveness?: string;
  updatedAt: number;
}
