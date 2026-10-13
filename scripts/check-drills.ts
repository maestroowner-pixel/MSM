// npm run check:drills — numbers, the schedule, the scenario clock, report rows, the board.
import { everyLabel, lastOfType, attendanceRows, clockAt, drillSchedule, drillState, minutesBetween, nextDrillNo, nextStepMin, registerRows, scenarioRows, sortDrills } from '../services/drills';
import { drillDoc } from '../services/drills';
import { DRILL_THEORY } from '../constants/drillTheory';
import { DRILL_TYPES } from '../types/drills';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-10-13';
const D = (o: any): any => ({ id: 'd', no: 'DR-2026-001', type: 'fire', topic: 'Fire in the galley', date: '2026-10-01', scenario: [], theory: true, attendance: [], plannedBy: 'Jez', updatedAt: 1, ...o });

ok(nextDrillNo([], T) === 'DR-2026-001', 'first of the year');
ok(nextDrillNo([D({ no: 'DR-2026-009' }), D({ no: 'DR-2025-044' })], T) === 'DR-2026-010', 'next after the highest of the year');
ok(nextDrillNo([D({ no: 'DR-2026-009' })], '2027-01-02') === 'DR-2027-001', 'a new year starts at 001');

ok(clockAt('10:00', 7) === '10:07', 'clock: start + minutes');
ok(clockAt('23:55', 10) === '00:05', 'clock: past midnight');
ok(clockAt(undefined, 5) === '', 'clock: no start, no clock');
ok(minutesBetween('10:00', '10:45') === 45, 'length of a drill');
ok(nextStepMin([]) === 0 && nextStepMin([{ id: 'a', min: 0, text: '' }, { id: 'b', min: 12, text: '' }]) === 17, 'a new step comes 5 min after the last');

ok(drillState(D({})) === 'planned', 'nothing marked = planned');
ok(drillState(D({ attendance: [{ name: 'A', present: true }] })) === 'running', 'someone marked = in progress');
ok(drillState(D({ doneAt: 5 })) === 'done', 'signed = done');
ok(sortDrills([D({ id: 'old', doneAt: 1, date: '2026-09-01' }), D({ id: 'plan', date: '2026-10-20' }), D({ id: 'new', doneAt: 2, date: '2026-10-05' })]).map((d) => d.id).join(',') === 'plan,new,old', 'plans first, then newest carried out');

// every type has its theory from the trainer
ok(DRILL_TYPES.every((t) => DRILL_THEORY[t.id]?.text.length > 3), 'every drill type has its theory briefing');
ok(['fire', 'enclosed', 'abandon', 'mob'].every((k) => DRILL_THEORY[k].checklist?.length), 'checklists for fire, enclosed, abandon, MOB');

// schedule
const sch = drillSchedule([D({ type: 'fire', date: '2026-09-01', doneAt: 1 }), D({ id: 'p', type: 'mob', date: '2026-10-20' })], T, [{ date: '2026-09-20' } as any]);
const fire = sch.find((r) => r.type === 'fire')!;
ok(fire.due === '2026-10-01' && fire.left! < 0, 'fire monthly: due a month after the last, overdue');
ok(sch.find((r) => r.type === 'oilspill')?.last === '2026-09-20', 'a SOPEP-screen drill counts as the oil-spill drill');
ok(!!sch.find((r) => r.type === 'mob')?.planned, 'a planned optional drill joins the schedule');
ok(!sch.find((r) => r.type === 'helicopter'), 'optional drills never held stay off the schedule');
ok(sch.find((r) => r.type === 'abandon')?.last === undefined && sch[0].left === undefined, 'never held = due now, at the top');

