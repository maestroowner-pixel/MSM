// npm run check:officecheck — verified by the office: a defect's stage, verify / return, the Board's order and its notices.
import { approveDeferral, deferralAwaitsOffice, deferralsToAnswer, refuseDeferral, awaitsOffice, defectScore, defectStage, giveBack, ncAwaitsOffice, needsPhoto, officeInLoop, rankDefects, verify, verifyNc } from '../services/officeCheck';
import { buildBoard } from '../services/board';
import { activeDeferral, jobCycle, jobDue, refusedDeferral } from '../services/pms';
import { PmsDefect, PmsDeferral, PmsJob } from '../types/pms';
import { NonConformity } from '../types/safety';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const D = (id: string, p: Partial<PmsDefect>): PmsDefect => ({ id, machineId: 'm1', machineName: 'ME', category: 'operational', description: 'Leak ' + id, date: '2026-10-01', by: 'CE', at: 1, updatedAt: 1, ...p });
const close = { date: '2026-10-20', note: 'Gasket renewed', by: '2/E', at: 100 };
const supt = { name: 'Anna Supt', rank: 'Office' };

// stages
ok(defectStage(D('a', {})) === 'open', 'new: open');
ok(defectStage(D('a', { awaitingSpares: { since: '2026-10-02' } })) === 'spares', 'awaiting spares');
ok(defectStage(D('a', { closed: close })) === 'closed', 'closed aboard');
const v = verify(D('a', { closed: close }), supt, '', 200);
ok(defectStage(v) === 'verified' && !awaitsOffice(v), 'verified: final, no longer waiting');
ok(v.closed === close || JSON.stringify(v.closed) === JSON.stringify(close), 'verifying keeps the closure');
ok(!('note' in v.office!), 'empty note is not written');

// return
let threw = false;
try { giveBack(D('a', { closed: close }), supt, ' ', 200); } catch { threw = true; }
ok(threw, 'returning needs a reason');
const r = giveBack(D('a', { closed: close }), supt, 'No photo of the new gasket', 200);
ok(!r.closed && r.closedBefore?.length === 1 && r.office?.result === 'returned', 'returned: closure moved to history, open again');
ok(defectStage(r) === 'returned' && !awaitsOffice(r), 'returned: shown as returned, not waiting for the office');
const again = { ...r, closed: { ...close, at: 300, note: 'Photo attached' } };
ok(awaitsOffice(again) && defectStage(again) === 'closed', 'closed again: waits for the office again');
const r2 = giveBack(again, supt, 'Still leaking', 400);
ok(r2.closedBefore?.length === 2 && r2.closedBefore[0].note === 'Gasket renewed', 'second return keeps both closures, oldest first');
threw = false;
try { verify(D('a', {}), supt, '', 1); } catch { threw = true; }
ok(threw, 'an open defect cannot be verified');

// NC
const nc: NonConformity = { id: 'n1', no: 'NC-2026-001', date: '2026-10-01', source: 'audit' as any, grade: 'minor' as any, title: 'x', what: 'y', actions: [], raisedBy: 'M', raisedAt: 1, updatedAt: 1 };
ok(!ncAwaitsOffice(nc), 'open NC is not waiting for the office');
const ncc = { ...nc, closedAt: 50, closedBy: 'Master' };
ok(ncAwaitsOffice(ncc) && !ncAwaitsOffice(verifyNc(ncc, supt, 'ok', 60)), 'closed NC waits until verified');

// photo rule
ok(needsPhoto({ category: 'safety' }) && needsPhoto({ category: 'class' }) && !needsPhoto({ category: 'operational' }), 'photo required for safety and class only');

// loop switch
ok(!officeInLoop([D('a', { closed: close })]), 'no office answer yet: office not in the loop');
ok(officeInLoop([v]) && officeInLoop([], [verifyNc(ncc, supt, '', 1)]), 'one answer puts the office in the loop');

// ranking: criticality × age
const today = '2026-10-28';
const oldOp = D('op', { date: '2026-08-01' });   // 88 days, weight 1 → ~13.6
const newCls = D('cls', { category: 'class', date: '2026-10-27' }); // 1 day, weight 2 → ~2.3
const midSafety = D('saf', { category: 'safety', date: '2026-10-21' }); // 7 days, weight 3 → 6
ok(defectScore(oldOp, today) > defectScore(midSafety, today) && defectScore(midSafety, today) > defectScore(newCls, today), 'score: an old operational defect outranks a fresh class one');
ok(rankDefects([newCls, midSafety, oldOp, D('c', { closed: close })], today).map((d) => d.id).join() === 'op,saf,cls', 'rank: worst first, closed left out');

