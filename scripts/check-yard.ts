// npm run check:yard — yard periods: a job's stage, a project's totals, warranty dates, claims, and the specification sheet round trip.
import {
  addMonths, cellAmount, claimInCover, claimStage, coverList, coverState, defectsToAdd, jobCover, jobFromDefect, jobFromPms, jobProblem, jobStage,
  nextClaimNo, nextJobNo, pmsToAdd, projectPhase, projectTotals, readSpecPrices, specRows, yardDept,
} from '../services/yard';
import { Machine, PmsDefect, PmsJob, PmsProject } from '../types/pms';
import { WarrantyClaim, YardJob } from '../types/yard';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const P: PmsProject = { id: 'p1', name: 'Winter refit 2026', dueDate: '2026-11-15', createdBy: 'Master', createdAt: 0, updatedAt: 0, currency: 'EUR', budget: 100000 };
const acc = (date: string) => ({ date, note: 'Checked', by: 'Chief', at: 1 });
const J = (id: string, p: Partial<YardJob>): YardJob => ({ id, projectId: 'p1', no: 1, title: 'Job ' + id, dept: 'engine', by: 'yard', createdBy: 'CE', at: 0, updatedAt: 0, ...p });

// stages
ok(jobStage(J('a', {})) === 'planned', 'new job: planned');
ok(jobStage(J('a', { startedOn: '2026-11-16' })) === 'progress', 'started: in progress');
ok(jobStage(J('a', { startedOn: '2026-11-16', doneOn: '2026-11-20' })) === 'done', 'done');
ok(jobStage(J('a', { doneOn: '2026-11-20', accepted: acc('2026-11-21') })) === 'accepted', 'accepted');
ok(jobStage(J('a', { accepted: acc('2026-11-21'), cancelled: { date: '2026-11-22', reason: 'x', by: 'y' } })) === 'cancelled', 'cancelled wins over everything');

// numbering
const jobs = [
  J('j1', { no: 1, quoted: 10000, final: 12000, accepted: acc('2026-11-30'), warrantyMonths: 12 }),
  J('j2', { no: 2, quoted: 5000, startedOn: '2026-11-20' }),
  J('j3', { no: 3 }),
  J('j4', { no: 4, by: 'crew' }),
  J('j5', { no: 5, quoted: 99999, cancelled: { date: '2026-11-18', reason: 'Postponed', by: 'CE' } }),
  J('x1', { projectId: 'p2', no: 9, quoted: 1 }),
];
ok(nextJobNo('p1', jobs) === 6, 'next number counts the cancelled job: never re-used');
ok(nextJobNo('p3', jobs) === 1, 'a new project starts at 1');

// totals
const tot = projectTotals(P, jobs);
ok(tot.live === 4 && tot.count.cancelled === 1, '4 live jobs, 1 cancelled');
ok(tot.quoted === 15000, 'quoted leaves out the cancelled job and other projects');
ok(tot.final === 12000 && tot.forecast === 17000, 'forecast = final where known, else quoted');
ok(tot.unpriced === 1, 'unpriced: the yard job without a price; the crew job does not count');
ok(tot.budgetLeft === 83000, 'budget left = budget − forecast');
ok(tot.accepted === 0.25, 'a quarter accepted');
ok(projectTotals({ ...P, budget: undefined }, jobs).budgetLeft === undefined, 'no budget: nothing left to show');
ok(projectPhase(P) === 'planning' && projectPhase({ ...P, startedOn: '2026-11-16' }) === 'inYard' && projectPhase({ ...P, startedOn: '2026-11-16', finishedOn: '2027-01-10' }) === 'finished' && projectPhase({ ...P, closedAt: 5 }) === 'closed', 'project phases');

// dates
ok(addMonths('2026-01-31', 1) === '2026-02-28', '31 Jan + 1 month = 28 Feb');
ok(addMonths('2028-01-31', 1) === '2028-02-29', 'leap year: 29 Feb');
ok(addMonths('2026-11-30', 12) === '2027-11-30', '+12 months');
ok(addMonths('2026-12-15', 2) === '2027-02-15', 'over the year end');
ok(addMonths('2026-03-15', -12) === '2025-03-15', 'back a year');
ok(coverState('2027-01-31', '2026-12-01') === 'active', '61 days left: still in warranty');
ok(coverState('2027-01-30', '2026-12-01') === 'expiring', '60 days left: runs out soon');
ok(coverState('2027-02-01', '2026-12-01') === 'active', '62 days left: in warranty');
ok(coverState('2026-11-30', '2026-12-01') === 'expired', 'the day after: expired');
ok(coverState('2026-12-01', '2026-12-01') === 'expiring', 'the last day is still covered');

