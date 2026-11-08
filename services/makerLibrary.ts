// ===================================
// The makers' library (plan item 54, 8 Nov 2026) on the app's side — pure.
// functions/makerLibrary.js keeps the schedule a maker's manual gives for one
// model, filled by manual reads (plan AI-3) on any vessel; task `library`
// answers per unit. Here it becomes:
//   - the plan wizard's jobs for a unit of that maker and model, in place of
//     the catalogue's typical ones (libraryJobs);
//   - a manual read on a machine's screen (asManualReply), checked like one.
// It is a proposal from another vessel's manual: every job says where it came
// from and to check it against the manual aboard.
// ===================================

import type { JobType } from '../types/pms';
import type { ManualAiReply } from './manualAi';

export interface LibraryJob {
  title: string;
  hours?: number | null;
  days?: number | null;
  type?: JobType | null;
  parts?: string;
  page?: string;
}

export interface LibraryEntry {
  key: string;
  /** As typed on the vessel whose manual was read. */
  maker: string;
  model: string;
  /** The model or models the manual names. */
  manualModel?: string;
  jobs: LibraryJob[];
  /** How many vessels' manuals it was read from. */
  vessels: number;
  readAt?: number;
}

/** A unit's maker and model as asked of the library; null when either is blank. */
export function pairOf(u: { maker?: string; model?: string }): string | null {
  const a = (u.maker ?? '').trim().replace(/\s+/g, ' ');
  const b = (u.model ?? '').trim().replace(/\s+/g, ' ');
  return a && b ? `${a}\u0001${b}` : null;
}

export const splitPair = (p: string) => {
  const [maker, model] = p.split('\u0001');
  return { maker, model };
};

export const entryName = (e: Pick<LibraryEntry, 'maker' | 'model'>) => `${e.maker} ${e.model}`.trim();

/** Where a job from the library came from, in its notes and change log. */
export const libraryFile = (e: Pick<LibraryEntry, 'maker' | 'model'>) => `ISMpilot library, ${entryName(e)}`;

export const LIBRARY_CHECK = "Check against the maker's manual aboard.";

export function libraryNote(j: Pick<LibraryJob, 'page' | 'parts'>, e: Pick<LibraryEntry, 'maker' | 'model'>): string {
  return `Maker's manual (${libraryFile(e)})${j.page ? `, p. ${j.page}` : ''}${j.parts ? ` — ${j.parts}` : ''}. ${LIBRARY_CHECK}`;
}

export interface WizardJob {
  title: string;
  type?: JobType;
  hours?: number;
  days?: number;
  notes: string;
}

/**
 * The jobs a new unit takes from the library. Left out, and counted: a job with
 * no interval the plan can count (as required, hours on a system with no
 * counter) and a watch check under a week by the calendar — the engine round's.
 */
export function libraryJobs(e: LibraryEntry, counter: boolean): { jobs: WizardJob[]; left: number } {
  const jobs: WizardJob[] = [];
  let left = 0;
  const seen = new Set<string>();
  for (const j of e.jobs) {
    const title = (j.title ?? '').trim();
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const hours = counter && j.hours ? j.hours : undefined;
    const days = j.days || undefined;
    if ((!hours && !days) || (!hours && days! < 7)) {
      left++;
      continue;
    }
    jobs.push({ title, ...(j.type ? { type: j.type } : {}), ...(hours ? { hours } : {}), ...(days ? { days } : {}), notes: libraryNote(j, e) });
  }
  return { jobs, left };
}

/** The library's schedule as a manual read of this model (services/manualAi readManual). */
export function asManualReply(e: LibraryEntry): ManualAiReply {
  return {
    covers: 'yes',
    ...(e.manualModel ? { model: e.manualModel } : {}),
    jobs: e.jobs.map((j) => ({ title: j.title, hours: j.hours ?? null, days: j.days ?? null, type: j.type ?? null, parts: j.parts ?? null, page: j.page ?? null, key: null })),
  };
}
