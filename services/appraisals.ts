// ===================================
// Crew appraisals (types/appraisal.ts, plan item 40) — the pure part: the stage
// read from the steps, who signs next, when each person is due (contract end,
// once a year), the average, the paper. Tested by `npm run check:appraisals`.
//
//   draft → appraiser ─┬→ crew | refused ─┬→ master → done
//                      │                   └→ done   (the Master was the appraiser)
//   draft | appraiser → cancel
//
// Due: the contract's end 30 days ahead (an appraisal for the end of contract
// covering this trip clears it); otherwise 12 months after the last appraisal's
// end, or after signing on when there is none. Not the Master — the office
// appraises the Master.
// ===================================

import { AppraisalReason, AppraisalStep, AppraisalStepKind, CrewAppraisal, CRITERIA, REHIRE_LABEL, APPRAISAL_REASON_LABEL, SCORE_LABEL, Score } from '../types/appraisal';
import { CrewMember, isAboard, isOfficerRank } from '../types/crew';

export type AppraisalStage = 'draft' | 'crew' | 'master' | 'done' | 'cancelled';

/** Steps that need a reason (rules: ≥ 3 characters). */
export const AP_NEEDS_NOTE: AppraisalStepKind[] = ['refused', 'cancel'];
/** Only the Master. */
export const AP_MASTER_STEPS: AppraisalStepKind[] = ['master'];
/** Any officer (the person appraised signs on an officer's device). */
export const AP_OFFICER_STEPS: AppraisalStepKind[] = ['appraiser', 'crew', 'refused', 'cancel'];

/** How long before the contract's end the appraisal is asked for. */
export const CONTRACT_LEAD_DAYS = 30;
/** How long before the year is up the annual one is asked for. */
export const ANNUAL_LEAD_DAYS = 30;

const last = (a: Pick<CrewAppraisal, 'steps'>): AppraisalStep | undefined => a.steps[a.steps.length - 1];
const byMaster = (a: Pick<CrewAppraisal, 'steps'>): boolean => a.steps[0]?.kind === 'appraiser' && a.steps[0].asMaster === true;

export function apStage(a: Pick<CrewAppraisal, 'steps'>): AppraisalStage {
  const s = last(a);
  switch (s?.kind) {
    case 'appraiser': return 'crew';
    case 'crew':
    case 'refused': return byMaster(a) ? 'done' : 'master';
    case 'master': return 'done';
    case 'cancel': return 'cancelled';
    default: return 'draft';
  }
}

export const apFinal = (a: Pick<CrewAppraisal, 'steps'>): boolean => ['done', 'cancelled'].includes(apStage(a));

/** Which steps the stage allows next. */
export function nextSteps(stage: AppraisalStage): AppraisalStepKind[] {
  switch (stage) {
    case 'draft': return ['appraiser', 'cancel'];
    case 'crew': return ['crew', 'refused', 'cancel'];
    case 'master': return ['master'];
    default: return [];
  }
}

/** Written and changed only before the appraiser signs. */
export const apEditable = (a: Pick<CrewAppraisal, 'steps'>): boolean => apStage(a) === 'draft';

export interface Who {
  name: string;
  rank?: string;
}

/** The record with one more step; throws when the stage does not allow it or a reason is missing. */
export function withStep(a: CrewAppraisal, kind: AppraisalStepKind, by: Who, now: number, extra: { note?: string; agree?: boolean; asMaster?: boolean; signedWith?: AppraisalStep['signedWith'] } = {}): CrewAppraisal {
  if (!nextSteps(apStage(a)).includes(kind)) throw new Error(`${kind} is not possible at ${apStage(a)}`);
  const note = extra.note?.trim();
  if (AP_NEEDS_NOTE.includes(kind) && (note ?? '').length < 3) throw new Error('A reason is required');
  if (kind === 'crew' && typeof extra.agree !== 'boolean') throw new Error('Agree or not');
  const step: AppraisalStep = {
    kind,
    by: by.name,
    ...(by.rank ? { byRank: by.rank } : {}),
    at: now,
    ...(note ? { note } : {}),
    ...(kind === 'crew' ? { agree: extra.agree } : {}),
    ...(kind === 'appraiser' && extra.asMaster ? { asMaster: true } : {}),
    ...(extra.signedWith ? { signedWith: extra.signedWith } : {}),
  };
  return { ...a, steps: [...a.steps, step], updatedAt: now };
}

