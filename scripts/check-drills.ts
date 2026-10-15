// npm run check:drills — numbers, the schedule, the scenario clock, report rows, the board.
import { archive, archiveKinds, archiveYears, attendanceSig, byMonth, everyLabel, lastOfType, attendanceRows, clockAt, drillSchedule, drillState, minutesBetween, nextDrillNo, nextStepMin, registerRows, scenarioRows, sortDrills } from '../services/drills';
import { drillDoc } from '../services/drills';
import { DRILL_THEORY } from '../constants/drillTheory';
import { DRILL_TYPES } from '../types/drills';
import { buildBoard } from '../services/board';
import { calendarRows, cellOf, dayIn, proposeYear, stepMonths, toggleSlot, yearCounts } from '../services/drillPlan';

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

// attendance signatures
const sig = D({ attendance: [{ name: 'Ann', present: true, signedAt: new Date('2026-10-13T10:07:00').getTime(), signedWith: { method: 'pin', at: 1 } }, { name: 'Bob', present: true, signedAt: new Date('2026-10-13T10:08:00').getTime(), signedWith: { method: 'drawn', drawing: 'M0 0 L10 10', at: 1 } }, { name: 'Cy', present: true }], doneAt: 5 });
ok(attendanceSig(sig.attendance[0]) === 'signed by PIN · 10:07', 'PIN signature on the list');
ok(attendanceSig(sig.attendance[1]) === '10:08' && drillDoc(sig, 'V').attSigs[1] === 'M0 0 L10 10', 'hand signature drawn, with the time');
ok(attendanceRows(sig)[2][4] === '', 'not signed = empty');
ok(drillDoc(D({ attendance: [{ name: 'Ann', present: true, signedAt: 1, signedWith: { method: 'biometric', at: 1 } }] }), 'V', true).attendance[0][4].startsWith('signed biometrically'), 'attendance list before signing the drill shows who signed');

// archive
const arch = [
  D({ id: 'a', no: 'DR-2025-004', type: 'fire', date: '2025-12-02', doneAt: 1, topic: 'Engine room fire' }),
  D({ id: 'b', no: 'DR-2026-001', type: 'fire', date: '2026-01-10', doneAt: 2, attendance: [{ name: 'Nina Brooks', present: true }] }),
  D({ id: 'c', no: 'DR-2026-002', type: 'mob', date: '2026-01-20', doneAt: 3 }),
  D({ id: 'd', no: 'DR-2026-003', type: 'fire', date: '2026-02-03', doneAt: 4 }),
  D({ id: 'p', no: 'DR-2026-004', type: 'fire', date: '2026-03-01' }),
];
ok(archiveYears(arch).join() === '2026,2025', 'years, newest first; plans left out');
ok(archive(arch, { year: '2026', kind: '', q: '' }).map((d) => d.id).join() === 'd,c,b', 'archive of a year, newest first, no plans');
ok(archive(arch, { year: '', kind: 'fire', q: '' }).length === 3, 'one kind across years');
ok(archive(arch, { year: '', kind: '', q: 'nina' }).map((d) => d.id).join() === 'b', 'search finds a name on the list');
ok(archive(arch, { year: '', kind: '', q: 'engine fire' }).map((d) => d.id).join() === 'a', 'every word must match');
ok(archiveKinds(arch, '2026')[0].kind === 'fire' && archiveKinds(arch, '2026')[0].n === 2, 'kinds of the year, most held first');
ok(byMonth(archive(arch, { year: '2026', kind: '', q: '' })).map((g) => `${g.month}:${g.drills.length}`).join() === 'February 2026:1,January 2026:2', 'grouped by month');

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

// ---- the drill calendar (15 Oct 2026) ----
{
  const T = '2026-10-15';
  const dr = (o: any): any => ({ id: Math.random().toString(36).slice(2), no: 'DR', topic: '', scenario: [], theory: false, attendance: [], plannedBy: 'x', updatedAt: 1, ...o });
  const held = [dr({ type: 'fire', date: '2026-09-20', doneAt: 1 }), dr({ type: 'steering', date: '2026-08-10', doneAt: 1 })];
  const sch = drillSchedule(held, T);
  const y = proposeYear(2026, sch, T);
  const months = (k: string, ys = y) => ys.filter((s) => s.kind === k).map((s) => s.month).join();
  ok(stepMonths(30) === 1 && stepMonths(60) === 2 && stepMonths(90) === 3 && stepMonths(180) === 6 && stepMonths(365) === 12, 'calendar: intervals as months');
  ok(months('fire') === '10,11,12' && months('abandon') === '10,11,12', `this year: monthly drills from this month on (fire ${months('fire')})`);
  ok(months('steering') === '11', `this year: steering every 3 months from its due month (${months('steering')})`);
  const y27 = proposeYear(2027, sch, T);
  ok(months('fire', y27) === '1,2,3,4,5,6,7,8,9,10,11,12' && months('steering', y27) === '2,5,8,11' && months('enclosed', y27).split(',').length === 6, `next year: monthly 12, quarterly ${months('steering', y27)}, every 2 months 6`);
  ok(proposeYear(2025, sch, T).length === 0, 'a past year is not drawn up');
  const plan = { id: '2026', slots: y, updatedAt: 1 };
  const sop: any[] = [{ id: 's', date: '2026-10-03', scenario: 'x', participants: [], by: 'x', at: 1, updatedAt: 1 }];
  const ctx = { plan, drills: [...held, dr({ type: 'abandon', date: '2026-10-28' })], sopepDrills: sop, securityDrills: [], today: T };
  ok(cellOf('fire', 2026, 9, ctx).state === 'done' && cellOf('fire', 2026, 10, ctx).state === 'planned', 'cell: carried out in September, planned in October');
  ok(cellOf('abandon', 2026, 10, ctx).state === 'scheduled' && cellOf('abandon', 2026, 10, ctx).scheduled?.date === '2026-10-28', 'cell: planned on a day');
  ok(cellOf('oilspill', 2026, 10, ctx).state === 'done', 'cell: a SOPEP drill counts in the calendar');
  const past = { ...ctx, plan: toggleSlot(plan, 'mob', 'Man overboard', 3) };
  ok(cellOf('mob', 2026, 3, past).state === 'missed' && calendarRows(sch, past.plan).some((r) => r.kind === 'mob'), 'cell: a planned month gone by without the drill is missed; a drill in the plan gets its row');
  ok(toggleSlot(past.plan, 'mob', 'Man overboard', 3).slots.length === plan.slots.length, 'toggle: the month taken off again');
  const c = yearCounts(calendarRows(sch, plan), 2026, ctx);
  ok(c.planned === y.length && c.missed === 0, `year figures: ${JSON.stringify(c)}`);
  ok(dayIn(2026, 10, T) === T && dayIn(2026, 12, T) === '2026-12-15', 'planning a month: today in this month, the 15th otherwise');
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
