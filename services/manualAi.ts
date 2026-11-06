// ===================================
// The maker's manual read by the AI (plan AI-3, 6 Nov 2026): the maintenance
// schedule of one machine's manual (a PDF or a photo of the table) becomes jobs
// with the maker's intervals, for the plan's keeper to check and add on
// screens/MachineSc. Pure.
//
// The model sees the machine (name, maker, model, counter or not) and its jobs
// under short keys (J1, J2…), and answers which of the manual's jobs is one of
// them. A key the machine does not have is dropped. A job already on the plan
// with the same interval is only counted; with another interval it is offered
// as a change — ticked when the plan's figure was the catalogue's typical one,
// which says to check it against the manual. A daily or weekly check is offered
// unticked: it is usually on the engine round. Nothing is added or changed
// without the tick, and a job without an interval the plan can count (on
// condition, as required, hours on a machine with no counter) is counted, not
// guessed into one.
// ===================================

import type { JobType, Machine, PmsJob } from '../types/pms';
import { JOB_TYPE, hasCounter } from '../types/pms';
import { TYPICAL_NOTE } from './pmsWizard';

export interface AiPlanJob {
  key: string;
  title: string;
  hours?: number;
  days?: number;
}

/** The machine's planned jobs as the AI sees them — no dates, no people. */
const planned = (machineId: string, jobs: PmsJob[]) => jobs.filter((j) => j.machineId === machineId && !j.deleted && !j.oneOff);

export function jobsForAi(machineId: string, jobs: PmsJob[]): AiPlanJob[] {
  return planned(machineId, jobs).map((j, i) => ({
    key: `J${i + 1}`,
    title: j.title,
    ...(j.intervalHours ? { hours: j.intervalHours } : {}),
    ...(j.intervalDays ? { days: j.intervalDays } : {}),
  }));
}

/** The job ids under J1, J2… when the manual was sent: a job that waited keeps them. */
export const jobKeyIds = (machineId: string, jobs: PmsJob[]) => planned(machineId, jobs).map((j) => j.id);

export const machineForAi = (m: Machine) => ({
  name: m.name,
  ...(m.maker ? { maker: m.maker } : {}),
  ...(m.model ? { model: m.model } : {}),
  counter: hasCounter(m),
});

export interface ManualAiReply {
  /** Is the manual for this maker and model: yes, no, unclear. */
  covers?: string;
  /** The model or models the manual names. */
  model?: string;
  jobs?: { title?: string; hours?: number | null; days?: number | null; type?: string | null; parts?: string | null; page?: string | number | null; key?: string | null }[];
  unreadable?: string;
}

export interface ManualProposal {
  /** m1, m2… in the reply's order. */
  id: string;
  title: string;
  hours?: number;
  days?: number;
  type?: JobType;
  /** Filters, oil, part numbers the manual names for it. */
  parts?: string;
  page?: string;
  /** The plan's job this is; absent = a new job. */
  jobId?: string;
  /** The plan's intervals for it, to show beside the maker's. */
  was?: { hours?: number; days?: number };
  /** Ticked when first shown. */
  pick: boolean;
  /** Under a week, by the calendar only: a watch check, usually on the engine round rather than in the plan. */
  daily?: boolean;
}

export interface ManualRead {
  covers: 'yes' | 'no' | 'unclear';
  model?: string;
  proposals: ManualProposal[];
  /** Jobs already on the plan at the maker's interval. */
  same: number;
  /** Jobs with no interval the plan can count: on condition, as required, or hours with no counter. */
  noInterval: string[];
  unreadable?: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const text = (v: unknown, max = 200) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().replace(/\s+/g, ' ').slice(0, max) : '');
const whole = (v: unknown, max: number): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= max ? Math.round(n) : undefined;
};
const sameInterval = (a: { hours?: number; days?: number }, b: { hours?: number; days?: number }) => (a.hours ?? 0) === (b.hours ?? 0) && (a.days ?? 0) === (b.days ?? 0);

