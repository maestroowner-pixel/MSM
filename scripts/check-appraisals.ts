// npm run check:appraisals — crew appraisals: the stage from the steps, who signs next, when each person is due (contract end, the year), the average, the Board, the rules.
import { addYear, apCounts, apEditable, apFinal, apStage, appraisalDue, appraisalReport, average, criteriaFor, dueList, isMasterRank, nextSteps, periodStart, signProblem, sortAppraisals, withStep, AP_NEEDS_NOTE } from '../services/appraisals';
import { buildBoard } from '../services/board';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-11-03';
const A = (o: any = {}): any => ({ id: 'a1', crewId: 'c1', name: 'Jez Dodd', rank: 'AB', reason: 'contract', from: '2026-05-01', to: '2026-11-01', scores: [{ id: 'safety', score: 4 }, { id: 'quality', score: 3 }], rehire: 'yes', steps: [], by: 'Bosun', at: 1, updatedAt: 1, ...o });
const C = (o: any = {}): any => ({ id: 'c1', name: 'Jez Dodd', rank: 'AB', active: true, onBoard: true, signOn: '2026-05-01', addedAt: Date.parse('2026-05-01'), updatedAt: 1, ...o });
const bosun = { name: 'Tom', rank: 'Bosun' };
const master = { name: 'Anna', rank: 'Master' };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

// The way, through the Master.
let a = A();
ok(apStage(a) === 'draft' && apEditable(a) && !apFinal(a) && !apCounts(a), 'new: draft, editable, not yet counted');
ok(throws(() => withStep(a, 'crew', bosun, 2, { agree: true })), 'the seafarer cannot sign before the appraiser');
a = withStep(a, 'appraiser', bosun, 2);
ok(apStage(a) === 'crew' && !apEditable(a) && apCounts(a), 'appraiser signed: fixed, waits for the seafarer, counted');
ok(throws(() => withStep(a, 'crew', { name: 'Jez Dodd' }, 3)), 'the seafarer must say whether he agrees');
ok(throws(() => withStep(a, 'refused', bosun, 3)), 'a refusal needs its reason');
ok(throws(() => withStep(a, 'master', master, 3)), 'no countersignature before the seafarer');
a = withStep(a, 'crew', { name: 'Jez Dodd', rank: 'AB' }, 3, { agree: false, note: 'Overtime not counted' });
ok(apStage(a) === 'master' && a.steps[1].agree === false && a.steps[1].note === 'Overtime not counted', 'seafarer signed, not agreeing, with his comment: waits for the Master');
ok(!nextSteps('master').includes('cancel'), 'signed by the seafarer, it is no longer cancelled');
a = withStep(a, 'master', master, 4);
ok(apStage(a) === 'done' && apFinal(a) && nextSteps(apStage(a)).length === 0, 'countersigned: final');

// The Master as appraiser.
let m = withStep(A({ id: 'a2' }), 'appraiser', master, 2, { asMaster: true });
m = withStep(m, 'refused', master, 3, { note: 'Would not sign' });
ok(apStage(m) === 'done', 'the Master appraised: the seafarer\'s signature (or refusal) completes it');
const c = withStep(withStep(A({ id: 'a3' }), 'appraiser', bosun, 2), 'cancel', bosun, 3, { note: 'Wrong person' });
ok(apStage(c) === 'cancelled' && !apCounts(c), 'cancelled: final, not counted');

// What the appraiser must give.
ok(signProblem(A({ from: '2026-12-01' })) === 'period', 'the period runs forwards');
ok(signProblem(A({ scores: [] })) === 'scores', 'at least one score');
ok(signProblem(A({ rehire: undefined })) === 'rehire', 're-hire answered');
ok(signProblem(A()) === null, 'complete: may be signed');
ok(average(A()) === 3.5 && average(A({ scores: [{ id: 'x' }] })) === null, 'average of the scores given, N/A left out');
ok(!criteriaFor('AB').some((x) => x.id === 'leadership') && criteriaFor('Chief Officer').some((x) => x.id === 'leadership'), 'leadership asked of officers only');
ok(criteriaFor('AB', A({ scores: [{ id: 'leadership', score: 4 }] })).some((x) => x.id === 'leadership'), '…but a score already given stays');
ok(isMasterRank('Master') && isMasterRank('Captain') && !isMasterRank('Chief Mate') && !isMasterRank('Bosun'), 'the Master is told by the rank');

