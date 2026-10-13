// ===================================
// Drills — numbering, the schedule (what is due when), the scenario's clock,
// and the rows of the reports (types/drills.ts). Pure: no storage, no React.
// ===================================

import { DRILL_TYPES, DRILL_TYPE_MAP, Drill, ScenarioStep, drillKind, drillTitle } from '../types/drills';
import type { SopepDrill } from '../types/sopep';
import type { SecurityDrill } from '../types/security';
import type { SignProof } from './signature';
import { DRILL_THEORY } from '../constants/drillTheory';

export function nextDrillNo(list: Drill[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^DR-${y}-(\\d+)$`);
  const top = list.reduce((m, d) => Math.max(m, Number(re.exec(d.no)?.[1] ?? 0)), 0);
  return `DR-${y}-${String(top + 1).padStart(3, '0')}`;
}

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(day(iso) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((day(to) - day(from)) / 86400000);

/** hh:mm + minutes → hh:mm (wraps past midnight). */
export function clockAt(start: string | undefined, min: number): string {
  if (!start || !/^\d{1,2}:\d{2}$/.test(start)) return '';
  const [h, m] = start.split(':').map(Number);
  const t = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const nowHm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Minutes between two hh:mm (next day when the end is earlier). */
export function minutesBetween(a?: string, b?: string): number | undefined {
  if (!a || !b || !/^\d{1,2}:\d{2}$/.test(a) || !/^\d{1,2}:\d{2}$/.test(b)) return undefined;
  const t = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
  return (t(b) - t(a) + 1440) % 1440;
}

/** The minute for a step added after `steps` — five on from the last. */
export function nextStepMin(steps: ScenarioStep[]): number {
  return steps.length ? Math.max(...steps.map((s) => s.min)) + 5 : 0;
}

export const sortSteps = (steps: ScenarioStep[]) => [...steps].sort((a, b) => a.min - b.min);

export type DrillState = 'planned' | 'running' | 'done';
export function drillState(d: Drill): DrillState {
  if (d.doneAt) return 'done';
  return d.scenario.some((s) => s.at) || d.attendance.some((a) => a.present) ? 'running' : 'planned';
}
export const DRILL_STATE_LABEL: Record<DrillState, string> = { planned: 'Planned', running: 'In progress — not signed', done: 'Carried out' };

/** Planned and in progress first (soonest first), then carried out, newest first. */
export function sortDrills(list: Drill[]): Drill[] {
  const open = list.filter((d) => !d.doneAt).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  const done = list.filter((d) => d.doneAt).sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
  return [...open, ...done];
}

/** The last drill of this type carried out — the one to copy a scenario from. */
export function lastOfType(list: Drill[], of: Pick<Drill, 'type' | 'title'>, notId?: string): Drill | undefined {
  const kind = drillKind(of);
  if (kind === 'other:') return undefined;
  return list.filter((d) => drillKind(d) === kind && d.id !== notId && d.scenario.length).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0) || b.date.localeCompare(a.date))[0];
}

export interface ScheduleRow {
  /** DRILL_TYPES id, or `other:<name>` for an own drill. */
  type: string;
  /** Own drill: its name as written, to plan the next one with. */
  own?: { title: string; reg?: string; everyDays?: number };
  title: string;
  reg: string;
  /** 0 = not on a cycle (own drill). */
  everyDays: number;
  last?: string;
  due?: string;
  /** Days to the due date — negative when overdue. */
  left?: number;
  /** Planned and not yet carried out. */
  planned?: Drill;
}

/**
 * What is due: every drill required by SOLAS / ISPS / MARPOL, and every other
 * type the vessel has held. Oil-spill and security drills recorded on the SOPEP
 * and Security screens count too.
 */
export function drillSchedule(drills: Drill[], today: string, sopepDrills: SopepDrill[] = [], securityDrills: SecurityDrill[] = []): ScheduleRow[] {
  const done = drills.filter((d) => d.doneAt);
  const lastBy = new Map<string, string>();
  const see = (type: string, date: string) => {
    if (!lastBy.has(type) || lastBy.get(type)! < date) lastBy.set(type, date);
  };
  for (const d of done) see(drillKind(d), d.date);
  for (const d of sopepDrills) see('oilspill', d.date);
  for (const d of securityDrills) see('security', d.date);
  const plannedBy = new Map<string, Drill>();
  for (const d of drills.filter((x) => !x.doneAt).sort((a, b) => a.date.localeCompare(b.date))) if (!plannedBy.has(drillKind(d))) plannedBy.set(drillKind(d), d);
  const std: ScheduleRow[] = DRILL_TYPES.filter((t) => t.required || lastBy.has(t.id) || plannedBy.has(t.id)).map((t) => {
    const last = lastBy.get(t.id);
    const due = last ? addDays(last, t.everyDays) : undefined;
    return { type: t.id, title: t.title, reg: t.reg, everyDays: t.everyDays, ...(last ? { last } : {}), ...(due ? { due, left: daysBetween(today, due) } : {}), ...(plannedBy.has(t.id) ? { planned: plannedBy.get(t.id) } : {}) };
  });
  // The vessel's own drills — one row per name, described by the latest one.
  const ownLatest = new Map<string, Drill>();
  for (const d of drills.filter((x) => x.type === 'other' && x.title?.trim()).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt)) ownLatest.set(drillKind(d), d);
  const own: ScheduleRow[] = [...ownLatest.entries()].map(([kind, d]) => {
    const last = lastBy.get(kind);
    const every = d.everyDays ?? 0;
    const due = last && every ? addDays(last, every) : undefined;
    const title = d.title!.trim();
    return {
      type: kind, title, reg: d.reg?.trim() || 'Own drill', everyDays: every, own: { title, ...(d.reg?.trim() ? { reg: d.reg.trim() } : {}), ...(every ? { everyDays: every } : {}) },
      ...(last ? { last } : {}), ...(due ? { due, left: daysBetween(today, due) } : {}), ...(plannedBy.has(kind) ? { planned: plannedBy.get(kind) } : {}),
    };
  });
  // Never held first, then the soonest due; own drills off a cycle at the end.
  const rank = (r: ScheduleRow) => (r.left != null ? r.left : r.everyDays ? -9999 : 99999);
  return [...std, ...own].sort((a, b) => rank(a) - rank(b));
}

export const everyLabel = (days: number) => (!days ? 'not on a cycle' : days === 30 ? 'monthly' : days === 60 ? 'every 2 months' : days === 90 ? 'every 3 months' : days === 180 ? 'every 6 months' : days === 365 ? 'yearly' : `every ${days} days`);

// ---- reports ----

const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
export const contentLines = (d: Drill) => (d.content ?? '').split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

export function scenarioRows(d: Drill): string[][] {
  return sortSteps(d.scenario).map((s) => [`T+${s.min}`, clockAt(d.time, s.min), s.text, s.who ?? '', s.at ?? '']);
}

export function attendanceRows(d: Drill, blank = false): string[][] {
  return d.attendance.map((a, i) => [String(i + 1), a.name, a.rank ?? '', blank ? '' : a.present ? 'present' : `ABSENT${a.reason ? ` — ${a.reason}` : ''}`, '']);
}

export function drillFacts(d: Drill): [string, string][] {
  const t = DRILL_TYPE_MAP[d.type];
  const len = minutesBetween(d.time, d.endTime);
  const present = d.attendance.filter((a) => a.present).length;
  return [
    ['Drill', `${drillTitle(d)}${t ? ` · ${t.reg}` : d.reg?.trim() ? ` · ${d.reg.trim()}` : ''}`],
    ['Topic', d.topic || '—'],
    ['Date', d.date],
    ['Time', [d.time, d.endTime].filter(Boolean).join(' – ') + (len != null ? ` (${len} min)` : '') || '—'],
    ['Location', d.location || '—'],
    ['Attendance', d.doneAt || present ? `${present} of ${d.attendance.length} present` : `${d.attendance.length} listed`],
    ['Theory briefing', d.theory ? 'Given — see the annex' : 'Not given'],
    ['Planned by', who(d.plannedBy, d.plannedByRank) || '—'],
  ];
}

export const REGISTER_HEAD = ['No.', 'Date', 'Time', 'Drill', 'Topic', 'Location', 'Present', 'Absent', 'Conducted by', 'Debrief'];
export function registerRows(list: Drill[]): string[][] {
  return sortDrills(list).filter((d) => d.doneAt).map((d) => [
    d.no, d.date, [d.time, d.endTime].filter(Boolean).join('–'), drillTitle(d), d.topic, d.location ?? '',
    String(d.attendance.filter((a) => a.present).length), d.attendance.filter((a) => !a.present).map((a) => a.name).join(', '),
    who(d.doneBy, d.doneByRank), d.debrief ?? '',
  ]);
}

export const SCHEDULE_HEAD = ['Drill', 'Requirement', 'Interval', 'Last held', 'Next due', 'Planned'];
export function scheduleRows(rows: ScheduleRow[]): string[][] {
  return rows.map((r) => [r.title, r.reg, everyLabel(r.everyDays), r.last ?? 'never', r.due ? `${r.due}${(r.left ?? 0) < 0 ? ' OVERDUE' : ''}` : r.everyDays ? 'now' : '—', r.planned ? `${r.planned.no} ${r.planned.date}` : '']);
}

// ---- the drill report / attendance list, as rows (drawn by services/drillReport.ts) ----

const proofLabel = (p?: SignProof) => (!p ? '' : p.method === 'biometric' ? 'signed biometrically' : p.method === 'drawn' ? 'signed by hand' : 'signed by PIN');
const stamp = (at: number) => {
  const x = new Date(at);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())} ${z(x.getHours())}:${z(x.getMinutes())}`;
};

export interface DrillDoc {
  title: string;
  vesselLine: string;
  status: string;
  /** Only the attendance list. */
  listOnly: boolean;
  facts: [string, string][];
  content: string[];
  scenario: string[][];
  attendance: string[][];
  debrief?: string;
  signature?: { who: string; when: string; how: string; drawing?: string };
  theory?: { title: string; text: string[] };
}

export function drillDoc(d: Drill, vesselLine: string, listOnly = false): DrillDoc {
  const st = drillState(d);
  const own = d.type === 'other' && d.theoryText?.trim() ? { title: drillTitle(d), text: d.theoryText.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean) } : undefined;
  const theory = DRILL_THEORY[d.type] ?? own;
  return {
    title: `${listOnly ? 'Attendance list' : 'Drill report'} — ${drillTitle(d)}${d.no ? ` · ${d.no}` : ''}`,
    vesselLine,
    status: st === 'done' ? DRILL_STATE_LABEL.done : 'PLAN — not yet carried out',
    listOnly,
    facts: listOnly ? drillFacts(d).filter(([k]) => ['Drill', 'Topic', 'Date', 'Time', 'Location'].includes(k)) : drillFacts(d),
    content: contentLines(d),
    scenario: scenarioRows(d),
    attendance: attendanceRows(d, listOnly && st !== 'done'),
    ...(d.debrief?.trim() ? { debrief: d.debrief.trim() } : {}),
    ...(d.doneAt ? { signature: { who: d.doneByRank ? `${d.doneBy} (${d.doneByRank})` : d.doneBy ?? '', when: stamp(d.doneAt), how: proofLabel(d.doneWith) || '—', ...(d.doneWith?.drawing ? { drawing: d.doneWith.drawing } : {}) } } : {}),
    ...(!listOnly && d.theory && theory ? { theory: { title: theory.title, text: theory.text } } : {}),
  };
}

