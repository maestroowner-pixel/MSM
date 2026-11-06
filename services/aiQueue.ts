// ===================================
// AI operations that wait for a connection (plan AI-0, 6 Nov 2026: "we go by a
// good connection; without one the operation is deferred").
//
// Only what still means something later waits here: a question, a photographed
// certificate, the plan for an inspection, a supplier's quotation or invoice, a maker's manual, an incident told for an NC, a new revision of an SMS document, a machinery defect to diagnose, the brief on a handover or the monthly report. A result comes back as a draft for someone to read and accept;
// nothing here signs or saves a record. An inspection's voice and photo do not
// wait: the round is signed long before the answer would arrive.
//
// Kept on this device, never synced and not in a .msm. The input (a photo, the
// records a question was asked over) goes the moment the job has run.
// ===================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { aiCall } from './ai';
import { AI_QUEUE_KEY } from './storage';
import { uid } from '../utils/id';

export type AiJobTask = 'ask' | 'cert' | 'readiness' | 'quote' | 'invoice' | 'manual' | 'incident' | 'sms' | 'diagnose' | 'brief';

export interface AiJob {
  id: string;
  task: AiJobTask;
  /** The question, or the certificate's name: what the list says. */
  label: string;
  at: number;
  status: 'waiting' | 'done' | 'failed';
  input?: unknown;
  result?: any;
  error?: string;
  tries: number;
  /** cert: where the result goes. A new certificate has no id yet, so it travels as its draft. readiness: the inspection asked about. quote, invoice: the order (and the quote). manual: the machine, its jobs under the keys, the file's name. incident: the NC (or 'new'), the card it came from, the past NCs under the keys. sms: the document and its revision, the lists and documents under the keys. diagnose: the defect, the records under the keys. brief: which brief (kind 'handover' | 'month'), the month, the list it was asked over (gaps). */
  target?: { certId?: string; draft?: unknown; kind?: string; date?: string; po?: string; quoteId?: string; lineIds?: string[]; machineId?: string; jobIds?: string[]; file?: string; ncId?: string; obsId?: string; ncIds?: string[]; docId?: string; rev?: number; compared?: boolean; listIds?: string[]; docIds?: string[]; defectId?: string; defectIds?: string[]; workIds?: string[]; partIds?: string[]; gaps?: import('./readinessAi').AiGap[]; month?: string };
}

/** localStorage holds about 5 MB for the whole app on the web; a queue must not take the register's room. */
export const MAX_JOB_CHARS = 3_000_000;
const MAX_TRIES = 3;

async function load(): Promise<AiJob[]> {
  try {
    const raw = await AsyncStorage.getItem(AI_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(jobs: AiJob[]) => void>();

async function save(jobs: AiJob[]): Promise<void> {
  await AsyncStorage.setItem(AI_QUEUE_KEY, JSON.stringify(jobs));
  listeners.forEach((l) => l(jobs));
}

async function patch(id: string, change: Partial<AiJob>): Promise<void> {
  const jobs = await load();
  await save(jobs.map((j) => (j.id === id ? { ...j, ...change } : j)));
}

/** No connection, or none that reached the server: worth another try later. A refusal by the server is not. */
export function isNetworkError(e: any): boolean {
  const code = String(e?.code ?? '').replace(/^functions\//, '');
  if (['unavailable', 'deadline-exceeded', 'unauthenticated'].includes(code)) return true;
  // A fetch that never arrived reads `internal` with the bare word; the server's own says what went wrong.
  if (code === 'internal' && /^internal$/i.test(String(e?.message ?? ''))) return true;
  return /network|failed to fetch|when the vessel syncs/i.test(String(e?.message ?? ''));
}

async function online(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

async function enqueue(task: AiJobTask, input: unknown, meta: Pick<AiJob, 'label' | 'target'>): Promise<AiJob> {
  if (JSON.stringify(input).length > MAX_JOB_CHARS) throw new Error('ai.tooBig');
  const job: AiJob = { id: uid('ai'), task, input, at: Date.now(), status: 'waiting', tries: 0, ...meta };
  await save([...(await load()), job]);
  return job;
}

/** The AI now if it can be reached, otherwise a job in the queue. Any other error is the caller's, as with aiCall. */
export async function aiOrLater<T>(
  task: AiJobTask,
  input: unknown,
  meta: Pick<AiJob, 'label' | 'target'>
): Promise<{ result: T } | { queued: AiJob }> {
  if (!(await online())) return { queued: await enqueue(task, input, meta) };
  try {
    return { result: await aiCall<T>(task, input) };
  } catch (e) {
    if (isNetworkError(e)) return { queued: await enqueue(task, input, meta) };
    throw e;
  }
}

let flushing = false;

/** Oldest first. Stops at the first sign of no connection or an allowance used up; both last, for this job and the next. */
export async function flushAiQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const job of (await load()).filter((j) => j.status === 'waiting')) {
      if (!(await online())) return;
      try {
        const result = await aiCall<any>(job.task, job.input);
        await patch(job.id, { status: 'done', result, input: undefined, error: undefined });
      } catch (e: any) {
        if (isNetworkError(e) || String(e?.code ?? '').endsWith('resource-exhausted')) return;
        const tries = job.tries + 1;
        const failed = tries >= MAX_TRIES;
        await patch(job.id, { tries, error: String(e?.message ?? e), ...(failed ? { status: 'failed' as const, input: undefined } : {}) });
      }
    }
  } finally {
    flushing = false;
  }
}

/** Dismissed, or read and used. */
export async function removeAiJob(id: string): Promise<void> {
  await save((await load()).filter((j) => j.id !== id));
}

/** Jobs that came back: the Board's line. */
export const readyCount = (jobs: AiJob[]) => jobs.filter((j) => j.status !== 'waiting').length;

export function useAiJobs(): AiJob[] {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  useEffect(() => {
    let live = true;
    void load().then((j) => { if (live) setJobs(j); });
    listeners.add(setJobs);
    return () => {
      live = false;
      listeners.delete(setJobs);
    };
  }, []);
  return jobs;
}
