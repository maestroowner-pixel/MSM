// ===================================
// The maintenance plan in a spreadsheet — the template the Master or the
// superintendent fills in (or downloads with the plan already in it), and the
// reading of it back: systems and their jobs added or updated, never removed
// (asked 11 Oct 2026: "load the planned work from a template, not by hand").
//
// One row per job. The system columns may be left empty under the first row of
// a system — the row above's system carries down, as people fill sheets.
// Columns are found by their heading, so a re-ordered sheet still reads.
// Pure, tested (check:pmsimport); file picking and saving in pmsTemplate.ts.
// ===================================

import * as XLSX from 'xlsx';

import { DEPTS, Dept, JOB_TYPE, JobType, Machine, PmsJob, deptOf, hasCounter } from '../types/pms';

export const PLAN_HEAD = [
  'Department',
  'System ★',
  'Critical (Y/N)',
  'Hours counter (Y/N)',
  'Location',
  'Maker',
  'Model',
  'Job ★',
  'Type',
  'Every … hours',
  'Every … days',
  'Last done (yyyy-mm-dd)',
  'Last done at … h',
  'Notes',
];

const yes = (v: unknown) => /^(y|yes|да|si|sí|так|1|true|x|✓)$/i.test(String(v ?? '').trim());
const no = (v: unknown) => /^(n|no|нет|ні|0|false)$/i.test(String(v ?? '').trim());
const str = (v: unknown) => String(v ?? '').trim();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function deptFrom(v: unknown): Dept | undefined {
  const s = norm(str(v));
  if (!s) return undefined;
  return DEPTS.find((d) => d.key === s || norm(d.label) === s || norm(d.label).startsWith(s))?.key;
}
function typeFrom(v: unknown): JobType | undefined {
  const s = norm(str(v));
  if (!s) return undefined;
  return (Object.keys(JOB_TYPE) as JobType[]).find((k) => k === s || norm(JOB_TYPE[k]) === s || norm(JOB_TYPE[k]).startsWith(s));
}
function numFrom(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined;
  const s = str(v).replace(',', '.').replace(/\s/g, '');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
/** A date cell — a Date (cellDates), an Excel serial, yyyy-mm-dd or dd.mm.yyyy. */
export function dateFrom(v: unknown): string | undefined {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Excel dates arrive at local midnight; take the local calendar day.
    const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = str(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/** The plan as sheet rows — what the template is downloaded with, so it can be edited and loaded back. */
export function planRows(machines: Machine[], jobs: PmsJob[]): (string | number)[][] {
  const out: (string | number)[][] = [];
  const order = new Map(DEPTS.map((d, i) => [d.key, i]));
  const live = machines.filter((m) => !m.deleted).sort((a, b) => (order.get(deptOf(a))! - order.get(deptOf(b))!) || a.name.localeCompare(b.name));
  for (const m of live) {
    const mj = jobs.filter((j) => j.machineId === m.id && !j.deleted).sort((a, b) => a.title.localeCompare(b.title));
    const sys = [DEPTS.find((d) => d.key === deptOf(m))!.label, m.name, m.critical ? 'Y' : '', hasCounter(m) ? 'Y' : 'N', m.location ?? '', m.maker ?? '', m.model ?? ''];
    if (!mj.length) out.push([...sys, '', '', '', '', '', '', '']);
    for (const j of mj) {
      out.push([...sys, j.title, j.type ? JOB_TYPE[j.type] : '', j.intervalHours ?? '', j.intervalDays ?? '', j.lastDoneDate ?? '', j.lastDoneHours ?? '', j.notes ?? '']);
    }
  }
  return out;
}

/** Example rows for an empty plan — replaced by the vessel's own. */
export const EXAMPLE_ROWS: (string | number)[][] = [
  ['Engineering', 'Main engine PS', 'Y', 'Y', 'Engine room', 'MTU', '16V 2000 M96', 'Oil and filter change', 'Maintenance', 500, 365, '2026-06-01', 11250, 'Check against the maker’s manual'],
  ['', '', '', '', '', '', '', 'Raw-water impeller', 'Maintenance', 1000, 365, '', '', ''],
  ['Safety', 'Fire pump', 'Y', 'N', 'Engine room', '', '', 'Run test', 'Performance test', '', 7, '', '', ''],
  ['Deck', 'Tender', '', 'Y', 'Garage', 'Williams', 'Dieseljet 505', 'Annual service', 'Maintenance', 100, 365, '', '', ''],
];

export interface PlanImport {
  /** Systems to save — new ones and changed ones. */
  machines: Machine[];
  /** Jobs to save — new ones and changed ones. */
  jobs: PmsJob[];
  addedSystems: string[];
  addedJobs: number;
  updatedJobs: number;
  /** Rows not read, with the sheet row number. */
  errors: string[];
}

/** Read the sheet's rows (header row anywhere near the top) against the plan the app has. */
export function planImport(rows: unknown[][], machines: Machine[], jobs: PmsJob[], newId: (p: string) => string, now = Date.now()): PlanImport {
  const headAt = rows.findIndex((r) => r.some((c) => /^job/i.test(str(c))) && r.some((c) => /^system/i.test(str(c))));
  if (headAt < 0) throw new Error('No "System" and "Job" columns — use the maintenance plan template.');
  const head = rows[headAt].map((h) => norm(str(h)).replace('★', '').trim());
  const col = (label: string) => head.findIndex((h) => h.startsWith(norm(label).replace('★', '').trim()));
  const c = {
    dept: col('Department'), sys: col('System'), crit: col('Critical'), counter: col('Hours counter'), loc: col('Location'), maker: col('Maker'), model: col('Model'),
    job: col('Job'), type: col('Type'), hours: col('Every … hours'), days: col('Every … days'), lastDate: col('Last done ('), lastHours: col('Last done at'), notes: col('Notes'),
  };
  const cell = (r: unknown[], i: number) => (i >= 0 ? r[i] : undefined);

  const byName = new Map<string, Machine>();
  for (const m of machines) if (!m.deleted) byName.set(norm(m.name), m);
  const touchedM = new Map<string, Machine>();
  const jobByKey = new Map<string, PmsJob>();
  for (const j of jobs) if (!j.deleted) jobByKey.set(`${j.machineId}|${norm(j.title)}`, j);
  const touchedJ = new Map<string, PmsJob>();
  const out: PlanImport = { machines: [], jobs: [], addedSystems: [], addedJobs: 0, updatedJobs: 0, errors: [] };
  const isNewM = new Set<string>();
  const isNewJ = new Set<string>();

  let carry = null as { name: string; dept?: Dept } | null;
  for (let i = headAt + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every((x) => str(x) === '')) continue;
    const rowNo = i + 1;
    const sysName = str(cell(r, c.sys));
    const deptCell = cell(r, c.dept);
    if (sysName) carry = { name: sysName, dept: deptFrom(deptCell) ?? carry?.dept };
    if (!carry) {
      out.errors.push(`Row ${rowNo}: no system.`);
      continue;
    }
    if (str(deptCell) && !deptFrom(deptCell)) out.errors.push(`Row ${rowNo}: department “${str(deptCell)}” not known — ${DEPTS.map((d) => d.label).join(', ')}.`);

    // The system — found by name, or new.
    let m = touchedM.get(norm(carry.name)) ?? byName.get(norm(carry.name));
    if (!m) {
      m = { id: newId('mach'), name: carry.name, dept: carry.dept ?? 'engineering', updatedAt: now };
      isNewM.add(m.id);
      out.addedSystems.push(carry.name);
    }
    if (sysName) {
      const patch: Partial<Machine> = {};
      if (carry.dept && carry.dept !== deptOf(m)) patch.dept = carry.dept;
      const crit = cell(r, c.crit);
      if (yes(crit) && !m.critical) patch.critical = true;
      if (no(crit) && m.critical) patch.critical = false;
      const cnt = cell(r, c.counter);
      if (yes(cnt) && !hasCounter(m)) patch.counter = true;
      if (no(cnt) && hasCounter(m)) patch.counter = false;
      for (const [k, ci] of [['location', c.loc], ['maker', c.maker], ['model', c.model]] as const) {
        const v = str(cell(r, ci));
        if (v && v !== m[k]) patch[k] = v;
      }
      if (Object.keys(patch).length) m = { ...m, ...patch, updatedAt: now };
    }
    touchedM.set(norm(m.name), m);

    // The job.
    const title = str(cell(r, c.job));
    if (!title) continue; // a system row without jobs
    const hours = numFrom(cell(r, c.hours));
    const days = numFrom(cell(r, c.days));
    if (hours == null && days == null) {
      out.errors.push(`Row ${rowNo} (${m.name} — ${title}): give an interval in hours or days.`);
      continue;
    }
    if (hours != null && !hasCounter(m)) {
      out.errors.push(`Row ${rowNo} (${m.name} — ${title}): an interval in hours needs “Hours counter” = Y on the system.`);
      continue;
    }
    const typeCell = cell(r, c.type);
    const type = typeFrom(typeCell);
    if (str(typeCell) && !type) out.errors.push(`Row ${rowNo}: type “${str(typeCell)}” not known — left empty.`);
    const lastCell = cell(r, c.lastDate);
    const lastDoneDate = dateFrom(lastCell);
    if (str(lastCell) && !lastDoneDate && !(lastCell instanceof Date)) out.errors.push(`Row ${rowNo}: last done “${str(lastCell)}” is not a date — left empty.`);
    const lastDoneHours = numFrom(cell(r, c.lastHours));
    const notes = str(cell(r, c.notes));

    const key = `${m.id}|${norm(title)}`;
    const have = touchedJ.get(key) ?? jobByKey.get(key);
    const fields: Partial<PmsJob> = {
      ...(type ? { type } : {}),
      intervalHours: hours,
      intervalDays: days,
      ...(lastDoneDate ? { lastDoneDate } : {}),
      ...(lastDoneHours != null ? { lastDoneHours } : {}),
      ...(notes ? { notes } : {}),
    };
    if (!have) {
      const j: PmsJob = { id: newId('job'), machineId: m.id, title, updatedAt: now };
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) (j as any)[k] = v;
      isNewJ.add(j.id);
      touchedJ.set(key, j);
      out.addedJobs++;
    } else {
      const changed = (Object.keys(fields) as (keyof PmsJob)[]).some((k) => fields[k] !== have[k]);
      if (changed) {
        const j: PmsJob = { ...have, updatedAt: now };
        for (const [k, v] of Object.entries(fields)) {
          if (v === undefined) delete (j as any)[k];
          else (j as any)[k] = v;
        }
        if (!isNewJ.has(have.id) && !touchedJ.has(key)) out.updatedJobs++;
        touchedJ.set(key, j);
      }
    }
  }
  const origM = new Map(machines.map((m) => [m.id, m]));
  out.machines = [...touchedM.values()].filter((m) => isNewM.has(m.id) || origM.get(m.id) !== m);
  out.jobs = [...touchedJ.values()];
  return out;
}

/** The template workbook: the plan (or examples) and a sheet with the allowed values. */
export function planWorkbook(machines: Machine[], jobs: PmsJob[]): XLSX.WorkBook {
  const rows = planRows(machines, jobs);
  const ws = XLSX.utils.aoa_to_sheet([PLAN_HEAD, ...(rows.length ? rows : EXAMPLE_ROWS)]);
  ws['!cols'] = [16, 26, 10, 12, 16, 14, 16, 34, 18, 12, 12, 16, 14, 40].map((wch) => ({ wch }));
  const help = XLSX.utils.aoa_to_sheet([
    ['Maintenance plan template — one row per job. Leave the system columns empty under the first row of a system to keep the same system.'],
    ['Loading adds new systems and jobs and updates the ones with the same name; nothing is removed.'],
    ['Intervals: hours (only with a running-hours counter), days, or both — whichever comes first.'],
    [],
    ['Department', 'Type'],
    ...Array.from({ length: Math.max(DEPTS.length, Object.keys(JOB_TYPE).length) }, (_, i) => [DEPTS[i]?.label ?? '', Object.values(JOB_TYPE)[i] ?? '']),
  ]);
  help['!cols'] = [{ wch: 22 }, { wch: 26 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan');
  XLSX.utils.book_append_sheet(wb, help, 'Help');
  return wb;
}

/** Rows of the first sheet of a workbook (base64 from a phone, bytes from the web). */
export function sheetRows(data: ArrayBuffer | Uint8Array | string): unknown[][] {
  const wb = typeof data === 'string' ? XLSX.read(data, { type: 'base64', cellDates: true }) : XLSX.read(data, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) : [];
}
