// npm run check:moc — management of change: numbers, the stage from the steps, who goes next, approval and closure, the office queue, the Board.
import { actionsDone, approveProblem, docsNotRevised, mocEditable, mocFinal, mocRa, mocStage, mocsToAnswer, nextMocNo, nextSteps, readyToClose, returnedBy, sortMocs, tempState, withStep, MOC_MASTER_STEPS, MOC_NEEDS_NOTE, MOC_OFFICE_STEPS, MOC_OFFICER_STEPS } from '../services/moc';
import { buildBoard } from '../services/board';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-11-03';
const M = (o: any = {}): any => ({ id: 'm1', no: 'MOC-2026-01', kind: 'equipment', title: 'New bilge sensor', what: 'Float switch → radar sensor', why: 'False alarms', needsOffice: false, actions: [{ id: 'a1', text: 'Fit it', owner: '2/E', due: '2026-11-10' }], steps: [], raisedBy: '2/E', at: 1, updatedAt: 1, ...o });
const officer = { name: 'Liam', rank: '2/E' };
const master = { name: 'Anna', rank: 'Master' };
const office = { name: 'Supt', rank: 'Office' };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

ok(nextMocNo([], T) === 'MOC-2026-01', 'first of the year');
ok(nextMocNo([M({ no: 'MOC-2026-07' }), M({ no: 'MOC-2025-12' })], T) === 'MOC-2026-08', 'next after the highest of the year');

// The way without the office.
let m = M();
ok(mocStage(m) === 'draft' && mocEditable(m) && !mocFinal(m), 'new: draft, editable');
m = withStep(m, 'submit', officer, 2);
ok(mocStage(m) === 'master' && mocEditable(m), 'submitted: with the Master, still editable');
ok(throws(() => withStep(m, 'masterReturn', master, 3)), 'a return needs its reason');
ok(throws(() => withStep(m, 'office', office, 3)), 'the office cannot answer before the Master');
const back = withStep(m, 'masterReturn', master, 3, 'Add the class approval');
ok(mocStage(back) === 'returned' && returnedBy(back)?.note === 'Add the class approval', 'returned with the reason');
ok(nextSteps('returned').includes('submit'), '…and submitted again');
m = withStep(m, 'master', master, 3);
ok(mocStage(m) === 'approved' && !mocEditable(m), 'no office: the Master\'s approval is final, the change is fixed');
ok(!readyToClose(m), 'not ready while an action is open');
ok(throws(() => withStep(m, 'close', master, 4)), 'closing needs a word on whether it worked');
m = { ...m, actions: m.actions.map((a: any) => ({ ...a, doneAt: 4, doneBy: 'Liam' })) };
ok(actionsDone(m) && readyToClose(m), 'every action done: ready to close');
m = withStep(m, 'close', master, 5, 'No false alarms in a week');
ok(mocStage(m) === 'closed' && mocFinal(m) && nextSteps(mocStage(m)).length === 0, 'closed: final');

// Through the office.
let o = withStep(withStep(M({ needsOffice: true }), 'submit', officer, 2), 'master', master, 3);
ok(mocStage(o) === 'office', 'office in the loop: the Master\'s approval sends it to the office');
ok(throws(() => withStep(o, 'close', master, 4)), 'not closed before the office approved');
const ret = withStep(o, 'officeReturn', office, 4, 'Which sensor model?');
ok(mocStage(ret) === 'returned' && mocEditable(ret) && returnedBy(ret)?.kind === 'officeReturn', 'the office returns it: editable aboard again');
const rej = withStep(o, 'reject', office, 4, 'Not class approved');
ok(mocStage(rej) === 'rejected' && mocFinal(rej), 'rejected: final');
o = withStep(o, 'office', office, 4);
ok(mocStage(o) === 'approved', 'the office approves');
const can = withStep(M(), 'cancel', officer, 2, 'Not needed after all');
ok(mocStage(can) === 'cancelled' && mocFinal(can), 'cancelled before approval: final');
ok(throws(() => withStep(o, 'cancel', officer, 5, 'Too late')), 'an approved change is not cancelled — it is closed');

// The office's queue.
const q1 = withStep(withStep(M({ id: 'q1', needsOffice: true }), 'submit', officer, 2), 'master', master, 30);
const q2 = withStep(M({ id: 'q2', needsOffice: true }), 'master', master, 10);
ok(mocsToAnswer([q1, q2, o, M()]).map((x) => x.id).join() === 'q2,q1', 'office queue: only what waits for it, oldest first');

// What an approval needs.
const ra: any = { id: 'ra1', title: 'RA', hazards: [], generic: false, mocId: 'm1', createdAt: 5, updatedAt: 5, approved: { by: 'Anna', at: 6 } };
ok(approveProblem(M({ what: ' ' }), [], true) === 'what' && approveProblem(M({ why: '' }), [], true) === 'why', 'the change and why first');
ok(approveProblem(M(), [], true) === 'ra', 'an approved risk assessment');
ok(approveProblem(M(), [{ ...ra, approved: undefined }], true) === 'ra', '…approved, not a draft');
ok(approveProblem(M(), [{ ...ra, generic: true }], true) === 'ra', '…made for it, not the library one');
ok(approveProblem(M({ actions: [] }), [ra], true) === 'actions', 'at least one action to carry it out');
ok(approveProblem(M(), [ra], true) === null && approveProblem(M(), [], false) === null, 'all there — or risk assessments switched off');
ok(mocRa(M({ raId: 'ra9' }), [{ ...ra, id: 'ra9', mocId: undefined }])?.id === 'ra9', 'an approved assessment linked by id counts');

