// The planned-maintenance month as figures and rows — pure, no I/O, so it is
// tested (scripts/check-pms) and shared by the PDF / Excel (services/pmsReport).
import { activeDeferral, dueText, jobDue, todayIso } from './pms';
import { CONDITION, JOB_TYPE, Machine, PmsDeferral, PmsDone, PmsJob } from '../types/pms';

const proofShort = (p?: { method: string }) => (!p ? '' : p.method === 'biometric' ? 'fingerprint' : p.method === 'drawn' ? 'handwritten' : 'PIN');

export interface PmsMonth {
  month: string;
  done: string[][];
  deferred: string[][];
  overdue: string[][];
  completion: { all: number | null; critical: number | null; doneAll: number; doneCritical: number; overdueAll: number; overdueCritical: number };
  /** Man-hours recorded on the month's sign-outs. */
  manHours: number;
}

const pct = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : null);
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function pmsMonth(month: string, machines: Machine[], jobs: PmsJob[], done: PmsDone[], deferrals: PmsDeferral[], today = todayIso()): PmsMonth {
  const mById = new Map(machines.map((m) => [m.id, m]));
  const jById = new Map(jobs.map((j) => [j.id, j]));
  const crit = (machineId: string) => !!mById.get(machineId)?.critical;
  const monthDone = done.filter((d) => d.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const monthDef = deferrals.filter((d) => localDay(d.at).startsWith(month)).sort((a, b) => a.at - b.at);
  const overdueJobs = jobs
    .filter((j) => !j.deleted && mById.has(j.machineId))
    .map((j) => ({ j, d: jobDue(j, mById.get(j.machineId), today, activeDeferral(j, deferrals)) }))
    .filter((x) => x.d.status === 'expired')
    .sort((a, b) => Number(crit(b.j.machineId)) - Number(crit(a.j.machineId)));
  const doneCritical = monthDone.filter((d) => crit(d.machineId)).length;
  const overdueCritical = overdueJobs.filter((x) => crit(x.j.machineId)).length;
  return {
    month,
    done: monthDone.map((d) => {
      const j = jById.get(d.jobId);
      const cond = d.conditionAfter ? CONDITION[d.conditionAfter] : '';
      return [dm(d.date), `${crit(d.machineId) ? '⚑ ' : ''}${d.machineName}`, d.jobTitle, j?.type ? JOB_TYPE[j.type] : '', d.hours != null ? String(d.hours) : '', cond, d.manHours != null ? String(d.manHours) : '', d.byRank ? `${d.by} (${d.byRank})` : d.by, proofShort(d.signedWith), d.note ?? ''];
    }),
    deferred: monthDef.map((d) => [dm(localDay(d.at)), d.machineName, d.jobTitle, [d.untilDate ? dm(d.untilDate) : null, d.untilHours != null ? `${d.untilHours} h` : null].filter(Boolean).join(' / '), d.reason, d.byRank ? `${d.by} (${d.byRank})` : d.by]),
    overdue: overdueJobs.map(({ j, d }) => [`${crit(j.machineId) ? '⚑ ' : ''}${mById.get(j.machineId)?.name ?? ''}`, j.title, j.type ? JOB_TYPE[j.type] : '', dueText(d)]),
    manHours: Math.round(monthDone.reduce((s, d) => s + (d.manHours ?? 0), 0) * 10) / 10,
    completion: {
      all: pct(monthDone.length, overdueJobs.length),
      critical: pct(doneCritical, overdueCritical),
      doneAll: monthDone.length,
      doneCritical,
      overdueAll: overdueJobs.length,
      overdueCritical,
    },
  };
}

export const PMS_HEAD = {
  done: ['Date', 'Machine', 'Job', 'Type', 'Hours', 'Condition after', 'Man-h', 'Signed by', 'How', 'Note'],
  deferred: ['Deferred on', 'Machine', 'Job', 'Until', 'Reason', 'Master'],
  overdue: ['Machine', 'Job', 'Type', 'Overdue'],
};

export function monthLabelPms(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function completionLine(r: PmsMonth): string {
  const c = r.completion;
  return `Completion ${c.all == null ? '—' : `${c.all} %`} (${c.doneAll} done, ${c.overdueAll} overdue) · Critical equipment ${c.critical == null ? '—' : `${c.critical} %`} (${c.doneCritical} done, ${c.overdueCritical} overdue)${r.manHours ? ` · ${r.manHours} man-hours` : ''}`;
}