/** The criteria asked of this rank — leadership only of an officer. Scores already given stay. */
export function criteriaFor(rank: string | undefined, a?: Pick<CrewAppraisal, 'scores'>) {
  const officer = isOfficerRank(rank);
  return CRITERIA.filter((c) => !c.officers || officer || a?.scores.some((s) => s.id === c.id && s.score));
}

export type SignProblem = 'period' | 'scores' | 'rehire';

/** What stops the appraiser signing: the period, a score on every criterion asked (N/A counts), whether to re-hire. */
export function signProblem(a: CrewAppraisal): SignProblem | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.from) || !/^\d{4}-\d{2}-\d{2}$/.test(a.to) || a.from > a.to) return 'period';
  if (!a.scores.some((s) => s.score)) return 'scores';
  if (!a.rehire) return 'rehire';
  return null;
}

/** The average of the scores given, one decimal; null when none. */
export function average(a: Pick<CrewAppraisal, 'scores'>): number | null {
  const s = a.scores.map((x) => x.score).filter((x): x is Score => !!x);
  return s.length ? Math.round((s.reduce((m, x) => m + x, 0) / s.length) * 10) / 10 : null;
}

export const isMasterRank = (rank?: string): boolean => /\b(master|captain|capt)\b/i.test(rank ?? '') && !/mate|bosun|boatswain|yacht\s*master\s*offshore/i.test(rank ?? '');

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** A year on, the 29th of February to the 28th. */
export function addYear(iso: string): string {
  const y = Number(iso.slice(0, 4)) + 1;
  const md = iso.slice(5) === '02-29' ? '02-28' : iso.slice(5);
  return `${y}-${md}`;
}

const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Signed by the appraiser and not cancelled — it counts, whether or not the person and the Master signed yet. */
export const apCounts = (a: Pick<CrewAppraisal, 'steps'>): boolean => a.steps.some((s) => s.kind === 'appraiser') && apStage(a) !== 'cancelled';

export interface ApDue {
  reason: AppraisalReason;
  /** The contract's end, or the day the year is up. */
  date: string;
  state: 'due' | 'overdue';
}

/** When this person is next due, if within the lead time; null when nothing is asked. */
export function appraisalDue(c: CrewMember, list: CrewAppraisal[], today: string): ApDue | null {
  if (!isAboard(c) || isMasterRank(c.rank)) return null;
  const mine = list.filter((a) => a.crewId === c.id && apCounts(a));
  const trip = c.signOn ?? '';
  if (c.contractEnd && !mine.some((a) => a.reason === 'contract' && a.to >= trip)) {
    if (today >= addDays(c.contractEnd, -CONTRACT_LEAD_DAYS)) return { reason: 'contract', date: c.contractEnd, state: today > c.contractEnd ? 'overdue' : 'due' };
    // The contract ends before the year is up: that one is what is asked.
  }
  const lastTo = mine.map((a) => a.to).sort().pop();
  const base = lastTo ?? c.signOn ?? isoOf(c.addedAt);
  const next = addYear(base);
  if (c.contractEnd && c.contractEnd <= addDays(next, ANNUAL_LEAD_DAYS) && !mine.some((a) => a.reason === 'contract' && a.to >= trip)) return null;
  if (today >= addDays(next, -ANNUAL_LEAD_DAYS)) return { reason: 'annual', date: next, state: today > next ? 'overdue' : 'due' };
  return null;
}

/** Everyone aboard who is due, overdue first, then by date. */
export function dueList(crew: CrewMember[], list: CrewAppraisal[], today: string): { c: CrewMember; due: ApDue }[] {
  return crew
    .map((c) => ({ c, due: appraisalDue(c, list, today) }))
    .filter((x): x is { c: CrewMember; due: ApDue } => !!x.due)
    .sort((a, b) => Number(b.due.state === 'overdue') - Number(a.due.state === 'overdue') || a.due.date.localeCompare(b.due.date));
}

