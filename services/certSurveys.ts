// ===================================
// A vessel certificate's surveys — the endorsements it needs to stay valid
// (15 Oct 2026, the TM Master V2 comparison, item 1: "annual / intermediate /
// renewal surveys with a window, not only an expiry date").
//
// A five-year statutory or class certificate is not "valid until the expiry
// date": it is valid until then PROVIDED each survey is endorsed inside its
// window. Miss the window of an annual survey and the certificate is invalid on
// the day the window closes, whatever the expiry date says. So the plan is drawn
// from the certificate itself, the way the endorsement boxes on its back read:
//
//   hssc      annual surveys ±3 months of each anniversary; one intermediate in
//             the window from 3 months before the 2nd anniversary to 3 months
//             after the 3rd — it takes the place of that year's annual; renewal
//             in the 3 months before expiry. (SOLAS SEC/SCC, Load Line with class,
//             IOPP, IAPP, class certificates — the Harmonized System.)
//   annual    annual surveys / verifications ±3 months, renewal (DOC, Load Line,
//             radio periodical surveys).
//   ism       one intermediate verification between the 2nd and 3rd anniversary
//             dates, renewal (SMC, ISSC, MLC — ISM Code 13.8, ISPS A/19.1.1, MLC A5.1.3).
//   renewal   renewal only (ISPP).
//   none      nothing to endorse (registry, safe manning, licences, insurance).
//
// Each occasion is its own once-only row of the Surveys plan (types/survey.ts),
// named for the box it fills — "SMC — intermediate verification" — so the Board,
// the Surveys screen and the history read without knowing about certificates.
// The schemes are a starting point: the Master unticks what does not apply, and
// edits a window like any survey.
// ===================================

import type { Certificate } from '../types/certificate';
import type { ComplianceStatus } from '../types/equipment';
import { Survey, SurveyDone, SurveyKind } from '../types/survey';
import { addMonths, surveyStatus, SurveyStatus } from './surveys';

export type SurveyScheme = 'hssc' | 'annual' | 'ism' | 'renewal' | 'none';

export const SCHEMES: { key: SurveyScheme; label: string; sub: string }[] = [
  { key: 'hssc', label: 'Annual + intermediate', sub: 'Annual ±3 months; intermediate at the 2nd or 3rd anniversary; renewal' },
  { key: 'annual', label: 'Annual', sub: 'Annual ±3 months of each anniversary; renewal' },
  { key: 'ism', label: 'Intermediate (ISM / ISPS / MLC)', sub: 'Between the 2nd and 3rd anniversary; renewal' },
  { key: 'renewal', label: 'Renewal only', sub: 'In the 3 months before expiry' },
  { key: 'none', label: 'No surveys', sub: 'Nothing to endorse' },
];

/** The usual scheme for a certificate, from its name (constants/certificateTypes.ts). */
export function defaultScheme(name: string): SurveyScheme {
  const n = name.toLowerCase();
  if (/\b(smc|issc|mlc)\b|safety management|ship security|maritime labour/.test(n)) return 'ism';
  if (/\b(doc)\b|document of compliance|load line|safety radio/.test(n)) return 'annual';
  if (/safety equipment|safety construction|\b(iopp|iapp)\b|class certificate|\bclass\b/.test(n)) return 'hssc';
  if (/\bispp\b|sewage/.test(n)) return 'renewal';
  return 'none';
}

/** "SMC" from "Safety Management Certificate (SMC)"; the name itself otherwise. */
export function certShort(name: string): string {
  const m = /\(([^)]{2,12})\)\s*$/.exec(name.trim());
  return m ? m[1] : name.trim();
}

