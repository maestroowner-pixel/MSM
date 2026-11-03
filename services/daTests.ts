// ===================================
// Drug and alcohol tests (types/daTest.ts, plan item 42) — the pure part: a
// person's outcome from the readings, the screen and the laboratory; what the
// cloud may hold of a result; when the next unannounced test is due; a random
// draw; the paper. Tested by `npm run check:datests`.
//
// Outcome, worst first: refused → positive (a reading above the limit — the
// confirming one when there is one — or the laboratory's positive) → pending
// (a non-negative screen with no laboratory result yet) → negative.
// ===================================

import { DaFollowUp, DaPolicy, DaReason, DaResult, DaTest, DA_DEFAULT_POLICY, DA_REASON_LABEL, DA_UNANNOUNCED } from '../types/daTest';
import { isMasked, maskName } from '../utils/privacy';
import { addMonths } from './surveys';
import type { MachineHistory } from './pmsHistory';

export type DaOutcome = 'negative' | 'pending' | 'positive' | 'refused';

const RANK: Record<DaOutcome, number> = { negative: 0, pending: 1, positive: 2, refused: 3 };

/** The laboratory's answer to this result, if any (the latest). */
export function labOf(r: Pick<DaResult, 'id'>, follow: DaFollowUp[]): DaFollowUp | undefined {
  return follow.filter((f) => f.resultId === r.id && f.kind === 'lab').sort((a, b) => b.at - a.at)[0];
}

/** What was done about a positive or a refusal, if recorded. */
export const actionsOf = (r: Pick<DaResult, 'id'>, follow: DaFollowUp[]): DaFollowUp[] =>
  follow.filter((f) => f.resultId === r.id && f.kind === 'action').sort((a, b) => a.at - b.at);

/** The alcohol reading that counts: the confirming one when it was taken. */
export const alcoholReading = (r: Pick<DaResult, 'alcohol' | 'confirm'>): number | undefined => r.confirm ?? r.alcohol;

export function outcome(r: DaResult, limit: number, follow: DaFollowUp[]): DaOutcome {
  if (r.refused) return 'refused';
  const a = alcoholReading(r);
  const alcoholPos = a != null && a > limit;
  const lab = r.drugs === 'nonNeg' ? labOf(r, follow) : undefined;
  if (alcoholPos || lab?.lab === 'pos') return 'positive';
  if (r.drugs === 'nonNeg' && !lab) return 'pending';
  return 'negative';
}

/** The test's worst outcome. */
export function testOutcome(t: DaTest, results: DaResult[], follow: DaFollowUp[]): DaOutcome {
  return results
    .filter((r) => r.testId === t.id)
    .map((r) => outcome(r, t.limit, follow))
    .reduce<DaOutcome>((w, o) => (RANK[o] > RANK[w] ? o : w), 'negative');
}

/** A positive or a refusal with nothing recorded about it yet. */
export const needsAction = (r: DaResult, limit: number, follow: DaFollowUp[]): boolean =>
  ['positive', 'refused'].includes(outcome(r, limit, follow)) && !actionsOf(r, follow).length;

export type ResultProblem = 'alcohol' | 'drugs' | 'confirm' | 'refused';

/** What stops a person's line being signed: a reading for each test taken, a reason for a refusal. */
export function resultProblem(t: Pick<DaTest, 'alcohol' | 'drugs' | 'limit'>, r: DaResult): ResultProblem | null {
  if (r.refused != null) return r.refused.trim().length < 3 ? 'refused' : null;
  if (t.alcohol && (r.alcohol == null || !Number.isFinite(r.alcohol) || r.alcohol < 0)) return 'alcohol';
  if (t.alcohol && r.confirm != null && (!Number.isFinite(r.confirm) || r.confirm < 0)) return 'confirm';
  if (t.drugs && !r.drugs) return 'drugs';
  return null;
}

export type TestProblem = 'kind' | 'tester' | 'people' | 'date' | 'limit';

export function testProblem(t: DaTest, results: DaResult[]): TestProblem | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return 'date';
  if (!t.alcohol && !t.drugs) return 'kind';
  if (t.alcohol && !(t.limit > 0)) return 'limit';
  if (t.tester.trim().length < 2) return 'tester';
  if (!results.length) return 'people';
  return null;
}

/** Above the limit at the first reading and no confirming one yet — the screen asks for it. */
export const wantsConfirm = (r: Pick<DaResult, 'alcohol' | 'confirm' | 'refused'>, limit: number): boolean =>
  r.refused == null && r.alcohol != null && r.alcohol > limit && r.confirm == null;

// ---- the cloud: health data -------------------------------------------------

/** What goes up: the name as its first and last letter, never the crew id. */
export function daResultToCloud(r: DaResult): DaResult {
  const { crewId: _drop, ...rest } = r;
  return { ...rest, name: isMasked(r.name) ? r.name : maskName(r.name) };
}

/** What comes down: the vessel's copy, with this device's name and crew id back in it. */
export function daResultFromCloud(local: DaResult | undefined, remote: DaResult): DaResult {
  if (!local || isMasked(local.name) || maskName(local.name) !== remote.name) return remote;
  return { ...remote, name: local.name, ...(local.crewId ? { crewId: local.crewId } : {}) };
}

// ---- when ----------------------------------------------------------------------

export const policyOf = (list: DaPolicy[]): DaPolicy => list.find((p) => p.id === 'policy') ?? DA_DEFAULT_POLICY;

export interface DaDue {
  /** The last unannounced or random test, if any. */
  last?: string;
  /** The day the next one is due by. */
  due?: string;
  state: 'never' | 'ok' | 'soon' | 'overdue';
}

