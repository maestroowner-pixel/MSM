// ===================================
// Yard period and warranty papers — PDF through the shared table report
// (services/pmsHistoryReport) and .xlsx (services/sheetFiles). English, as every report.
//   Specification  the work list sent to the yards, by department. Its Excel has
//                  a Job ID column and empty Yard price / Yard remarks columns: the
//                  yard fills them in and the sheet is read back (readSpecPrices).
//   Progress       every job's stage, quoted and final price, who accepted it;
//                  the totals against the budget.
//   Claim          one warranty claim, as sent to the yard or the maker.
//   Warranty       what is under warranty, and every claim.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { saveSheet } from './sheetFiles';
import { byDept, specRows, claimCover, claimInCover, claimStage, CoverRow, jobCover, jobNo, jobStage, jobsOf, money, projectTotals } from './yard';
import { PmsProject } from '../types/pms';
import {
  CLAIM_OUTCOME_LABEL, CLAIM_SETTLEMENT_LABEL, PROJECT_KIND_LABEL, WarrantyClaim, YARD_BY_LABEL, YARD_DEPT_LABEL, YARD_STAGE_LABEL, YardJob,
} from '../types/yard';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const who = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);
const byText = (j: YardJob) => (j.by === 'yard' ? 'Yard' : `${YARD_BY_LABEL[j.by]}${j.contractor ? `: ${j.contractor}` : ''}`);
const stem = (p: PmsProject) => p.name.replace(/[\\/:*?"<>|]+/g, ' ');

function projectFacts(p: PmsProject, today: string): string[] {
  return [
    p.kind ? PROJECT_KIND_LABEL[p.kind] : 'Yard period',
    [p.yard, p.place].filter(Boolean).join(', '),
    p.endDate ? `Planned ${dmy(p.dueDate)} – ${dmy(p.endDate)}` : `Planned ${dmy(p.dueDate)}`,
    p.startedOn ? `In yard ${dmy(p.startedOn)}${p.finishedOn ? ` – ${dmy(p.finishedOn)}` : ''}` : '',
    p.description ?? '',
    `Printed ${dmy(today)}`,
  ].filter(Boolean);
}

export function exportSpecification(p: PmsProject, jobs: YardJob[], today: string, vessel: VesselInfo | null) {
  const live = jobsOf(p.id, jobs).filter((j) => !j.cancelled);
  const tables = byDept(live).map(({ dept, jobs: list }) => ({
    title: YARD_DEPT_LABEL[dept],
    head: ['No.', 'Item', 'Machine', 'Specification', 'By', 'Class'],
    rows: list.map((j) => [jobNo(j), j.title, j.machineName ?? '', j.spec ?? '', byText(j), j.classItem ? 'CLASS' : '']),
    widths: { 0: 12, 1: 55, 2: 40, 3: 116, 4: 34, 5: 16 },
  }));
  return exportPmsHistory('Yard specification', `Specification ${stem(p)}`, vessel, [{
    title: `Specification — ${p.name}`,
    facts: [...projectFacts(p, today), `${live.length} items`, p.currency ? `Prices in ${p.currency}` : ''].filter(Boolean),
    tables: [...tables, { title: 'Issued', head: ['Chief Engineer', 'Master', 'Superintendent'], rows: [['', '', '']], widths: { 0: 91, 1: 91, 2: 91 } }],
  }]);
}

/** The specification as a sheet the yard fills in: keep the Job ID column. */
export function specSheet(p: PmsProject, jobs: YardJob[], vessel: VesselInfo | null) {
  return saveSheet(specRows(p, jobs), 'Specification', `Specification ${stem(p)}`, vessel);
}

export function exportProgress(p: PmsProject, jobs: YardJob[], today: string, vessel: VesselInfo | null) {
  const list = jobsOf(p.id, jobs);
  const tot = projectTotals(p, jobs);
  const cur = p.currency;
  const rows = list.map((j) => {
    const s = jobStage(j);
    return [
      jobNo(j), j.title, YARD_DEPT_LABEL[j.dept], byText(j),
      s === 'cancelled' ? `Cancelled — ${j.cancelled!.reason}` : YARD_STAGE_LABEL[s] + (s === 'done' && j.doneOn ? ` ${dmy(j.doneOn)}` : ''),
      money(j.quoted), money(j.final), j.invoice ?? '',
      j.accepted ? `${who(j.accepted.by, j.accepted.byRank)} ${dmy(j.accepted.date)}${j.accepted.signedWith ? ' (signed)' : ''}` : '',
      j.warrantyMonths ? `${j.warrantyMonths} mo${jobCover(j) ? ` to ${dmy(jobCover(j)!.until)}` : ''}` : '',
    ];
  });
  const facts = [
    ...projectFacts(p, today),
    `${tot.live} jobs: ${tot.count.planned} planned, ${tot.count.progress} in progress, ${tot.count.done} done, ${tot.count.accepted} accepted${tot.count.cancelled ? `, ${tot.count.cancelled} cancelled` : ''}`,
    `Quoted ${money(tot.quoted, cur)} · final so far ${money(tot.final, cur)} · forecast ${money(tot.forecast, cur)}${tot.unpriced ? ` (${tot.unpriced} not priced)` : ''}`,
    p.budget != null ? `Budget ${money(p.budget, cur)} · ${tot.budgetLeft! < 0 ? `OVER by ${money(-tot.budgetLeft!, cur)}` : `left ${money(tot.budgetLeft, cur)}`}` : '',
  ].filter(Boolean);
  return exportPmsHistory('Yard progress', `Yard progress ${stem(p)}`, vessel, [{
    title: `Progress — ${p.name}`,
    facts,
    tables: [
      { title: 'Work list', head: ['No.', 'Item', 'Dept', 'By', 'Stage', 'Quoted', 'Final', 'Invoice', 'Accepted by', 'Warranty'], rows, widths: { 0: 11, 1: 62, 2: 24, 3: 28, 4: 30, 5: 20, 6: 20, 7: 20, 8: 34, 9: 24 } },
      { title: 'Signed', head: ['Chief Engineer', 'Master', 'Superintendent'], rows: [['', '', '']], widths: { 0: 91, 1: 91, 2: 91 } },
    ],
  }]);
}

export function exportClaim(c: WarrantyClaim, jobs: YardJob[], projects: PmsProject[], vessel: VesselInfo | null) {
  const job = c.yardJobId ? jobs.find((j) => j.id === c.yardJobId) : undefined;
  const project = projects.find((p) => p.id === (c.projectId ?? job?.projectId));
  const cv = claimCover(c, jobs);
  const inCover = claimInCover(c, jobs);
  const chronology: string[][] = [[dmy(c.found), 'Fault found', c.createdBy]];
  if (c.submitted) chronology.push([dmy(c.submitted.date), `Claim submitted${c.submitted.to ? ` to ${c.submitted.to}` : ''}`, c.submitted.by]);
  if (c.answer) chronology.push([dmy(c.answer.date), `${CLAIM_OUTCOME_LABEL[c.answer.outcome]}${c.answer.theirRef ? ` (their ref. ${c.answer.theirRef})` : ''}: ${c.answer.note}`, c.against]);
  if (c.closed) chronology.push([dmy(c.closed.date), `Closed — ${CLAIM_SETTLEMENT_LABEL[c.closed.how]}${c.closed.cost ? `, our cost ${money(c.closed.cost)}` : ''}: ${c.closed.note}`, `${who(c.closed.by, c.closed.byRank)}${c.closed.signedWith ? ' (signed)' : ''}`]);
  return exportPmsHistory('Warranty claim', `Warranty claim ${c.no}`, vessel, [{
    title: `Warranty claim ${c.no} — ${c.title}`,
    facts: [
      `To: ${c.against}`,
      c.machineName ? `Equipment: ${c.machineName}` : '',
      job ? `Work: item ${jobNo(job)} "${job.title}"${project ? `, ${project.name}` : ''}${job.accepted ? `, accepted ${dmy(job.accepted.date)}` : ''}${job.invoice ? `, invoice ${job.invoice}` : ''}` : '',
      cv ? `Warranty ${cv.from ? `${dmy(cv.from)} – ` : 'until '}${dmy(cv.until)}${inCover === false ? ' — fault found OUTSIDE it' : ''}` : '',
      `Fault found ${dmy(c.found)}`,
    ].filter(Boolean),
    tables: [
      { title: 'Description of the fault', head: ['Description'], rows: [[c.description]], widths: { 0: 273 } },
      { title: 'Chronology', head: ['Date', 'Event', 'By'], rows: chronology, widths: { 0: 24, 1: 189, 2: 60 } },
      ...(c.photos?.length ? [{ title: 'Attachments', head: ['Photographs'], rows: [[`${c.photos.length} photograph${c.photos.length === 1 ? '' : 's'} attached to this claim in ISMpilot`]], widths: { 0: 273 } }] : []),
      { title: 'Signed', head: ['For the vessel', `For ${c.against}`], rows: [['', '']], widths: { 0: 136, 1: 137 } },
    ],
  }]);
}

export function exportWarranty(cover: CoverRow[], claims: WarrantyClaim[], jobs: YardJob[], today: string, vessel: VesselInfo | null) {
  const STATE = { active: 'In warranty', expiring: 'Runs out soon', expired: 'Expired' } as const;
  const coverRows = cover.map((r) => [
    `${jobNo(r.job)} ${r.job.title}`, r.job.machineName ?? '', r.project?.name ?? '', byText(r.job), dmy(r.from), dmy(r.until), STATE[r.state], r.claims.map((c) => c.no).join(', '),
  ]);
  const STAGE = { draft: 'Draft', submitted: 'Submitted', answered: 'Answered', closed: 'Closed' } as const;
  const claimRows = [...claims].sort((a, b) => b.found.localeCompare(a.found)).map((c) => {
    const cv = claimCover(c, jobs);
    return [
      c.no, c.title, c.machineName ?? '', c.against, dmy(c.found), cv ? dmy(cv.until) : '',
      STAGE[claimStage(c)] + (c.answer ? ` — ${CLAIM_OUTCOME_LABEL[c.answer.outcome]}` : ''),
      c.closed ? CLAIM_SETTLEMENT_LABEL[c.closed.how] : '',
    ];
  });
  return exportPmsHistory('Warranty register', `Warranty ${today}`, vessel, [{
    title: 'Warranty register',
    facts: [`${cover.filter((r) => r.state !== 'expired').length} items in warranty`, `${cover.filter((r) => r.state === 'expiring').length} run out within 60 days`, `${claims.filter((c) => !c.closed).length} open claims`, dmy(today)],
    tables: [
      { title: 'Under warranty (yard work)', head: ['Item', 'Machine', 'Project', 'By', 'From', 'Until', 'State', 'Claims'], rows: coverRows, widths: { 0: 62, 1: 38, 2: 38, 3: 32, 4: 20, 5: 20, 6: 26, 7: 37 } },
      { title: 'Claims', head: ['No.', 'Claim', 'Machine', 'Against', 'Found', 'Warranty to', 'Stage', 'Outcome'], rows: claimRows, widths: { 0: 24, 1: 60, 2: 36, 3: 38, 4: 20, 5: 22, 6: 35, 7: 38 } },
    ],
  }]);
}
