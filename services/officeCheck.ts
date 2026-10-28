// ===================================
// "Verified by the office" (28 Oct 2026, plan item 31 — taken from JiBe).
//
// A defect closed aboard is the vessel's word that it is put right. The office
// (a superintendent or the DPA, in Fleet) then either VERIFIES the closure or
// RETURNS it with a reason: the closure moves to `closedBefore` and the defect
// is open again aboard, flagged "returned by the office". An NC closed by the
// Master can be verified the same way (not returned — a closed NC is final; the
// office raises a new one).
//
// Nothing is switched on per vessel: a vessel whose office never answered
// anything sees no "awaiting the office" notices — the first verification or
// return is what shows the office is in the loop.
//
// A deferral of a PMS job (plan item 32) goes the same way: signed by the
// Master, it holds at once — the vessel cannot wait for office hours — and the
// office APPROVES it or REFUSES it with the reason; a refused deferral holds no
// longer, so the job's own due date is back (services/pms activeDeferral). The
// Master may defer again, which is a new request. Critical equipment is still
// never deferred.
//
// Also here: the Board's order for open defects — criticality × age, so a
// month-old class defect stands above yesterday's operational one.
// ===================================

import type { PmsDefect, DefectCategory, PmsDeferral } from '../types/pms';
import type { NonConformity } from '../types/safety';
import type { PmsJob } from '../types/pms';
import { jobCycle } from './pms';

export interface OfficeCheck {
  result: 'verified' | 'returned';
  /** Required when returning: what is missing. */
  note?: string;
  by: string;
  byRank?: string;
  at: number;
}

export type DefectStage = 'open' | 'spares' | 'returned' | 'closed' | 'verified';

export function defectStage(d: PmsDefect): DefectStage {
  if (d.closed) return d.office?.result === 'verified' ? 'verified' : 'closed';
  if (d.office?.result === 'returned') return 'returned';
  return d.awaitingSpares ? 'spares' : 'open';
}

/** Closed aboard, not yet answered by the office (a re-closure after a return counts again). */
export function awaitsOffice(d: PmsDefect): boolean {
  return !!d.closed && d.office?.result !== 'verified';
}

export function ncAwaitsOffice(nc: NonConformity): boolean {
  return !!nc.closedAt && !nc.office;
}

/** Has the office ever answered on this vessel — the switch for "awaiting the office" notices. */
export function officeInLoop(defects: PmsDefect[], ncs: NonConformity[] = [], deferrals: PmsDeferral[] = []): boolean {
  return defects.some((d) => !!d.office) || ncs.some((n) => !!n.office) || deferrals.some((d) => !!d.office);
}

export interface DeferralAnswer {
  result: 'approved' | 'refused';
  /** Required when refusing: why the job cannot wait. */
  note?: string;
  by: string;
  byRank?: string;
  at: number;
}

/** A deferral not yet answered by the office. */
export function deferralAwaitsOffice(d: PmsDeferral): boolean {
  return !d.office;
}

/**
 * Deferrals waiting for the office: unanswered and still about the job's current
 * cycle. One whose job has since been done no longer needs an answer.
 */
export function deferralsToAnswer(deferrals: PmsDeferral[], jobs: Pick<PmsJob, 'id' | 'lastDoneDate' | 'lastDoneHours'>[]): PmsDeferral[] {
  const cycle = new Map(jobs.map((j) => [j.id, jobCycle(j)]));
  return deferrals.filter((d) => deferralAwaitsOffice(d) && cycle.get(d.jobId) === d.cycle).sort((a, b) => a.at - b.at);
}

/** The office approves a deferral; it holds as signed. */
export function approveDeferral(d: PmsDeferral, by: { name: string; rank?: string }, note: string, now: number): PmsDeferral {
  if (d.office) throw new Error('Already answered');
  const office: DeferralAnswer = { result: 'approved', by: by.name, ...(by.rank ? { byRank: by.rank } : {}), ...(note.trim() ? { note: note.trim() } : {}), at: now };
  return { ...d, office, updatedAt: now };
}

/** The office refuses a deferral with the reason; the job's own due date is back. */
export function refuseDeferral(d: PmsDeferral, by: { name: string; rank?: string }, note: string, now: number): PmsDeferral {
  if (d.office) throw new Error('Already answered');
  if (note.trim().length < 3) throw new Error('A reason is required');
  const office: DeferralAnswer = { result: 'refused', by: by.name, ...(by.rank ? { byRank: by.rank } : {}), note: note.trim(), at: now };
  return { ...d, office, updatedAt: now };
}

const WEIGHT: Record<DefectCategory, number> = { safety: 3, class: 2, operational: 1 };

function days(from: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(from)) / 86400000));
}

/** Criticality × age: weight × (1 + weeks open). A returned defect counts from the day it was first raised. */
export function defectScore(d: PmsDefect, today: string): number {
  return WEIGHT[d.category] * (1 + days(d.date, today) / 7);
}

/** Open defects, worst first. */
export function rankDefects(list: PmsDefect[], today: string): PmsDefect[] {
  return list.filter((d) => !d.closed).sort((a, b) => defectScore(b, today) - defectScore(a, today) || a.at - b.at);
}

/** The office's verification of a closure. */
export function verify(d: PmsDefect, by: { name: string; rank?: string }, note: string, now: number): PmsDefect {
  if (!d.closed) throw new Error('Not closed');
  const office: OfficeCheck = { result: 'verified', by: by.name, ...(by.rank ? { byRank: by.rank } : {}), ...(note.trim() ? { note: note.trim() } : {}), at: now };
  return { ...d, office, updatedAt: now };
}

/** Back to the vessel with a reason: the closure is kept in `closedBefore`, the defect is open again. */
export function giveBack(d: PmsDefect, by: { name: string; rank?: string }, note: string, now: number): PmsDefect {
  if (!d.closed) throw new Error('Not closed');
  if (note.trim().length < 3) throw new Error('A reason is required');
  const { closed, ...rest } = d;
  const office: OfficeCheck = { result: 'returned', by: by.name, ...(by.rank ? { byRank: by.rank } : {}), note: note.trim(), at: now };
  return { ...rest, closedBefore: [...(d.closedBefore ?? []), closed], office, updatedAt: now };
}

export function verifyNc(nc: NonConformity, by: { name: string; rank?: string }, note: string, now: number): NonConformity {
  if (!nc.closedAt) throw new Error('Not closed');
  const office: OfficeCheck = { result: 'verified', by: by.name, ...(by.rank ? { byRank: by.rank } : {}), ...(note.trim() ? { note: note.trim() } : {}), at: now };
  return { ...nc, office, updatedAt: now };
}

/** Closing a safety-critical or class-affecting defect needs a photo of the repair — the office verifies against it. */
export function needsPhoto(d: Pick<PmsDefect, 'category'>): boolean {
  return d.category === 'safety' || d.category === 'class';
}