// warranty from the jobs
ok(jobCover(jobs[0])?.until === '2027-11-30', 'accepted 30 Nov + 12 months');
ok(jobCover(jobs[1]) === null, 'not accepted: no warranty yet');
ok(jobCover(J('w', { accepted: acc('2026-11-30') })) === null, 'accepted with no warranty months');
ok(jobCover(J('w', { accepted: acc('2026-11-30'), warrantyMonths: 6, cancelled: { date: 'x', reason: 'x', by: 'x' } })) === null, 'cancelled: none');
const old = J('old', { no: 7, accepted: acc('2024-01-10'), warrantyMonths: 12 });
const ending = J('end', { no: 8, accepted: acc('2026-01-20'), warrantyMonths: 12 });
const gone = J('gone', { no: 9, accepted: acc('2025-06-01'), warrantyMonths: 12 });
const cl = coverList([jobs[0], old, ending, gone], [P], [], '2026-12-01');
ok(cl.length === 3, 'expired more than a year ago is left out');
ok(cl.map((r) => r.job.id).join() === 'end,j1,gone', 'soonest to run out first, expired last');
ok(cl[0].state === 'expiring' && cl[2].state === 'expired', 'states on the list');

// claims
const C = (p: Partial<WarrantyClaim>): WarrantyClaim => ({ id: 'c', no: 'WC-2026-001', title: 'Leak', against: 'Yard', found: '2027-03-01', description: 'Seal leaking again', createdBy: 'CE', at: 0, updatedAt: 0, ...p });
ok(claimStage(C({})) === 'draft', 'claim: draft');
ok(claimStage(C({ submitted: { date: 'd', by: 'b' } })) === 'submitted', 'claim: submitted');
ok(claimStage(C({ submitted: { date: 'd', by: 'b' }, answer: { date: 'd', outcome: 'rejected', note: 'n' } })) === 'answered', 'claim: answered');
ok(claimStage(C({ closed: { date: 'd', how: 'repaired', note: 'n', by: 'b', at: 1 } })) === 'closed', 'claim: closed');
ok(claimInCover(C({ yardJobId: 'j1' }), jobs) === true, 'found inside the job warranty');
ok(claimInCover(C({ yardJobId: 'j1', found: '2027-12-01' }), jobs) === false, 'found after the job warranty');
ok(claimInCover(C({ coverFrom: '2026-05-01', coverUntil: '2028-05-01' }), jobs) === true, 'own warranty dates');
ok(claimInCover(C({ coverFrom: '2027-05-01', coverUntil: '2028-05-01' }), jobs) === false, 'found before the warranty started');
ok(claimInCover(C({}), jobs) === null, 'no warranty to judge by');
ok(claimInCover(C({ yardJobId: 'j1', coverUntil: '2027-01-01' }), jobs) === false, "the claim's own dates win over the job's");
const claims = [C({ no: 'WC-2026-001' }), C({ no: 'WC-2026-004' }), C({ no: 'WC-2025-009' })];
ok(nextClaimNo(claims, '2026') === 'WC-2026-005', 'next claim number after the highest of the year');
ok(nextClaimNo(claims, '2027') === 'WC-2027-001', 'a new year starts at 001');

