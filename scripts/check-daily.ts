// npm run check:daily — position cells, and the day on board from every log.
import { coordsError, formatPosition, parsePosition } from '../utils/position';
import { OFFSETS, offsetMinutes, shipAndUtc, shipInstant } from '../utils/shipTime';
import { dailyActivity, dayOf, reportWindow } from '../services/dailyActivity';
import { fuelDaily, fuelDailyText } from '../services/fuelDaily';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

// position
const c = { latDeg: '38', latMin: '45.2', ns: 'N' as const, lonDeg: '2', lonMin: '10.6', ew: 'E' as const };
ok(formatPosition(c) === "38°45.2'N 002°10.6'E", 'cells → 38°45.2\'N 002°10.6\'E');
ok(JSON.stringify(parsePosition("38°45.2'N 002°10.6'E")) === JSON.stringify(c), 'and back into the cells');
ok(formatPosition({ ...c, latMin: '5' }) === "38°05.0'N 002°10.6'E", 'minutes padded and one decimal');
ok(parsePosition('Palma de Mallorca') === null, 'a port is not a position');
ok(parsePosition("43° 28,5' N, 008° 15.0' W")?.ew === 'W', 'commas and spaces as people write them');
ok(coordsError({ ...c, latDeg: '91' }) !== null && coordsError({ ...c, lonMin: '60' }) !== null, 'out of range is an error');
ok(coordsError({ ...c, lonMin: '' }) !== null && formatPosition({ ...c, lonMin: '' }) === '', 'half-filled: an error, nothing written');
ok(coordsError({ latDeg: '', latMin: '', ns: 'N', lonDeg: '', lonMin: '', ew: 'E' }) === null, 'empty is not an error');

// ship's time
ok(offsetMinutes('+02:00') === 120 && offsetMinutes('-03:30') === -210 && offsetMinutes('') === undefined, 'offsets read');
ok(OFFSETS.includes('-12:00') && OFFSETS.includes('+14:00') && OFFSETS.includes('+05:45'), 'every zone a ship keeps');
const noonUtc = shipInstant('2026-10-13', '12:00', '+02:00');
ok(new Date(noonUtc).toISOString() === '2026-10-13T10:00:00.000Z', 'noon at UTC+2 is 10:00 UTC');
ok(shipAndUtc(noonUtc, '+02:00').line === "2026-10-13 12:00 ship's time (UTC+02:00) · 10:00 UTC", 'header: ship\'s time and UTC');
ok(shipAndUtc(shipInstant('2026-10-14', '00:00', '+02:00'), '+02:00').utc === '2026-10-13 22:00', 'midnight at UTC+2 is 22:00 UTC the day before');
const w = reportWindow('noon', '2026-10-13', '-05:00');
ok(new Date(w.from).toISOString() === '2026-10-12T17:00:00.000Z' && new Date(w.to).toISOString() === '2026-10-13T17:00:00.000Z', 'noon-to-noon window in ship\'s time');

