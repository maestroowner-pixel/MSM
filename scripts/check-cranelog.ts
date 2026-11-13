// npm run check:cranelog — the crane operator's log: entry rules, voiding, totals per crane, the statement.
import { craneSnap, entryProblem, hoursOf, operatorTotals, operators, standing, statementPages } from '../services/craneLog';
import { CraneEntry } from '../types/craneLog';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = '2026-11-13';

const k1 = { type: 'Knuckle-boom crane', make: 'Palfinger', no: 1, position: 'Aft deck', swl: '12 t' };
const snap = craneSnap(k1);
ok(snap.label === 'Knuckle-boom crane · No. 1 · Aft deck' && snap.make === 'Palfinger' && snap.swl === '12 t', `snapshot: ${snap.label}`);
ok(craneSnap({}).label === 'Crane' && craneSnap({}).swl === undefined, 'bare crane → "Crane", no SWL invented');

ok(hoursOf('2,5') === 2.5 && hoursOf('2.3') === 2.5 && hoursOf('0') === undefined && hoursOf('x') === undefined, 'hours: comma, half-hour rounding, nonsense refused');

const base = { hours: 2, ops: ['cargo' as const], crewId: 'c1', date: today };
ok(entryProblem(base, today) === null, 'a full entry passes');
ok(entryProblem({ ...base, crewId: '' }, today) === 'operator', 'no operator');
ok(entryProblem({ ...base, hours: 0 }, today) === 'hours', 'no hours');
ok(entryProblem({ ...base, hours: 25 }, today) === 'tooMany', 'more than a day');
ok(entryProblem({ ...base, date: '2026-11-14' }, today) === 'future', 'future date');
ok(entryProblem({ ...base, ops: [] }, today) === 'ops', 'no kind of work');
ok(entryProblem({ ...base, lifts: 2.5 }, today) === 'lifts', 'lifts whole');

let n = 0;
const e = (o: Partial<CraneEntry>): CraneEntry => ({ id: `e${++n}`, itemId: 'k1', crane: snap, crewId: 'c1', name: 'Max Lee', rank: 'AB', date: '2026-10-01', hours: 2, ops: ['cargo'], by: 'C/O', at: n, createdAt: n, updatedAt: n, ...o });
const all = [
  e({ date: '2026-10-01', hours: 2, lifts: 10 }),
  e({ date: '2026-10-02', hours: 3.5, lifts: 12, ops: ['offshore'] }),
  e({ date: '2026-10-02', hours: 1, ops: ['personnel'] }), // lifts not counted
  e({ itemId: 'a1', crane: { label: 'A-frame', swl: '25 t' }, date: '2026-10-05', hours: 4, lifts: 3, ops: ['subsea'] }),
  e({ crewId: 'c2', name: 'Ann Roe', hours: 6 }),
  e({ date: '2026-10-03', hours: 9, lifts: 50 }), // a mistake…
];
all.push(e({ ...all[5], id: 'v1', voids: all[5].id })); // …voided
ok(standing(all).length === 5, 'voided entry and the void itself are out');
const tot = operatorTotals(all, 'c1');
const k = tot.find((x) => x.itemId === 'k1')!;
ok(tot.length === 2 && tot[0].itemId === 'k1', 'two cranes, most hours first');
ok(k.hours === 6.5 && k.lifts === 22 && k.uncounted === 1 && k.days === 2 && k.first === '2026-10-01' && k.last === '2026-10-02', `crane 1: ${k.hours} h, ${k.lifts}+ lifts, ${k.days} days`);
ok(k.ops.join() === 'cargo,offshore,personnel', 'kinds of work in the fixed order');
ok(operatorTotals(all, 'c1', '2026-10-02', '2026-10-04').find((x) => x.itemId === 'k1')!.hours === 4.5, 'period bounds');
const ops = operators(all);
ok(ops.length === 2 && ops[0].crewId === 'c1' && ops[0].hours === 10.5, 'operators by hours');

