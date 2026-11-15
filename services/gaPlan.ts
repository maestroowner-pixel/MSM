// ===================================
// The ship's plan (GA) — the pure part (types/gaPlan.ts): which sheets are on
// the plan, which points stand on a sheet, what colour each is, and the
// numbered list that goes beside the picture on paper. No I/O.
// Tested by `npm run check:gaplan`.
//
// Four kinds of point (15 Nov 2026): machinery defects and yard jobs — work,
// coloured by how it stands; LSA/FFE items — where the gear is kept, coloured
// by its date and drawn square; safety observation cards — where it was seen.
// ===================================

import { PmsDefect } from '../types/pms';
import { YardJob } from '../types/yard';
import { ComplianceStatus } from '../types/equipment';
import { OBS_KIND_LABEL, SafetyObservation } from '../types/safety';
import { GaPin, GaPinKind, GaSheet, gaPinId } from '../types/gaPlan';
import { jobNo, jobStage } from './yard';

/**
 * How a point is drawn. Work: open (red), waiting or under way (amber), done and
 * not yet accepted (blue), closed (green), planned (grey). Gear: expired (red),
 * due soon (amber), in date (green), no date (grey).
 */
export type MarkStatus = 'open' | 'waiting' | 'done' | 'closed' | 'planned' | 'expired' | 'due' | 'ok' | 'nodate';
export const MARK_STATUSES: MarkStatus[] = ['open', 'waiting', 'done', 'planned', 'closed', 'expired', 'due', 'ok', 'nodate'];

/**
 * An equipment item as the plan needs it, worked out by the caller (its category's
 * name and group, its compliance status) so this file stays free of the registers.
 */
export interface PlanItem {
  id: string;
  category: string;
  /** "Fire extinguishers". */
  cat: string;
  /** "LSA", "FFE", "OTHER", "LIFTING". */
  group: string;
  /** "No. 12 · 6 kg CO2". */
  name: string;
  /** "Main deck · Galley entrance". */
  place: string;
  /** yyyy-mm-dd of the date that drives it, or ''. */
  due: string;
  status: ComplianceStatus;
}

export interface PlanSources {
  defects: PmsDefect[];
  jobs: YardJob[];
  items?: PlanItem[];
  obs?: SafetyObservation[];
  /** A yard period's date, for its jobs on paper. */
  projectDate?: (id: string) => string;
}

export interface Mark {
  pin: GaPin;
  /** 1, 2, 3… on this sheet as filtered — the number on the point and in the table. */
  n: number;
  status: MarkStatus;
  /** "Defect", "Yard 007", "FFE", "Observation" — English, for paper. */
  label: string;
  /** The yard job's number on its work list ("007"); empty otherwise. */
  no: string;
  title: string;
  /** The machine, the yard period, the item's category and place, the card's kind and topic. */
  sub: string;
  /** yyyy-mm-dd — the defect or card raised, the yard period, the item's next date. */
  date: string;
}

export interface MarkFilter {
  kinds: GaPinKind[];
  /** Closed defects, accepted jobs and reviewed cards too. Gear is shown whatever its date. */
  closed: boolean;
  /** Only this yard period's jobs (the other kinds are not filtered by it). */
  projectId?: string;
  /** Only this equipment category (the other kinds are not filtered by it). */
  category?: string;
}

export const ALL_MARKS: MarkFilter = { kinds: ['defect', 'yard', 'equip', 'obs'], closed: true };

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

export function itemStatus(it: Pick<PlanItem, 'status'>): MarkStatus {
  return it.status === 'none' ? 'nodate' : it.status;
}

/** A card is open until an officer has reviewed it. */
export const obsStatus = (o: SafetyObservation): MarkStatus => (o.reviewedAt ? 'closed' : 'open');

/** Gear is a place, not a task: drawn square, so it does not read as something to do. */
export const isGear = (kind: GaPinKind) => kind === 'equip';

const KIND_RANK: Record<GaPinKind, number> = { defect: 0, yard: 1, equip: 2, obs: 3 };

