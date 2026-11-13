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

import { ApForm, ApFormItem, ApFormSnap, ApRoleFacts, AppraisalReason, AppraisalStep, AppraisalStepKind, CrewAppraisal, CRITERIA, AP_ROLES, AP_ROLE_TITLE, ROLE_CRITERIA, REHIRE_LABEL, APPRAISAL_REASON_LABEL, SCORE_LABEL, Score } from '../types/appraisal';
import { CrewMember, isAboard, isOfficerRank } from '../types/crew';
import type { CraneEntry, CraneTest } from '../types/craneLog';
import type { DpDay } from '../types/dp';
import { Drill, isDpDrill } from '../types/drills';
import { operatorTotals, standing } from './craneLog';
import { dpoTotals } from './dp';

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

// ---- the company's own form (13 Nov 2026) --------------------------------------

/** The app's standard form, in the same shape as a company's. */
export const STANDARD_FORM: ApFormSnap = {
  title: 'Crew appraisal',
  scale: ([1, 2, 3, 4, 5] as Score[]).map((n) => SCORE_LABEL[n]),
  items: CRITERIA.map((c) => ({ id: c.id, text: c.label, ...(c.officers ? { officers: true } : {}) })),
};

/** The form an appraisal is written on: its own copy, else the standard one. */
export const formOf = (a?: { form?: ApFormSnap }): ApFormSnap => a?.form ?? STANDARD_FORM;

/** The company's form a NEW appraisal takes — none when not set, switched off or without a criterion. */
export function activeForm(forms: ApForm[]): ApFormSnap | undefined {
  const f = forms.find((x) => x.id === 'form');
  if (!f || f.off || formProblem(f)) return undefined;
  return { title: f.title, scale: [...f.scale], items: f.items.map((i) => ({ ...i })) };
}

/** The form's items asked of this rank, in order: what is only for officers drops out for a rating (unless already answered); a heading with nothing under it too. The work by position follows, a section each. */
export function itemsFor(rank: string | undefined, a?: Pick<CrewAppraisal, 'scores' | 'answers'> & { form?: ApFormSnap; roles?: ApRoleFacts[] }): ApFormItem[] {
  const officer = isOfficerRank(rank);
  const answered = (i: ApFormItem) => !!a?.scores.some((s) => s.id === i.id && s.score) || !!a?.answers?.[i.id];
  const kept = formOf(a).items.filter((i) => i.kind === 'section' || !i.officers || officer || answered(i));
  return [...kept.filter((i, n) => i.kind !== 'section' || (n + 1 < kept.length && kept[n + 1].kind !== 'section')), ...roleItems(a?.roles)];
}

// ---- criteria by position (13 Nov 2026) ----------------------------------------

/** The heading and criteria of each role on the record, in AP_ROLES order. */
export function roleItems(roles?: ApRoleFacts[]): ApFormItem[] {
  return AP_ROLES.filter((r) => roles?.some((x) => x.role === r)).flatMap((r) => [
    { id: r, text: AP_ROLE_TITLE[r], kind: 'section' as const },
    ...ROLE_CRITERIA[r].map((c) => ({ id: c.id, text: c.label })),
  ]);
}

/** A role item's id (heading or criterion) — translated on the screens whatever the form. */
export const isRoleItem = (id: string): boolean => (AP_ROLES as string[]).includes(id) || AP_ROLES.some((r) => ROLE_CRITERIA[r].some((c) => c.id === id));

const CRANE_RANK = /crane/i;
const DP_RANK = /\b[sj]?dpo\b|\bdp\s*operator/i;

const craneName = (c: { label: string; make?: string; swl?: string }) => {
  const more = [c.make, c.swl ? `SWL ${c.swl}` : ''].filter(Boolean).join(', ');
  return more ? `${c.label} (${more})` : c.label;
};

/**
 * The work by position for one person over [from, to]: crane when they have standing crane log
 * entries or worked a load test in the period, or their rank names the crane; DP when they have
 * DP time in the period, or their rank is a DPO's. A role asked by rank alone shows 0 — the books
 * are then empty, which the appraiser should see. Pure.
 */