/** ISM-family papers are verified; the rest are surveyed. */
function word(name: string, scheme: SurveyScheme): string {
  return scheme === 'ism' || /\b(doc)\b|document of compliance/i.test(name) ? 'verification' : 'survey';
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** Whole years the certificate runs (5 when the issue date is not known). */
export function validityYears(c: Pick<Certificate, 'issueDate' | 'expiryDate'>): number {
  if (!c.expiryDate || !c.issueDate) return 5;
  // Rounded down after the 3 months a renewal may be done ahead: issued 4 Apr 2029,
  // valid to 19 Jun 2034, is a five-year certificate.
  const y = (Date.parse(c.expiryDate) - Date.parse(c.issueDate)) / (365.25 * 86400000);
  return Math.max(1, Math.floor(y + 0.1));
}

export interface PlannedSurvey {
  survey: Survey;
  /** Planned unless its window has already closed — that one was endorsed before the app, or missed. */
  include: boolean;
}

/**
 * The occasions a certificate needs, from its expiry date (the anniversary is
 * its day and month). Nothing without an expiry date or for scheme `none`.
 */
export function planForCertificate(c: Certificate, scheme: SurveyScheme, today: string, now = Date.now()): PlannedSurvey[] {
  if (!c.expiryDate || scheme === 'none') return [];
  const years = validityYears(c);
  const short = certShort(c.name);
  const w = word(c.name, scheme);
  const out: PlannedSurvey[] = [];
  let order = 0;
  const add = (kind: SurveyKind, name: string, due: string, before: number, after: number, by?: string) => {
    const survey: Survey = {
      id: `sv_${c.id}_${kind}_${due}`,
      name: `${short} — ${name}`,
      due, before, after, repeat: 0, anniversary: true,
      certId: c.id, kind, order: order++, updatedAt: now,
      ...(by ? { by } : {}),
    };
    out.push({ survey, include: addMonths(due, after) >= today });
  };
  const anniv = (k: number) => addMonths(c.expiryDate!, -12 * (years - k));
  const by = c.issuer?.trim() || undefined;

  if (scheme === 'hssc' || scheme === 'annual') {
    for (let k = 1; k < years; k++) {
      // The intermediate sits between the annuals of the 2nd and 3rd years.
      if (scheme === 'hssc' && years >= 3 && k === 3) add('intermediate', `intermediate ${w}`, anniv(2), 3, 15, by);
      add('annual', `${ORD[k - 1]} annual ${w}`, anniv(k), 3, 3, by);
    }
  }
  if (scheme === 'ism' && years >= 3) add('intermediate', `intermediate ${w}`, anniv(2), 0, 12, by);
  add('renewal', `renewal ${w}`, c.expiryDate, 3, 0, by);
  return out;
}

/** The plan rows of one certificate, live, in order. */
export function certRows(certId: string, surveys: Survey[]): Survey[] {
  return surveys.filter((s) => s.certId === certId && !s.deleted).sort((a, b) => a.due.localeCompare(b.due) || a.order - b.order);
}

export interface CertSurveySummary {
  /** The first occasion not yet carried out, with where its window stands. */
  next?: { s: Survey; st: SurveyStatus };
  /** overdue → expired (the certificate is no longer valid), open → due, otherwise ok. */
  status: ComplianceStatus;
  planned: number;
}

export function certSurveySummary(certId: string, surveys: Survey[], done: SurveyDone[], today: string): CertSurveySummary {
  const rows = certRows(certId, surveys).map((s) => ({ s, st: surveyStatus(s, today, done) })).filter((r) => r.st.state !== 'done');
  const status: ComplianceStatus = rows.some((r) => r.st.state === 'overdue') ? 'expired' : rows.some((r) => r.st.state === 'open') ? 'due' : 'ok';
  const next = rows.find((r) => r.st.state === 'overdue') ?? rows.find((r) => r.st.state === 'open') ?? rows[0];
  return { next, status, planned: certRows(certId, surveys).length };
}

const RANK: Record<ComplianceStatus, number> = { expired: 0, due: 1, ok: 2, none: 3 };
/** A certificate's own status and its surveys', whichever is worse. */
export function worstOf(a: ComplianceStatus, b: ComplianceStatus): ComplianceStatus {
  return RANK[a] <= RANK[b] ? a : b;
}

/**
 * The annual an intermediate carried out on `date` takes the place of: the
 * annual of the same certificate whose window holds that date and is not yet
 * done. Recorded with it, so the plan does not ask for both.
 */
export function annualCoveredBy(inter: Survey, date: string, surveys: Survey[], done: SurveyDone[]): Survey | undefined {
  if (inter.kind !== 'intermediate' || !inter.certId) return undefined;
  return certRows(inter.certId, surveys).find(
    (s) => s.kind === 'annual' && addMonths(s.due, -s.before) <= date && date <= addMonths(s.due, s.after) && surveyStatus(s, date, done).state !== 'done',
  );
}

/**
 * The expiry a renewal gives by default, the same number of years as before:
 * counted from the old expiry when the renewal survey is completed inside the
 * 3 months before it, from the day it was completed when earlier (SOLAS I/14(b),
 * the Harmonized System).
 */
export function renewedExpiry(c: Pick<Certificate, 'issueDate' | 'expiryDate'>, doneDate?: string): string | undefined {
  if (!c.expiryDate) return undefined;
  const years = validityYears(c);
  const early = doneDate && doneDate < addMonths(c.expiryDate, -3);
  return addMonths(early ? doneDate! : c.expiryDate, 12 * years);
}