/** Days before the date the Board starts asking. */
export const DA_LEAD_DAYS = 30;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function nextUnannounced(tests: DaTest[], policy: DaPolicy, today: string): DaDue {
  const last = tests.filter((t) => DA_UNANNOUNCED.includes(t.reason)).map((t) => t.date).sort().pop();
  if (!last) return { state: 'never' };
  const due = addMonths(last, policy.months);
  return { last, due, state: today > due ? 'overdue' : today >= addDays(due, -DA_LEAD_DAYS) ? 'soon' : 'ok' };
}

/** Non-negative screens waiting for the laboratory, oldest first. */
export function labsAwaited(tests: DaTest[], results: DaResult[], follow: DaFollowUp[]): { t: DaTest; r: DaResult }[] {
  const byId = new Map(tests.map((t) => [t.id, t]));
  return results
    .filter((r) => r.drugs === 'nonNeg' && !r.refused && !labOf(r, follow) && byId.has(r.testId))
    .map((r) => ({ t: byId.get(r.testId)!, r }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date));
}

/** Positives and refusals with nothing recorded about them. */
export function actionsAwaited(tests: DaTest[], results: DaResult[], follow: DaFollowUp[]): { t: DaTest; r: DaResult }[] {
  const byId = new Map(tests.map((t) => [t.id, t]));
  return results
    .filter((r) => byId.has(r.testId) && needsAction(r, byId.get(r.testId)!.limit, follow))
    .map((r) => ({ t: byId.get(r.testId)!, r }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date));
}

/** n people drawn at random from the ids given (no one twice). `rnd` for the checks. */
export function drawRandom<T>(pool: T[], n: number, rnd: () => number = Math.random): T[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

export const sortTests = (list: DaTest[]) => [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.at - a.at);

/** "0.00" — readings to two decimals. */
export const mgl = (n?: number) => (n == null ? '' : n.toFixed(2));

/** Reads "0,12" and "0.12". Empty → undefined. */
export function parseReading(s: string): number | undefined {
  const v = s.trim().replace(',', '.');
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
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
export const OUTCOME_EN: Record<DaOutcome, string> = { negative: 'Negative', pending: 'Awaiting laboratory', positive: 'POSITIVE', refused: 'REFUSED' };

export const reasonEn = (r: DaReason) => DA_REASON_LABEL[r];

/** One test as a part of the PMS-history paper: the facts, each person's result, what followed, the signature. */
export function daTestReport(t: DaTest, results: DaResult[], follow: DaFollowUp[]): MachineHistory {
  const mine = results.filter((r) => r.testId === t.id).sort((a, b) => a.name.localeCompare(b.name));
  const rows = mine.map((r) => {
    const lab = labOf(r, follow);
    return [
      whoOf(r.name, r.rank),
      r.refused ? '' : t.alcohol ? [mgl(r.alcohol), r.confirm != null ? `confirm ${mgl(r.confirm)}` : ''].filter(Boolean).join(' / ') : '',
      r.refused ? '' : t.drugs ? (r.drugs === 'nonNeg' ? `Non-negative${r.sample ? ` (sample ${r.sample})` : ''}` : r.drugs === 'neg' ? 'Negative' : '') : '',
      lab ? `${lab.lab === 'pos' ? 'Positive' : 'Negative'}${lab.ref ? ` (${lab.ref})` : ''}` : '',
      r.refused ? `REFUSED — ${r.refused}` : OUTCOME_EN[outcome(r, t.limit, follow)],
    ];
  });
  const acts = mine.flatMap((r) => actionsOf(r, follow).map((f) => [whoOf(r.name, r.rank), f.note ?? '', whoOf(f.by, f.byRank), [dmyT(f.at), how(f.signedWith)].filter(Boolean).join(' · ')]));
  return {
    title: `Drug and alcohol test ${t.no}`,
    facts: [
      `${dmy(t.date)}${t.time ? ` ${t.time}` : ''} · ${DA_REASON_LABEL[t.reason]}${t.ref ? ` — ${t.ref}` : ''}${t.drawn ? ` · ${t.drawn.n} drawn at random of ${t.drawn.of} aboard` : ''}`,
      `Tests: ${[t.alcohol ? `alcohol (breath, limit ${mgl(t.limit)} mg/l)` : '', t.drugs ? 'drugs (screen)' : ''].filter(Boolean).join(', ')} · People tested: ${mine.length}`,
      t.device ? `Breathalyser: ${t.device}` : '',
      t.kit ? `Drug screening kit: ${t.kit}` : '',
      `Carried out by: ${t.tester}${t.external ? ' (external)' : ''}${t.witness ? ` · Witness: ${t.witness}` : ''}`,
      `Recorded and signed by ${whoOf(t.by, t.byRank)}, ${dmyT(t.at)}${t.signedWith ? `, ${how(t.signedWith)}` : ''}`,
      'Confidential — personal health data. Readings in mg/l of alcohol in the breath.',
    ].filter(Boolean),
    tables: [
      { title: 'Results', head: ['Person', 'Alcohol mg/l', 'Drug screen', 'Laboratory', 'Result'], rows, widths: { 0: 55, 1: 40, 2: 55, 3: 45, 4: 75 } },
      ...(acts.length ? [{ title: 'Action taken', head: ['Person', 'Action', 'By', 'Signed'], rows: acts, widths: { 0: 50, 1: 120, 2: 50, 3: 50 } }] : []),
    ],
    drawings: t.signedWith?.drawing ? [{ title: `Signed — ${whoOf(t.by, t.byRank)}`, path: t.signedWith.drawing, w: 300, h: 100 }] : [],
  };
}
