// npm run check:logbooks — Sewage, Ballast Water, Fuel oil changeover and ODS record books: rules and lines.
import { BALLAST, FUEL_CHANGE, ODS, SEWAGE } from '../services/logbooks';
import { entryWhen, entryZone, setShipClock } from '../utils/shipTime';
import { deckFix } from '../utils/position';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
ok(/3 nm/.test(SEWAGE.problem({ code: 'COM', quantity: 2, place: 'x', distance: 2 }) ?? ''), 'comminuted sewage closer than 3 nm → warned');
ok(SEWAGE.problem({ code: 'COM', quantity: 2, place: 'x', distance: 4, start: '10:00', stop: '10:20', placeEnd: 'y', speed: 6 }) === null, 'comminuted 4 nm out, start and end given, is fine');
ok(/end of the discharge/.test(SEWAGE.problem({ code: 'COM', quantity: 2, place: 'x', distance: 4 }) ?? ''), 'a discharge needs its end — time, position — and speed');
ok(/end of the discharge/.test(SEWAGE.problem({ code: 'STP', quantity: 2, place: 'x', start: '10:00' }) ?? ''), 'treated discharge too');
ok(SEWAGE.problem({ code: 'STP', quantity: 2, place: 'x', placeEnd: 'y', start: '10:00', stop: '10:30', speed: 7 }) === null, 'treated discharge complete');
ok(/7 kn/.test(SEWAGE.text({ code: 'STP', quantity: 2, place: 'A', placeEnd: 'B', start: '10:00', stop: '10:30', speed: 7 })), 'speed in the line in the book');
ok(/4 knots/.test(SEWAGE.problem({ code: 'HT', tank: 'Black water tank', quantity: 3, place: 'x', distance: 14, speed: 2 }) ?? ''), 'untreated while slower than 4 kn → warned');
ok(/12 nm/.test(SEWAGE.problem({ code: 'HT', tank: 'T', quantity: 3, place: 'x', distance: 8, speed: 6 }) ?? ''), 'untreated inside 12 nm → warned');
ok(SEWAGE.text({ code: 'SHORE', quantity: 5, tank: 'Black water tank', place: 'Antibes', receiptNo: 'R12' }) === 'To reception facility 5 m³ from Black water tank; Antibes; receipt R12', 'sewage line');
ok(/200 m/.test(BALLAST.problem({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', distance: 220, depth: 150 }) ?? ''), 'exchange in shallow water → warned');
ok(BALLAST.problem({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', distance: 220, depth: 3000 }) === null, 'exchange 220 nm out, 3000 m deep');
ok(/Exchange \(Sequential\) 120 m³ in DB 1 P\/S/.test(BALLAST.text({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', start: '08:00', stop: '11:30' })), 'exchange line names the method');
ok(BALLAST.text({ code: 'UP', tank: 'Fore peak', quantity: 40, place: 'Palma', treated: true }).includes('treated (BWMS)'), 'uptake treated');
const IN = { code: 'IN', method: 'med', tank: 'DB 3 P/S', quantity: 24.5, place: "43°10.0'N 007°20.0'E", time: '12:40' };
ok(/Sulphur/.test(FUEL_CHANGE.problem(IN) ?? ''), 'changeover into an ECA needs the sulphur content');
ok(FUEL_CHANGE.problem({ ...IN, sulphur: 0.08 }) === null, 'changeover to 0.08 % S before the ECA is fine');
ok(/0\.10 % S/.test(FUEL_CHANGE.problem({ ...IN, sulphur: 0.5 }) ?? ''), '0.50 % S inside an ECA → warned');
ok(FUEL_CHANGE.problem({ ...IN, sulphur: 0.5, remarks: 'FONAR sent' }) === null, '…unless the reason is in the remarks');
ok(/Which ECA/.test(FUEL_CHANGE.problem({ ...IN, method: undefined, sulphur: 0.08 }) ?? ''), 'the ECA is named');
ok(/Time/.test(FUEL_CHANGE.problem({ ...IN, time: undefined, sulphur: 0.08 }) ?? ''), 'the time is required (reg. 14.6)');
ok(FUEL_CHANGE.text({ ...IN, sulphur: 0.08 }) === "Changeover to 0.08 % S completed before entering Mediterranean Sea ECA; 43°10.0'N 007°20.0'E; DB 3 P/S 24.5 m³", 'changeover line');
ok(/0\.10 % S/.test(FUEL_CHANGE.problem({ code: 'BERTH', tank: 'DB 3', quantity: 10, sulphur: 0.5, place: 'Antibes', time: '09:00' }) ?? ''), 'EU berth with 0.50 % S → warned');
ok(FUEL_CHANGE.problem({ code: 'DEPART', tank: 'DB 3', quantity: 10, place: 'Antibes', time: '17:00' }) === null, 'before departure, no sulphur needed');
ok(FUEL_CHANGE.problem({ ...IN, method: 'neatl', date: '2027-10-01', sulphur: 0.5 }) === null, 'North-East Atlantic before 1 Sep 2028: 0.50 % S not warned');
ok(/0\.10 % S/.test(FUEL_CHANGE.problem({ ...IN, method: 'neatl', date: '2028-09-01', sulphur: 0.5 }) ?? ''), '…from 1 Sep 2028 it is');
ok(/North-East Atlantic ECA/.test(FUEL_CHANGE.text({ code: 'ENTER', method: 'neatl', place: 'x', time: '01:00' })), 'North-East Atlantic named');
ok(/Left North Sea ECA/.test(FUEL_CHANGE.text({ code: 'EXIT', method: 'north', place: 'x', time: '01:00' })), 'leaving the ECA');
ok(/kg/.test(ODS.problem({ code: 'PART', equipment: 'Provision plant', substance: 'R-22' }) ?? ''), 'a recharge needs the mass');
ok(ODS.text({ code: 'PART', equipment: 'Provision plant', substance: 'R-22', mass: 2.5 }) === 'Partial recharge of Provision plant: R-22 2.5 kg', 'ODS line');
ok(/prohibited/.test(ODS.problem({ code: 'DELIB', equipment: 'A/C 2', substance: 'R-22', mass: 1 }) ?? ''), 'a deliberate discharge needs the reason');
ok(ODS.problem({ code: 'LEAK', equipment: 'A/C 2', substance: 'R-22', mass: 1, remarks: 'found by leak test, valve replaced' }) === null, 'a leak with remarks is fine');
ok(/port/.test(ODS.problem({ code: 'SHORE', substance: 'Halon 1301', mass: 40 }) ?? ''), 'to a reception facility needs the port');
// Ship's time and UTC on every entry (MMC-193 §4.x.2): the zone is frozen when signed, the copy prints both.
ok(entryWhen('2026-10-02', '14:30', '+02:00') === '02.10.2026 14:30 LT\n(UTC+02:00)\n12:30 UTC', 'an entry prints ship\'s time, its zone and UTC');
ok(entryWhen('2026-10-02', '01:00', '+03:00') === '02.10.2026 01:00 LT\n(UTC+03:00)\n01.10 22:00 UTC', 'UTC on the day before says its date');
ok(entryWhen('2026-10-02', '20:00', '-05:00').endsWith('03.10 01:00 UTC'), 'west of Greenwich, UTC the next day');
ok(entryWhen('2026-10-02', '14:30') === '02.10.2026 14:30' && entryWhen('2026-10-02', undefined, '+02:00') === '02.10.2026', 'no zone (before 2.77) or no time → as written');
setShipClock({ ship_utc_offset: '+01:00' });
ok(entryZone('2026-11-05', '10:00') === '+01:00', 'the zone set in Settings');
setShipClock({ ship_utc_offset: '+01:00', ship_time_changes: [{ id: 'c1', at: Date.parse('2026-11-10T00:00:00Z'), from: '+01:00', to: '+02:00', madeAt: 0 }] });
ok(entryZone('2026-11-05', '10:00') === '+01:00' && entryZone('2026-11-12', '10:00') === '+02:00', 'an entry for a date before a clock change keeps the zone in force then');
setShipClock(null);
// The position from the Deck log (MMC-193 §4.2.4/4.4.4): nearest entry within 4 h, offered, never silent.
const DL = [
  { date: '2026-11-05', time: '08:00', latDeg: 41, latMin: 20.4, latHem: 'N' as const, lonDeg: 2, lonMin: 9.8, lonHem: 'E' as const },
  { date: '2026-11-05', time: '12:00', latDeg: 41, latMin: 5, latHem: 'N' as const, lonDeg: 2, lonMin: 30.25, lonHem: 'E' as const },
  { date: '2026-11-05', time: '13:00', draft: true, latDeg: 41, latMin: 1, latHem: 'N' as const, lonDeg: 2, lonMin: 40, lonHem: 'E' as const },
  { date: '2026-11-05', time: '10:00' },
];
const f1 = deckFix(DL, '2026-11-05', '11:40');
ok(f1?.position === "41°05.0'N 002°30.3'E" && f1.minutes === 20 && !f1.draft, `nearest Deck log entry with a position: ${f1?.position} +${f1?.minutes}`);
ok(deckFix(DL, '2026-11-05', '12:30')?.time === '12:00', 'at the same distance the earlier, signed entry');
ok(deckFix(DL, '2026-11-05', '12:50')?.draft === true, 'a draft is said to be one');
ok(deckFix(DL, '2026-11-05', '18:00') === null && deckFix(DL, '2026-11-05', undefined) === null, 'nothing within 4 h, or no time → nothing offered');
ok(deckFix([{ date: '2026-11-04', time: '23:00', latDeg: 1, latMin: 0, lonDeg: 1, lonMin: 0 }], '2026-11-05', '01:00')?.minutes === -120, 'across midnight');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
