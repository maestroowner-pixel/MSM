// ===================================
// Watch plan — the days to come, checked by the same rules as the record.
//
// The forecast is the person's record where there is one and the plan where
// there is not: a day already recorded is what happened and outranks what was
// meant. The six days before today are filled from the plan too when nobody
// recorded them, because the 77 h in 7 days rule looks back a week and a missing
// yesterday would otherwise leave a whole week of the forecast unjudged — the
// plan is the best guess of a day nobody wrote down, and it is never shown or
// stored as a record.
//
// Pure: no storage, no React — npm run check:restplan.
// ===================================

import { RestDay, SLOTS_PER_DAY } from '../types/rest';
import { CrewMember } from '../types/crew';
import { PLAN_DAYS, RestPlan } from '../types/restPlan';
import { analyseRest, RestDaySummary, RestViolation } from './restHours';
import { ShipClockInfo } from '../utils/shipTime';

/** Where a day of the forecast comes from. `changed` = a planned day that differs from the standing watch. */
export type DaySource = 'record' | 'plan' | 'changed' | 'none';

export interface ForecastDay {
  date: string;
  source: DaySource;
  /** The day's work as checked — the record's or the plan's. */
  work?: string;
  note?: string;
  summary: RestDaySummary;
  /** Breaches the plan brings — on a planned day, or on a recorded one whose 24 h runs into a planned day. */
  ahead: RestViolation[];
}

/** Days of the plan kept behind today — enough for the 7-day rule to look back. */
const KEEP_BEHIND = 7;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** What the plan says for a day: the day's own entry, else the standing watch from its first day. */
export function plannedWork(plan: RestPlan | undefined | null, date: string): { work: string; note?: string; changed: boolean } | null {
  if (!plan) return null;
  const own = plan.days?.[date];
  if (own) return { work: own.work, note: own.note, changed: true };
  if (plan.pattern && plan.pattern.length === SLOTS_PER_DAY && date >= plan.from) return { work: plan.pattern, changed: false };
  return null;
}

/**
 * One person's next `n` days from `today`. `records` may hold anyone's days —
 * only `plan.crewId`'s (or `crewId`'s) are used.
 */
export function forecast(
  crewId: string,
  records: RestDay[],
  plan: RestPlan | undefined | null,
  today: string,
  ship?: ShipClockInfo | null,
  n: number = PLAN_DAYS
): ForecastDay[] {
  const mine = records.filter((r) => r.crewId === crewId);
  const byDate = new Map(mine.map((r) => [r.date, r]));
  const end = addDays(today, n - 1);
  const days: RestDay[] = [...mine];
  const source = new Map<string, DaySource>();
  // A week behind (unrecorded days only), the horizon, and the day after it so
  // the last day's 24-hour windows can be judged.
  for (let i = -6; i <= n; i++) {
    const date = addDays(today, i);
    if (byDate.has(date)) {
      source.set(date, 'record');
      continue;
    }
    const p = plannedWork(plan, date);
    if (p) {
      days.push({ id: `plan_${date}`, crewId, holderName: '', date, work: p.work, note: p.note, updatedAt: 0 });
      source.set(date, p.changed ? 'changed' : 'plan');
    } else source.set(date, 'none');
  }
  const byAny = new Map(days.map((d) => [d.date, d]));
  const planned = (date: string) => {
    const s = source.get(date);
    return s === 'plan' || s === 'changed';
  };
  return analyseRest(days, today, end, ship).map((summary) => {
    const src = source.get(summary.date) ?? 'none';
    const day = byAny.get(summary.date);
    return {
      date: summary.date,
      source: src,
      work: day?.work,
      note: day?.note,
      summary,
      ahead: planned(summary.date) || planned(addDays(summary.date, 1)) ? summary.violations : [],
    };
  });
}

export interface PlanBreach {
  crewId: string;
  name: string;
  /** The first day the plan breaks a rule. */
  first: string;
  /** Days in the horizon with a breach the plan brings. */
  days: number;
}

/** Everyone on board whose plan breaks the rules in the next `n` days, soonest first. */
export function planBreaches(
  people: CrewMember[],
  records: RestDay[],
  plans: RestPlan[],
  today: string,
  ship?: ShipClockInfo | null,
  n: number = PLAN_DAYS
): PlanBreach[] {
  const out: PlanBreach[] = [];
  for (const c of people) {
    const plan = plans.find((p) => p.crewId === c.id);
    if (!plan) continue;
    const bad = forecast(c.id, records, plan, today, ship, n).filter((d) => d.ahead.length);
    if (bad.length) out.push({ crewId: c.id, name: c.name, first: bad[0].date, days: bad.length });
  }
  return out.sort((a, b) => a.first.localeCompare(b.first) || a.name.localeCompare(b.name));
}

/** The plan as saved: days older than a week dropped (the record holds them), empty days removed. */
export function prunePlan(plan: RestPlan, today: string): RestPlan {
  const keepFrom = addDays(today, -KEEP_BEHIND);
  const days: RestPlan['days'] = {};
  for (const [date, d] of Object.entries(plan.days ?? {})) {
    if (date >= keepFrom && d?.work) days[date] = d.note ? { work: d.work, note: d.note } : { work: d.work };
  }
  return { ...plan, days };
}

/** A fresh plan for a person — no standing watch, nothing planned. */
export function emptyPlan(c: { id: string; name: string }, today: string): RestPlan {
  return { id: c.id, crewId: c.id, holderName: c.name, pattern: '', from: today, days: {}, updatedAt: 0 };
}