// Documents.
const docs: any[] = [{ id: 'd1', title: 'Bilge procedure', revision: 3 }, { id: 'd2', title: 'Alarm list', revision: 5 }, { id: 'd3', title: 'Gone', revision: 1, deleted: true }];
const withDocs = M({ docs: [{ id: 'd1', title: 'Bilge procedure', rev: 3 }, { id: 'd2', title: 'Alarm list', rev: 4 }, { id: 'd3', title: 'Gone', rev: 1 }] });
ok(docsNotRevised(withDocs, docs).map((d) => d.id).join() === 'd1', 'documents still at the revision they were named at');

// A temporary change.
const temp = (until: string) => withStep(M({ until }), 'master', master, 2);
ok(tempState(temp('2026-11-02'), T) === 'over' && tempState(temp('2026-11-08'), T) === 'soon' && tempState(temp('2026-12-01'), T) === null, 'temporary: over, ending within a week, else nothing');
ok(tempState(M({ until: '2026-11-01' }), T) === null, '…only once it is in force');

ok(sortMocs([m, o, back, M({ id: 'd' })], T).map((x) => mocStage(x)).join() === 'returned,draft,approved,closed', 'list: returned first, finished last');

// The Board.
const base: any = {
  on: (k: string) => ['moc', 'qhse'].includes(k), role: 'superadmin', me: null, today: T, now: `${T}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const key = (b: any, k: string) => b.attention.find((n: any) => n.key === k);
let b = buildBoard({ ...base, mocs: [withStep(M(), 'submit', officer, 2)] });
ok(key(b, 'moc:m1')?.who === 'master' && key(b, 'moc:m1')?.level === 'amber', 'submitted: amber for the Master');
b = buildBoard({ ...base, mocs: [back] });
ok(key(b, 'moc:m1')?.who === 'officer' && /Add the class approval/.test(key(b, 'moc:m1')?.sub ?? ''), 'returned: the officer, with the reason');
b = buildBoard({ ...base, mocs: [withStep(M({ actions: [{ id: 'a1', text: 'x', owner: 'y', due: '2026-11-01' }] }), 'master', master, 2)] });
ok(key(b, 'moc:m1')?.level === 'red', 'an action overdue: red');
b = buildBoard({ ...base, mocs: [{ ...temp('2026-11-01') }] });
ok(key(b, 'moc:m1:temp')?.level === 'red' && key(b, 'moc:m1:temp')?.who === 'master', 'a temporary change past its end: red for the Master');
b = buildBoard({ ...base, mocs: [withStep({ ...M(), actions: [{ id: 'a1', text: 'x', owner: 'y', due: T, doneAt: 1 }] }, 'master', master, 2)] });
ok(key(b, 'moc:m1')?.title.includes('MOC-2026-01'), 'ready: the Master is asked to close it');
b = buildBoard({ ...base, mocs: [m] });
ok(!b.attention.some((n: any) => n.key.startsWith('moc:')) && !b.tiles.some((t: any) => t.key === 'moc'), 'closed: nothing on the Board');
b = buildBoard({ ...base, on: (k: string) => k === 'qhse', mocs: [back] });
ok(!b.attention.some((n: any) => n.key.startsWith('moc:')), 'module off: nothing');

// The rules know the same steps.
const rules = readFileSync('firestore.rules', 'utf8');
const block = rules.slice(rules.indexOf('function mocStepAdded'), rules.indexOf('match /mocs/'));
const update = rules.slice(rules.indexOf('match /mocs/'), rules.indexOf('match /mocs/') + 1500);
const listIn = (s: string, re: RegExp) => (re.exec(s)?.[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort().join();
ok(listIn(block, /kind in \[([^\]]+)\]\)\s*\n\s*\|\| n\[o\.size\(\)\]\.get\('note'/) === [...MOC_NEEDS_NOTE].sort().join(), 'rules: the same steps need a reason');
ok(listIn(update, /mocStepAdded\((\[[^\]]+\])\)\)\n\s*\|\| \(isSuper/) === '' || listIn(update, /\|\| mocStepAdded\(\[([^\]]+)\]\)/) === [...MOC_OFFICER_STEPS].sort().join(), 'rules: an officer submits and cancels');
ok(listIn(update, /isSuper\(v\) && mocStepAdded\(\[([^\]]+)\]\)/) === MOC_MASTER_STEPS.filter((k) => k !== 'cancel').sort().join(), 'rules: the Master approves, returns, rejects, closes');
ok(listIn(update, /shore\(v\) && onlyChanges\(\['steps', 'updatedAt'\]\) && mocStepAdded\(\[([^\]]+)\]\)/) === [...MOC_OFFICE_STEPS].sort().join(), 'rules: the office approves, returns, rejects');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
