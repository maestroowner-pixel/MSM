// npm run check:officecheck — verified by the office: a defect's stage, verify / return, the Board's order and its notices.
import { awaitsOffice, defectScore, defectStage, giveBack, ncAwaitsOffice, needsPhoto, officeInLoop, rankDefects, verify, verifyNc } from '../services/officeCheck';
import { buildBoard } from '../services/board';
import { PmsDefect } from '../types/pms';
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
b = buildBoard({ ...base, on: (m: string) => m === 'pms', pmsDefects: [r] });
ok(!b.attention.find((n) => n.key.startsWith('pms:returned')), 'flag off: no office notices');

console.log(fail ? `\n${fail} failed` : '\nAll passed');
process.exit(fail ? 1 : 0);
