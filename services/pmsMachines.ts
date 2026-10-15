// ===================================
// A machine's life on the plan — copied, replaced, scrapped (15 Oct 2026, the
// TM Master V2 comparison, item 2).
//
//   copy      a second unit like this one: same details and jobs, its own
//             serial and counter, jobs not yet done. Two identical generators
//             are set up once.
//   copy jobs this one's recurring jobs onto other machines, skipping a job a
//             machine already has by that title.
//   replace   the unit is changed for a new one: the old is scrapped with the
//             reason, the new takes its place and its jobs, counted from the
//             day it was fitted — the old unit's history stays the old unit's.
//             TM Master's warning, and ours: editing the serial of the old
//             record to the new unit's would make the old history the new one's.
//   scrap     taken out of service, nothing in its place.
//
// Pure functions: the screen saves what they return.
// ===================================

import { Machine, PmsJob, hasCounter } from '../types/pms';
import { withReading } from './pms';

/** What is the unit's own and does not pass to a copy. */
const UNIT_OWN: (keyof Machine)[] = ['serial', 'hours', 'hoursDate', 'readings', 'counterOffset', 'installed', 'replaces', 'scrapped', 'deleted'];
/** What is one machine's history in a job and does not pass to a copy. */
const JOB_OWN: (keyof PmsJob)[] = ['lastDoneDate', 'lastDoneHours', 'anchorDate', 'anchorHours', 'deleted'];

function strip<T extends object>(o: T, keys: (keyof T)[]): T {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
}

/** The recurring jobs a machine carries over — not its one-offs, which were its own defects. */
export function recurringJobs(machineId: string, jobs: PmsJob[]): PmsJob[] {
  return jobs.filter((j) => j.machineId === machineId && !j.deleted && !j.oneOff);
}

function copyJob(j: PmsJob, machineId: string, id: string, now: number): PmsJob {
  return { ...strip(j, JOB_OWN), id, machineId, updatedAt: now };
}

export function copyMachine(
  m: Machine, jobs: PmsJob[], o: { id: string; name: string; now: number; uid: (p: string) => string },
): { machine: Machine; jobs: PmsJob[] } {
  const machine: Machine = { ...strip(m, UNIT_OWN), id: o.id, name: o.name, updatedAt: o.now };
  return { machine, jobs: recurringJobs(m.id, jobs).map((j) => copyJob(j, o.id, o.uid('job'), o.now)) };
}

/** Jobs to add to each target, skipping a title it already has. */
export function copyJobsTo(sourceId: string, targetIds: string[], jobs: PmsJob[], now: number, uid: (p: string) => string): PmsJob[] {
  const src = recurringJobs(sourceId, jobs);
  const out: PmsJob[] = [];
  for (const t of targetIds) {
    if (t === sourceId) continue;
    const have = new Set(jobs.filter((j) => j.machineId === t && !j.deleted).map((j) => j.title.trim().toLowerCase()));
    for (const j of src) if (!have.has(j.title.trim().toLowerCase())) out.push(copyJob(j, t, uid('job'), now));
  }
  return out;
}

export interface Retire {
  date: string;
  reason: string;
  by: string;
  byRank?: string;
  now: number;
}

/** Off the plan: the machine marked scrapped, its jobs taken off (their history is in PmsDone). */
export function scrapMachine(m: Machine, jobs: PmsJob[], r: Retire, replacedBy?: string): { machine: Machine; jobs: PmsJob[] } {
  const machine: Machine = {
    ...m,
    scrapped: { date: r.date, reason: r.reason, by: r.by, ...(r.byRank ? { byRank: r.byRank } : {}), ...(replacedBy ? { replacedBy } : {}) },
    updatedAt: r.now,
  };
  return { machine, jobs: jobs.filter((j) => j.machineId === m.id && !j.deleted).map((j) => ({ ...j, deleted: true, updatedAt: r.now })) };
}

/**
 * The new unit: the old one's details and recurring jobs, its own serial, its
 * counter from `hours`, fitted on `date` — each job counted from then, as a new
 * unit owes its first service an interval after it was fitted.
 */
