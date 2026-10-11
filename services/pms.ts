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
import { HoursReading, Machine, PmsDeferral, PmsDone, PmsJob, READINGS_KEPT } from '../types/pms';

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
  /** Counted against a deferral (services/pms activeDeferral), not the interval. */
  deferred?: boolean;
}

/** The cycle a job is in: changes every time it is done. */
export const jobCycle = (job: Pick<PmsJob, 'lastDoneDate' | 'lastDoneHours'>) => `${job.lastDoneDate ?? ''}|${job.lastDoneHours ?? ''}`;

/** The deferral that holds for the job's current cycle, latest first. */
export function activeDeferral(job: PmsJob, deferrals: PmsDeferral[]): PmsDeferral | undefined {
  const c = jobCycle(job);
  return deferrals.filter((d) => d.jobId === job.id && d.cycle === c).sort((a, b) => b.at - a.at)[0];
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Is a reading believable? Lower than the last one, or more than the hours the
 * calendar allows since it (+ 12 h of slack, as TM Master does) — accepted only
 * with a reason. `total` is the machine's running hours (counter + offset).
 */
export function checkReading(m: Pick<Machine, 'hours' | 'hoursDate'>, date: string, total: number): { ok: true } | { ok: false; why: string } {
  if (m.hours == null || !m.hoursDate) return { ok: true };
  if (total < m.hours) return { ok: false, why: `Lower than the last reading (${m.hours} h on ${m.hoursDate.split('-').reverse().join('.')}).` };
  const days = Math.max(0, daysBetween(m.hoursDate, date));
  const most = (days + 1) * 24 + 12;
  if (total - m.hours > most) return { ok: false, why: `${Math.round(total - m.hours)} h more than the last reading, in ${days} day${days === 1 ? '' : 's'} — more than the machine could have run.` };
  return { ok: true };
}

/** Running hours per calendar day, from the readings kept on the machine — since the last adjustment, which would skew it. */
export function hoursPerDay(readings: HoursReading[] | undefined): number | undefined {
  if (!readings || readings.length < 2) return undefined;
  let sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const lastAdj = sorted.map((r) => !!r.reason).lastIndexOf(true);
  if (lastAdj > 0) sorted = sorted.slice(lastAdj);
  if (sorted.length < 2) return undefined;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = daysBetween(first.date, last.date);
  const hours = last.hours - first.hours;
  if (days <= 0 || hours < 0) return undefined;
  return hours / days;
}

export function jobDue(job: PmsJob, machine: Machine | undefined, today = todayIso(), deferral?: PmsDeferral): JobDue {
  // Deferred: the new limits replace the interval for this cycle.
  if (deferral) {
    const d: JobDue = { status: 'ok', noBaseline: false, deferred: true };
    if (deferral.untilHours != null && machine?.hours != null) d.hoursLeft = deferral.untilHours - machine.hours;
    if (deferral.untilDate) d.daysLeft = daysBetween(today, deferral.untilDate);
    d.by = d.hoursLeft != null && (d.daysLeft == null) ? 'hours' : 'days';
    const over = (d.hoursLeft != null && d.hoursLeft < 0) || (d.daysLeft != null && d.daysLeft < 0);
    const soon = (d.hoursLeft != null && d.hoursLeft <= 10) || (d.daysLeft != null && d.daysLeft <= 3);
    d.status = over ? 'expired' : soon ? 'due' : 'ok';
    return d;
  }
  // One-off: due by a date and / or a counter reading, once.
  if (job.oneOff) {
    const d: JobDue = { status: 'ok', noBaseline: false };
    if (job.dueHours != null && machine?.hours != null) {
      d.hoursLeft = job.dueHours - machine.hours;
      const rate = hoursPerDay(machine.readings);
      if (rate && rate > 0 && d.hoursLeft >= 0) d.estDaysForHours = Math.floor(d.hoursLeft / rate);
    }
    if (job.dueDate) d.daysLeft = daysBetween(today, job.dueDate);
    if (d.hoursLeft == null && d.daysLeft == null) return { status: 'none', noBaseline: false };
    d.by = d.daysLeft == null ? 'hours' : 'days';
    const over = (d.hoursLeft != null && d.hoursLeft < 0) || (d.daysLeft != null && d.daysLeft < 0);
    const soon = (d.hoursLeft != null && d.hoursLeft <= 25) || (d.daysLeft != null && d.daysLeft <= 7);
    d.status = over ? 'expired' : soon ? 'due' : 'ok';
    return d;
  }
  const out: JobDue = { status: 'none', noBaseline: false };
  let hourFrac: number | undefined;
  let dayFrac: number | undefined;

  const dueH = nextDueHours(job);
  if (job.intervalHours && dueH != null && machine?.hours != null) {
    out.hoursLeft = dueH - machine.hours;
    hourFrac = out.hoursLeft / job.intervalHours;
    const rate = hoursPerDay(machine.readings);
    if (rate && rate > 0) out.estDaysForHours = Math.floor(out.hoursLeft / rate);
  }
  const dueD = nextDueDate(job);
  if (job.intervalDays && dueD) {
    out.daysLeft = daysBetween(today, dueD);
    dayFrac = out.daysLeft / job.intervalDays;
  }

  if (hourFrac == null && dayFrac == null) {
    out.noBaseline = !!(job.intervalHours || job.intervalDays);
    return out;
  }

  // Which limit comes first: compare as a fraction of each interval.
  out.by = hourFrac == null ? 'days' : dayFrac == null ? 'hours' : hourFrac <= dayFrac ? 'hours' : 'days';
  const overdue = (out.hoursLeft != null && out.hoursLeft < 0) || (out.daysLeft != null && out.daysLeft < 0);
  const soonHours = out.hoursLeft != null && out.hoursLeft <= (job.warnHours ?? Math.max(1, (job.intervalHours ?? 0) * 0.1));
  const soonDays = out.daysLeft != null && out.daysLeft <= (job.warnDays ?? Math.max(1, (job.intervalDays ?? 0) * 0.1));
  out.status = overdue ? 'expired' : soonHours || soonDays ? 'due' : 'ok';
  return out;
}

/** `iso` moved on by `n` intervals of `days` — whole months for multiples of 30, years for 365 (a fixed schedule's calendar). */
export function addInterval(iso: string, days: number, n = 1): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (days % 365 === 0) d.setUTCFullYear(d.getUTCFullYear() + (days / 365) * n);
  else if (days % 30 === 0) {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (days / 30) * n);
    // The 31st of a 30-day month is its last day, not the 1st of the next.
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + days * n);
  return d.toISOString().slice(0, 10);
}