export function roleFacts(x: { crewId: string; name?: string; rank?: string; from: string; to: string }, books: { craneLog?: CraneEntry[]; craneTests?: CraneTest[]; dpDays?: DpDay[]; drills?: Drill[] }): ApRoleFacts[] {
  const out: ApRoleFacts[] = [];
  const cranes = operatorTotals(books.craneLog ?? [], x.crewId, x.from, x.to);
  const tests = (books.craneTests ?? []).filter((t) => t.crewId === x.crewId && t.date >= x.from && t.date <= x.to).length;
  if (cranes.length || tests || CRANE_RANK.test(x.rank ?? '')) {
    const days = new Set(standing(books.craneLog ?? []).filter((e) => e.crewId === x.crewId && e.date >= x.from && e.date <= x.to).map((e) => e.date)).size;
    out.push({
      role: 'crane',
      hours: cranes.reduce((n, c) => n + c.hours, 0),
      days,
      lifts: cranes.reduce((n, c) => n + c.lifts, 0),
      uncounted: cranes.reduce((n, c) => n + c.uncounted, 0),
      tests,
      cranes: cranes.map((c) => craneName(c.crane)),
    });
  }
  const dp = dpoTotals(books.dpDays ?? [], x.from, x.to).find((d) => d.crewId === x.crewId);
  // DP drills attended: the attendance list holds names, not crew ids.
  const drills = x.name ? (books.drills ?? []).filter((d) => d.doneAt && !d.deleted && isDpDrill(d.type) && d.date >= x.from && d.date <= x.to && d.attendance.some((a) => a.present && a.name === x.name)).length : 0;
  if ((dp && (dp.active || dp.passive)) || drills || DP_RANK.test(x.rank ?? '')) out.push({ role: 'dp', hours: dp?.active ?? 0, days: dp?.dpDays ?? 0, ...(drills ? { drills } : {}) });
  return out;
}

const num1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One line of figures, English — the paper's fact. */
export function roleFactText(r: ApRoleFacts): string {
  if (r.role === 'dp') return `DP time in the period (DP log): ${num1(r.hours)} h Active, ${r.days} DP day${r.days === 1 ? '' : 's'}${r.drills ? `, ${r.drills} DP drill${r.drills === 1 ? '' : 's'} attended` : ''}`;
  const lifts = r.lifts || r.uncounted ? `, ${r.lifts ?? 0}${r.uncounted ? '+' : ''} lifts` : '';
  const tests = r.tests ? `, ${r.tests} load test${r.tests === 1 ? '' : 's'}` : '';
  const cranes = r.cranes?.length ? ` — ${r.cranes.join('; ')}` : '';
  return `Crane operator's log in the period: ${num1(r.hours)} h at the controls, ${r.days} day${r.days === 1 ? '' : 's'}${lifts}${tests}${cranes}`;
}


/** The criteria asked of this rank — leadership only of an officer. Scores already given stay. */
export function criteriaFor(rank: string | undefined, a?: Pick<CrewAppraisal, 'scores'> & { form?: ApFormSnap; answers?: Record<string, string> }) {
  return itemsFor(rank, a ? { answers: undefined, ...a } : undefined).filter((i) => !i.kind).map((i) => ({ id: i.id, label: i.text, ...(i.officers ? { officers: true } : {}) }));
}

export type FormProblem = 'title' | 'scale' | 'criteria';

export function formProblem(f: Pick<ApFormSnap, 'title' | 'scale' | 'items'>): FormProblem | null {
  if (!f.title.trim()) return 'title';
  if (f.scale.length < 2 || f.scale.length > 10) return 'scale';
  if (!f.items.some((i) => !i.kind)) return 'criteria';
  return null;
}

const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const OFFICERS_MARK = /\s*\*officers?$/i;

/**
 * The editor's wording → the form. One line each:
 *   Scale: Poor | Fair | Good | Excellent     the scale, lowest first (also comma-separated)
 *   ## Seamanship                             a section heading
 *   Knowledge of the job                      a criterion, scored on the scale
 *   Leadership *officers                      … asked only of an officer
 *   @text Comments of the Head of Department  a question answered in words
 * A line that keeps its text (and kind) keeps its id, so a reworded form still reads its old answers. Pure.
 */
export function formFromText(text: string, old: ApFormItem[], newId: () => string): { scale: string[] | null; items: ApFormItem[] } {
  const free = [...old];
  let scale: string[] | null = null;
  const items: ApFormItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-•]\s+/, '');
    if (!line) continue;
    const sc = /^scale\s*:\s*(.*)$/i.exec(line);
    if (sc) {
      scale = sc[1].split(sc[1].includes('|') ? '|' : ',').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    let kind: ApFormItem['kind'];
    let body = line;
    if (/^##\s*/.test(body)) { kind = 'section'; body = body.replace(/^##\s*/, ''); }
    else if (/^@text\s+/i.test(body)) { kind = 'text'; body = body.replace(/^@text\s+/i, ''); }
    const officers = kind !== 'section' && OFFICERS_MARK.test(body);
    body = body.replace(OFFICERS_MARK, '').trim();
    if (!body) continue;
    const k = free.findIndex((o) => o.kind === kind && fold(o.text) === fold(body));
    const id = k >= 0 ? free.splice(k, 1)[0].id : newId();
    items.push({ id, text: body, ...(kind ? { kind } : {}), ...(officers ? { officers: true } : {}) });
  }
  return { scale, items };
}

/** The form back in the editor's wording. Pure. */
export function formText(f: Pick<ApFormSnap, 'scale' | 'items'>): string {
  return [`Scale: ${f.scale.join(' | ')}`, ...f.items.map((i) => `${i.kind === 'section' ? '## ' : i.kind === 'text' ? '@text ' : ''}${i.text}${i.officers ? ' *officers' : ''}`)].join('\n');
}

export type SignProblem = 'period' | 'scores' | 'rehire';

