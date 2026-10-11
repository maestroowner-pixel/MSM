// npm run check:pms — planned-maintenance due dates against hand-worked cases.
import { jobDue, withReading, hoursPerDay, jobAfter, intervalText, scheduleText, checkReading , noteForNext, lastCondition } from '../services/pms';
import { Machine, PmsJob, finishedOneOff } from '../types/pms';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const T = '2026-10-09';
const m = (hours: number, readings?: { date: string; hours: number }[]): Machine => ({ id: 'm', name: 'ME', hours, hoursDate: T, readings, updatedAt: 0 });
const j = (p: Partial<PmsJob>): PmsJob => ({ id: 'j', machineId: 'm', title: 'Oil', updatedAt: 0, ...p });

{ const d = jobDue(j({ intervalHours: 250, lastDoneHours: 1000 }), m(1100), T);
  ok(d.status === 'ok' && d.hoursLeft === 150 && d.by === 'hours', 'hours: 150 h left of 250 → ok'); }
{ const d = jobDue(j({ intervalHours: 250, lastDoneHours: 1000 }), m(1230), T);
  ok(d.status === 'due' && d.hoursLeft === 20, 'hours: 20 h left (< 10 %) → due soon'); }
{ const d = jobDue(j({ intervalHours: 250, lastDoneHours: 1000 }), m(1260), T);
  ok(d.status === 'expired' && d.hoursLeft === -10, 'hours: 10 h past → overdue'); }
{ const d = jobDue(j({ intervalDays: 365, lastDoneDate: '2025-10-01' }), m(0), T);
  ok(d.status === 'expired' && d.daysLeft === -8, 'days: 365 d from 1 Oct 2025 → 8 d overdue on 9 Oct 2026'); }
{ const d = jobDue(j({ intervalDays: 30, lastDoneDate: '2026-10-07' }), m(0), T);
  ok(d.status === 'ok' && d.daysLeft === 28, 'days: monthly job done 2 days ago → 28 d left, ok (not "due" for 60 days)'); }
{ const d = jobDue(j({ intervalHours: 250, intervalDays: 365, lastDoneHours: 1000, lastDoneDate: '2026-09-01' }), m(1240), T);
  ok(d.status === 'due' && d.by === 'hours', 'both: hours run out first → due by hours'); }
{ const d = jobDue(j({ intervalHours: 250, intervalDays: 365, lastDoneHours: 1000, lastDoneDate: '2025-10-20' }), m(1010), T);
  ok(d.status === 'due' && d.by === 'days', 'both: calendar runs out first → due by days'); }
{ const d = jobDue(j({ intervalHours: 250 }), m(500), T);
  ok(d.noBaseline && d.status === 'none', 'never done: no baseline, no status'); }
{ const mm = withReading(withReading(m(1000), '2026-10-01', 1000), '2026-10-09', 1080);
  ok(mm.hours === 1080 && mm.hoursDate === '2026-10-09', 'reading updates hours and date');
  ok(hoursPerDay(mm.readings) === 10, '80 h over 8 days → 10 h/day');
  const d = jobDue(j({ intervalHours: 250, lastDoneHours: 1000 }), mm, T);
  ok(d.estDaysForHours === 17, '170 h left at 10 h/day → about 17 days'); }
{ const jj = jobAfter(j({ intervalHours: 250, lastDoneHours: 1000 }), { date: T, hours: 1260 });
  ok(jj.lastDoneHours === 1260 && jj.lastDoneDate === T, 'completion resets the baseline'); }
ok(intervalText({ intervalHours: 250, intervalDays: 365 }) === '250 h or 1 y', 'interval text "250 h or 1 y"');
ok(intervalText({ intervalDays: 30 }) === '1 mo', 'interval text "1 mo"');

// The catalogue (services/pmsCatalogue.ts)
import { CATALOGUE } from '../services/pmsCatalogue';
{
  const keys = new Set(CATALOGUE.map((c) => c.key));
  ok(keys.size === CATALOGUE.length, `catalogue: ${CATALOGUE.length} systems, keys unique`);
  ok(CATALOGUE.every((c) => c.jobs.length > 0), 'catalogue: every system has jobs');
  const stuck = CATALOGUE.filter((c) => !c.counter).flatMap((c) => c.jobs.filter((j) => !j.days).map((j) => `${c.label}: ${j.title}`));
  ok(stuck.length === 0, `catalogue: calendar-only systems give every job a day interval${stuck.length ? ' — ' + stuck.join('; ') : ''}`);
  const depts = new Set(CATALOGUE.map((c) => c.dept));
  ok(depts.size === 7, `catalogue covers all 7 departments (${[...depts].join(', ')})`);
  ok(CATALOGUE.reduce((n, c) => n + c.jobs.length, 0) > 150, `catalogue: ${CATALOGUE.reduce((n, c) => n + c.jobs.length, 0)} jobs`);
}

