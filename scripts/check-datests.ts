// npm run check:datests — drug and alcohol tests: a person's outcome, what stops signing, the mask the cloud gets, when the unannounced test is due, the draw, the Board, the paper, the rules.
import { actionsAwaited, daResultFromCloud, daResultToCloud, daTestReport, drawRandom, labsAwaited, needsAction, nextUnannounced, outcome, parseReading, policyOf, resultProblem, testOutcome, testProblem, wantsConfirm } from '../services/daTests';
import { buildBoard } from '../services/board';
import { DA_DEFAULT_POLICY } from '../types/daTest';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-11-03';
const test = (o: any = {}): any => ({ id: 't1', no: 'DA-2026-001', date: '2026-10-01', reason: 'unannounced', alcohol: true, drugs: true, limit: 0.25, tester: 'Master', count: 1, by: 'Anna', at: 1, updatedAt: 1, ...o });
const res = (o: any = {}): any => ({ id: 'r1', testId: 't1', crewId: 'c1', name: 'Jez Dodd', rank: 'AB', alcohol: 0, drugs: 'neg', at: 1, updatedAt: 1, ...o });
const lab = (o: any = {}): any => ({ id: 'f1', testId: 't1', resultId: 'r1', kind: 'lab', lab: 'neg', by: 'Anna', at: 2, updatedAt: 2, ...o });

// Outcome.
ok(outcome(res(), 0.25, []) === 'negative', 'zero and a negative screen: negative');
ok(outcome(res({ alcohol: 0.25 }), 0.25, []) === 'negative', 'at the limit is not above it');
ok(outcome(res({ alcohol: 0.3 }), 0.25, []) === 'positive', 'above the limit: positive');
ok(outcome(res({ alcohol: 0.3, confirm: 0.2 }), 0.25, []) === 'negative', 'the confirming reading is the one that counts');
ok(outcome(res({ alcohol: 0.1, confirm: 0.3 }), 0.25, []) === 'positive', '…both ways');
ok(outcome(res({ drugs: 'nonNeg' }), 0.25, []) === 'pending', 'a non-negative screen waits for the laboratory');
ok(outcome(res({ drugs: 'nonNeg' }), 0.25, [lab()]) === 'negative', 'the laboratory clears it');
ok(outcome(res({ drugs: 'nonNeg' }), 0.25, [lab({ lab: 'pos' })]) === 'positive', 'the laboratory confirms it');
ok(outcome(res({ drugs: 'neg' }), 0.25, [lab({ lab: 'pos' })]) === 'negative', 'a laboratory answer on a negative screen is not read');
ok(outcome(res({ refused: 'Would not', alcohol: undefined }), 0.25, []) === 'refused', 'a refusal is a refusal');
ok(testOutcome(test(), [res(), res({ id: 'r2', drugs: 'nonNeg' })], []) === 'pending', 'the test reads its worst result');
ok(testOutcome(test(), [res({ id: 'x', testId: 'other', alcohol: 1 })], []) === 'negative', '…only its own');

// What stops signing.
ok(resultProblem(test(), res({ alcohol: undefined })) === 'alcohol', 'an alcohol test needs a reading');
ok(resultProblem(test(), res({ alcohol: NaN })) === 'alcohol', '…a number');
ok(resultProblem(test(), res({ drugs: undefined })) === 'drugs', 'a drug test needs the screen');
ok(resultProblem(test({ drugs: false }), res({ drugs: undefined })) === null, 'not when drugs were not tested');
ok(resultProblem(test(), res({ refused: 'no', alcohol: undefined, drugs: undefined })) === 'refused', 'a refusal needs its reason');
ok(resultProblem(test(), res({ refused: 'Said he was ill', alcohol: undefined, drugs: undefined })) === null, 'a refusal needs no readings');
ok(testProblem(test({ alcohol: false, drugs: false }), [res()]) === 'kind', 'alcohol, drugs or both');
ok(testProblem(test({ tester: ' ' }), [res()]) === 'tester', 'who carried it out');
ok(testProblem(test(), []) === 'people', 'somebody was tested');
ok(testProblem(test(), [res()]) === null, 'complete');
ok(wantsConfirm(res({ alcohol: 0.3 }), 0.25) && !wantsConfirm(res({ alcohol: 0.3, confirm: 0.3 }), 0.25) && !wantsConfirm(res({ alcohol: 0.1 }), 0.25), 'a second reading is asked only above the limit, once');
ok(parseReading('0,12') === 0.12 && parseReading(' ') === undefined && Number.isNaN(parseReading('abc')!), 'readings with a comma, empty, not a number');

// The cloud.
const up = daResultToCloud(res());
ok(up.name === 'J…d' && !('crewId' in up) && up.alcohol === 0, 'up: the name masked, no crew id, the result kept');
ok(daResultToCloud(up).name === 'J…d', 'masking twice changes nothing');
const back = daResultFromCloud(res(), up);
ok(back.name === 'Jez Dodd' && back.crewId === 'c1', 'down on the device it was recorded on: the name and crew id back');
ok(daResultFromCloud(undefined, up).name === 'J…d' && !daResultFromCloud(undefined, up).crewId, 'on another device: masked, no crew id');
ok(daResultFromCloud(res({ name: 'Max Payne' }), up).name === 'J…d', 'a different local name is not put on it');
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/da_results\/\{id\}[\s\S]*?!\('crewId' in request\.resource\.data\)/.test(rules), 'rules: no crew id on a result');
ok(/match \/da_followups\/\{id\}[\s\S]*?!\('name' in request\.resource\.data\)/.test(rules), 'rules: no name on a follow-up');
ok(/match \/da_policy\/\{id\}[\s\S]*?isSuper\(v\)/.test(rules), 'rules: the policy is the Master\'s');

