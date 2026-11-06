// ===================================
// The AI's brief (plan AI-7, 6 Nov 2026): a few lines on top of a report that
// say what matters most to whoever reads it next — the relief at a crew change
// (Handover), the office in the monthly digest (the Master's note). The report
// itself stays what counts; the brief is a draft its writer edits before it
// goes on the PDF or with the mail.
//
// What goes: the lines of Inspection readiness (gapsForAi — crew lines carry no
// name), the writer's own notes and, for the month, its counts (PMS completion,
// defects, NCs, drills), all through scrubNames — names become ranks. Nothing
// else. The brief comes back in English: it is printed on an English report.
// A point that names a line of the list must name a real one; a key the list
// does not hold is dropped, and a point left with none goes unless it came from
// the notes or the counts. This file is pure — `npm run check:briefai`.
// ===================================

import { Readiness } from './readiness';
import { AiGap, gapsForAi } from './readinessAi';
import { Person, scrubNames } from './incidentAi';
import { PmsMonth, completionLine } from './pmsKpi';
import { PmsDefect } from '../types/pms';
import { NonConformity } from '../types/safety';
import { Drill } from '../types/drills';

export type BriefFor = 'handover' | 'month';

export const MAX_NOTES = 4000;
export const MAX_POINTS = 8;

export interface BriefInput {
  for: BriefFor;
  today: string;
  /** handover: the relief's trip in days. month: the month, yyyy-mm. */
  ahead?: number;
  month?: string;
  /** What is handed over — "Engine room". */
  area?: string;
  gaps: AiGap[];
  /** The writer's own words: work in progress, remarks, a few words for the office. */
  notes: string;
  /** The month's counts, one a line. */
  facts: string[];
}

const scrub = (v: string, people: Person[], max: number) => scrubNames(v.slice(0, max), people);

/** The handover's input: readiness looking `ahead` days + the outgoing officer's notes. */
export function handoverForAi(r: Readiness, d: { area: string; ahead: number; progress: string; remarks: string }, people: Person[]): { input: BriefInput; replaced: number } {
  const notes = [d.progress.trim() ? `Work in progress:\n${d.progress.trim()}` : '', d.remarks.trim() ? `For the relief:\n${d.remarks.trim()}` : ''].filter(Boolean).join('\n\n');
  const n = scrub(notes, people, MAX_NOTES);
  const area = scrub(d.area.trim(), people, 120);
  return { input: { for: 'handover', today: r.today, ahead: d.ahead, ...(area.text ? { area: area.text } : {}), gaps: gapsForAi(r), notes: n.text, facts: [] }, replaced: n.replaced + area.replaced };
}

const inMonth = (iso: string | undefined, month: string) => !!iso && iso.startsWith(month);
const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The month in counts, in English, no names — what the office reads beside the digest. */
export function monthFacts(x: { month: string; pms?: PmsMonth; defects?: PmsDefect[]; ncs?: NonConformity[]; drills?: Drill[] }): string[] {
  const out: string[] = [];
  if (x.pms) out.push(`Planned maintenance: ${completionLine(x.pms)}; ${x.pms.deferred.length} deferred this month`);
  if (x.pms?.downtime?.length) out.push(`Machines out of service this month: ${x.pms.downtime.length}`);
  if (x.defects) {
    const live = x.defects;
    const raised = live.filter((d) => inMonth(d.date, x.month)).length;
    const closed = live.filter((d) => inMonth(d.closed?.date, x.month)).length;
    out.push(`Machinery defects: ${raised} raised, ${closed} closed this month, ${live.filter((d) => !d.closed).length} open now`);
  }
  if (x.ncs) {
    const raised = x.ncs.filter((n) => inMonth(n.date, x.month)).length;
    const closed = x.ncs.filter((n) => n.closedAt && dayOf(n.closedAt).startsWith(x.month)).length;
    out.push(`Non-conformities: ${raised} raised, ${closed} closed this month, ${x.ncs.filter((n) => !n.closedAt).length} open now`);
  }
  if (x.drills) {
    const held = x.drills.filter((d) => !d.deleted && d.doneAt && inMonth(d.date, x.month));
    out.push(`Drills held this month: ${held.length}${held.length ? ` (${held.map((d) => d.topic.trim()).filter(Boolean).slice(0, 12).join('; ')})` : ''}`);
  }
  return out;
}

/** The month's input: readiness today looking 30 days + the counts + the Master's few words. */
export function monthForAi(r: Readiness, month: string, facts: string[], words: string, people: Person[]): { input: BriefInput; replaced: number } {
  const n = scrub(words.trim(), people, MAX_NOTES);
  const f = facts.map((l) => scrub(l, people, 600));
  return { input: { for: 'month', today: r.today, month, gaps: gapsForAi(r), notes: n.text, facts: f.map((x) => x.text) }, replaced: n.replaced + f.reduce((a, x) => a + x.replaced, 0) };
}

export interface BriefAiReply {
  points?: { text?: string; keys?: string[]; from?: string }[];
}

export interface BriefPoint {
  text: string;
  /** The readiness lines it stands on — the titles, for the screen. */
  lines: string[];
  from: 'list' | 'notes' | 'facts';
}

/** The reply against the list it was asked over: invented keys go, a list point left with none goes. */
export function readBrief(reply: BriefAiReply, gaps: AiGap[]): BriefPoint[] {
  const byKey = new Map(gaps.map((g) => [g.key, g]));
  const out: BriefPoint[] = [];
  for (const p of reply.points ?? []) {
    const text = String(p.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const named = [...new Set((p.keys ?? []).map(String))];
    const lines = named.map((k) => byKey.get(k)).filter((g): g is AiGap => !!g).map((g) => g.title);
    const from = p.from === 'notes' || p.from === 'facts' ? p.from : 'list';
    if (from === 'list' && !lines.length) continue;
    out.push({ text, lines, from });
    if (out.length >= MAX_POINTS) break;
  }
  return out;
}

/** What goes into the brief field: one point a line. */
export const briefText = (points: BriefPoint[]) => points.map((p) => `- ${p.text}`).join('\n');