/** What stops the appraiser signing: the period, a score on every criterion asked (N/A counts), whether to re-hire. */
export function signProblem(a: CrewAppraisal): SignProblem | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.from) || !/^\d{4}-\d{2}-\d{2}$/.test(a.to) || a.from > a.to) return 'period';
  const max = formOf(a).scale.length;
  if (!a.scores.some((s) => s.score) || a.scores.some((s) => s.score != null && (s.score < 1 || s.score > max))) return 'scores';
  if (!a.rehire) return 'rehire';
  return null;
}

/** The average of the scores given, one decimal; null when none. */
export function average(a: Pick<CrewAppraisal, 'scores'>): number | null {
  const s = a.scores.map((x) => x.score).filter((x): x is number => !!x);
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
  const f = formOf(a);
  const max = f.scale.length;
  const range = `1 ${f.scale[0]} — ${max} ${f.scale[max - 1]}`;
  // One table per section of the form; criteria before the first heading go under "Assessment".
  const groups: { title: string; rows: string[][] }[] = [];
  const texts: string[][] = [];
  for (const i of itemsFor(a.rank, a)) {
    if (i.kind === 'section') { groups.push({ title: i.text, rows: [] }); continue; }
    if (i.kind === 'text') { texts.push([i.text, a.answers?.[i.id] ?? '']); continue; }
    if (!groups.length) groups.push({ title: 'Assessment', rows: [] });
    const s = a.scores.find((x) => x.id === i.id);
    groups[groups.length - 1].rows.push([i.text, s?.score ? `${s.score} — ${f.scale[s.score - 1] ?? ''}` : 'N/A', s?.note ?? '']);
  }
  const signs = a.steps.map((s) => [
    STEP_EN[s.kind],
    whoOf(s.by, s.byRank),
    [dmyT(s.at), how(s.signedWith)].filter(Boolean).join(' · '),
    [s.kind === 'crew' ? (s.agree ? 'I agree with this appraisal' : 'I do not agree with this appraisal') : '', s.note ?? ''].filter(Boolean).join(' — '),
  ]);
  return {
    title: `${a.form ? a.form.title : 'Crew appraisal'} — ${whoOf(a.name, a.rank)}`,
    facts: [
      `Reason: ${APPRAISAL_REASON_LABEL[a.reason]}${a.reasonNote ? ` (${a.reasonNote})` : ''} · Period ${dmy(a.from)} – ${dmy(a.to)}`,
      `Overall: ${avg != null ? `${avg.toFixed(1)} of ${max}` : '—'} · Recommended for re-hire: ${a.rehire ? REHIRE_LABEL[a.rehire] : '—'}${a.promote ? ' · Recommended for promotion' : ''}`,
      ...(a.roles ?? []).map(roleFactText),
      a.strengths ? `Strengths: ${a.strengths}` : '',
      a.improve ? `To improve: ${a.improve}` : '',
      a.training ? `Training needs: ${a.training}` : '',
      `Status: ${STAGE_EN[apStage(a)]}`,
    ].filter(Boolean),
    tables: [
      ...groups.filter((g) => g.rows.length).map((g) => ({ title: `${g.title} (${range})`, head: ['Criterion', 'Score', 'Comment'], rows: g.rows, widths: { 0: 80, 1: 50, 2: 140 } })),
      ...(texts.length ? [{ title: 'Questions', head: ['Question', 'Answer'], rows: texts, widths: { 0: 80, 1: 190 } }] : []),
      ...(signs.length ? [{ title: 'Signatures', head: ['Role', 'Name', 'Signed', 'Comment'], rows: signs, widths: { 0: 50, 1: 60, 2: 50, 3: 110 } }] : []),
    ],
    drawings: a.steps.filter((s) => s.signedWith?.drawing).map((s) => ({ title: `${STEP_EN[s.kind]} — ${whoOf(s.by, s.byRank)}`, path: s.signedWith!.drawing!, w: 300, h: 100 })),
  };
}

// ---- the paper form read by AI (functions/ai.js `apform`) -----------------------

export interface ApFormReply {
  title?: unknown;
  scale?: unknown;
  lines?: unknown;
  unreadable?: unknown;
}

/** The AI's reading of a paper form → the editor's wording, for the Master to check against the paper. Pure. */
export function apFormFromReply(r: ApFormReply): { title: string; text: string; lines: number; unreadable: string } {
  const strs = (x: unknown, max: number, len: number) => (Array.isArray(x) ? x : []).map((v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, len)).filter(Boolean).slice(0, max);
  const scale = strs(r.scale, 10, 40).map((x) => x.replace(/[|,]/g, ' '));
  const lines = strs(r.lines, 150, 200).filter((l) => !/^scale\s*:/i.test(l));
  const text = [...(scale.length >= 2 ? [`Scale: ${scale.join(' | ')}`] : []), ...lines].join('\n');
  return { title: String(r.title ?? '').trim().slice(0, 120), text, lines: lines.length, unreadable: String(r.unreadable ?? '').trim().slice(0, 300) };
}