// Deferral through the office (plan item 32)
const job: PmsJob = { id: 'j', machineId: 'm1', title: 'Overhaul', intervalDays: 30, lastDoneDate: '2026-08-01' } as any;
const F = (id: string, p: Partial<PmsDeferral>): PmsDeferral => ({ id, jobId: 'j', machineId: 'm1', jobTitle: 'Overhaul', machineName: 'ME', cycle: jobCycle(job), untilDate: '2026-12-01', reason: 'Spares on order', by: 'Master', at: 10, updatedAt: 10, ...p });
const f1 = F('f1', {});
ok(activeDeferral(job, [f1]) === f1 && deferralAwaitsOffice(f1), 'a signed deferral holds at once and waits for the office');
ok(jobDue(job, { id: 'm1' } as any, today, activeDeferral(job, [f1])).status === 'ok', 'pending deferral: the job is not overdue');
threw = false;
try { refuseDeferral(f1, supt, '', 20); } catch { threw = true; }
ok(threw, 'refusing needs a reason');
const fa = approveDeferral(f1, supt, '', 20);
ok(fa.office?.result === 'approved' && activeDeferral(job, [fa]) === fa && !deferralAwaitsOffice(fa), 'approved: holds, no longer waiting');
threw = false;
try { refuseDeferral(fa, supt, 'later', 30); } catch { threw = true; }
ok(threw, 'an answered deferral cannot be answered again');
const fr = refuseDeferral(f1, supt, 'Class item — do it in Palma', 20);
ok(!activeDeferral(job, [fr]) && refusedDeferral(job, [fr]) === fr, 'refused: holds no longer, the refusal stands');
ok(jobDue(job, { id: 'm1' } as any, today, activeDeferral(job, [fr])).status === 'expired', 'refused: the job is overdue on its own dates again');
const f2 = F('f2', { at: 40, updatedAt: 40, untilDate: '2026-11-15' });
ok(activeDeferral(job, [fr, f2]) === f2 && !refusedDeferral(job, [fr, f2]), 'deferred again: the new request holds, the old refusal no longer shows');
ok(deferralsToAnswer([fr, f2], [job]).map((d) => d.id).join() === 'f2', 'to answer: only the unanswered one');
ok(!deferralsToAnswer([F('old', { cycle: '2026-01-01|' })], [job]).length, 'to answer: not a deferral of a cycle already done');
ok(officeInLoop([], [], [fa]) && !officeInLoop([], [], [f1]), 'an answered deferral puts the office in the loop');

// Board
const base: any = {
  on: (m: string) => ['pms', 'officeCheck', 'qhse'].includes(m), role: 'superadmin', me: null, today, now: `${today}T10:00`,
  labelOf: (c: string) => c, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [],
  machines: [{ id: 'm1', name: 'ME' }], pmsJobs: [{ id: 'j', machineId: 'm1', title: 'x' }], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [],
};
const s1 = D('s1', { category: 'safety', date: '2026-10-27', description: 'fresh' });
const s2 = D('s2', { category: 'safety', date: '2026-09-01', description: 'old' });
let b = buildBoard({ ...base, pmsDefects: [s1, s2] });
ok(b.attention.find((n) => n.key === 'pms:defect-safety')?.sub === 'old', 'Board names the worst safety defect, the oldest');
b = buildBoard({ ...base, pmsDefects: [r] });
ok(!!b.attention.find((n) => n.key === 'pms:returned:a' && n.sub === 'No photo of the new gasket'), 'returned defect: notice to the officers with the reason');
b = buildBoard({ ...base, pmsDefects: [D('c1', { closed: close })] });
ok(!b.attention.find((n) => n.key === 'office:await'), 'office not in the loop: no "awaiting the office" notice');
b = buildBoard({ ...base, pmsDefects: [D('c1', { closed: close }), v], ncs: [ncc] });
ok(b.attention.find((n) => n.key === 'office:await')?.title.includes('2') === true, 'office in the loop: one closed defect + one NC awaiting');
b = buildBoard({ ...base, pmsJobs: [job], pmsDeferrals: [fr] });
ok(!!b.attention.find((n) => n.key === 'pms:refused:f1' && n.who === 'master' && n.sub === 'Class item — do it in Palma'), 'refused deferral: notice to the Master with the reason');
b = buildBoard({ ...base, pmsJobs: [job], pmsDeferrals: [fr, f2] });
ok(!b.attention.find((n) => n.key.startsWith('pms:refused')) && b.attention.find((n) => n.key === 'office:await')?.title.includes('1') === true, 'deferred again: no refusal notice, one awaiting the office');
b = buildBoard({ ...base, on: (m: string) => m === 'pms', pmsDefects: [r] });
ok(!b.attention.find((n) => n.key.startsWith('pms:returned')), 'flag off: no office notices');

console.log(fail ? `\n${fail} failed` : '\nAll passed');
process.exit(fail ? 1 : 0);
