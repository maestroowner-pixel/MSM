// ===================================
// Planned maintenance — when a job is due, as pure functions.
//
// A job may have an hours interval, a calendar interval, or both; it falls due
// on WHICHEVER COMES FIRST, which is how makers write it ("every 250 h or 12
// months") and how a class surveyor reads it.
//
// Hours are judged against the machine's last counter reading, not today's
// guess. When the vessel also has a running rate (from the last readings) the
// hours left are turned into an estimated date, so an hours-based job can sit
// in the same "due soon" list as a calendar one — shown as an estimate.
//
// "Due soon" is the last 10 % of the interval (at least 1 day / 1 hour), not
// the 60 days the equipment register uses: 60 days is right for a liferaft's
// annual service and wrong for a monthly impeller check, which would be "due"
// from the day it was done.
// ===================================

import { ComplianceStatus } from '../types/equipment';
import { HoursReading, Machine, PmsDone, PmsJob, READINGS_KEPT } from '../types/pms';

export interface JobDue {
  status: ComplianceStatus;
  /** Hours left on the counter (negative = overdue), when the job has an hours interval and a baseline. */
  hoursLeft?: number;
  /** Days left on the calendar (negative = overdue), when the job has a day interval and a baseline. */
  daysLeft?: number;
  /** Estimated days until the hours run out, from the running rate. */
  estDaysForHours?: number;
  /** Which limit decides: the one that comes first. */
  by?: 'hours' | 'days';
  /** True when the job has never been done and has no baseline to count from. */
  noBaseline: boolean;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Running hours per calendar day, from the readings kept on the machine. */
export function hoursPerDay(readings: HoursReading[] | undefined): number | undefined {
  if (!readings || readings.length < 2) return undefined;
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = daysBetween(first.date, last.date);
  const hours = last.hours - first.hours;
  if (days <= 0 || hours < 0) return undefined;
  return hours / days;
}

export function jobDue(job: PmsJob, machine: Machine | undefined, today = todayIso()): JobDue {
  const out: JobDue = { status: 'none', noBaseline: false };
  let hourFrac: number | undefined;
  let dayFrac: number | undefined;

  if (job.intervalHours && job.lastDoneHours != null && machine?.hours != null) {
    out.hoursLeft = job.lastDoneHours + job.intervalHours - machine.hours;
    hourFrac = out.hoursLeft / job.intervalHours;
    const rate = hoursPerDay(machine.readings);
    if (rate && rate > 0) out.estDaysForHours = Math.floor(out.hoursLeft / rate);
  }
  if (job.intervalDays && job.lastDoneDate) {
    out.daysLeft = job.lastDoneDate ? daysBetween(today, job.lastDoneDate) + job.intervalDays : undefined;
    dayFrac = out.daysLeft! / job.intervalDays;
  }

  if (hourFrac == null && dayFrac == null) {
    out.noBaseline = !!(job.intervalHours || job.intervalDays);
    return out;
  }

  // Which limit comes first: compare as a fraction of each interval.
  out.by = hourFrac == null ? 'days' : dayFrac == null ? 'hours' : hourFrac <= dayFrac ? 'hours' : 'days';
  const overdue = (out.hoursLeft != null && out.hoursLeft < 0) || (out.daysLeft != null && out.daysLeft < 0);
  const soonHours = out.hoursLeft != null && out.hoursLeft <= Math.max(1, (job.intervalHours ?? 0) * 0.1);
  const soonDays = out.daysLeft != null && out.daysLeft <= Math.max(1, (job.intervalDays ?? 0) * 0.1);
  out.status = overdue ? 'expired' : soonHours || soonDays ? 'due' : 'ok';
  return out;
}

/** "120 h left", "3 d overdue", "45 d left (≈ 12 d by hours)". */
export function dueText(d: JobDue): string {
  if (d.noBaseline) return 'Never done — record the last time it was done';
  const parts: string[] = [];
  if (d.hoursLeft != null) {
    parts.push(d.hoursLeft < 0 ? `${Math.abs(Math.round(d.hoursLeft))} h overdue` : `${Math.round(d.hoursLeft)} h left`);
    if (d.estDaysForHours != null && d.hoursLeft >= 0) parts.push(`≈ ${d.estDaysForHours} d at the current rate`);
  }
  if (d.daysLeft != null) parts.push(d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} d overdue` : `${d.daysLeft} d left`);
  return parts.join(' · ') || 'No interval set';
}

export function intervalText(job: Pick<PmsJob, 'intervalHours' | 'intervalDays'>): string {
  const d = job.intervalDays;
  const days = !d ? null : d % 365 === 0 ? `${d / 365} y` : d % 30 === 0 ? `${d / 30} mo` : `${d} d`;
  return [job.intervalHours ? `${job.intervalHours} h` : null, days].filter(Boolean).join(' or ') || 'no interval';
}

const RANK: Record<ComplianceStatus, number> = { expired: 0, due: 1, ok: 2, none: 3 };
export function worse(a: ComplianceStatus, b: ComplianceStatus): ComplianceStatus {
  return RANK[a] <= RANK[b] ? a : b;
}
export function statusRank(s: ComplianceStatus): number {
  return RANK[s];
}

/** A new counter reading: updates hours and keeps the last READINGS_KEPT. */
export function withReading(m: Machine, date: string, hours: number): Machine {
  const readings = [...(m.readings ?? []).filter((r) => r.date !== date), { date, hours }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-READINGS_KEPT);
  const latest = readings[readings.length - 1];
  return { ...m, hours: latest.hours, hoursDate: latest.date, readings, updatedAt: Date.now() };
}

/** Newest `updatedAt` wins, by id. */
export function mergeById<T extends { id: string; updatedAt: number }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of [...local, ...remote]) {
    const have = map.get(r.id);
    if (!have || (r.updatedAt ?? 0) > (have.updatedAt ?? 0)) map.set(r.id, r);
  }
  return [...map.values()];
}

// ---- Job templates ----------------------------------------------------------
// Typical intervals for small-ship and yacht machinery, to start a plan from.
// They are NOT the maker's figures: every one is marked to be checked against
// the manual, and the officer edits them like any other job.

export const MACHINE_TYPES: { key: string; label: string; jobs: { title: string; hours?: number; days?: number }[] }[] = [
  {
    key: 'engine',
    label: 'Diesel engine (main / auxiliary)',
    jobs: [
      { title: 'Engine oil and oil filter change', hours: 250, days: 365 },
      { title: 'Fuel filters (primary and secondary)', hours: 500, days: 365 },
      { title: 'Raw-water pump impeller', hours: 500, days: 365 },
      { title: 'Air filter check / clean', hours: 250 },
      { title: 'Valve clearances check', hours: 1000 },
      { title: 'Coolant check and renewal', days: 730 },
      { title: 'Zinc anodes (heat exchanger)', days: 180 },
      { title: 'Drive belts check', hours: 250, days: 180 },
    ],
  },
  {
    key: 'generator',
    label: 'Generator',
    jobs: [
      { title: 'Engine oil and oil filter change', hours: 250, days: 365 },
      { title: 'Fuel filter', hours: 500, days: 365 },
      { title: 'Raw-water pump impeller', hours: 500, days: 365 },
      { title: 'Air filter', hours: 500 },
      { title: 'Valve clearances check', hours: 1000 },
      { title: 'Load test', days: 90 },
    ],
  },
  {
    key: 'watermaker',
    label: 'Watermaker',
    jobs: [
      { title: 'Pre-filters change', hours: 100, days: 30 },
      { title: 'Membrane clean / pickling', days: 180 },
      { title: 'High-pressure pump oil change', hours: 500, days: 365 },
    ],
  },
  {
    key: 'compressor',
    label: 'Air / BA compressor',
    jobs: [
      { title: 'Oil change', hours: 125, days: 365 },
      { title: 'Filter cartridge', hours: 25 },
      { title: 'Air quality test', days: 90 },
      { title: 'Valve service', hours: 1000 },
    ],
  },
  {
    key: 'pump',
    label: 'Pump (fire, bilge, ballast)',
    jobs: [
      { title: 'Run test and pressure check', days: 7 },
      { title: 'Seal and bearing inspection', days: 365 },
      { title: 'Impeller inspection', hours: 1000, days: 365 },
    ],
  },
  {
    key: 'fin_stabiliser',
    label: 'Fin stabilisers (hydraulic)',
    jobs: [
      { title: 'Hydraulic oil level and leaks', days: 30 },
      { title: 'Hydraulic filter change', hours: 1000, days: 365 },
      { title: 'Hydraulic oil sample / change', days: 730 },
      { title: 'Fin shaft seals and bearings inspection', days: 365 },
      { title: 'Fin anodes', days: 365 },
    ],
  },
  {
    key: 'gyro_stabiliser',
    label: 'Gyro stabiliser',
    jobs: [
      { title: 'Glycol cooling level and pump check', days: 30 },
      { title: 'Seawater strainer clean', days: 30 },
      { title: 'Cooling-loop anode', days: 365 },
      { title: 'Bearing service (maker\'s interval)', hours: 4000 },
      { title: 'Vacuum check', days: 365 },
    ],
  },
  {
    key: 'thruster',
    label: 'Bow / stern thruster',
    jobs: [
      { title: 'Run test both directions', days: 7 },
      { title: 'Gear-leg oil level / change', hours: 200, days: 365 },
      { title: 'Propeller and anode inspection (haul-out)', days: 365 },
      { title: 'Motor brushes and contactors (electric)', hours: 200, days: 365 },
    ],
  },
];

export function sortJobsByDue(jobs: PmsJob[], machines: Map<string, Machine>, today = todayIso()): PmsJob[] {
  return [...jobs].sort((a, b) => {
    const da = jobDue(a, machines.get(a.machineId), today);
    const db = jobDue(b, machines.get(b.machineId), today);
    return RANK[da.status] - RANK[db.status] || (da.daysLeft ?? da.estDaysForHours ?? 1e9) - (db.daysLeft ?? db.estDaysForHours ?? 1e9);
  });
}

/** Apply a completion to its job: the new baseline. */
export function jobAfter(job: PmsJob, done: Pick<PmsDone, 'date' | 'hours'>): PmsJob {
  return { ...job, lastDoneDate: done.date, lastDoneHours: done.hours ?? job.lastDoneHours, updatedAt: Date.now() };
}