// defects and PMS jobs onto the list
const D = (id: string, p: Partial<PmsDefect>): PmsDefect => ({ id, machineId: 'm1', machineName: 'Stabiliser PS', category: 'operational', description: 'Fin seal weeping', date: '2026-10-01', by: 'CE', at: 0, updatedAt: 0, ...p });
const defects = [D('d1', {}), D('d2', { category: 'safety', date: '2026-10-05' }), D('d3', { closed: { date: 'x', note: 'x', by: 'x', at: 1 } }), D('d4', {}), D('d5', {})];
const onList = [J('y1', { defectId: 'd4' }), J('y2', { defectId: 'd5', cancelled: { date: 'x', reason: 'x', by: 'x' } })];
const left = defectsToAdd(defects, onList);
ok(left.map((d) => d.id).join() === 'd2,d1,d5', 'open defects not on a live job, safety first; a cancelled job frees its defect');
const long = D('d9', { category: 'class', description: 'Port stabiliser fin: hydraulic seal weeping at the shaft, about 2 litres a day, oil collected in the tray' });
const fromD = jobFromDefect(long, 'p1', 6, 'engine', 'CE', 5);
ok(fromD.title.length <= 70 && fromD.title.endsWith('…') && fromD.spec === long.description, 'a long defect: short title, full text in the specification');
ok(fromD.classItem === true && fromD.defectId === 'd9' && fromD.no === 6, 'class defect → class item, linked');
ok(jobFromDefect(D('d1', {}), 'p1', 1, 'engine', 'CE', 5).id === jobFromDefect(D('d1', {}), 'p1', 1, 'engine', 'CE', 9).id, 'the same defect on the same project gets the same id on two devices');
const M = { id: 'm1', name: 'Generator 2', dept: 'engineering', updatedAt: 0 } as unknown as Machine;
const pj = { id: 'pj1', machineId: 'm1', title: 'Overhaul 12 000 h', notes: 'Maker kit 1234' } as PmsJob;
const fromP = jobFromPms(pj, M, 'p1', 2, 'CE', 5);
ok(fromP.pmsJobId === 'pj1' && fromP.spec === 'Maker kit 1234' && fromP.dept === 'engine', 'a deferred PMS job becomes a line, notes as specification');
ok(pmsToAdd([{ job: pj }, { job: { ...pj, id: 'pj2' } }], 'p1', [fromP]).map((x) => x.job.id).join() === 'pj2', 'a PMS job already on the list is not offered again');
ok(yardDept({ dept: 'avit' } as Machine) === 'electrical' && yardDept({} as Machine) === 'engine' && yardDept({ dept: 'hull' } as Machine) === 'hull', 'machine department → work-list department');

// problems
ok(jobProblem({ title: 'ab' }) === 'yd.needTitle', 'title too short');
ok(jobProblem({ title: 'Paint', quoted: -1 }) === 'yd.negative', 'negative price');
ok(jobProblem({ title: 'Paint', warrantyMonths: 200 }) === 'yd.badWarranty', 'warranty over 10 years');
ok(jobProblem({ title: 'Paint', startedOn: '2026-11-20', doneOn: '2026-11-19' }) === 'yd.doneBeforeStart', 'done before started');
ok(jobProblem({ title: 'Paint', quoted: 0, warrantyMonths: 0 }) === null, 'zeros are fine');

// amounts
ok(cellAmount(1234.5) === 1234.5, 'number');
ok(cellAmount('€ 1.234,50') === 1234.5, 'European format with €');
ok(cellAmount('1,234.50') === 1234.5, 'English format');
ok(cellAmount('12,5') === 12.5, 'decimal comma');
ok(cellAmount('EUR 4 500') === 4500, 'currency code and spaces');
ok(cellAmount('') === undefined && cellAmount('n/a') === undefined, 'empty and words: no amount');

// the specification sheet round trip
const rows = specRows(P, jobs);
ok(rows.length === 5 && rows[0][9] === 'Job ID' && rows[0][7] === 'Yard price (EUR)', 'sheet: header and the four live jobs (the cancelled one left out)');
const filled = rows.map((r, i) => (i === 0 ? r : [...r.slice(0, 7), i === 1 ? '11 000,00' : i === 2 || i === 4 ? '' : '700', i === 2 ? 'Included in item 1' : '', r[9]]));
const title = [['Specification — Winter refit 2026'], ['M/Y Test']];
const read = readSpecPrices([...title, ...filled]);
ok(!read.error && read.prices.length === 3, 'header found below the title rows; a line with no price and no remark is skipped');
ok(read.prices.find((x) => x.jobId === rows[1][9])?.price === 11000, 'price read in the yard\'s own format');
ok(read.prices.find((x) => x.jobId === rows[2][9])?.remark === 'Included in item 1' && read.prices.find((x) => x.jobId === rows[2][9])?.price === undefined, 'a remark without a price is read');
ok(readSpecPrices([['a', 'b'], [1, 2]]).error === 'yd.sheetNoId', 'not our sheet');
ok(readSpecPrices([['Job ID', 'Item'], ['j1', 'x']]).error === 'yd.sheetNoPrice', 'no price column');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