// When each person is due.
ok(addYear('2025-11-03') === '2026-11-03' && addYear('2024-02-29') === '2025-02-28', 'a year on');
ok(appraisalDue(C({ contractEnd: '2026-12-10' }), [], T) === null, 'contract ends in 37 days: not yet');
ok(appraisalDue(C({ contractEnd: '2026-12-01' }), [], T)?.reason === 'contract' && appraisalDue(C({ contractEnd: '2026-12-01' }), [], T)?.state === 'due', 'contract ends within 30 days: due');
ok(appraisalDue(C({ contractEnd: '2026-11-01' }), [], T)?.state === 'overdue', 'contract ended: overdue');
ok(appraisalDue(C({ contractEnd: '2026-12-01' }), [withStep(A(), 'appraiser', bosun, 2)], T) === null, 'an end-of-contract appraisal signed for this trip clears it');
ok(appraisalDue(C({ contractEnd: '2026-12-01' }), [A()], T)?.reason === 'contract', 'a draft does not');
ok(appraisalDue(C({ contractEnd: '2026-12-01', signOn: '2026-11-02' }), [withStep(A(), 'appraiser', bosun, 2)], T)?.reason === 'contract', 'one from the last trip does not either');
ok(appraisalDue(C({ signOn: '2025-11-20' }), [], T)?.reason === 'annual' && appraisalDue(C({ signOn: '2025-11-20' }), [], T)?.date === '2026-11-20', 'aboard almost a year, none yet: the annual one is due');
ok(appraisalDue(C({ signOn: '2025-10-01' }), [], T)?.state === 'overdue', 'over a year: overdue');
ok(appraisalDue(C({ signOn: '2025-10-01' }), [withStep(A({ reason: 'annual', from: '2025-10-01', to: '2026-10-01' }), 'appraiser', bosun, 2)], T) === null, 'the annual one signed: next year');
ok(appraisalDue(C({ signOn: '2025-11-20', contractEnd: '2026-12-15' }), [], T) === null, 'the contract ends soon after the year: the end-of-contract one is asked instead, later');
ok(appraisalDue(C({ onBoard: false, contractEnd: '2026-11-01' }), [], T) === null, 'ashore: nothing asked');
ok(appraisalDue(C({ rank: 'Master', contractEnd: '2026-11-01' }), [], T) === null, 'the Master is appraised by the office');
const list = dueList([C({ id: 'x', contractEnd: '2026-12-01' }), C({ id: 'y', contractEnd: '2026-11-01' }), C({ id: 'z' })], [], T);
ok(list.map((d) => d.c.id).join() === 'y,x', 'due list: overdue first, then by date');
ok(periodStart(C(), [withStep(A({ to: '2026-08-31' }), 'appraiser', bosun, 2)], T) === '2026-09-01' && periodStart(C(), [], T) === '2026-05-01' && periodStart(undefined, [], T) === '2025-11-03', 'period starts after the last one, else at signing on, else a year back');
ok(sortAppraisals([A({ id: 'd' }), a, withStep(A({ id: 'w' }), 'appraiser', bosun, 2)]).map((x) => x.id).join() === 'w,d,a1', 'list: waiting for a signature first, history last');

// The paper.
const r = appraisalReport(a);
ok(r.title.includes('Jez Dodd (AB)') && r.facts.some((f) => f.includes('3.5 of 5')) && r.tables[1].rows.length === 3 && r.tables[1].rows[1][3].includes('do not agree'), 'paper: who, the average, the three signatures, the disagreement');

// The Board.
const base: any = {
  on: (k: string) => ['appraisals', 'crewCerts'].includes(k), role: 'superadmin', me: null, today: T, now: `${T}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const key = (b: any, k: string) => b.attention.find((n: any) => n.key === k);
let b = buildBoard({ ...base, crew: [C({ contractEnd: '2026-11-01' }), C({ id: 'c2', name: 'Liam', contractEnd: '2026-11-20' })], appraisals: [] });
ok(key(b, 'ap:due')?.level === 'red' && key(b, 'ap:due')?.who === 'officer' && /Jez Dodd/.test(key(b, 'ap:due')?.sub ?? ''), 'one overdue: red for the officers, named');
b = buildBoard({ ...base, crew: [C({ contractEnd: '2026-11-20' })], appraisals: [] });
ok(key(b, 'ap:due')?.level === 'amber' && key(b, 'ap:due')?.route === 'Appraisal', 'one due: amber, opens the new appraisal');
b = buildBoard({ ...base, crew: [C()], appraisals: [withStep(withStep(A(), 'appraiser', bosun, 2), 'crew', { name: 'Jez Dodd' }, 3, { agree: true })] });
ok(key(b, 'ap:master')?.who === 'master', 'to countersign: the Master\'s');
b = buildBoard({ ...base, on: (k: string) => k === 'crewCerts', crew: [C({ contractEnd: '2026-11-01' })], appraisals: [] });
ok(!key(b, 'ap:due'), 'module off: nothing');

// The rules know the same steps.
const rules = readFileSync('firestore.rules', 'utf8');
const block = rules.slice(rules.indexOf('function apNoteOk'), rules.indexOf('match /crew_appraisals/'));
const listIn = (s: string, re: RegExp) => (re.exec(s)?.[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort().join();
ok(listIn(block, /!\(st\.kind in \[([^\]]+)\]\)/) === [...AP_NEEDS_NOTE].sort().join(), 'rules: the same steps need a reason');
ok(/k == 'master' && isSuper\(v\) && !asMaster/.test(block), 'rules: only the Master countersigns, and not his own');
ok(listIn(block, /\(k in \[([^\]]+)\] && p == 'appraiser'\)/) === ['cancel', 'crew', 'refused'].sort().join(), 'rules: after the appraiser — the seafarer, the refusal, a cancellation');
ok(/match \/crew_appraisals\/\{id\} \{\s*\n\s*allow read: if isAdmin\(v\) \|\| shore\(v\);/.test(rules), 'rules: officers and the office read, crew does not');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
