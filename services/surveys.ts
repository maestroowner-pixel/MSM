// ===================================
// Surveys & audits — where each stands, and the next date once done.
//
//   overdue   past the end of the window (due + after)
//   open      inside the window now
//   soon      the window opens within 60 days
//   planned   further away
//   done      once-only and carried out
// ===================================

import { Survey, SurveyDone } from '../types/survey';

export type SurveyState = 'overdue' | 'open' | 'soon' | 'planned' | 'done';

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export interface SurveyStatus {
  state: SurveyState;
  opens: string;
  closes: string;
  /** Days to the window opening (soon/planned), to its closing (open), or past it (overdue, negative). */
  days: number;
}

export function surveyStatus(s: Survey, today: string, done: SurveyDone[] = []): SurveyStatus {
  const opens = addMonths(s.due, -s.before);
  const closes = addMonths(s.due, s.after);
  if (!s.repeat && done.some((d) => d.surveyId === s.id && d.forDue === s.due)) return { state: 'done', opens, closes, days: 0 };
  if (today > closes) return { state: 'overdue', opens, closes, days: -days(closes, today) };
  if (today >= opens) return { state: 'open', opens, closes, days: days(today, closes) };
  const d = days(today, opens);
  return { state: d <= 60 ? 'soon' : 'planned', opens, closes, days: d };
}

/** The plan after it is carried out on `date`: the next due date (unchanged for a once-only). */
export function nextDue(s: Survey, date: string): string {
  if (!s.repeat) return s.due;
  // Anniversary-based: the next anniversary after this due date, however early or
  // late inside the window it was done. Otherwise counted from the day it was done.
  return s.anniversary ? addMonths(s.due, s.repeat) : addMonths(date, s.repeat);
}

const RANK: Record<SurveyState, number> = { overdue: 0, open: 1, soon: 2, planned: 3, done: 4 };
export function sortSurveys(list: Survey[], today: string, done: SurveyDone[] = []) {
  return list
    .filter((s) => !s.deleted)
    .map((s) => ({ s, st: surveyStatus(s, today, done) }))
    .sort((a, b) => RANK[a.st.state] - RANK[b.st.state] || a.s.due.localeCompare(b.s.due));
}
