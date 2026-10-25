// npm run check:shiptime — ship's time across planned clock changes.
import { ClockChange, clockChangeText, nextChangeSoon, offsetAt, pastChanges, planChange, plannedChanges, shipAndUtcAt, shipInstantAt } from '../utils/shipTime';
import { reportWindow } from '../services/dailyActivity';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const U = (s: string) => Date.parse(s);
const H = 3600000;

// Westbound: 26 Oct 02:00 ship's time (UTC+2, = 00:00 UTC) the clocks go back to UTC+1.
const back: ClockChange = { id: 'a', at: U('2026-10-26T00:00:00Z'), from: '+02:00', to: '+01:00', madeAt: 0 };
const v = { ship_utc_offset: '+02:00', ship_time_changes: [back] };

ok(offsetAt(back.at - 1, v) === '+02:00' && offsetAt(back.at, v) === '+01:00', 'the offset changes at the planned instant');
ok(offsetAt(U('2026-10-20T00:00:00Z'), v) === '+02:00' && offsetAt(Date.now(), { ship_utc_offset: '+05:00' }) === '+05:00', 'before the first change — the zone it changed from; no changes — the set offset');
ok(shipAndUtcAt(back.at - 60000, v).ship === '2026-10-26 01:59' && shipAndUtcAt(back.at, v).ship === '2026-10-26 01:00', '01:59 → 01:00: the clocks went back');

ok(shipInstantAt('2026-10-26', '01:30', v) === U('2026-10-25T23:30:00Z'), 'a repeated wall time is taken the first time it comes');
ok(shipInstantAt('2026-10-26', '03:00', v) === U('2026-10-26T02:00:00Z'), 'after the change — the new zone');

const day = reportWindow('midnight', '2026-10-26', v);
ok(day.to - day.from === 25 * H, 'the day the clocks go back is 25 hours');
const old = reportWindow('midnight', '2026-10-20', v);
ok(old.from === U('2026-10-19T22:00:00Z') && old.to - old.from === 24 * H, 'a day last week keeps last week\'s zone');
ok(reportWindow('midnight', '2026-10-20', '+01:00').from === U('2026-10-19T23:00:00Z'), 'a plain offset still works as before');

// Eastbound: advance at 02:00 (UTC+1 → UTC+2); 02:30 never happens.
const fwd: ClockChange = { id: 'b', at: U('2026-10-28T01:00:00Z'), from: '+01:00', to: '+02:00', madeAt: 0 };
const v2 = { ship_utc_offset: '+02:00', ship_time_changes: [back, fwd] };
ok(reportWindow('midnight', '2026-10-28', v2).to - reportWindow('midnight', '2026-10-28', v2).from === 23 * H, 'the day the clocks go forward is 23 hours');
ok(shipInstantAt('2026-10-28', '02:30', v2) === fwd.at, 'a skipped wall time falls at the change');

const now = U('2026-10-25T08:00:00Z');
const p = planChange({ ship_utc_offset: '+02:00' }, '2026-10-26', '02:00', -1, 'x', 'Master', now);
ok(typeof p !== 'string' && p.at === back.at && p.from === '+02:00' && p.to === '+01:00', 'planned: 26 Oct 02:00, retard 1 h');
ok(planChange({ ship_utc_offset: '+02:00' }, '2026-10-24', '02:00', -1, 'x', undefined, now) === 'past', 'refused in the past');
ok(planChange(v, '2026-10-25', '23:00', 1, 'x', undefined, now) === 'order', 'refused before a change already planned');
ok(planChange({ ship_utc_offset: '+14:00' }, '2026-10-26', '02:00', 1, 'x', undefined, now) === 'range', 'refused beyond UTC+14');
ok(planChange({ ship_utc_offset: '+02:00' }, '26.10.2026', '2:00', 1, 'x', undefined, now) === 'format', 'refused in another format');

ok(plannedChanges(v, now).length === 1 && pastChanges(v, now).length === 0 && pastChanges(v, back.at).length === 1, 'planned and made told apart');
ok(nextChangeSoon(v, back.at - 3 * H)?.time === '26.10 02:00' && nextChangeSoon(v, back.at - H / 2)?.time === '02:00' && nextChangeSoon(v, back.at - 13 * H) === null, 'the reminder: within 12 hours, at the old zone\'s wall time');
ok(clockChangeText(back) === "Ship's time changed UTC+02:00 → UTC+01:00 (clocks retarded 1 h)", 'the log line');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
