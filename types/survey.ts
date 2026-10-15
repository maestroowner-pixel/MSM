// ===================================
// Surveys & audits — the planned statutory and class events of a vessel
// (10 Oct 2026: "the planned revisions — monthly, the annual inspection").
//
// Monthly / quarterly / annual LSA-FFE rounds and equipment services already
// have their own dates (inspections, certificates). These are the rest: class
// annual survey, flag inspection, ISM audits, dry-dock… Each is due on a date
// (or an anniversary) with a window either side, repeats, and when it is done
// the next one is planned from it.
//
//   Survey       the plan, edited by the Master.
//   SurveyDone   one occasion it was carried out — append-only, the history.
// ===================================

import type { Versioned } from '../services/versions';

/**
 * What an occasion is to the certificate it endorses (15 Oct 2026, the TM Master
 * comparison: "annual / intermediate / renewal surveys with a window, not only an
 * expiry date"). Absent on the vessel's own plan rows that belong to no certificate.
 */
export type SurveyKind = 'annual' | 'intermediate' | 'renewal';
export interface Survey {
  id: string;
  name: string;
  /** Next due date (yyyy-mm-dd) — the anniversary for windowed surveys. */
  due: string;
  /** Window around `due`, in months: may be done from due − before … due + after. */
  before: number;
  after: number;
  /** Repeat every n months (12 = yearly); 0 = once. */
  repeat: number;
  /** Anniversary-based: the next one stays on the anniversary, whenever this one was done. */
  anniversary: boolean;
  /** Class society, flag, company, auditor… */
  by?: string;
  note?: string;
  order: number;
  /** The vessel certificate it endorses (Certificate.id) — planned from the certificate (services/certSurveys.ts). */
  certId?: string;
  kind?: SurveyKind;
  deleted?: boolean;
  updatedAt: number;
}

export interface SurveyDone extends Versioned {
  id: string;
  surveyId: string;
  name: string;
  /** Date carried out. */
  date: string;
  /** The due date it answered. */
  forDue: string;
  /** Report / endorsement number. */
  ref?: string;
  note?: string;
  /** Copied from the plan row, so a certificate keeps its endorsements when a renewal replans it. */
  certId?: string;
  kind?: SurveyKind;
  by: string;
  byRank?: string;
  at: number;
  updatedAt: number;
}

/** Starting list — the Master picks what applies, sets the dates. */
export const SURVEY_TEMPLATES: { name: string; before: number; after: number; repeat: number; anniversary: boolean; by?: string }[] = [
  { name: 'Class annual survey', before: 3, after: 3, repeat: 12, anniversary: true, by: 'Class society' },
  { name: 'Flag State annual inspection', before: 3, after: 3, repeat: 12, anniversary: true, by: 'Flag' },
  { name: 'Safety Equipment Certificate — annual survey', before: 3, after: 3, repeat: 12, anniversary: true },
  { name: 'Load Line — annual survey', before: 3, after: 3, repeat: 12, anniversary: true },
  { name: 'Intermediate survey', before: 3, after: 3, repeat: 30, anniversary: true, by: 'Class society' },
  { name: 'Special (renewal) survey', before: 3, after: 0, repeat: 60, anniversary: true, by: 'Class society' },
  { name: 'Dry-dock / bottom survey', before: 3, after: 3, repeat: 30, anniversary: false },
  { name: 'ISM internal audit', before: 1, after: 1, repeat: 12, anniversary: false, by: 'Company / DPA' },
  { name: 'ISM external audit (SMC intermediate)', before: 3, after: 3, repeat: 30, anniversary: true, by: 'Flag / RO' },
  { name: 'MLC inspection', before: 3, after: 3, repeat: 30, anniversary: true, by: 'Flag / RO' },
  { name: 'Master’s review of the SMS', before: 0, after: 1, repeat: 12, anniversary: false },
];
