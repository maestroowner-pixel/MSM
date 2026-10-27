// ===================================
// Yard periods and warranty — the pure part (types/yard.ts). Where a job is,
// what a project costs so far, when a warranty runs out, numbering, and
// reading the yard's prices back from the specification sheet.
// Tested by `npm run check:yard`.
// ===================================

import { Dept, Machine, PmsDefect, PmsJob, PmsProject } from '../types/pms';
import { ClaimStage, WarrantyClaim, YardDept, YardJob, YardStage, YARD_BY_LABEL, YARD_DEPT_LABEL, YARD_DEPTS } from '../types/yard';

export function jobStage(j: YardJob): YardStage {
  if (j.cancelled) return 'cancelled';
  if (j.accepted) return 'accepted';
  if (j.doneOn) return 'done';
  if (j.startedOn) return 'progress';
  return 'planned';
}

export const jobsOf = (projectId: string, jobs: YardJob[]) =>
  jobs.filter((j) => j.projectId === projectId).sort((a, b) => a.no - b.no);

/** The next item number of a project's work list — numbers are never re-used, cancelled ones included. */
export const nextJobNo = (projectId: string, jobs: YardJob[]) =>
  jobs.filter((j) => j.projectId === projectId).reduce((n, j) => Math.max(n, j.no), 0) + 1;

/** "1.3" style is the yards'; we print the plain number, zero-padded to the list's width. */
export const jobNo = (j: YardJob, width = 3) => String(j.no).padStart(width, '0');

export interface ProjectTotals {
  count: Record<YardStage, number>;
  /** Not cancelled. */
  live: number;
  quoted: number;
  /** Final where known, quoted otherwise — what the period is heading for. */
  forecast: number;
  final: number;
  /** Jobs with no price yet (not cancelled, not by the crew). */
  unpriced: number;
  budgetLeft?: number;
  /** 0..1 — accepted share of the live jobs. */
  accepted: number;
}

export function projectTotals(p: PmsProject, jobs: YardJob[]): ProjectTotals {
  const list = jobsOf(p.id, jobs);
  const count = { planned: 0, progress: 0, done: 0, accepted: 0, cancelled: 0 } as Record<YardStage, number>;
  let quoted = 0, forecast = 0, final = 0, unpriced = 0;
  for (const j of list) {
    const s = jobStage(j);
    count[s]++;
    if (s === 'cancelled') continue;
    quoted += j.quoted ?? 0;
    final += j.final ?? 0;
    forecast += j.final ?? j.quoted ?? 0;
    if (j.final == null && j.quoted == null && j.by !== 'crew') unpriced++;
  }
  const live = list.length - count.cancelled;
  return {
    count, live, quoted: round2(quoted), forecast: round2(forecast), final: round2(final), unpriced,
    ...(p.budget != null ? { budgetLeft: round2(p.budget - forecast) } : {}),
    accepted: live ? count.accepted / live : 0,
  };
}