/** The reply against the machine's jobs as they are now. */
export function readManual(m: Machine, jobs: PmsJob[], reply: ManualAiReply, sent?: string[]): ManualRead {
  const mine = planned(m.id, jobs);
  const live = new Map(mine.map((j) => [j.id, j]));
  const byKey = new Map((sent ?? mine.map((j) => j.id)).map((id, i) => [`J${i + 1}`, id] as [string, string]).filter(([, id]) => live.has(id)));
  const byTitle = new Map(mine.map((j) => [norm(j.title), j.id]));
  const counter = hasCounter(m);
  const covers = reply.covers === 'yes' || reply.covers === 'no' ? reply.covers : 'unclear';

  const out: ManualRead = { covers, proposals: [], same: 0, noInterval: [] };
  const seenTitle = new Set<string>();
  const matched = new Set<string>();
  for (const r of reply.jobs ?? []) {
    const title = text(r?.title, 120);
    if (!title || seenTitle.has(norm(title))) continue;
    seenTitle.add(norm(title));
    const hours = counter ? whole(r.hours, 100_000) : undefined;
    const days = whole(r.days, 7300);
    if (!hours && !days) {
      out.noInterval.push(title);
      continue;
    }
    const type = r.type && r.type in JOB_TYPE ? (r.type as JobType) : undefined;
    const parts = text(r.parts, 300);
    const page = text(r.page, 20);
    const base = { id: `m${out.proposals.length + 1}`, title, ...(hours ? { hours } : {}), ...(days ? { days } : {}), ...(type ? { type } : {}), ...(parts ? { parts } : {}), ...(page ? { page } : {}) };
    // The model's key first; a title the plan already has counts as the same job.
    const jobId = byKey.get(String(r.key ?? '')) ?? byTitle.get(norm(title));
    const job = jobId && !matched.has(jobId) ? live.get(jobId) : undefined;
    if (job) {
      matched.add(job.id);
      const was = { ...(job.intervalHours ? { hours: job.intervalHours } : {}), ...(job.intervalDays ? { days: job.intervalDays } : {}) };
      if (sameInterval(was, base)) {
        out.same++;
        continue;
      }
      out.proposals.push({ ...base, jobId: job.id, was, pick: !!job.notes?.includes(TYPICAL_NOTE) });
      continue;
    }
    // A second manual job on a plan job already matched may be a part of it: offered, not ticked. So is a watch check.
    const daily = !hours && !!days && days < 7;
    out.proposals.push({ ...base, pick: !jobId && !daily, ...(daily ? { daily: true } : {}) });
  }
  const model = text(reply.model, 120);
  if (model) out.model = model;
  const u = text(reply.unreadable, 300);
  if (u) out.unreadable = u;
  return out;
}

/** Where the figures came from, in a job's notes and its change log. */
export function makerNote(p: Pick<ManualProposal, 'page' | 'parts'>, file?: string): string {
  return `Maker's manual${file ? ` (${file})` : ''}${p.page ? `, p. ${p.page}` : ''}${p.parts ? ` — ${p.parts}` : ''}`;
}

/**
 * What the ticked proposals do: new jobs for the machine, and the plan's jobs
 * with the maker's intervals. The typical-interval note gives way to the
 * maker's; any other note stays, the maker's added after it. The change log
 * (services/planLog.ts) is the screen's, as for any change of interval.
 */
export function applyManual(m: Machine, jobs: PmsJob[], picked: ManualProposal[], file: string | undefined, newId: (prefix: string) => string, now: number): { add: PmsJob[]; change: PmsJob[] } {
  const counter = hasCounter(m);
  const add: PmsJob[] = [];
  const change: PmsJob[] = [];
  for (const p of picked) {
    const note = makerNote(p, file);
    const hours = counter ? p.hours : undefined;
    if (!hours && !p.days) continue;
    const job = p.jobId ? jobs.find((j) => j.id === p.jobId && !j.deleted) : undefined;
    if (job) {
      const kept = (job.notes ?? '').replace(TYPICAL_NOTE, '').trim();
      const { intervalHours: _h, intervalDays: _d, ...rest } = job;
      change.push({
        ...rest,
        ...(hours ? { intervalHours: hours } : {}),
        ...(p.days ? { intervalDays: p.days } : {}),
        notes: kept && !kept.includes(note) ? `${kept}\n${note}` : note,
        updatedAt: now,
      });
      continue;
    }
    add.push({
      id: newId('job'),
      machineId: m.id,
      title: p.title,
      ...(p.type ? { type: p.type } : {}),
      ...(hours ? { intervalHours: hours } : {}),
      ...(p.days ? { intervalDays: p.days } : {}),
      notes: note,
      updatedAt: now,
    });
  }
  return { add, change };
}