const page = statementPages(all, 'c1', { name: 'Max Lee', rank: 'AB', vesselName: 'MY TEST', imo: '1234567', from: '2026-01-01', to: today, today, signatory: { name: 'J. Smith' } })[0];
const cr = page.tables[0];
ok(cr.rows.length === 2 && cr.rows[0][3] === '12 t' && cr.rows[0][1] === 'Palfinger' && cr.rows[0][5] === '22+', 'statement: make, SWL, "22+" lifts when some uncounted');
ok(page.facts.some((f) => f.includes('10.5 hours') && f.includes('3 days')), 'statement: total hours and days');
ok(page.tables[2].rows.length === 4 && !page.tables[2].rows.some((r) => r[3] === '9'), 'entries listed, the voided one not');
ok(page.facts.some((f) => f.includes('between 01.10.2026 and 05.10.2026')), 'statement names the days worked, not the period asked');
ok(page.tables[1].rows[0][0] === 'Master' && page.tables[1].rows[0][1] === 'J. Smith', 'Master signs');

// ---- load tests
import { applyTest, testProblem, testsDue } from '../services/craneLog';
const crane: any = { id: 'k1', category: 'cranes', type: 'Knuckle-boom crane', swl: '12 t', nextInspection: '2026-11-01', testCertNo: 'OLD', updatedAt: 0 };
const T = (o: any): any => ({ id: `t${++n}`, itemId: 'k1', crane: snap, kind: 'annual', date: '2026-11-10', result: 'pass', by: 'C/O', at: n, createdAt: n, updatedAt: n, ...o });
ok(testProblem(T({}), today) === null, 'a test passes');
ok(testProblem(T({ itemId: '' }), today) === 'crane' && testProblem(T({ date: '2026-12-01' }), today) === 'future', 'no crane / future refused');
ok(testProblem(T({ pctSwl: 0 }), today) === 'pct' && testProblem(T({ nextDue: '2026-11-10' }), today) === 'due', 'bad % SWL / next due not after the test');
let it = applyTest(crane, T({ nextDue: '2027-11-10', certNo: 'LT-26' }), 5)!;
ok(it.nextInspection === '2027-11-10' && it.testCertNo === 'LT-26', 'pass: overdue date discharged, certificate written');
it = applyTest({ ...crane, nextInspection: '2027-03-01' }, T({ kind: 'fiveYear', nextDue: '2031-11-10' }), 5)!;
ok(it === null || it.nextInspection === '2027-03-01', 'a 5-yearly test never pushes a later due date out');
ok(applyTest({ ...crane, nextInspection: '2027-03-01' }, T({ nextDue: '2027-01-01' }), 5)!.nextInspection === '2027-01-01', 'an earlier next due wins');
ok(applyTest(crane, T({ result: 'fail', nextDue: '2027-11-10', certNo: 'X' }), 5) === null, 'a failed test changes nothing');
const tests = [T({ date: '2025-11-01', nextDue: '2026-11-01' }), T({ kind: 'brake', date: '2026-10-01', result: 'fail' }), T({ kind: 'fiveYear', date: '2024-01-01', nextDue: '2029-01-01' })];
const due = testsDue(tests, 'k1', today);
ok(due[0].level === 'red' && due.find((d) => d.kind === 'annual')!.level === 'red' && due.find((d) => d.kind === 'brake')!.level === 'red' && due.find((d) => d.kind === 'fiveYear')!.level === 'ok', 'tests due: overdue annual and failed brake red, 5-yearly fine');
const withTest = statementPages(all, 'c1', { name: 'Max Lee', from: '2026-01-01', to: today, today }, [T({ crewId: 'c1', name: 'Max Lee', date: '2026-10-07', testLoad: '15 t', pctSwl: 125 })])[0];
ok(withTest.tables[1].title === 'Load tests operated' && withTest.tables[1].rows[0][4] === '15 t, 125% SWL', 'statement lists the load test the operator worked');
ok(withTest.facts.some((f) => f.includes('between 01.10.2026 and 07.10.2026')), 'the test date counts as a day worked in the text');
ok(operators([], [T({ crewId: 'c9', name: 'Only Tests' })]).some((o) => o.crewId === 'c9'), 'an operator with only a test is listed');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