export type ProjectPhase = 'planning' | 'inYard' | 'finished' | 'closed';
export function projectPhase(p: PmsProject): ProjectPhase {
  if (p.closedAt) return 'closed';
  if (p.finishedOn) return 'finished';
  if (p.startedOn) return 'inYard';
  return 'planning';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** yyyy-mm-dd + n months, kept to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Warning this many days before a warranty runs out — time to look the work over and claim. */
export const EXPIRING_DAYS = 60;

export type CoverState = 'active' | 'expiring' | 'expired';
export const coverState = (until: string, today: string): CoverState =>
  until < today ? 'expired' : daysBetween(today, until) <= EXPIRING_DAYS ? 'expiring' : 'active';

/** An accepted job's warranty, if it has one. */
export function jobCover(j: YardJob): { from: string; until: string } | null {
  if (!j.accepted || !j.warrantyMonths || j.cancelled) return null;
  return { from: j.accepted.date, until: addMonths(j.accepted.date, j.warrantyMonths) };
}

export interface CoverRow {
  job: YardJob;
  project?: PmsProject;
  from: string;
  until: string;
  state: CoverState;
  claims: WarrantyClaim[];
}

/** Everything under warranty from the yard periods, the soonest to run out first; expired ones last, kept a year. */
export function coverList(jobs: YardJob[], projects: PmsProject[], claims: WarrantyClaim[], today: string): CoverRow[] {
  const pById = new Map(projects.map((p) => [p.id, p]));
  const yearAgo = addMonths(today, -12);
  const rows: CoverRow[] = [];
  for (const j of jobs) {
    const c = jobCover(j);
    if (!c || c.until < yearAgo) continue;
    rows.push({ job: j, project: pById.get(j.projectId), ...c, state: coverState(c.until, today), claims: claims.filter((x) => x.yardJobId === j.id) });
  }
  const rank = (s: CoverState) => (s === 'expired' ? 1 : 0);
  return rows.sort((a, b) => rank(a.state) - rank(b.state) || (a.state === 'expired' ? b.until.localeCompare(a.until) : a.until.localeCompare(b.until)));
}

export function claimStage(c: WarrantyClaim): ClaimStage {
  if (c.closed) return 'closed';
  if (c.answer) return 'answered';
  if (c.submitted) return 'submitted';
  return 'draft';
}

/** The warranty a claim is made under: its own dates, else its yard job's. */
export function claimCover(c: WarrantyClaim, jobs: YardJob[]): { from?: string; until: string } | null {
  if (c.coverUntil) return { ...(c.coverFrom ? { from: c.coverFrom } : {}), until: c.coverUntil };
  const j = c.yardJobId ? jobs.find((x) => x.id === c.yardJobId) : undefined;
  return j ? jobCover(j) : null;
}

/** Was the fault found inside the warranty? null when there is no warranty to judge by. */
export function claimInCover(c: WarrantyClaim, jobs: YardJob[]): boolean | null {
  const cv = claimCover(c, jobs);
  if (!cv) return null;
  return c.found <= cv.until && (!cv.from || c.found >= cv.from);
}

/** "WC-2026-004" — the year's next number, never re-used. */
export function nextClaimNo(claims: WarrantyClaim[], year: string): string {
  const re = new RegExp(`^WC-${year}-(\\d+)$`);
  const n = claims.reduce((m, c) => Math.max(m, Number(re.exec(c.no)?.[1] ?? 0)), 0) + 1;
  return `WC-${year}-${String(n).padStart(3, '0')}`;
}

/** Open defects not already on a live job of any yard period — what can still be added to a work list. */
export function defectsToAdd(defects: PmsDefect[], jobs: YardJob[]): PmsDefect[] {
  const taken = new Set(jobs.filter((j) => !j.cancelled && j.defectId).map((j) => j.defectId));
  return defects.filter((d) => !d.closed && !taken.has(d.id)).sort((a, b) => rankDefect(a) - rankDefect(b) || a.date.localeCompare(b.date));
}
const rankDefect = (d: PmsDefect) => (d.category === 'safety' ? 0 : d.category === 'class' ? 1 : 2);

/** A defect becomes a job: its machine, its words, class if it affects class. */
export function jobFromDefect(d: PmsDefect, projectId: string, no: number, dept: YardDept, by: string, now: number): YardJob {
  const words = d.description.trim();
  const title = words.length > 70 ? `${words.slice(0, 67).trimEnd()}…` : words;
  return {
    id: `yj_${d.id}_${projectId}`.slice(0, 60), projectId, no, title, ...(words.length > 70 ? { spec: words } : {}), dept,
    machineId: d.machineId, machineName: d.machineName, defectId: d.id, ...(d.category === 'class' ? { classItem: true } : {}),
    by: 'yard', createdBy: by, at: now, updatedAt: now,
  };
}

const FROM_PMS: Record<Dept, YardDept> = { engineering: 'engine', deck: 'deck', safety: 'safety', bridge: 'electrical', interior: 'interior', avit: 'electrical', hull: 'hull' };
/** The work-list department of a PMS machine; a machine with none is engineering's. */
export const yardDept = (m?: Pick<Machine, 'dept'>): YardDept => FROM_PMS[m?.dept ?? 'engineering'] ?? 'engine';

/** A PMS job deferred to the project becomes a line of the work list, so the yard prices it with the rest. */
export function jobFromPms(job: PmsJob, machine: Machine, projectId: string, no: number, by: string, now: number): YardJob {
  return {
    id: `yj_${job.id}_${projectId}`.slice(0, 60), projectId, no, title: job.title, ...(job.notes ? { spec: job.notes } : {}),
    dept: yardDept(machine), machineId: machine.id, machineName: machine.name, pmsJobId: job.id,
    ...(job.classJob || machine.classItem ? { classItem: true } : {}), by: 'yard', createdBy: by, at: now, updatedAt: now,
  };
}

/** The deferred PMS jobs not yet on the work list. */
export const pmsToAdd = <T extends { job: PmsJob }>(pending: T[], projectId: string, jobs: YardJob[]): T[] => {
  const taken = new Set(jobs.filter((j) => j.projectId === projectId && !j.cancelled && j.pmsJobId).map((j) => j.pmsJobId));
  return pending.filter((x) => !taken.has(x.job.id));
};

/** What a job may not be saved with, as an i18n key; null when fine. */
export function jobProblem(j: Pick<YardJob, 'title' | 'quoted' | 'final' | 'warrantyMonths' | 'startedOn' | 'doneOn'>): string | null {
  if (j.title.trim().length < 3) return 'yd.needTitle';
  if ((j.quoted != null && j.quoted < 0) || (j.final != null && j.final < 0)) return 'yd.negative';
  if (j.warrantyMonths != null && (j.warrantyMonths < 0 || j.warrantyMonths > 120)) return 'yd.badWarranty';
  if (j.startedOn && j.doneOn && j.doneOn < j.startedOn) return 'yd.doneBeforeStart';
  return null;
}

// ---- the yard's prices back from the specification sheet ----------------------

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function cellAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  let s = String(v ?? '').replace(/[€$£\s]/g, '').replace(/[A-Za-z]/g, '');
  if (!s) return undefined;
  // 1.234,50 → 1234.50 ; 1,234.50 → 1234.50 ; 12,5 → 12.5
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export interface SheetPrice {
  jobId: string;
  price?: number;
  /** The yard's remark on the line. */
  remark?: string;
}

/**
 * Rows of a filled specification sheet (services/yardReport specSheet) → prices by
 * job. The header row is found by its "Job ID" column; the price is the "Yard price"
 * column (or "Price"); "Yard remarks" is read when there.
 */
export function readSpecPrices(rows: unknown[][]): { prices: SheetPrice[]; error?: string } {
  const h = rows.findIndex((r) => r.some((c) => norm(c) === 'job id'));
  if (h < 0) return { prices: [], error: 'yd.sheetNoId' };
  const head = rows[h].map(norm);
  const idCol = head.indexOf('job id');
  const priceCol = head.findIndex((c) => c === 'yard price' || c === 'price' || c.startsWith('yard price'));
  if (priceCol < 0) return { prices: [], error: 'yd.sheetNoPrice' };
  const remCol = head.findIndex((c) => c.startsWith('yard remark') || c === 'remarks');
  const prices: SheetPrice[] = [];
  for (const r of rows.slice(h + 1)) {
    const id = String(r[idCol] ?? '').trim();
    if (!id) continue;
    const price = cellAmount(r[priceCol]);
    const remark = remCol >= 0 ? String(r[remCol] ?? '').trim() : '';
    if (price == null && !remark) continue;
    prices.push({ jobId: id, ...(price != null ? { price } : {}), ...(remark ? { remark } : {}) });
  }
  return { prices };
}

/** Jobs grouped by department, in the order of YARD_DEPTS — the order a specification reads in. */
export function byDept(list: YardJob[]): { dept: YardDept; jobs: YardJob[] }[] {
  return YARD_DEPTS.map((dept) => ({ dept, jobs: list.filter((j) => j.dept === dept) })).filter((g) => g.jobs.length);
}

/**
 * The specification as rows for the sheet the yard fills in (services/yardReport
 * specSheet) — kept here, beside readSpecPrices, so the round trip is checked.
 */
export function specRows(p: PmsProject, jobs: YardJob[]): unknown[][] {
  const live = jobsOf(p.id, jobs).filter((j) => !j.cancelled);
  const head = ['No.', 'Department', 'Item', 'Machine', 'Specification', 'By', 'Class', `Yard price${p.currency ? ` (${p.currency})` : ''}`, 'Yard remarks', 'Job ID'];
  const by = (j: YardJob) => (j.by === 'yard' ? 'Yard' : `${YARD_BY_LABEL[j.by]}${j.contractor ? `: ${j.contractor}` : ''}`);
  return [head, ...byDept(live).flatMap(({ jobs: list }) => list.map((j) => [
    jobNo(j), YARD_DEPT_LABEL[j.dept], j.title, j.machineName ?? '', j.spec ?? '', by(j), j.classItem ? 'CLASS' : '', j.quoted ?? '', '', j.id,
  ]))];
}

/** 12 345.50 — amounts on screen and paper; the currency follows. */
export const money = (n?: number, cur?: string) =>
  n == null ? '' : `${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`;