// When.
ok(policyOf([]).months === 12 && policyOf([]).limit === 0.25, 'default policy: a year, 0.25 mg/l (STCW)');
ok(nextUnannounced([], DA_DEFAULT_POLICY, T).state === 'never', 'none on record');
ok(nextUnannounced([test({ reason: 'postIncident' })], DA_DEFAULT_POLICY, T).state === 'never', 'a test after an incident is not the unannounced one');
const d1 = nextUnannounced([test({ date: '2026-01-15' })], DA_DEFAULT_POLICY, T);
ok(d1.due === '2027-01-15' && d1.state === 'ok', 'a year after the last');
ok(nextUnannounced([test({ date: '2025-11-20' })], DA_DEFAULT_POLICY, T).state === 'soon', 'asked 30 days ahead');
ok(nextUnannounced([test({ date: '2025-10-01' })], DA_DEFAULT_POLICY, T).state === 'overdue', 'overdue after the date');
ok(nextUnannounced([test({ date: '2026-03-01', reason: 'random' })], { ...DA_DEFAULT_POLICY, months: 6 }, T).state === 'overdue', 'a random draw counts; six months is the policy\'s choice');
ok(nextUnannounced([test({ date: '2025-08-31' })], { ...DA_DEFAULT_POLICY, months: 6 }, '2026-02-27').due === '2026-02-28', 'month end clamps');

// Waiting.
const tests = [test()];
ok(labsAwaited(tests, [res({ drugs: 'nonNeg' })], []).length === 1 && labsAwaited(tests, [res({ drugs: 'nonNeg' })], [lab()]).length === 0, 'the laboratory awaited until its result');
ok(needsAction(res({ alcohol: 0.5 }), 0.25, []) && !needsAction(res({ alcohol: 0.5 }), 0.25, [lab({ id: 'a', kind: 'action', note: 'Relieved' })]), 'a positive waits for the action taken');
ok(actionsAwaited(tests, [res({ refused: 'No', alcohol: undefined })], []).length === 1, 'so does a refusal');
ok(actionsAwaited(tests, [res()], []).length === 0, 'a negative needs nothing');

// The draw.
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const drawn = drawRandom(['a', 'b', 'c', 'd', 'e'], 3, rnd);
ok(drawn.length === 3 && new Set(drawn).size === 3, 'three drawn, no one twice');
ok(drawRandom(['a', 'b'], 5).length === 2 && drawRandom(['a'], 0).length === 0, 'never more than there are, nothing for 0');

// The Board.
const base: any = {
  on: (k: string) => ['daTests', 'crewCerts'].includes(k), role: 'superadmin', me: null, today: T, now: `${T}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const notes = (x: any) => buildBoard({ ...base, ...x }).attention.filter((n: any) => n.key.startsWith('da:'));
ok(notes({}).some((n: any) => n.key === 'da:due'), 'Board: no unannounced test on record');
ok(notes({ daTests: [test({ date: '2026-09-01' })] }).every((n: any) => n.key !== 'da:due'), 'Board: quiet when in date');
const b = notes({ daTests: tests, daResults: [res({ alcohol: 0.6, drugs: 'nonNeg' }), res({ id: 'r2', drugs: 'nonNeg', alcohol: 0 })], daFollowUps: [] });
ok(b.some((n: any) => n.key === 'da:act' && n.level === 'red' && n.who === 'master') && b.some((n: any) => n.key === 'da:lab'), 'Board: positive with no action red for the Master, the laboratory awaited');
ok(!JSON.stringify(b).includes('Jez'), 'Board: no names');
ok(notes({ role: 'user' }).length === 0, 'Board: nothing on a crew device');
ok(notes({ on: (m: string) => m === 'crewCerts' }).length === 0, 'Board: nothing with the flag off');

// The paper.
const paper = daTestReport(test(), [res({ alcohol: 0.3, confirm: 0.28 }), res({ id: 'r2', name: 'Ann Lee', drugs: 'nonNeg', sample: 'S-77' })], [lab({ resultId: 'r2', lab: 'pos', ref: 'L-1' }), lab({ id: 'a1', kind: 'action', note: 'Relieved of duty', lab: undefined })]);
const txt = JSON.stringify(paper);
ok(paper.title === 'Drug and alcohol test DA-2026-001' && txt.includes('0.30 / confirm 0.28') && txt.includes('POSITIVE'), 'paper: readings and the result');
ok(txt.includes('sample S-77') && txt.includes('Positive (L-1)') && txt.includes('Relieved of duty'), 'paper: the sample, the laboratory, the action');
ok(paper.tables[0].rows[0][0].startsWith('Ann Lee'), 'paper: people in order of name');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
