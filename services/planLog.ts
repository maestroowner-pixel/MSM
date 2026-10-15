// ===================================
// The change log of the maintenance plan (15 Oct 2026, TM Master V2 comparison,
// item 7): who changed a job's interval or a machine's class code, when, from
// what to what, and why. An auditor's first question about an interval that
// grew from 250 h to 500 h is "who decided that, and on what grounds".
//
// Kept on the record itself (PmsJob.changes, Machine.changes — the last
// CHANGES_KEPT), not in a collection of its own: only the plan's keepers change
// the plan, and they write the whole record anyway.
// ===================================

import type { Machine, PlanChange, PmsJob } from '../types/pms';

export const CHANGES_KEPT = 100;

type Fmt<T> = { label: string; get: (x: T) => string; needsReason?: boolean };

const yes = (b?: boolean) => (b ? 'yes' : 'no');
const n = (v?: number, unit = '') => (v != null ? `${v}${unit}` : '—');

export const JOB_FIELDS: Record<string, Fmt<PmsJob>> = {
  title: { label: 'Title', get: (j) => j.title },
  intervalHours: { label: 'Interval, hours', get: (j) => n(j.intervalHours, ' h'), needsReason: true },
  intervalDays: { label: 'Interval, days', get: (j) => n(j.intervalDays, ' d'), needsReason: true },
  dueDate: { label: 'Due date', get: (j) => j.dueDate ?? '—', needsReason: true },
  dueHours: { label: 'Due at', get: (j) => n(j.dueHours, ' h'), needsReason: true },
  fixed: { label: 'Fixed schedule', get: (j) => yes(j.fixed), needsReason: true },
  type: { label: 'Type', get: (j) => j.type ?? '—' },
  classJob: { label: 'Class job', get: (j) => yes(j.classJob), needsReason: true },
  permitType: { label: 'Permit to work', get: (j) => j.permitType ?? 'none', needsReason: true },
  docIds: { label: 'Documents to read', get: (j) => String(j.docIds?.length ?? 0) },
};

export const MACHINE_FIELDS: Record<string, Fmt<Machine>> = {
  name: { label: 'Name', get: (m) => m.name },
  critical: { label: 'Critical equipment', get: (m) => yes(m.critical), needsReason: true },
  classItem: { label: 'Class item', get: (m) => yes(m.classItem), needsReason: true },
  classCode: { label: 'Class code', get: (m) => m.classCode || '—', needsReason: true },
  parentId: { label: 'Part of', get: (m) => m.parentId ?? '—' },
  followsParent: { label: 'Hours from its parent', get: (m) => yes(m.followsParent) },
  dept: { label: 'Department', get: (m) => m.dept ?? 'engineering' },
  maker: { label: 'Maker', get: (m) => m.maker ?? '—' },
  model: { label: 'Model', get: (m) => m.model ?? '—' },
  serial: { label: 'Serial', get: (m) => m.serial ?? '—' },
};

export interface PlanDiff {
  field: string;
  label: string;
  from: string;
  to: string;
  needsReason: boolean;
}

/** What changed between the saved record and the edit, by the tracked fields. */
export function planDiff<T>(prev: T | undefined, next: T, fields: Record<string, Fmt<T>>): PlanDiff[] {
  if (!prev) return [];
  const out: PlanDiff[] = [];
  for (const [field, f] of Object.entries(fields)) {
    const a = f.get(prev);
    const b = f.get(next);
    if (a !== b) out.push({ field, label: f.label, from: a, to: b, needsReason: !!f.needsReason });
  }
  return out;
}

/** The record's log with this edit's changes added, newest last, the last CHANGES_KEPT kept. */
export function withChanges(log: PlanChange[] | undefined, diff: PlanDiff[], who: { by: string; byRank?: string }, reason: string, at: number): PlanChange[] | undefined {
  if (!diff.length) return log;
  const add: PlanChange[] = diff.map((d) => ({ at, by: who.by, ...(who.byRank ? { byRank: who.byRank } : {}), field: d.label, from: d.from, to: d.to, ...(reason.trim() ? { reason: reason.trim() } : {}) }));
  return [...(log ?? []), ...add].slice(-CHANGES_KEPT);
}

/** "Interval, hours 250 h → 500 h". */
export const changeText = (c: PlanChange) => `${c.field}: ${c.from} → ${c.to}`;
