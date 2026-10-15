// ===================================
// The drill calendar — the year's plan of drills, month by month (15 Oct 2026:
// "a calendar of drills, with planning for the year, in Drills").
//
//   DrillYearPlan  one record per year: which drill in which month. Drawn up
//                  from the schedule (every drill's interval, counted on from
//                  the last one held), then moved about by the officer.
//   cell           what a month holds for a drill: carried out (any drill of
//                  that kind that month — the SOPEP and ISPS drills recorded on
//                  their own screens too), planned on a day (a Drill record),
//                  in the plan, or in the plan and missed.
//
// Pure: no storage, no React — check:drills tests it.
// ===================================

import { Drill, drillKind } from '../types/drills';
import type { SopepDrill } from '../types/sopep';
import type { SecurityDrill } from '../types/security';
import type { ScheduleRow } from './drills';

export interface PlanSlot {
  /** drillKind — a DRILL_TYPES id, or `other:<name>`. */
  kind: string;
  title: string;
  /** 1–12. */
  month: number;
}

export interface DrillYearPlan {
  /** The year, as text — one record per year. */
  id: string;
  slots: PlanSlot[];
  by?: string;
  updatedAt: number;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Months between drills: a 30-day drill every month, 90 days a quarter, 365 once a year. */
export const stepMonths = (everyDays: number) => Math.max(1, Math.round(everyDays / 30.4));

/**
 * The year drawn up from the schedule: each drill on a cycle from the month it
 * is next due (or this month, when it is overdue or was never held), then every
 * interval. A past year is not planned; in the current year nothing goes before
 * this month.
 */
export function proposeYear(year: number, schedule: ScheduleRow[], today: string): PlanSlot[] {
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  if (year < ty) return [];
  const first = year === ty ? tm : 1;
  const out: PlanSlot[] = [];
  for (const r of schedule) {
    if (!r.everyDays) continue;
    const step = stepMonths(r.everyDays);
    // The month it is next due, as a month count from year 0.
    let at = r.due ? Number(r.due.slice(0, 4)) * 12 + Number(r.due.slice(5, 7)) - 1 : ty * 12 + tm - 1;
    const start = year * 12 + first - 1;
    if (at < ty * 12 + tm - 1) at = ty * 12 + tm - 1; // overdue: now
    while (at < start) at += step;
    for (; at < (year + 1) * 12; at += step) out.push({ kind: r.type, title: r.title, month: (at % 12) + 1 });
  }
  return out;
}

export type CellState = 'done' | 'scheduled' | 'planned' | 'missed' | 'empty';

export interface Cell {
  state: CellState;
  /** In the year's plan. */
  inPlan: boolean;
  /** Carried out that month — dates. */
  done: { date: string; drill?: Drill }[];
  /** A drill planned on a day that month, not yet carried out. */
  scheduled?: Drill;
}

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export function cellOf(
  kind: string, year: number, month: number,
  x: { plan?: DrillYearPlan; drills: Drill[]; sopepDrills?: SopepDrill[]; securityDrills?: SecurityDrill[]; today: string },
): Cell {
  const m = ym(year, month);
  const done: Cell['done'] = x.drills.filter((d) => d.doneAt && !d.deleted && drillKind(d) === kind && d.date.startsWith(m)).map((d) => ({ date: d.date, drill: d }));
  if (kind === 'oilspill') for (const d of x.sopepDrills ?? []) if (!(d as any).cancelled && d.date.startsWith(m)) done.push({ date: d.date });
  if (kind === 'security') for (const d of x.securityDrills ?? []) if (!(d as any).cancelled && d.date.startsWith(m)) done.push({ date: d.date });
  const scheduled = x.drills.filter((d) => !d.doneAt && !d.deleted && drillKind(d) === kind && d.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const inPlan = !!x.plan?.slots.some((s) => s.kind === kind && s.month === month);
  const past = m < x.today.slice(0, 7);
  const state: CellState = done.length ? 'done' : scheduled ? 'scheduled' : inPlan ? (past ? 'missed' : 'planned') : 'empty';
  return { state, inPlan, done, ...(scheduled ? { scheduled } : {}) };
}

/** The rows of the calendar: the schedule's drills, then any other kind in the plan. */
export function calendarRows(schedule: ScheduleRow[], plan?: DrillYearPlan): { kind: string; title: string; reg: string; everyDays: number }[] {
  const rows = schedule.map((r) => ({ kind: r.type, title: r.title, reg: r.reg, everyDays: r.everyDays }));
  for (const s of plan?.slots ?? []) if (!rows.some((r) => r.kind === s.kind)) rows.push({ kind: s.kind, title: s.title, reg: '', everyDays: 0 });
  return rows;
}

/** Add or take away one month of one drill. */
export function toggleSlot(plan: DrillYearPlan, kind: string, title: string, month: number, now = Date.now()): DrillYearPlan {
  const has = plan.slots.some((s) => s.kind === kind && s.month === month);
  return { ...plan, slots: has ? plan.slots.filter((s) => !(s.kind === kind && s.month === month)) : [...plan.slots, { kind, title, month }], updatedAt: now };
}

/** The year's figures: planned, carried out of the planned, missed. */
export function yearCounts(rows: { kind: string }[], year: number, x: Parameters<typeof cellOf>[3]) {
  let planned = 0, done = 0, missed = 0;
  for (const r of rows) for (let m = 1; m <= 12; m++) {
    const c = cellOf(r.kind, year, m, x);
    if (c.inPlan) planned++;
    if (c.inPlan && c.state === 'done') done++;
    if (c.state === 'missed') missed++;
  }
  return { planned, done, missed };
}

/** A day in that month to plan the drill on: today in the current month, the 15th otherwise. */
export const dayIn = (year: number, month: number, today: string) => (today.startsWith(ym(year, month)) ? today : `${ym(year, month)}-15`);
