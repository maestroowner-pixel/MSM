// ===================================
// Drills — numbering, the schedule (what is due when), the scenario's clock,
// and the rows of the reports (types/drills.ts). Pure: no storage, no React.
// ===================================

import { DRILL_TYPES, DRILL_TYPE_MAP, Attendee, Drill, ScenarioStep, drillKind, drillTitle } from '../types/drills';
import type { SopepDrill } from '../types/sopep';
import type { SecurityDrill } from '../types/security';
import type { SignProof } from './signature';
import { DRILL_THEORY } from '../constants/drillTheory';
import { t, tk } from '../utils/t';
import { shipHm, shipStamp } from '../utils/shipTime';

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

export const nowHm = (d = new Date()) => shipHm(d.getTime());

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

// ---- the archive: drills carried out, by year, kind and words ----

export interface ArchiveFilter {
  /** 'YYYY', or '' for every year. */
  year: string;
  /** drillKind, or '' for every kind. */
  kind: string;
  /** Words in the number, drill, topic, place, debrief or a name on the list. */
  q: string;
}

export const archiveYears = (list: Drill[]) => [...new Set(list.filter((d) => d.doneAt).map((d) => d.date.slice(0, 4)))].sort().reverse();

/** The kinds held in that year (all years with ''), named, most held first. */
export function archiveKinds(list: Drill[], year: string): { kind: string; title: string; n: number }[] {
  const m = new Map<string, { kind: string; title: string; n: number }>();
  for (const d of list.filter((x) => x.doneAt && (!year || x.date.startsWith(year)))) {
    const k = drillKind(d);
    const e = m.get(k) ?? { kind: k, title: drillTitle(d), n: 0 };
    e.n++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
}

export function archive(list: Drill[], f: ArchiveFilter): Drill[] {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((d) => d.doneAt && (!f.year || d.date.startsWith(f.year)) && (!f.kind || drillKind(d) === f.kind))
    .filter((d) => {
      if (!words.length) return true;
      const hay = [d.no, drillTitle(d), d.topic, d.location, d.debrief, d.doneBy, ...d.attendance.map((a) => a.name)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
}

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Newest month first: "October 2026" and its drills. */
export function byMonth(list: Drill[]): { month: string; drills: Drill[] }[] {
  const out: { month: string; drills: Drill[] }[] = [];
  for (const d of list) {
    const label = `${MONTH[Number(d.date.slice(5, 7)) - 1]} ${d.date.slice(0, 4)}`;
    const last = out[out.length - 1];
    if (last?.month === label) last.drills.push(d);
    else out.push({ month: label, drills: [d] });
  }
  return out;
}

export const everyLabel = (days: number) => (!days ? 'not on a cycle' : days === 30 ? 'monthly' : days === 60 ? 'every 2 months' : days === 90 ? 'every 3 months' : days === 180 ? 'every 6 months' : days === 365 ? 'yearly' : `every ${days} days`);

// ---- on screen, in the interface language (reports keep the English above) ----
const CYCLES = [30, 60, 90, 180, 365];
export const everyText = (days: number) => (!days ? t('dr.every.0') : CYCLES.includes(days) ? tk(`dr.every.${days}`) : t('dr.everyN', { n: days }));
/** OWN_INTERVALS' label — "Monthly", "Not on a cycle". */
export const intervalName = (days?: number) => (days && CYCLES.includes(days) ? tk(`dr.int.${days}`) : t('dr.noCycle'));
export const drillTypeName = (id: string) => (DRILL_TYPE_MAP[id] ? tk(`dr.type.${id}`) : t('dr.otherDrill'));
export const drillName = (d: Pick<Drill, 'type' | 'title'>) => (d.type === 'other' ? d.title?.trim() || t('dr.otherDrill') : drillTypeName(d.type));
/** A schedule / archive kind — an own drill keeps the name it was given. */
export const kindName = (kind: string, title: string) => (kind.startsWith('other:') ? title : drillTypeName(kind));
export const drillStateName = (s: DrillState) => tk(`dr.st.${s}`);

// ---- reports ----

const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
export const contentLines = (d: Drill) => (d.content ?? '').split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

export function scenarioRows(d: Drill): string[][] {
  return sortSteps(d.scenario).map((s) => [`T+${s.min}`, clockAt(d.time, s.min), s.text, s.who ?? '', s.at ?? '']);
}

/** The signature cell: how and when they signed; a hand signature is drawn over it (drillDoc.attSigs). */
export function attendanceSig(a: Attendee): string {
  if (!a.signedAt) return '';
  const hm = shipHm(a.signedAt);
  return a.signedWith?.method === 'drawn' ? hm : `${proofLabel(a.signedWith) || 'signed'} · ${hm}`;
}

export function attendanceRows(d: Drill, blank = false): string[][] {
  return d.attendance.map((a, i) => [String(i + 1), a.name, a.rank ?? '', blank ? '' : a.present ? 'present' : `ABSENT${a.reason ? ` — ${a.reason}` : ''}`, blank ? '' : attendanceSig(a)]);
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
  return shipStamp(at);
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
  /** Hand signatures on the attendance list, row by row (SVG paths). */
  attSigs: (string | undefined)[];
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
    attendance: attendanceRows(d, listOnly && st !== 'done' && !d.attendance.some((a) => a.signedAt)),
    attSigs: d.attendance.map((a) => (a.signedWith?.method === 'drawn' ? a.signedWith.drawing : undefined)),
    ...(d.debrief?.trim() ? { debrief: d.debrief.trim() } : {}),
    ...(d.doneAt ? { signature: { who: d.doneByRank ? `${d.doneBy} (${d.doneByRank})` : d.doneBy ?? '', when: stamp(d.doneAt), how: proofLabel(d.doneWith) || '—', ...(d.doneWith?.drawing ? { drawing: d.doneWith.drawing } : {}) } } : {}),
    ...(!listOnly && d.theory && theory ? { theory: { title: theory.title, text: theory.text } } : {}),
  };
}

