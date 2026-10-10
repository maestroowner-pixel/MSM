// npm run check:fueldaily — the noon report's arithmetic.
import { fuelDaily, fuelDailyText } from '../services/fuelDaily';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const tanks: any[] = [{ id: 'p', name: 'Port', order: 0 }, { id: 's', name: 'Stbd', order: 1 }];
const R = (date: string, p: number, s: number): any => ({ id: `rob_${date}`, date, time: '12:00', tanks: { p, s }, by: 'X' });
const readings = [R('2026-09-30', 10000, 10000), R('2026-10-03', 9000, 9000), R('2026-10-08', 8000, 8000), R('2026-10-09', 7500, 7700), R('2026-10-10', 7000, 7000)];
const bunkers: any[] = [{ date: '2026-10-09', litres: 1000 }];
const r = fuelDaily('2026-10-10', tanks, readings, bunkers);
ok(r.consumed === 1200 && r.span === 1 && r.received === 0, 'last 24 h: 15200 → 14000 = 1200');
ok(r.rob === 14000 && r.byTank[0].litres === 7000, 'ROB and by tank');
ok(r.avg7 === 714 && r.daysLeft === 19, '7 days from 03.10: 18000+1000−14000 = 5000 / 7 days = 714 L/day, 19 days left');
const r2 = fuelDaily('2026-10-09', tanks, readings, bunkers);
ok(r2.consumed === 1800 && r2.received === 1000, 'bunker counted on the day received: 16000+1000−15200');
ok(r.monthToDate === 7000, 'month to date from 30.09: 20000+1000−14000');
const none = fuelDaily('2026-10-11', tanks, readings, bunkers);
ok(none.reading === undefined && none.rob === undefined, 'no sounding → nothing invented');
const t = fuelDailyText(r, 'MY Alpha', 'All well', 'Jez Dodd');
ok(t.includes('Consumed: 1 200 L (09.10 12:00 → 10.10 12:00)') && t.includes('ROB: 14 000 L (Port 7 000 L / Stbd 7 000 L)'), 'text');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