/** The points on one sheet, numbered in a fixed order: defects by date, yard jobs by period and number, gear by category and name, cards by date. */
export function sheetMarks(sheetId: string, pins: GaPin[], src: PlanSources, f: MarkFilter): Mark[] {
  const dById = new Map(src.defects.map((d) => [d.id, d]));
  const jById = new Map(src.jobs.map((j) => [j.id, j]));
  const iById = new Map((src.items ?? []).map((i) => [i.id, i]));
  const oById = new Map((src.obs ?? []).map((o) => [o.id, o]));
  const projectDate = src.projectDate ?? (() => '');
  const out: (Omit<Mark, 'n'> & { key: string })[] = [];
  for (const pin of pins) {
    if (pin.removed || pin.sheetId !== sheetId || !f.kinds.includes(pin.kind)) continue;
    if (pin.kind === 'defect') {
      const d = dById.get(pin.ref);
      if (!d) continue;
      const status = defectStatus(d);
      if (status === 'closed' && !f.closed) continue;
      out.push({ pin, status, label: 'Defect', no: '', title: d.description, sub: d.machineName, date: d.date, key: d.date });
    } else if (pin.kind === 'yard') {
      const j = jById.get(pin.ref);
      if (!j || (f.projectId && j.projectId !== f.projectId)) continue;
      const status = yardStatus(j);
      if (!status || (status === 'closed' && !f.closed)) continue;
      const date = projectDate(j.projectId) || j.startedOn || '';
      out.push({ pin, status, label: `Yard ${jobNo(j)}`, no: jobNo(j), title: j.title, sub: j.machineName ?? '', date, key: `${date}|${String(j.no).padStart(6, '0')}` });
    } else if (pin.kind === 'equip') {
      const it = iById.get(pin.ref);
      if (!it || (f.category && it.category !== f.category)) continue;
      out.push({ pin, status: itemStatus(it), label: it.group, no: '', title: it.name || it.cat, sub: [it.cat, it.place].filter(Boolean).join(' · '), date: it.due, key: `${it.cat}|${it.name}` });
    } else {
      const o = oById.get(pin.ref);
      if (!o) continue;
      const status = obsStatus(o);
      if (status === 'closed' && !f.closed) continue;
      out.push({ pin, status, label: 'Observation', no: '', title: o.what, sub: [OBS_KIND_LABEL[o.kind], o.topic, o.location].filter(Boolean).join(' · '), date: o.date, key: o.date });
    }
  }
  out.sort((a, b) => KIND_RANK[a.pin.kind] - KIND_RANK[b.pin.kind] || a.key.localeCompare(b.key, undefined, { numeric: true }) || a.pin.id.localeCompare(b.pin.id));
  return out.map(({ key, ...m }, i) => ({ ...m, n: i + 1 }));
}

/** How many points each sheet holds under the filter — the counts on the tabs. */
export function sheetCounts(sheets: GaSheet[], pins: GaPin[], src: PlanSources, f: MarkFilter): Record<string, number> {
  return Object.fromEntries(sheets.map((s) => [s.id, sheetMarks(s.id, pins, src, f).length]));
}

/** The statuses the given points use, in legend order — the legend shows only these. */
export const usedStatuses = (marks: Mark[]): MarkStatus[] => MARK_STATUSES.filter((s) => marks.some((m) => m.status === s));

/** Words for a status on paper (English always). */
export const STATUS_EN: Record<MarkStatus, string> = {
  open: 'Open', waiting: 'Waiting / in progress', done: 'Done, to accept', closed: 'Closed', planned: 'Planned',
  expired: 'Expired', due: 'Due soon', ok: 'In date', nodate: 'No date',
};

/** Colours on paper and on screen alike — red, amber, blue, green, grey. */
export const STATUS_HEX: Record<MarkStatus, string> = {
  open: '#D64545', waiting: '#E0A100', done: '#2F6FDE', closed: '#2E9E5B', planned: '#7A8794',
  expired: '#D64545', due: '#E0A100', ok: '#2E9E5B', nodate: '#7A8794',
};

export const PLAN_HEAD = ['No.', 'Record', 'What', 'Machine / place', 'Date', 'Status'];

/** The table under the picture. */
export function markRows(marks: Mark[]): string[][] {
  const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  return marks.map((m) => [String(m.n), m.label, m.title, m.sub, dmy(m.date), STATUS_EN[m.status]]);
}
