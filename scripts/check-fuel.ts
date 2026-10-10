// npm run check:fuel — remaining on board and consumption (services/fuel.ts).
import { fuelMonth, orbBunkerLine, robTotal } from '../services/fuel';
import { FuelBunker, FuelReading, FuelTank } from '../types/fuel';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const tanks: FuelTank[] = [{ id: 'p', name: 'Port', order: 0, updatedAt: 0 }, { id: 's', name: 'Stbd', order: 1, updatedAt: 0 }, { id: 'x', name: 'Old', order: 2, deleted: true, updatedAt: 0 }];
const R = (date: string, p: number, s: number): FuelReading => ({ id: `rob_${date}`, date, tanks: { p, s, x: 999 }, by: 'C/E', updatedAt: 0 });
const B = (date: string, litres: number): FuelBunker => ({ id: date, date, port: 'Palma', litres, density: 0.845, sulphur: 0.1, bdnNo: 'BDN-1', into: { p: litres / 2, s: litres / 2 }, by: 'C/E', updatedAt: 0 });

ok(robTotal(R('2026-10-01', 4000, 3000), tanks.filter((t) => !t.deleted)) === 7000, 'ROB: sum of live tanks only');

const readings = [R('2026-09-30', 5000, 5000), R('2026-10-01', 4800, 4800), R('2026-10-02', 4700, 4700), R('2026-10-05', 4400, 4400), R('2026-10-06', 8400, 8400)];
const m = fuelMonth('2026-10', tanks, readings, [B('2026-10-06', 8200)], []);
ok(m.opening === 10000 && m.closing === 16800, 'opening from the last September sounding, closing from the last October one');
ok(m.days[0].consumed === 400 && m.days[0].span === 1, '1 Oct: 10 000 → 9 600 = 400 L');
ok(m.days[4].consumed === 600 && m.days[4].span === 3, '5 Oct: gap of 3 days, 600 L put on the next sounding');
ok(m.days[3].consumed == null && m.days[3].rob == null, 'a day without sounding has no figure of its own');
ok(m.days[5].received === 8200 && m.days[5].consumed === 200, '6 Oct: 8 800 + 8 200 bunkered − 16 800 = 200 L');
ok(m.received === 8200 && m.consumed === 1400, 'month: received 8 200 L, consumed 1 400 L');
ok(m.opening! + m.received - m.consumed === m.closing, 'balance: opening + received − consumed = closing');

const bad = fuelMonth('2026-10', tanks, [R('2026-10-01', 1000, 1000), R('2026-10-02', 1200, 1000)], [], []);
ok(bad.days[1].suspect === true && bad.consumed === 0, 'more fuel than before with no bunker → flagged, not counted');

const line = orbBunkerLine(B('2026-10-06', 8200), tanks);
ok(line.includes('H 26.1 Place of bunkering: Palma') && line.includes('8200 L (6929 t)') === false && line.includes('(6929 t)') === false && line.includes('6.9 t'), `ORB code H: place, quantity in L and t, sulphur, tanks, BDN`);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
