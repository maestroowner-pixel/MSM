// npm run check:appraisals — crew appraisals: the stage from the steps, who signs next, when each person is due (contract end, the year), the average, the Board, the rules.
import { addYear, apCounts, apEditable, apFinal, apStage, appraisalDue, appraisalReport, average, criteriaFor, dueList, isMasterRank, nextSteps, periodStart, signProblem, sortAppraisals, withStep, AP_NEEDS_NOTE, formFromText, formText, formProblem, activeForm, itemsFor, formOf, STANDARD_FORM, apFormFromReply, roleFacts, roleItems, roleFactText, isRoleItem } from '../services/appraisals';
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

// The company's own form (13 Nov 2026).
let n = 0;
const nid = () => `n${++n}`;
const src = 'Scale: Poor | Fair | Good | Excellent\n## Seamanship\n- Knowledge of duties\nLeadership *officers\n## Conduct\nPunctuality\n@text Training recommended\n\n';
const f1 = formFromText(src, [], nid);
ok(f1.scale?.join('|') === 'Poor|Fair|Good|Excellent' && f1.items.map((i) => `${i.kind ?? 'c'}:${i.text}${i.officers ? '*' : ''}`).join(',') === 'section:Seamanship,c:Knowledge of duties,c:Leadership*,section:Conduct,c:Punctuality,text:Training recommended', 'editor wording → scale, sections, criteria, officers only, a written question');
ok(formText({ scale: f1.scale!, items: f1.items }) === 'Scale: Poor | Fair | Good | Excellent\n## Seamanship\nKnowledge of duties\nLeadership *officers\n## Conduct\nPunctuality\n@text Training recommended', 'and back');
const f2 = formFromText(src.replace('Punctuality', 'Punctuality and attendance').replace('knowledge', 'x'), f1.items, nid);
ok(f2.items[1].id === f1.items[1].id && f2.items[4].id !== f1.items[4].id && f2.items[5].id === f1.items[5].id, 'a line that keeps its text keeps its id; a reworded one is new');
ok(formFromText('Scale: 1, 2, 3\nA', [], nid).scale?.join('|') === '1|2|3', 'scale with commas');
const form: any = { id: 'form', title: 'CR-07', scale: f1.scale, items: f1.items, updatedAt: 1 };
ok(formProblem(form) === null && formProblem({ ...form, scale: ['Ok'] }) === 'scale' && formProblem({ ...form, items: f1.items.filter((i) => i.kind) }) === 'criteria' && formProblem({ ...form, title: ' ' }) === 'title', 'a form needs a title, a scale of 2–10 and a criterion');
ok(activeForm([form])?.title === 'CR-07' && !activeForm([{ ...form, off: true }]) && !activeForm([]) && activeForm([form])!.items !== form.items, 'a new appraisal takes a copy of the company form; switched off or none = standard');
const ca = A({ form: activeForm([form]), scores: [{ id: f1.items[1].id, score: 4 }] });
ok(itemsFor('AB', ca).map((i) => i.text).join(',') === 'Seamanship,Knowledge of duties,Conduct,Punctuality,Training recommended' && itemsFor('Chief Officer', ca).length === 6, 'a rating is not asked the officers-only line');
ok(itemsFor('AB', A({ form: { title: 'x', scale: ['a', 'b'], items: [{ id: 's', text: 'Lead', kind: 'section' }, { id: 'l', text: 'L', officers: true }, { id: 'o', text: 'Other', kind: 'section' }, { id: 'p', text: 'P' }] } })).map((i) => i.id).join() === 'o,p', 'a heading with nothing under it for this rank drops out');
ok(signProblem(ca) === null && signProblem({ ...ca, scores: [{ id: f1.items[1].id, score: 5 }] }) === 'scores', 'a score above the company scale is refused');
ok(formOf(A()) === STANDARD_FORM && STANDARD_FORM.scale.length === 5 && STANDARD_FORM.items.length === 9, 'no form = the standard nine criteria, 1–5');
const rep = appraisalReport({ ...ca, answers: { [f1.items[5].id]: 'BRM course' } });
ok(rep.title.startsWith('CR-07 — Jez Dodd') && rep.facts.some((x) => x.includes('of 4')) && rep.tables[0].title === 'Seamanship (1 Poor — 4 Excellent)' && rep.tables[0].rows[0][1] === '4 — Excellent' && rep.tables[1].title.startsWith('Conduct') && rep.tables[2].title === 'Questions' && rep.tables[2].rows[0][1] === 'BRM course', 'the paper: one table per section on the company scale, the questions answered');
ok(appraisalReport(A()).tables[0].title === 'Assessment (1 Unsatisfactory — 5 Excellent)', 'the standard paper as before');
const rr = apFormFromReply({ title: ' CR-07 ', scale: ['Poor', 'Good|ish', 'Excellent'], lines: ['## Seamanship', 'Knowledge', 'Scale: x', 42, ''], unreadable: '' });
ok(rr.title === 'CR-07' && rr.text === 'Scale: Poor | Good ish | Excellent\n## Seamanship\nKnowledge\n42' && rr.lines === 3, 'the AI reading → the editor: the scale line first, no stray scale, nothing empty');