export function replaceMachine(
  m: Machine, jobs: PmsJob[], r: Retire & { id: string; serial?: string; hours?: number; uid: (p: string) => string },
): { old: Machine; fitted: Machine; jobs: PmsJob[] } {
  const counter = hasCounter(m);
  const hours = counter ? r.hours ?? 0 : undefined;
  const copy = copyMachine(m, jobs, { id: r.id, name: m.name, now: r.now, uid: r.uid });
  const fitted: Machine = {
    ...copy.machine,
    ...(r.serial?.trim() ? { serial: r.serial.trim() } : {}),
    installed: r.date,
    replaces: m.id,
    ...(hours != null ? { hours, hoursDate: r.date, readings: [{ date: r.date, hours, reason: `Fitted — replaced ${m.serial ? `S/N ${m.serial}` : 'the old unit'}`, by: r.by }] } : {}),
  };
  const newJobs = copy.jobs.map((j) => ({ ...j, lastDoneDate: r.date, ...(counter && j.intervalHours ? { lastDoneHours: hours } : {}) }));
  const off = scrapMachine(m, jobs, r, r.id);
  return { old: off.machine, fitted, jobs: [...newJobs, ...off.jobs] };
}

/** The chain of units this one replaced, newest first — where to read its earlier history. */
export function predecessors(m: Machine, all: Machine[]): Machine[] {
  const out: Machine[] = [];
  let cur: Machine | undefined = m;
  const seen = new Set<string>();
  while (cur?.replaces && !seen.has(cur.replaces)) {
    seen.add(cur.replaces);
    cur = all.find((x) => x.id === cur!.replaces);
    if (cur) out.push(cur);
  }
  return out;
}

// ---- Components (TM Master comparison, item 6) ----

/** A machine's components, and theirs, depth first. */
export function descendants(id: string, all: Machine[]): Machine[] {
  const out: Machine[] = [];
  const seen = new Set<string>([id]);
  const walk = (pid: string) => {
    for (const c of all.filter((m) => m.parentId === pid && !m.deleted && !m.scrapped)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

/**
 * The components whose hours follow `next` after its counter moved from
 * `prev`: each gets the same difference on its own figure (not below 0), and
 * passes it on to those that follow it. Nothing when the hours did not change.
 */
export function followerReadings(prev: Machine | undefined, next: Machine, all: Machine[], date: string): Machine[] {
  const diff = (next.hours ?? 0) - (prev?.hours ?? next.hours ?? 0);
  if (!diff || next.hours == null) return [];
  const out: Machine[] = [];
  const step = (parentId: string, seen: Set<string>) => {
    for (const c of all.filter((m) => m.parentId === parentId && m.followsParent && !m.deleted && !m.scrapped)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(withReading(c, date, Math.max(0, Math.round(((c.hours ?? 0) + diff) * 10) / 10)));
      step(c.id, seen);
    }
  };
  step(next.id, new Set([next.id]));
  return out;
}

/** Machines that may be this one's parent: not itself, not one of its own components. */
export function parentChoices(m: Pick<Machine, 'id'>, all: Machine[]): Machine[] {
  const own = new Set([m.id, ...descendants(m.id, all).map((x) => x.id)]);
  return all.filter((x) => !own.has(x.id) && !x.deleted && !x.scrapped).sort((a, b) => a.name.localeCompare(b.name));
}

/** The machines in list order: each parent followed by its components, with their depth. */
export function treeOrder<T extends { m: Machine }>(rows: T[]): (T & { depth: number })[] {
  const ids = new Set(rows.map((r) => r.m.id));
  const kids = (pid?: string) => rows.filter((r) => (pid ? r.m.parentId === pid : !r.m.parentId || !ids.has(r.m.parentId)));
  const out: (T & { depth: number })[] = [];
  const seen = new Set<string>();
  const walk = (list: T[], depth: number) => {
    for (const r of list) {
      if (seen.has(r.m.id)) continue;
      seen.add(r.m.id);
      out.push({ ...r, depth });
      walk(kids(r.m.id), depth + 1);
    }
  };
  walk(kids(undefined), 0);
  return out;
}