// own drills ('other')
const own = drillSchedule([
  D({ id: 'o1', type: 'other', title: 'Lifeboat release gear', reg: 'SMS 8.2', everyDays: 90, date: '2026-06-01', doneAt: 1 }),
  D({ id: 'o2', type: 'other', title: 'lifeboat release gear ', everyDays: 90, date: '2026-07-01', doneAt: 2 }),
  D({ id: 'o3', type: 'other', title: 'Gas leak in the galley', date: '2026-10-01', doneAt: 3 }),
], T);
const lb = own.find((r) => r.type === 'other:lifeboat release gear')!;
ok(!!lb && lb.last === '2026-07-01' && lb.due === '2026-09-29' && lb.left! < 0, 'own drill: one row per name (case and spaces ignored), due by its interval');
ok(lb.own?.title === 'lifeboat release gear', 'own drill row carries its name to plan the next');
const gas = own.find((r) => r.type === 'other:gas leak in the galley')!;
ok(!!gas && gas.due === undefined && gas.everyDays === 0, 'own drill off a cycle is never due');
ok(own[own.length - 1].type === 'other:gas leak in the galley', 'off-cycle drills at the end of the schedule');
ok(lastOfType([D({ id: 'x', type: 'other', title: 'Gas leak in the galley', scenario: [{ id: 's', min: 0, text: 'Smell of gas' }], doneAt: 1 })], { type: 'other', title: 'gas leak in the galley' })?.id === 'x', 'copy the last own drill of the same name');
ok(lastOfType([D({ id: 'x', type: 'other', title: 'A', scenario: [{ id: 's', min: 0, text: 'x' }] })], { type: 'other', title: '' }) === undefined, 'an unnamed own drill copies nothing');
const ownDoc = drillDoc(D({ type: 'other', title: 'Gas leak in the galley', reg: 'SMS 8.2', theoryText: 'LPG is heavier than air.\nShut the valve at the bottle.', theory: true }), 'V');
ok(ownDoc.title.includes('Gas leak in the galley') && ownDoc.facts[0][1] === 'Gas leak in the galley · SMS 8.2', 'own drill: report names it and its requirement');
ok(ownDoc.theory?.text.length === 2, 'own drill: the officer\'s briefing is the annex');
ok(everyLabel(0) === 'not on a cycle', 'interval label for off-cycle');

// report rows
const run = D({ time: '10:00', endTime: '10:40', scenario: [{ id: 'b', min: 5, text: 'Muster', at: '10:06' }, { id: 'a', min: 0, text: 'Alarm', who: 'Bridge' }], attendance: [{ name: 'Ann', rank: '2/O', present: true }, { name: 'Bob', present: false, reason: 'On watch' }], doneAt: 9, doneBy: 'Jez' });
ok(JSON.stringify(scenarioRows(run)[0]) === JSON.stringify(['T+0', '10:00', 'Alarm', 'Bridge', '']), 'scenario row: T+, clock, action, who, actual');
ok(scenarioRows(run)[1][4] === '10:06', 'actual time printed');
ok(attendanceRows(run)[1][3] === 'ABSENT — On watch', 'absent with the reason');
ok(attendanceRows(run, true)[1][3] === '', 'the blank sheet leaves attendance to fill in');
ok(registerRows([run])[0][7] === 'Bob', 'register lists who was absent');
const doc = drillDoc(run, 'V');
ok(!!doc.theory && doc.theory.text.length > 3 && !!doc.signature, 'report: theory annex and signature');
ok(drillDoc(run, 'V', true).theory === undefined, 'attendance list: no annex');
ok(drillDoc(D({}), 'V').status.startsWith('PLAN'), 'unsigned prints as the plan');

// board
const base: any = { on: (k: string) => k === 'drills', role: 'admin', me: null, today: T, now: `${T}T10:00`, labelOf: (k: any) => k, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], rest: [], machines: [], pmsJobs: [], pmsDone: [], pmsDeferrals: [], pmsDefects: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [], fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [], visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], rounds: [], categories: [], templates: {} };
let b: any;
try {
  b = buildBoard({ ...base, drills: [D({ type: 'fire', date: '2026-09-01', doneAt: 1 })] });
  ok(b.attention.some((n: any) => n.key === 'drill:fire' && n.level === 'red'), 'board: overdue fire drill in red');
  ok(b.tiles.some((t: any) => t.key === 'drills'), 'board: Drills tile');
} catch (e: any) {
  ok(false, `board builds: ${e?.message}`);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
