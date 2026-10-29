// ===================================
// External inspections — PSC, flag, class, the superintendent's visit, vetting,
// an external ISM / MLC audit (plan item 33, 29 Oct 2026: "замечания внешних
// проверок → CAPA").
//
// THE RECORD is the visit: who came, where, when, the report number and how it
// ended — clean, with findings, or a detention. THE FINDINGS are not kept here:
// each one is a non-conformity (types/safety.ts) carrying `inspId`, so it goes
// the whole NC way — root cause, actions with owners and dates, the Master's
// signed closure, the office's verification — and there is one copy of it. The
// visit's state (open / overdue / closed / verified) is worked out from its NCs
// (services/extInspections.ts).
//
// Officers write it; never deleted (a wrong one is corrected, not removed — a
// PSC report the vessel received is a fact).
// ===================================

import type { SignProof } from '../services/signature';

export type ExtInspKind = 'psc' | 'flag' | 'class' | 'superintendent' | 'vetting' | 'ism_audit' | 'mlc_audit' | 'other';
export const EXT_INSP_KINDS: ExtInspKind[] = ['psc', 'flag', 'class', 'superintendent', 'vetting', 'ism_audit', 'mlc_audit', 'other'];

/** English — for the papers (PSC / flag reports stay English); the screens use t('ei.kind.<k>'). */
export const EXT_INSP_KIND_LABEL: Record<ExtInspKind, string> = {
  psc: 'Port State Control',
  flag: 'Flag State inspection',
  class: 'Class survey',
  superintendent: 'Superintendent visit',
  vetting: 'Vetting / charterer inspection',
  ism_audit: 'External ISM audit (DOC / SMC)',
  mlc_audit: 'External MLC inspection',
  other: 'Other external inspection',
};

/**
 * PSC action taken codes (Paris / Tokyo MOU), the ones a vessel meets. `days`
 * is how long the code gives to put it right, counted from the inspection:
 * 0 = before departure; undefined = no date of its own (the officer sets one).
 */
export const PSC_ACTIONS: { code: string; label: string; days?: number; months?: number }[] = [
  { code: '10', label: 'Deficiency rectified', days: 0 },
  { code: '15', label: 'Rectify at the next port' },
  { code: '16', label: 'Rectify within 14 days', days: 14 },
  { code: '17', label: 'Rectify before departure', days: 0 },
  { code: '18', label: 'Rectify within 3 months', months: 3 },
  { code: '19', label: 'Rectify at the agreed repair port' },
  { code: '30', label: 'Grounds for detention', days: 0 },
  { code: '99', label: 'Other' },
];

export interface ExternalInspection {
  id: string;
  /** EI-2026-01 — this vessel's number, by year. */
  no: string;
  kind: ExtInspKind;
  /** The day it took place, yyyy-mm-dd (the first day, if longer). */
  date: string;
  port?: string;
  /** Who carried it out: Paris MOU / the flag / the class society / the company / the oil major. */
  authority?: string;
  inspector?: string;
  /** The report / Form B / survey report number. */
  reportNo?: string;
  /** PSC (or flag) detained the vessel. */
  detained?: boolean;
  /** The detention was lifted, yyyy-mm-dd. */
  releasedOn?: string;
  note?: string;
  /** Recorded aboard, signed. */
  by: string;
  byRank?: string;
  signedWith?: SignProof;
  at: number;
  updatedAt: number;
}
