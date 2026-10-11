// ===================================
// A machine's maintenance history as a surveyor reads it — the evidence class
// (continuous survey of machinery), PSC and the ISM auditor ask for: what the
// machine is, its jobs with intervals and where each stands, every job done
// (signed, with the counter reading and how many photos), deferrals, and
// defects open and closed. One machine, or every critical one as a survey pack.
// Pure, tested (check:pmshistory); printed by pmsHistoryReport.ts.
// ===================================

import { DEFECT_CATEGORY, JOB_TYPE, Machine, PmsDefect, PmsDeferral, PmsDone, PmsJob, hasCounter } from '../types/pms';
import { activeDeferral, dueText, jobDue, scheduleText } from './pms';

export interface HistTable {
  title: string;
  head: string[];
  rows: string[][];
  /** Column widths in mm on A4 landscape (277 mm usable); the rest share what is left. */
  widths?: Record<number, number>;
}
export interface MachineHistory {
  title: string;
  facts: string[];
  tables: HistTable[];
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const who = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);
const how = (m?: { method?: string }) => (!m ? '' : m.method === 'biometric' ? 'fingerprint' : m.method === 'drawn' ? 'handwritten' : 'PIN');
const STATUS: Record<string, string> = { expired: 'OVERDUE', due: 'Due soon', ok: 'In date', none: '—' };

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
    hasCounter(m) ? (m.hours != null ? `Running hours ${m.hours} h (read ${dmy(m.hoursDate)})` : 'Running hours: no reading') : null,
    `Printed ${dmy(today)}`,
  ].filter(Boolean) as string[];

  const tables: HistTable[] = [
    {
      title: 'Planned jobs',
      head: ['Job', 'Type', 'Schedule', 'Last done', 'Status', 'Next'],
      widths: { 1: 30, 2: 30, 3: 34, 4: 22, 5: 70 },
      rows: mj.map((j) => {
        const d = jobDue(j, m, today, activeDeferral(j, deferrals));
        return [j.title, j.type ? JOB_TYPE[j.type] : '', scheduleText(j).replace(/^Every /, ''), [dmy(j.lastDoneDate), j.lastDoneHours != null ? `${j.lastDoneHours} h` : ''].filter(Boolean).join(' · '), d.deferred ? 'Deferred' : STATUS[d.status], dueText(d)];
      }),
    },
    {
      title: 'Work done',
      head: ['Date', 'Job', 'Counter', 'Done and signed by', 'Note', 'Photos'],
      widths: { 0: 22, 2: 20, 3: 48, 5: 16 },
      rows: md.map((d) => [dmy(d.date), `${d.unplanned ? 'Unplanned: ' : ''}${d.jobTitle}`, d.hours != null ? `${d.hours} h` : '', `${who(d.by, d.byRank)}${d.signedWith ? ` · ${how(d.signedWith)}` : ''}`, [d.note, d.defectId ? 'Defect raised' : null].filter(Boolean).join(' · '), d.photos?.length ? String(d.photos.length) : '']),
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
