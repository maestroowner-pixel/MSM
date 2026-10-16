// ===================================
// A machine's maintenance history as a surveyor reads it — the evidence class
// (continuous survey of machinery), PSC and the ISM auditor ask for: what the
// machine is, its jobs with intervals and where each stands, every job done
// (signed, with the counter reading and how many photos), deferrals, and
// defects open and closed. One machine, or every critical one as a survey pack.
// Pure, tested (check:pmshistory); printed by pmsHistoryReport.ts.
// ===================================

import { CONDITION, DEFECT_CATEGORY, JOB_TYPE, Machine, PmsDefect, PmsDeferral, PmsDone, PmsJob, hasCounter } from '../types/pms';
import { activeDeferral, dueText, jobDue, scheduleText } from './pms';

export interface HistTable {
  title: string;
  head: string[];
  rows: string[][];
  /** Column widths in mm on A4 landscape (277 mm usable); the rest share what is left. */
  widths?: Record<number, number>;
  /** Printed beside the table before it, as on the paper form. */
  beside?: boolean;
}
export interface MachineHistory {
  title: string;
  facts: string[];
  tables: HistTable[];
  /** Drawings by hand after the tables — an SVG path ("M x y L x y…") in a w × h box (the DP schematic). */
  drawings?: { title: string; path: string; w: number; h: number }[];
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const who = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);
const how = (m?: { method?: string }) => (!m ? '' : m.method === 'biometric' ? 'signed biometrically' : m.method === 'drawn' ? 'signed by hand' : 'signed by PIN');
const STATUS: Record<string, string> = { expired: 'OVERDUE', due: 'Due soon', ok: 'In date', none: '—' };

/** "Fair → Good", "→ Good", "" — the condition columns of a sign-out. */
export function conditionText(d: Pick<PmsDone, 'conditionBefore' | 'conditionAfter'>): string {
  if (!d.conditionBefore && !d.conditionAfter) return '';
  return `${d.conditionBefore ? CONDITION[d.conditionBefore] : ''} → ${d.conditionAfter ? CONDITION[d.conditionAfter] : '—'}`.trim();
}

export function machineHistory(m: Machine, jobs: PmsJob[], done: PmsDone[], deferrals: PmsDeferral[], defects: PmsDefect[], today: string): MachineHistory {
  const mj = jobs.filter((j) => j.machineId === m.id && !j.deleted).sort((a, b) => a.title.localeCompare(b.title));
  const md = done.filter((d) => d.machineId === m.id).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const mf = deferrals.filter((d) => d.machineId === m.id).sort((a, b) => b.at - a.at);
  const mx = defects.filter((d) => d.machineId === m.id).sort((a, b) => Number(!!a.closed) - Number(!!b.closed) || b.at - a.at);
  const facts = [
    [m.maker, m.model].filter(Boolean).join(' ') || null,
    m.serial ? `S/N ${m.serial}` : null,
    m.location ? `Location: ${m.location}` : null,
    m.critical ? 'CRITICAL EQUIPMENT' : null,
    m.classItem ? `CLASS${m.classCode ? ` ${m.classCode}` : ''}` : null,
    hasCounter(m) ? (m.hours != null ? `Running hours ${m.hours} h (read ${dmy(m.hoursDate)})` : 'Running hours: no reading') : null,
    (() => {
      const c = md.find((d) => d.conditionAfter);
      return c ? `Last condition: ${CONDITION[c.conditionAfter!]} (${dmy(c.date)})` : null;
    })(),
    `Printed ${dmy(today)}`,
  ].filter(Boolean) as string[];

  const tables: HistTable[] = [
    {
      title: 'Planned jobs',
      head: ['Job', 'Type', 'Schedule', 'Last done', 'Status', 'Next'],
      widths: { 1: 30, 2: 30, 3: 34, 4: 22, 5: 70 },
      rows: mj.map((j) => {
        const d = jobDue(j, m, today, activeDeferral(j, deferrals));
        return [`${j.title}${j.classJob || m.classItem ? ' (class)' : ''}`, j.type ? JOB_TYPE[j.type] : '', scheduleText(j).replace(/^Every /, ''), [dmy(j.lastDoneDate), j.lastDoneHours != null ? `${j.lastDoneHours} h` : ''].filter(Boolean).join(' · '), d.deferred ? 'Deferred' : STATUS[d.status], dueText(d)];
      }),
    },
    {
      title: 'Work done',
      head: ['Date', 'Job', 'Counter', 'Condition', 'Man-h', 'Done and signed by', 'Note', 'Photos'],
      widths: { 0: 20, 2: 18, 3: 30, 4: 14, 5: 44, 7: 14 },
      rows: md.map((d) => [dmy(d.date), `${d.unplanned ? 'Unplanned: ' : ''}${d.jobTitle}`, d.hours != null ? `${d.hours} h` : '', conditionText(d), d.manHours != null ? String(d.manHours) : '', `${d.doneBy ? `${who(d.doneBy, d.doneByRank)}; signed out by ` : ''}${who(d.by, d.byRank)}${d.signedWith ? ` · ${how(d.signedWith)}` : ''}`, [d.note, d.permitNo ? `Permit ${d.permitNo}` : null, d.defectId ? 'Defect raised' : null].filter(Boolean).join(' · '), d.photos?.length ? String(d.photos.length) : '']),
    },
  ];
  if (mf.length) {
    tables.push({
      title: 'Deferrals',
      head: ['Signed', 'Job', 'Deferred until', 'Reason', 'By'],
      widths: { 0: 22, 2: 40, 4: 48 },
      rows: mf.map((f) => [dmy(new Date(f.at).toISOString().slice(0, 10)), f.jobTitle, [f.untilDate ? dmy(f.untilDate) : null, f.untilHours != null ? `${f.untilHours} h` : null].filter(Boolean).join(' or '), f.reason, who(f.by, f.byRank)]),
    });
  }
  if (mx.length) {
    tables.push({
      title: 'Defects',
      head: ['Raised', 'Category', 'Defect', 'Raised by', 'Rectified'],
      widths: { 0: 22, 1: 30, 3: 40, 4: 80 },
      rows: mx.map((x) => [dmy(x.date), DEFECT_CATEGORY[x.category], `${x.description}${x.jobTitle ? ` (found doing “${x.jobTitle}”)` : ''}`, who(x.by, x.byRank), x.closed ? `${dmy(x.closed.date)} — ${x.closed.note} · ${who(x.closed.by, x.closed.byRank)}` : 'OPEN']),
    });
  }
  return { title: m.name, facts, tables };
}