import { pmsMonth } from '../services/pmsKpi';
{
  const ms: any[] = [{ id: 'me', name: 'Main engine', critical: true, hours: 5000, updatedAt: 0 }, { id: 'wm', name: 'Watermaker', updatedAt: 0 }];
  const js: any[] = [
    { id: 'j1', machineId: 'me', title: 'Oil change', type: 'maintenance', intervalDays: 30, lastDoneDate: '2026-08-01', updatedAt: 0 },
    { id: 'j2', machineId: 'wm', title: 'Membrane flush', intervalDays: 30, lastDoneDate: '2026-10-05', updatedAt: 0 },
    { id: 'j3', machineId: 'wm', title: 'Filters', intervalDays: 10, lastDoneDate: '2026-09-01', updatedAt: 0 },
  ];
  const done: any[] = [{ id: 'd1', jobId: 'j2', machineId: 'wm', jobTitle: 'Membrane flush', machineName: 'Watermaker', date: '2026-10-05', by: 'Ana', at: 0, updatedAt: 0 }];
  const dfr: any[] = [{ id: 'f1', jobId: 'j3', machineId: 'wm', jobTitle: 'Filters', machineName: 'Watermaker', cycle: '2026-09-01|', untilDate: '2026-10-30', reason: 'Spares on order', by: 'Master', at: Date.parse('2026-10-08T10:00:00'), updatedAt: 0 }];
  const r = pmsMonth('2026-10', ms, js, done, dfr, '2026-10-11');
  ok(r.done.length === 1 && r.deferred.length === 1 && r.overdue.length === 1, 'month: 1 done, 1 deferred, 1 overdue (the deferred one is not overdue)');
  ok(r.overdue[0][0].startsWith('⚑') && r.completion.all === 50 && r.completion.critical === 0, 'completion 50 %; critical 0 % (its only job is overdue)');
}
// One-off (corrective) jobs: due by a date and / or a counter reading, once.
{
  const m: any = { id: 'me', name: 'ME', hours: 4980, updatedAt: 0 };
  const byDate: any = { id: 'o1', machineId: 'me', title: 'Renew lagging', oneOff: true, dueDate: '2026-10-15', updatedAt: 0 };
  ok(jobDue(byDate, m, '2026-10-11').status === 'due' && jobDue(byDate, m, '2026-10-11').daysLeft === 4, 'one-off due in 4 days → due soon');
  ok(jobDue(byDate, m, '2026-10-20').status === 'expired', 'one-off past its date → overdue');
  ok(jobDue({ ...byDate, dueDate: '2026-12-01' }, m, '2026-10-11').status === 'ok', 'one-off weeks away → in date');
  const byHours: any = { ...byDate, dueDate: undefined, dueHours: 4950 };
  ok(jobDue(byHours, m, '2026-10-11').status === 'expired' && jobDue(byHours, m, '2026-10-11').hoursLeft === -30, 'one-off by counter, passed → overdue by 30 h');
  ok(scheduleText(byDate) === 'One-off — by 15.10.2026' && scheduleText({ intervalDays: 30 } as any) === 'Every 1 mo', 'schedule text');
  ok(finishedOneOff({ ...byDate, lastDoneDate: '2026-10-12' }) && !finishedOneOff({ intervalDays: 30, lastDoneDate: '2026-10-12' } as any), 'a one-off done is finished; a recurring one is not');
}
// Readings the calendar cannot explain need a reason; the rate starts after the last adjustment.
{
  const m: any = { hours: 1000, hoursDate: '2026-10-09' };
  ok(checkReading(m, '2026-10-11', 1060).ok, '60 h in 2 days — fine');
  const low = checkReading(m, '2026-10-11', 990);
  ok(!low.ok && /Lower than the last/.test((low as any).why), 'lower than the last → asks a reason');
  ok(!checkReading(m, '2026-10-11', 1090).ok, '90 h in 2 days (most 3×24 + 12 = 84) → asks a reason');
  ok(checkReading({}, '2026-10-11', 5).ok, 'first reading — nothing to compare');
  const rs: any[] = [{ date: '2026-09-01', hours: 100 }, { date: '2026-09-11', hours: 300 }, { date: '2026-09-21', hours: 50, reason: 'Counter replaced' }, { date: '2026-10-01', hours: 70 }];
  ok(hoursPerDay(rs) === 2, `rate counted after the adjustment: ${hoursPerDay(rs)} h/day`);
}
{
  const m: any = { id: 'g', name: 'G', readings: [{ date: '2026-10-11', hours: 9700, reason: 'Counter replaced' }], hours: 9700, hoursDate: '2026-10-11', updatedAt: 0 };
  const n = withReading(m, '2026-10-11', 9715);
  ok(n.readings!.length === 2 && n.hours === 9715 && n.readings![0].reason === 'Counter replaced', 'a reading the same day keeps the adjustment before it');
  const n2 = withReading(n, '2026-10-11', 9720);
  ok(n2.readings!.length === 2 && n2.hours === 9720, 'a second plain reading that day replaces the plain one');
}
// The fuller sign-out: condition, man-hours, a note for next time.
{
  const done: any[] = [
    { id: 'a', jobId: 'j1', machineId: 'me', jobTitle: 'Oil change', machineName: 'ME', date: '2026-09-01', by: 'Tom', at: 1, nextNote: 'Order a spare gasket', conditionAfter: 'fair', manHours: 2, updatedAt: 1 },
    { id: 'b', jobId: 'j1', machineId: 'me', jobTitle: 'Oil change', machineName: 'ME', date: '2026-10-05', by: 'Ana', at: 2, conditionBefore: 'fair', conditionAfter: 'good', manHours: 1.5, updatedAt: 2 },
  ];
  ok(noteForNext('j1', done)?.nextNote === 'Order a spare gasket', 'the last note for next time is found even when the latest sign-out has none');
  ok(lastCondition('me', done)?.conditionAfter === 'good', 'last condition is the latest one recorded');
  const r = pmsMonth('2026-10', [{ id: 'me', name: 'ME', updatedAt: 0 }] as any, [], done, [], '2026-10-11');
  ok(r.manHours === 1.5 && r.done[0][5] === 'Good' && r.done[0][6] === '1.5', `month: man-hours ${r.manHours}, condition and man-h columns`);
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
