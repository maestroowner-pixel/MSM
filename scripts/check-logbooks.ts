// npm run check:logbooks — Sewage, Ballast Water, Fuel oil changeover and ODS record books: rules and lines.
import { BALLAST, FUEL_CHANGE, ODS, SEWAGE, cover, printedCode } from '../services/logbooks';
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
// Ballast Water Record Book — the form since 1 Feb 2025 (MEPC.369(80)), sections A–H.
const EX = { code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, rob: 240, method: 'seq', place: "38°10.0'N 015°20.0'W", placeEnd: "38°30.0'N 015°50.0'W", start: '08:00', stop: '11:30', bwmp: true, treatment: 'BWMS UV' };
ok(/200 m/.test(BALLAST.problem({ ...EX, distance: 220, depth: 150 }) ?? ''), 'exchange in shallow water → warned');
ok(BALLAST.problem({ ...EX, distance: 220, depth: 3000 }) === null, 'exchange 220 nm out, 3000 m deep');
ok(/designated exchange area/.test(BALLAST.problem(EX) ?? ''), 'exchange without distance/depth asks for them or the designated area');
ok(BALLAST.problem({ ...EX, area: 'North Sea BWE area' }) === null, 'a designated exchange area (B-4.2) stands for distance and depth');
ok(/final total/.test(BALLAST.problem({ ...EX, rob: undefined, distance: 220, depth: 3000 }) ?? ''), 'exchange needs the final total on board');
ok(/BWMP/.test(BALLAST.problem({ ...EX, bwmp: undefined, distance: 220, depth: 3000 }) ?? ''), 'exchange: per BWMP is asked');
const exLine = BALLAST.text({ ...EX, distance: 220, depth: 3000 });
ok(exLine.startsWith('Exchange (Sequential): .1 08:00 ') && exLine.includes('.6 120 m³, total on board 240 m³') && exLine.includes('.7 BWMS UV') && exLine.includes('.4 per BWMP: yes, Sequential'), `exchange line by the form's items: ${exLine}`);
const A = { code: 'UP', tank: 'Fore peak', quantity: 40, rob: 160, place: 'Palma', placeEnd: 'Palma', start: '09:00', stop: '09:40', bwmp: true, treatment: 'BWMS UV' };
ok(BALLAST.problem(A) === null, 'A — uptake in port, complete');
ok(/depth/.test(BALLAST.problem({ ...A, place: "39°30.0'N 002°40.0'E", placeEnd: "39°31.0'N 002°41.0'E" }) ?? ''), 'A — uptake at sea needs the minimum depth');
ok(/Start and completion/.test(BALLAST.problem({ ...A, placeEnd: undefined }) ?? ''), 'A — completion time and place required');
ok(/final total/.test(BALLAST.problem({ ...A, rob: undefined }) ?? ''), 'A — final total on board required');
ok(/treatment/.test(BALLAST.problem({ ...A, treatment: undefined }) ?? ''), 'A — treatment method required');
ok(BALLAST.text(A) === 'Ballasting: .1 09:00 Palma; .2 09:40 Palma; .3 Fore peak; .4 40 m³, total on board 160 m³; .5 per BWMP: yes; .6 BWMS UV', `A line: ${BALLAST.text(A)}`);
ok(BALLAST.text({ code: 'UP', tank: 'Fore peak', quantity: 40, place: 'Palma', treated: true }).includes('treated (BWMS)'), 'an entry made before 2.78 (treated yes/no) still reads');
ok(/facility/.test(BALLAST.problem({ code: 'SHORE', method: 'dis', place: 'Rotterdam', start: '10:00', stop: '12:00', tank: 'DB2', quantity: 50, rob: 10, bwmp: true, treatment: 'none' }) ?? ''), 'D — the facility is named');
ok(BALLAST.problem({ code: 'SHORE', method: 'dis', facility: 'BW reception barge 3', place: 'Rotterdam', start: '10:00', stop: '12:00', tank: 'DB2', quantity: 50, rob: 10, bwmp: true, treatment: 'none' }) === null, 'D — complete');
ok(/circumstances/.test(BALLAST.problem({ code: 'ACC', method: 'ingress', place: 'x', start: '01:00', tank: 'FP', quantity: 3 }) ?? ''), 'E — circumstances required');
ok(/issue/.test(BALLAST.problem({ code: 'BWMS', method: 'up', place: 'Palma', start: '10:00' }) ?? ''), 'F — the issue described');
ok(BALLAST.problem({ code: 'BWMS', method: 'up', place: 'Palma', start: '10:00', remarks: 'UV lamp alarm' }) === null, 'F — back in operation may follow later');
ok(/operational 14:00 Palma/.test(BALLAST.text({ code: 'BWMS', method: 'up', place: 'Palma', start: '10:00', stop: '14:00', placeEnd: 'Palma', remarks: 'UV lamp alarm' })), 'F — time and place made operational');
ok(/facility/.test(BALLAST.problem({ code: 'SED', method: 'shore', place: 'Barcelona', start: '08:00', tank: 'DB 1', quantity: 0.5 }) ?? ''), 'G — sediments ashore: the facility');
ok(/distance/.test(BALLAST.problem({ code: 'SED', method: 'sea', place: 'x', start: '08:00', tank: 'DB 1', quantity: 0.5 }) ?? ''), 'G — sediments at sea: distance and depth');
ok(/^Tank cleaning \/ sediments: .1 08:00 Barcelona; .3 DB 1; .4 0.5 m³, Port reception 4, receipt R7$/.test(BALLAST.text({ code: 'SED', method: 'shore', place: 'Barcelona', start: '08:00', tank: 'DB 1', quantity: 0.5, facility: 'Port reception 4', receiptNo: 'R7' })), 'G line');
ok(/remarks/.test(BALLAST.problem({ code: 'REM' }) ?? '') && BALLAST.problem({ code: 'REM', remarks: 'BWMP rev. 3 on board' }) === null, 'H — remarks');
ok(printedCode({ book: 'ballast', code: 'EXCH' }) === 'C.1' && printedCode({ book: 'ballast', code: 'UP' }) === 'A' && printedCode({ book: 'ballast', code: 'REM' }) === 'H', 'ballast prints the section letters');
ok(printedCode({ book: 'sewage', code: 'STP' }) === 'STP' && printedCode({ book: 'ballast', code: 'OLD' }) === 'OLD', 'other books and unknown codes print as stored');
ok(Object.values(BALLAST.codes).map((c) => c.print).join(' ') === 'A B C.1 C.2 D E F G H', 'sections in the form\'s order');
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
// The BWRB cover (BWM Appendix II): GT, IBWM Certificate, total capacity — on the ballast copy only.
const V = { vessel_name: 'DreamBoat', imo: '1234567', gross_tonnage: '499', ibwm_cert_no: 'BWM-123', bw_capacity: '85' };
ok(cover(BALLAST, V) === 'GT 499 · IBWM Certificate BWM-123 · Total ballast water capacity 85 m³ · Tank diagram: see the Ballast Water Management Plan', 'ballast copy prints the cover particulars');
ok(cover(SEWAGE, V) === '' && cover(BALLAST, null) === '', 'other books: no cover line');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