/** The machines a survey pack covers: the critical ones, else all. */
export function packMachines(machines: Machine[]): Machine[] {
  const live = machines.filter((m) => !m.deleted).sort((a, b) => a.name.localeCompare(b.name));
  const critical = live.filter((m) => m.critical);
  return critical.length ? critical : live;
}

/** Open defects, safety-critical first, then class, then the oldest. */
export function openDefects(defects: PmsDefect[]): PmsDefect[] {
  const rank = { safety: 0, class: 1, operational: 2 } as const;
  return defects.filter((d) => !d.closed).sort((a, b) => rank[a.category] - rank[b.category] || a.at - b.at);
}

/**
 * The class survey pack (15 Oct 2026, TM Master V2 comparison, item 4: what a
 * class surveyor asks to see at a periodical survey, in one file): the class
 * items and their jobs with where each stands; every job overdue and every
 * deferral in force, with the open defects; the class jobs done and the
 * corrective / unplanned work since `since`. A job is a class job when it is
 * marked so or its machine is a class item.
 */
export function classPack(machines: Machine[], jobs: PmsJob[], done: PmsDone[], deferrals: PmsDeferral[], defects: PmsDefect[], today: string, since: string): MachineHistory[] {
  const live = machines.filter((m) => !m.deleted && !m.scrapped);
  const byId = new Map(machines.map((m) => [m.id, m]));
  // By class code, the ones without a code last.
  const byCode = (a?: string, b?: string) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0);
  const cls = live.filter((m) => m.classItem).sort((a, b) => byCode(a.classCode, b.classCode) || a.name.localeCompare(b.name));
  const liveJobs = jobs.filter((j) => !j.deleted && byId.get(j.machineId) && !byId.get(j.machineId)!.scrapped);
  const isClass = (j: Pick<PmsJob, 'classJob' | 'machineId'>) => !!j.classJob || !!byId.get(j.machineId)?.classItem;
  const due = (j: PmsJob) => jobDue(j, byId.get(j.machineId), today, activeDeferral(j, deferrals));
  const code = (m?: Machine) => (m?.classCode ? m.classCode : '');
  const classJobs = liveJobs.filter(isClass).sort((a, b) => byCode(code(byId.get(a.machineId)), code(byId.get(b.machineId))) || byId.get(a.machineId)!.name.localeCompare(byId.get(b.machineId)!.name) || a.title.localeCompare(b.title));
  const overdue = liveJobs.filter((j) => { const d = due(j); return d.status === 'expired' && !d.deferred; });
  const deferredNow = liveJobs.map((j) => ({ j, f: activeDeferral(j, deferrals) })).filter((x) => x.f);
  const openDx = openDefects(defects.filter((d) => byId.get(d.machineId) && !byId.get(d.machineId)!.scrapped));
  const inPeriod = done.filter((d) => d.date >= since && d.date <= today && !(d as { cancelled?: boolean }).cancelled).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const classDone = inPeriod.filter((d) => { const j = jobById.get(d.jobId); return j ? isClass(j) : !!byId.get(d.machineId)?.classItem; });
  const corrective = inPeriod.filter((d) => d.unplanned || jobById.get(d.jobId)?.oneOff);
  const period = `${dmy(since)} – ${dmy(today)}`;
  const jobRow = (j: PmsJob) => {
    const m = byId.get(j.machineId)!;
    const d = due(j);
    return [code(m), m.name, `${j.title}${m.critical ? ' (critical)' : ''}`, scheduleText(j).replace(/^Every /, ''), [dmy(j.lastDoneDate), j.lastDoneHours != null ? `${j.lastDoneHours} h` : ''].filter(Boolean).join(' · '), d.deferred ? 'Deferred' : STATUS[d.status], dueText(d)];
  };
  const doneRow = (d: PmsDone) => [dmy(d.date), code(byId.get(d.machineId)), d.machineName, `${d.unplanned ? 'Unplanned: ' : ''}${d.jobTitle}`, d.hours != null ? `${d.hours} h` : '', conditionText(d), `${d.doneBy ? `${who(d.doneBy, d.doneByRank)}; signed out by ` : ''}${who(d.by, d.byRank)}${d.signedWith ? ` · ${how(d.signedWith)}` : ''}`, d.note ?? ''];
  const doneHead = ['Date', 'Class code', 'System', 'Job', 'Counter', 'Condition', 'Done and signed by', 'Note'];
  const doneW = { 0: 18, 1: 22, 4: 16, 5: 24, 6: 44 };
  return [
    {
      title: 'Class items and class jobs',
      facts: [`${cls.length} class item${cls.length === 1 ? '' : 's'}`, `${classJobs.length} class job${classJobs.length === 1 ? '' : 's'}`, `${classJobs.filter((j) => due(j).status === 'expired' && !due(j).deferred).length} overdue`, `${classJobs.filter((j) => due(j).deferred).length} deferred`, `Printed ${dmy(today)}`],
      tables: [
        { title: 'Class items', head: ['Class code', 'System', 'Maker / model', 'S/N', 'Location', 'Critical', 'Running hours'], widths: { 0: 26, 3: 26, 5: 18, 6: 34 }, rows: cls.map((m) => [code(m), m.name, [m.maker, m.model].filter(Boolean).join(' '), m.serial ?? '', m.location ?? '', m.critical ? 'Yes' : '', hasCounter(m) && m.hours != null ? `${m.hours} h (${dmy(m.hoursDate)})` : '']) },
        { title: 'Class jobs', head: ['Class code', 'System', 'Job', 'Schedule', 'Last done', 'Status', 'Next'], widths: { 0: 22, 3: 30, 4: 30, 5: 20, 6: 60 }, rows: classJobs.map(jobRow) },
      ],
    },
    {
      title: 'Overdue, deferred and open defects',
      facts: [`${overdue.length} job${overdue.length === 1 ? '' : 's'} overdue`, `${deferredNow.length} deferred`, `${openDx.length} open defect${openDx.length === 1 ? '' : 's'}`, `As of ${dmy(today)}`],
      tables: [
        { title: 'Overdue jobs', head: ['Class code', 'System', 'Job', 'Schedule', 'Last done', 'Status', 'Overdue by'], widths: { 0: 22, 3: 30, 4: 30, 5: 20, 6: 60 }, rows: overdue.map(jobRow) },
        { title: 'Deferred jobs', head: ['Class code', 'System', 'Job', 'Deferred until', 'Reason', 'Deferred by'], widths: { 0: 22, 3: 34, 5: 44 }, rows: deferredNow.map(({ j, f }) => [code(byId.get(j.machineId)), byId.get(j.machineId)!.name, j.title, [f!.untilDate ? dmy(f!.untilDate) : null, f!.untilHours != null ? `${f!.untilHours} h` : null].filter(Boolean).join(' or '), f!.reason, who(f!.by, f!.byRank)]) },
        { title: 'Open defects', head: ['Raised', 'Category', 'System', 'Defect', 'Raised by'], widths: { 0: 20, 1: 26, 4: 44 }, rows: openDx.map((x) => [dmy(x.date), DEFECT_CATEGORY[x.category], x.machineName, x.description, who(x.by, x.byRank)]) },
      ],
    },
    {
      title: `Class jobs done and corrective work · ${period}`,
      facts: [`${classDone.length} class job${classDone.length === 1 ? '' : 's'} done`, `${corrective.length} corrective / unplanned`, `Period ${period}`],
      tables: [
        { title: 'Class jobs done', head: doneHead, widths: doneW, rows: classDone.map(doneRow) },
        { title: 'Corrective and unplanned work', head: doneHead, widths: doneW, rows: corrective.map(doneRow) },
      ],
    },
  ];
}
