// ===================================
// The ship's plan (GA) — the pure part (types/gaPlan.ts): which sheets are on
// the plan, which points stand on a sheet, what colour each is, and the
// numbered list that goes beside the picture on paper. No I/O.
// Tested by `npm run check:gaplan`.
// ===================================

import { PmsDefect } from '../types/pms';
import { YardJob } from '../types/yard';
import { GaPin, GaPinKind, GaSheet, gaPinId } from '../types/gaPlan';
import { jobNo, jobStage } from './yard';

/** How a point is drawn: open (red), waiting or under way (amber), done and not yet accepted (blue), closed (green), planned (grey). */
export type MarkStatus = 'open' | 'waiting' | 'done' | 'closed' | 'planned';
export const MARK_STATUSES: MarkStatus[] = ['open', 'waiting', 'done', 'planned', 'closed'];

export interface Mark {
  pin: GaPin;
  /** 1, 2, 3… on this sheet as filtered — the number on the point and in the table. */
  n: number;
  status: MarkStatus;
  /** "Defect" or "Yard 007" — English, for paper. */
  label: string;
  /** The yard job's number on its work list ("007"); empty for a defect. */
  no: string;
  title: string;
  /** The machine, the yard period. */
  sub: string;
  /** yyyy-mm-dd the record was raised (a defect) or the yard period's date — for the paper. */
  date: string;
}

export interface MarkFilter {
  kinds: GaPinKind[];
  /** Closed defects and accepted jobs too. */
  closed: boolean;
  /** Only this yard period's jobs (defects are not filtered by it). */
  projectId?: string;
}

export const ALL_MARKS: MarkFilter = { kinds: ['defect', 'yard'], closed: true };

/** The sheets on the plan, in their order. */
export function liveSheets(sheets: GaSheet[]): GaSheet[] {
  return sheets.filter((s) => !s.removed).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export const nextOrder = (sheets: GaSheet[]) => sheets.reduce((m, s) => Math.max(m, s.order), 0) + 1;

/** A tap position as a fraction of the picture, kept inside it. */
export const clampPos = (v: number) => (Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000 : 0.5);

export function sheetProblem(s: Pick<GaSheet, 'name' | 'photos' | 'w' | 'h'>): 'name' | 'image' | null {
  if (!s.name.trim()) return 'name';
  if (!s.photos?.[0] || s.photos[0].kind !== 'photo' || !(s.w > 0) || !(s.h > 0)) return 'image';
  return null;
}

/** The record's point, if it has one standing. */
export function pinFor(pins: GaPin[], kind: GaPinKind, ref: string): GaPin | undefined {
  const p = pins.find((x) => x.id === gaPinId(kind, ref));
  return p && !p.removed ? p : undefined;
}

/** A point put down or moved: the same id, so a record never has two. */
export function placePin(prev: GaPin | undefined, kind: GaPinKind, ref: string, sheetId: string, x: number, y: number, by: string, now: number): GaPin {
  return { id: gaPinId(kind, ref), kind, ref, sheetId, x: clampPos(x), y: clampPos(y), by, at: prev && !prev.removed ? prev.at : now, updatedAt: now };
}

export function defectStatus(d: PmsDefect): MarkStatus {
  if (d.closed) return 'closed';
  return d.awaitingSpares ? 'waiting' : 'open';
}

/** null for a cancelled job: it is not work on the ship any more. */
export function yardStatus(j: YardJob): MarkStatus | null {
  switch (jobStage(j)) {
    case 'cancelled': return null;
    case 'accepted': return 'closed';
    case 'done': return 'done';
    case 'progress': return 'waiting';
    default: return 'planned';
  }
}

/** The points on one sheet, numbered in a fixed order: defects by date, then yard jobs by period and number. */
export function sheetMarks(sheetId: string, pins: GaPin[], defects: PmsDefect[], jobs: YardJob[], f: MarkFilter, projectDate: (id: string) => string = () => ''): Mark[] {
  const dById = new Map(defects.map((d) => [d.id, d]));
  const jById = new Map(jobs.map((j) => [j.id, j]));
  const out: Omit<Mark, 'n'>[] = [];
  for (const pin of pins) {
    if (pin.removed || pin.sheetId !== sheetId || !f.kinds.includes(pin.kind)) continue;
    if (pin.kind === 'defect') {
      const d = dById.get(pin.ref);
      if (!d) continue;
      const status = defectStatus(d);
      if (status === 'closed' && !f.closed) continue;
      out.push({ pin, status, label: 'Defect', no: '', title: d.description, sub: d.machineName, date: d.date });
    } else {
      const j = jById.get(pin.ref);
      if (!j || (f.projectId && j.projectId !== f.projectId)) continue;
      const status = yardStatus(j);
      if (!status || (status === 'closed' && !f.closed)) continue;
      out.push({ pin, status, label: `Yard ${jobNo(j)}`, no: jobNo(j), title: j.title, sub: j.machineName ?? '', date: projectDate(j.projectId) || j.startedOn || '' });
    }
  }
  const kindRank = (k: GaPinKind) => (k === 'defect' ? 0 : 1);
  const jobKey = (m: Omit<Mark, 'n'>) => {
    const j = jById.get(m.pin.ref);
    return j ? `${m.date}|${String(j.no).padStart(6, '0')}` : m.date;
  };
  out.sort((a, b) => kindRank(a.pin.kind) - kindRank(b.pin.kind) || (a.pin.kind === 'defect' ? a.date.localeCompare(b.date) : jobKey(a).localeCompare(jobKey(b))) || a.pin.id.localeCompare(b.pin.id));
  return out.map((m, i) => ({ ...m, n: i + 1 }));
}

/** How many points each sheet holds under the filter — the counts on the tabs. */
export function sheetCounts(sheets: GaSheet[], pins: GaPin[], defects: PmsDefect[], jobs: YardJob[], f: MarkFilter): Record<string, number> {
  return Object.fromEntries(sheets.map((s) => [s.id, sheetMarks(s.id, pins, defects, jobs, f).length]));
}

/** Words for a status on paper (English always). */
export const STATUS_EN: Record<MarkStatus, string> = { open: 'Open', waiting: 'Waiting / in progress', done: 'Done, to accept', closed: 'Closed', planned: 'Planned' };

/** Colours on paper and on screen alike — red, amber, blue, green, grey. */
export const STATUS_HEX: Record<MarkStatus, string> = { open: '#D64545', waiting: '#E0A100', done: '#2F6FDE', closed: '#2E9E5B', planned: '#7A8794' };

export const PLAN_HEAD = ['No.', 'Record', 'What', 'Machine', 'Date', 'Status'];

/** The table under the picture. */
export function markRows(marks: Mark[]): string[][] {
  const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  return marks.map((m) => [String(m.n), m.label, m.title, m.sub, dmy(m.date), STATUS_EN[m.status]]);
}