/**
 * The next due date. Counting from the last done; or, on a fixed schedule, the
 * first scheduled date (anchor + n × interval) after the last done — so a job
 * due on the 1st and done on the 3rd is next due on the 1st again.
 */
export function nextDueDate(job: Pick<PmsJob, 'intervalDays' | 'lastDoneDate' | 'fixed' | 'anchorDate'>): string | undefined {
  if (!job.intervalDays) return undefined;
  // Counting from the last done stays in plain days, as it always has.
  if (!job.fixed || !job.anchorDate) {
    if (!job.lastDoneDate) return undefined;
    const d = new Date(`${job.lastDoneDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + job.intervalDays);
    return d.toISOString().slice(0, 10);
  }
  if (!job.lastDoneDate) return job.anchorDate;
  for (let n = 0; n < 5000; n++) {
    const d = addInterval(job.anchorDate, job.intervalDays, n);
    if (d > job.lastDoneDate) return d;
  }
  return undefined;
}

/** The next due counter reading — last done + interval, or the next fixed mark after it. */
export function nextDueHours(job: Pick<PmsJob, 'intervalHours' | 'lastDoneHours' | 'fixed' | 'anchorHours'>): number | undefined {
  if (!job.intervalHours) return undefined;
  if (!job.fixed) return job.lastDoneHours != null ? job.lastDoneHours + job.intervalHours : undefined;
  const anchor = job.anchorHours ?? job.intervalHours;
  if (job.lastDoneHours == null) return anchor;
  if (job.lastDoneHours < anchor) return anchor;
  return anchor + (Math.floor((job.lastDoneHours - anchor) / job.intervalHours) + 1) * job.intervalHours;
}

/** "120 h left", "3 d overdue", "45 d left (≈ 12 d by hours)". */
export function dueText(d: JobDue): string {
  if (d.noBaseline) return 'Never done — record the last time it was done';
  const pre = d.deferred ? 'Deferred · ' : '';
  const parts: string[] = [];
  if (d.hoursLeft != null) {
    parts.push(d.hoursLeft < 0 ? `${Math.abs(Math.round(d.hoursLeft))} h overdue` : `${Math.round(d.hoursLeft)} h left`);
    if (d.estDaysForHours != null && d.hoursLeft >= 0) parts.push(`≈ ${d.estDaysForHours} d at the current rate`);
  }
  if (d.daysLeft != null) parts.push(d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} d overdue` : `${d.daysLeft} d left`);
  return pre + (parts.join(' · ') || 'No interval set');
}

/** "Every 500 h or 1 y", or "One-off — by 20 Oct 2026 or 4 500 h". */
export function scheduleText(job: Pick<PmsJob, 'intervalHours' | 'intervalDays' | 'oneOff' | 'dueDate' | 'dueHours' | 'fixed'>): string {
  if (!job.oneOff) return `Every ${intervalText(job)}${job.fixed ? ' · fixed' : ''}`;
  const by = [job.dueDate ? job.dueDate.split('-').reverse().join('.') : null, job.dueHours != null ? `${job.dueHours} h` : null].filter(Boolean).join(' or ');
  return by ? `One-off — by ${by}` : 'One-off';
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
export function withReading(m: Machine, date: string, hours: number, note?: { reason?: string; by?: string }): Machine {
  // A reading replaces the day's earlier one — unless that one carries a reason
  // (a correction, a counter replaced): that is history and stays.
  const readings = [...(m.readings ?? []).filter((r) => r.date !== date || r.reason), { date, hours, ...(note?.reason ? { reason: note.reason } : {}), ...(note?.by ? { by: note.by } : {}) }]
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
// Moved to services/pmsCatalogue.ts (by department, 9 Oct 2026).

export function sortJobsByDue(jobs: PmsJob[], machines: Map<string, Machine>, today = todayIso(), deferrals: PmsDeferral[] = []): PmsJob[] {
  return [...jobs].sort((a, b) => {
    const da = jobDue(a, machines.get(a.machineId), today, activeDeferral(a, deferrals));
    const db = jobDue(b, machines.get(b.machineId), today, activeDeferral(b, deferrals));
    return RANK[da.status] - RANK[db.status] || (da.daysLeft ?? da.estDaysForHours ?? 1e9) - (db.daysLeft ?? db.estDaysForHours ?? 1e9);
  });
}

/** Apply a completion to its job: the new baseline. */
export function jobAfter(job: PmsJob, done: Pick<PmsDone, 'date' | 'hours'>): PmsJob {
  return { ...job, lastDoneDate: done.date, lastDoneHours: done.hours ?? job.lastDoneHours, updatedAt: Date.now() };
}

/** The last word left for this job's next sign-out (PmsDone.nextNote), newest first. */
export function noteForNext(jobId: string, done: PmsDone[]): PmsDone | undefined {
  return done.filter((d) => d.jobId === jobId && d.nextNote?.trim()).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)[0];
}

/** The machine's condition as last recorded after work on it. */
export function lastCondition(machineId: string, done: PmsDone[]): PmsDone | undefined {
  return done.filter((d) => d.machineId === machineId && d.conditionAfter).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)[0];
}

export interface AheadRow {
  job: PmsJob;
  machine: Machine;
  /** The due date, or the date the counter is estimated to reach the due hours. */
  date: string;
  estimated: boolean;
}

/**
 * The plan ahead, month by month — every job falling due between today and
 * `months` from now (overdue ones in the first month), by date or by the counter
 * at the machine's running rate. TM Master's "due timeline", as a list a phone
 * can show.
 */
export function jobsAhead(machines: Machine[], jobs: PmsJob[], deferrals: PmsDeferral[], today: string, months: number): { month: string; rows: AheadRow[] }[] {
  const byId = new Map(machines.map((m) => [m.id, m]));
  const end = addInterval(today, 30, months);
  const plusDays = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const rows: AheadRow[] = [];
  for (const j of jobs) {
    const m = byId.get(j.machineId);
    if (!m || j.deleted) continue;
    const d = jobDue(j, m, today, activeDeferral(j, deferrals));
    const cands: { date: string; estimated: boolean }[] = [];
    if (d.daysLeft != null) cands.push({ date: plusDays(d.daysLeft), estimated: false });
    if (d.hoursLeft != null) {
      if (d.hoursLeft < 0) cands.push({ date: today, estimated: false });
      else if (d.estDaysForHours != null) cands.push({ date: plusDays(d.estDaysForHours), estimated: true });
    }
    if (!cands.length) continue;
    const first = cands.sort((a, b) => a.date.localeCompare(b.date))[0];
    const date = first.date < today ? today : first.date;
    if (date >= end) continue;
    rows.push({ job: j, machine: m, date, estimated: first.estimated });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.machine.name.localeCompare(b.machine.name));
  const out: { month: string; rows: AheadRow[] }[] = [];
  for (const r of rows) {
    const mo = r.date.slice(0, 7);
    const g = out[out.length - 1];
    if (g && g.month === mo) g.rows.push(r);
    else out.push({ month: mo, rows: [r] });
  }
  return out;
}