// the day
const D = '2026-10-13';
const at = (hm: string) => new Date(`${D}T${hm}:00`).getTime();
const all = (k: string) => true || k;
const sec = dailyActivity({
  date: D, on: all as any, labelOf: (k) => (k === 'fire_ext' ? 'Fire extinguishers' : k),
  flat: [{ id: 'fe1', category: 'fire_ext', no: 'FE-12', type: 'CO2 5kg' } as any],
  inspections: [{ id: 'i1', itemId: 'fe1', category: 'fire_ext', at: at('09:10'), by: 'Ann', period: 'monthly', outcome: 'pass' } as any, { id: 'i2', itemId: 'fe1', category: 'fire_ext', at: at('09:10') - 86400000, by: 'Ann', period: 'monthly', outcome: 'pass' } as any],
  sewage: [{ id: 's', book: 'sewage', date: D, time: '14:00', code: 'STP', text: 'STP discharge 2 m³', by: 'Bob' } as any, { id: 'x', book: 'sewage', date: D, code: 'STP', text: 'cancelled one', by: 'Bob', cancelled: true } as any],
  ballast: [{ id: 'b', book: 'ballast', date: D, time: '08:00', code: 'UP', text: 'Ballast 20 m³ up', by: 'Bob' } as any],
  fuelTanks: [{ id: 't1', name: 'Port', order: 0 } as any], fuelReadings: [{ id: 'r', date: D, time: '12:00', tanks: { t1: 4000 }, by: 'Eng' } as any],
  visitors: [{ id: 'v', date: D, timeIn: '10:00', name: 'J. Smith', company: 'Tech Co', purpose: 'Service', inBy: 'Max', timeOut: '12:00', outBy: 'Max' } as any],
  medTreatments: [{ id: 'm', date: D, patient: 'Secret Name' } as any],
  medMoves: [{ id: 'mm', itemId: 'p', kind: 'issued', qty: 2, date: D, at: at('11:00'), by: 'Ann' } as any],
  medItems: [{ id: 'p', name: 'Paracetamol' } as any],
});
const titles = sec.map((s) => s.title);
ok(titles.includes('Inspections') && sec.find((s) => s.title === 'Inspections')!.rows.length === 1, 'inspections of that day only');
ok(sec.find((s) => s.title === 'Inspections')!.rows[0][1] === 'FE-12 CO2 5kg' && sec.find((s) => s.title === 'Inspections')!.rows[0][2] === 'Fire extinguishers', 'item named, category labelled');
ok(sec.find((s) => s.title === 'Sewage record')!.rows.length === 1, 'a cancelled entry is left out');
ok(titles.includes('Ballast water record') && titles.includes('Fuel') && titles.includes('Gangway & security'), 'ballast, fuel, gangway');
ok(sec.find((s) => s.title === 'Gangway & security')!.rows.length === 2, 'visitor aboard and ashore');
const hosp = sec.find((s) => s.title === 'Hospital')!;
ok(!!hosp && !JSON.stringify(hosp).includes('Secret Name') && hosp.rows.length === 1, 'hospital: only how many were seen — no names, no issues to patients');
ok(dailyActivity({ date: D, on: () => false, labelOf: (k) => k, flat: [], inspections: [], sewage: [{ id: 's', date: D, code: 'X', text: 't', by: 'b' } as any] }).length === 0, 'switched-off modules are not read');

// noon to noon vs the calendar day
const two = { flat: [], inspections: [], on: (() => true) as any, labelOf: (k: string) => k, sewage: [
  { id: 'a', date: '2026-10-12', time: '15:00', code: 'A', text: 'yesterday afternoon', by: 'b' } as any,
  { id: 'b', date: D, time: '09:00', code: 'B', text: 'this morning', by: 'b' } as any,
  { id: 'c', date: D, time: '16:00', code: 'C', text: 'this afternoon', by: 'b' } as any,
] };
const noon = dailyActivity({ ...two, date: D, ...reportWindow('noon', D) }).find((s) => s.title === 'Sewage record')!.rows.map((r) => r[1]).join();
const mid = dailyActivity({ ...two, date: D, ...reportWindow('midnight', D) }).find((s) => s.title === 'Sewage record')!.rows.map((r) => r[1]).join();
ok(noon === 'B,A' || noon === 'A,B', `noon report: yesterday 15:00 and today 09:00, not today 16:00 (${noon})`);
ok(mid === 'B,C', `midnight report: today 00:00–24:00 (${mid})`);
ok(fuelDailyText(fuelDaily(D, [], [], []), 'V', '', 'J', { kind: 'midnight' }).startsWith('MIDNIGHT REPORT'), 'midnight report title');

// the text
const r = fuelDaily(D, [], [], []);
const t = fuelDailyText(r, 'MY Alpha', '', 'Jez', { position: "38°45.2'N 002°10.6'E", activity: ['Inspections: 1'] });
ok(t.startsWith('DAILY REPORT') && t.includes("Position: 38°45.2'N 002°10.6'E") && t.includes('ON BOARD') && t.includes('No sounding'), 'daily text: position, fuel, on board');
ok(fuelDailyText(r, 'V', '', 'J', { port: 'Palma' }).includes('In port: Palma'), 'or the port');
ok(dayOf(at('23:59')) === D, 'local day');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