/** Where a new appraisal's period starts: the end of the last one (+1 day), else signing on, else a year back. */
export function periodStart(c: CrewMember | undefined, list: CrewAppraisal[], today: string): string {
  const lastTo = c ? list.filter((a) => a.crewId === c.id && apCounts(a)).map((a) => a.to).sort().pop() : undefined;
  if (lastTo) return addDays(lastTo, 1) <= today ? addDays(lastTo, 1) : today;
  if (c?.signOn && c.signOn <= today) return c.signOn;
  return `${Number(today.slice(0, 4)) - 1}-${today.slice(5) === '02-29' ? '02-28' : today.slice(5)}`;
}

const ORDER: Record<AppraisalStage, number> = { master: 0, crew: 1, draft: 2, done: 3, cancelled: 4 };

/** The list: what waits for a signature first, then drafts, then the history, newest first. */
export function sortAppraisals(list: CrewAppraisal[]): CrewAppraisal[] {
  return [...list].sort((a, b) => ORDER[apStage(a)] - ORDER[apStage(b)] || b.at - a.at);
}

// ---- the paper (English) -----------------------------------------------------

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const pad = (n: number) => String(n).padStart(2, '0');
const dmyT = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const whoOf = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);
const how = (m?: { method?: string }) => (!m ? '' : m.method === 'biometric' ? 'signed biometrically' : m.method === 'drawn' ? 'signed by hand' : 'signed by PIN');
const STEP_EN: Record<AppraisalStepKind, string> = { appraiser: 'Appraiser', crew: 'Seafarer', refused: 'Seafarer refused to sign', master: 'Master (countersigned)', cancel: 'Cancelled' };
const STAGE_EN: Record<AppraisalStage, string> = { draft: 'Draft — not signed', crew: 'Awaiting the seafarer\'s signature', master: 'Awaiting the Master\'s countersignature', done: 'Complete', cancelled: 'Cancelled' };

/** One appraisal as a part of the PMS-history paper (services/pmsHistoryReport): facts, the scores, the signatures. */
export function appraisalReport(a: CrewAppraisal): import('./pmsHistory').MachineHistory {
  const avg = average(a);
  const rows = criteriaFor(a.rank, a).map((c) => {
    const s = a.scores.find((x) => x.id === c.id);
    return [c.label, s?.score ? `${s.score} — ${SCORE_LABEL[s.score]}` : 'N/A', s?.note ?? ''];
  });
  const signs = a.steps.map((s) => [
    STEP_EN[s.kind],
    whoOf(s.by, s.byRank),
    [dmyT(s.at), how(s.signedWith)].filter(Boolean).join(' · '),
    [s.kind === 'crew' ? (s.agree ? 'I agree with this appraisal' : 'I do not agree with this appraisal') : '', s.note ?? ''].filter(Boolean).join(' — '),
  ]);
  return {
    title: `Crew appraisal — ${whoOf(a.name, a.rank)}`,
    facts: [
      `Reason: ${APPRAISAL_REASON_LABEL[a.reason]}${a.reasonNote ? ` (${a.reasonNote})` : ''} · Period ${dmy(a.from)} – ${dmy(a.to)}`,
      `Overall: ${avg != null ? `${avg.toFixed(1)} of 5` : '—'} · Recommended for re-hire: ${a.rehire ? REHIRE_LABEL[a.rehire] : '—'}${a.promote ? ' · Recommended for promotion' : ''}`,
      a.strengths ? `Strengths: ${a.strengths}` : '',
      a.improve ? `To improve: ${a.improve}` : '',
      a.training ? `Training needs: ${a.training}` : '',
      `Status: ${STAGE_EN[apStage(a)]}`,
    ].filter(Boolean),
    tables: [
      { title: 'Assessment (1 Unsatisfactory — 5 Excellent)', head: ['Criterion', 'Score', 'Comment'], rows, widths: { 0: 80, 1: 50, 2: 140 } },
      ...(signs.length ? [{ title: 'Signatures', head: ['Role', 'Name', 'Signed', 'Comment'], rows: signs, widths: { 0: 50, 1: 60, 2: 50, 3: 110 } }] : []),
    ],
    drawings: a.steps.filter((s) => s.signedWith?.drawing).map((s) => ({ title: `${STEP_EN[s.kind]} — ${whoOf(s.by, s.byRank)}`, path: s.signedWith!.drawing!, w: 300, h: 100 })),
  };
}
