// ===================================
// A project — a yard period, a dry dock — and the jobs deferred to it: those
// still waiting (their active deferral points at the project) and those done
// since they were deferred to it. The yard list is printed from this.
// Pure, tested (check:pms).
// ===================================

import { CONDITION, JOB_TYPE, Machine, PmsDeferral, PmsDone, PmsJob, PmsProject } from '../types/pms';
import { activeDeferral } from './pms';
import type { MachineHistory } from './pmsHistory';

export interface ProjectJobs {
  pending: { job: PmsJob; machine: Machine; deferral: PmsDeferral }[];
  done: { done: PmsDone; deferral: PmsDeferral }[];
}

export function projectJobs(p: PmsProject, jobs: PmsJob[], machines: Machine[], deferrals: PmsDeferral[], done: PmsDone[]): ProjectJobs {
  const mById = new Map(machines.map((m) => [m.id, m]));
  const pending: ProjectJobs['pending'] = [];
  for (const j of jobs) {
    const d = activeDeferral(j, deferrals);
    const m = mById.get(j.machineId);
    if (d?.projectId === p.id && m) pending.push({ job: j, machine: m, deferral: d });
  }
  pending.sort((a, b) => Number(!!b.machine.critical) - Number(!!a.machine.critical) || a.machine.name.localeCompare(b.machine.name) || a.job.title.localeCompare(b.job.title));
  const toProject = deferrals.filter((d) => d.projectId === p.id);
  const doneRows: ProjectJobs['done'] = [];
  for (const d of done) {
    const def = toProject.filter((x) => x.jobId === d.jobId && x.at < d.at).sort((a, b) => b.at - a.at)[0];
    if (def) doneRows.push({ done: d, deferral: def });
  }
  doneRows.sort((a, b) => a.done.date.localeCompare(b.done.date));
  return { pending, done: doneRows };
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

/** The yard list as a printable page (services/pmsHistoryReport draws it). */
export function yardList(p: PmsProject, pj: ProjectJobs, today: string): MachineHistory {
  return {
    title: p.name,
    facts: [`Planned ${dmy(p.dueDate)}`, p.description ?? null, `${pj.pending.length} job${pj.pending.length === 1 ? "" : "s"} to do · ${pj.done.length} done`, `Printed ${dmy(today)}`].filter(Boolean) as string[],
    tables: [
      {
        title: 'To be done',
        head: ['Machine', 'Job', 'Type', 'Critical', 'Class', 'Deferred — reason', 'Location'],
        widths: { 2: 28, 3: 16, 4: 18, 6: 32 },
        rows: pj.pending.map(({ job, machine, deferral }) => [machine.name, job.title, job.type ? JOB_TYPE[job.type] : '', machine.critical ? 'CRITICAL' : '', job.classJob || machine.classItem ? `CLASS${machine.classCode ? ` ${machine.classCode}` : ''}` : '', `${dmy(new Date(deferral.at).toISOString().slice(0, 10))} — ${deferral.reason}`, machine.location ?? '']),
      },
      {
        title: 'Done',
        head: ['Date', 'Machine', 'Job', 'Condition after', 'Signed by'],
        widths: { 0: 22, 3: 30 },
        rows: pj.done.map(({ done }) => [dmy(done.date), done.machineName, done.jobTitle, done.conditionAfter ? CONDITION[done.conditionAfter] : '', done.byRank ? `${done.by} (${done.byRank})` : done.by]),
      },
    ],
  };
}