// Criteria by position (13 Nov 2026): the crane operator's hours, the DPO's DP time.
const CE = (o: any): any => ({ id: o.id, itemId: 'k1', crane: { label: 'Crane No. 1', make: 'Palfinger', swl: '12 t' }, crewId: 'c1', name: 'Jez Dodd', date: '2026-06-10', hours: 4, ops: ['cargo'], by: 'CO', at: 1, createdAt: 1, updatedAt: 1, ...o });
const log = [CE({ id: 'e1', lifts: 10 }), CE({ id: 'e2', date: '2026-06-11', hours: 2.5 }), CE({ id: 'e3', date: '2026-06-12', hours: 8 }), CE({ id: 'e4', date: '2026-06-12', hours: 1, voids: 'e3' }), CE({ id: 'e5', date: '2026-12-01', hours: 9 }), CE({ id: 'e6', crewId: 'c2', hours: 7 })];
const tests: any[] = [{ id: 't1', itemId: 'k1', crewId: 'c1', date: '2026-07-01' }, { id: 't2', itemId: 'k1', crewId: 'c1', date: '2027-01-01' }];
const slots = (active: number) => Array(48).fill(0).map((_, i) => (i < active * 2 ? 1 : 0));
const days: any[] = [{ id: 'c1_2026-06-01', crewId: 'c1', name: 'Jez Dodd', date: '2026-06-01', slots: slots(6), updatedAt: 1 }, { id: 'c1_2026-06-02', crewId: 'c1', name: 'Jez Dodd', date: '2026-06-02', slots: slots(1), updatedAt: 1 }, { id: 'c1_2025-01-01', crewId: 'c1', name: 'Jez Dodd', date: '2025-01-01', slots: slots(8), updatedAt: 1 }];
const P = { crewId: 'c1', rank: 'AB', from: '2026-05-01', to: '2026-11-01' };
const rf = roleFacts(P, { craneLog: log, craneTests: tests, dpDays: days });
const cr = rf.find((r) => r.role === 'crane')!;
ok(cr && cr.hours === 6.5 && cr.days === 2 && cr.lifts === 10 && cr.uncounted === 1 && cr.tests === 1 && cr.cranes?.[0] === 'Crane No. 1 (Palfinger, SWL 12 t)', 'crane: hours, days and lifts of the period only, voided entries out, another person out, the load test counted');
const dq = rf.find((r) => r.role === 'dp')!;
ok(dq && dq.hours === 7 && dq.days === 1, 'DP: Active hours of the period, a DP day is 2 h or more');
ok(roleFacts({ ...P, crewId: 'c9' }, { craneLog: log, craneTests: tests, dpDays: days }).length === 0, 'nobody in the books, a plain rank: no role');
const byRank = roleFacts({ ...P, crewId: 'c9', rank: 'SDPO' }, { craneLog: log, dpDays: days });
ok(byRank.length === 1 && byRank[0].role === 'dp' && byRank[0].hours === 0 && roleFacts({ ...P, crewId: 'c9', rank: 'Crane operator' }, {})[0]?.role === 'crane', 'the rank alone asks the role, with the books at 0');
ok(roleItems(rf).map((i) => i.id).join() === 'crane,craneSafe,craneSignals,craneChecks,dp,dpWatch,dpAsog,dpRecords' && isRoleItem('dpAsog') && isRoleItem('crane') && !isRoleItem('safety'), 'a section per role, crane first');
const ra = A({ roles: rf, scores: [{ id: 'safety', score: 4 }, { id: 'craneSafe', score: 5 }] });
ok(itemsFor('AB', ra).slice(-8)[0].id === 'crane' && itemsFor('AB', ra).length === 8 + 8 && itemsFor('AB', A({ form: activeForm([form]), roles: [dq] })).slice(-4).map((i) => i.id).join() === 'dp,dpWatch,dpAsog,dpRecords', 'role sections follow the standard and the company form');
const rp = appraisalReport(ra);
ok(rp.facts.some((x) => x.startsWith("Crane operator's log in the period: 6.5 h at the controls, 2 days, 10+ lifts, 1 load test — Crane No. 1")) && rp.facts.some((x) => x === 'DP time in the period (DP log): 7 h Active, 1 DP day') && rp.tables.some((t) => t.title.startsWith('Crane operation') && t.rows[0][1] === '5 — Excellent'), 'the paper: the figures and a table per role');
ok(roleFactText({ role: 'crane', hours: 3, days: 1, lifts: 0, uncounted: 0 }) === "Crane operator's log in the period: 3 h at the controls, 1 day", 'no lifts counted, none printed');
ok(average(ra) === 4.5, 'role scores count in the average');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
