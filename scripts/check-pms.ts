// npm run check:pms — planned-maintenance due dates against hand-worked cases.
import { jobDue, withReading, hoursPerDay, jobAfter, intervalText } from '../services/pms';
import { Machine, PmsJob } from '../types/pms';

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

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
