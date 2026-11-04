// npm run check:emissions — which rule applies, the CII line and rating against the IMO tables, a passage and its problems, the new year, the EU split, what is reported as a gap, the Board.
import { applicability, ciiFor, ciiLine, CF_CO2, CII_Z, emissionsYear, emptySplit, frozenOf, passagePart, passageProblem, statementDue, statementGaps, statementOf } from '../services/emissions';
import { buildBoard } from '../services/board';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const near = (a: number | undefined, b: number, d = 0.01) => a != null && Math.abs(a - b) <= d;
const V = (o: any = {}): any => ({ id: 'vessel', type: 'cruise', gt: 50000, commercial: 'yes', updatedAt: 1, ...o });
const P = (o: any = {}): any => ({ id: 'p1', fromPort: 'Barcelona', fromEu: true, toPort: 'Piraeus', toEu: true, depAt: '2026-03-01T08:00', faopAt: '2026-03-01T09:00', eospAt: '2026-03-04T09:00', arrAt: '2026-03-04T10:00', robDep: 100000, robArr: 80000, distanceNm: 1000, by: 'Anna', at: 1, updatedAt: 1, ...o });
const tank: any = { id: 't1', name: 'P', kind: 'diesel', order: 0, updatedAt: 1 };
const R = (date: string, l: number): any => ({ id: `rob_${date}`, date, tanks: { t1: l }, by: 'A', updatedAt: 1 });
const B = (date: string, litres: number, density?: number, o: any = {}): any => ({ id: `b${date}`, date, port: 'X', litres, density, into: { t1: litres }, by: 'A', updatedAt: 1, ...o });
const Y = (o: any = {}) => emissionsYear({ year: 2026, today: '2027-02-01', vessel: V(), tanks: [tank], readings: [R('2025-12-31', 200000), R('2026-12-31', 100000)], bunkers: [B('2026-02-01', 50000, 0.85)], passages: [P()], ...o });

// Which rule applies.
ok(applicability(undefined).dcs === 'unknown', 'no particulars: unknown');
ok(applicability(V({ gt: undefined })).cii === 'unknown', '…no tonnage: unknown');
const yacht = applicability(V({ type: 'yacht', gt: 4525, commercial: 'unsure' }));
ok(yacht.dcs === 'no' && yacht.cii === 'no' && yacht.mrv === 'no', 'a 4,525 GT yacht: none of them');
const big = applicability(V({ type: 'yacht', gt: 6000, commercial: 'unsure' }));
ok(big.dcs === 'applies' && big.cii === 'no' && big.mrv === 'check', 'a 6,000 GT yacht: DCS, no CII (not a CII type), MRV to check');
ok(applicability(V({ type: 'yacht', gt: 6000, commercial: 'no' })).mrv === 'no', '…private: no MRV');
ok(applicability(V({ type: 'yacht', gt: 6000, commercial: 'yes' })).mrv === 'applies', '…commercial: MRV');
const osv = applicability(V({ type: 'offshore', gt: 400 }));
ok(osv.mrv === 'applies' && osv.dcs === 'no' && osv.cii === 'no', 'offshore at 400 GT: MRV only');
ok(applicability(V({ type: 'offshore', gt: 399 })).mrv === 'no', '…399 GT: nothing');
ok(applicability(V({ type: 'generalCargo', gt: 3000 })).mrv === 'applies', 'general cargo at 3,000 GT: MRV');
ok(applicability(V({ type: 'tanker', gt: 3000 })).mrv === 'no', 'a tanker at 3,000 GT: no MRV');
ok(applicability(V({ gt: 5000 })).cii === 'applies', 'exactly 5,000 GT counts');

// The IMO tables.
ok(CII_Z[2026] === 11 && CII_Z[2027] === 13.625 && CII_Z[2030] === 21.5, 'Z factors');
ok(ciiLine('bulk', 0, 300000)!.capacity === 279000, 'bulk carrier capped at 279,000 DWT');
ok(ciiLine('lng', 0, 50000)!.capacity === 65000, 'small LNG carrier reads 65,000');
ok(ciiLine('vehicle', 60000)!.capacity === 57700, 'vehicle carrier capped at 57,700 GT');
ok(ciiLine('vehicle', 20000)!.a === 330, 'small vehicle carrier: its own line');
ok(ciiLine('generalCargo', 0, 10000)!.a === 588 && ciiLine('generalCargo', 0, 30000)!.a === 31948, 'general cargo: two lines at 20,000 DWT');
ok(ciiLine('tanker', 9000) === undefined, 'a tanker needs DWT, GT is not enough');
ok(ciiLine('yacht', 9000, 900) === undefined, 'no line for a yacht');
// Cruise, 50,000 GT, 2026: 930 x 50000^-0.383 x 0.89 = 13.13 g/GT-nm.
const c = ciiFor(V(), 2026, 10000, 15000)!;
ok(near(c.required, 13.13), `required CII worked by hand (${c.required.toFixed(3)})`);
ok(near(c.attained, 13.333), `attained = 10,000 t x 1e6 / (50,000 x 15,000) (${c.attained.toFixed(3)})`);
ok(c.rating === 'C', 'between the lower and the upper bound: C');
ok(ciiFor(V(), 2026, 5000, 15000)!.rating === 'A' && ciiFor(V(), 2026, 20000, 15000)!.rating === 'E', 'A and E');
const bound = ciiFor(V(), 2026, 10000, 15000)!;
ok(near(bound.bounds[0] / bound.required, 0.87) && near(bound.bounds[3] / bound.required, 1.16), 'the vectors of the type');
ok(ciiFor(V(), 2031, 10000, 15000) === undefined, 'no Z after 2030: no rating');
ok(ciiFor(V(), 2022, 10000, 15000) === undefined, '…nor before 2023');
ok(ciiFor(V(), 2026, 10000, 0) === undefined, 'no distance: no CII');

// A passage.
ok(passageProblem(P()) === null, 'a sound passage');
ok(passageProblem(P({ toPort: ' ' })) === 'ports', 'a port is needed');
ok(passageProblem(P({ faopAt: '2026-03-01' })) === 'times', 'a time is needed');
ok(passageProblem(P({ faopAt: '2026-03-01T07:00' })) === 'order', 'FAOP before leaving the berth');
ok(passageProblem(P({ eospAt: '2026-03-01T09:00' })) === 'order', 'EOSP must be after FAOP');
ok(passageProblem(P({ robArr: undefined })) === 'rob', 'ROB is needed');
ok(passageProblem(P({ distanceNm: 0 })) === 'distance', 'distance is needed');
const cross = P({ depAt: '2026-12-30T08:00', faopAt: '2026-12-30T09:00', eospAt: '2027-01-02T09:00', arrAt: '2027-01-02T10:00', robDep: 100, robArr: 40, distanceNm: 600 });
ok(passageProblem(cross) === 'yearEnd', 'over the new year: the 31 Dec figures are needed');
ok(passageProblem({ ...cross, arrAt: '2028-01-02T10:00', eospAt: '2028-01-02T09:00' }) === 'tooLong', 'two new years: no');
const x2 = { ...cross, yearEndRob: 70, yearEndNm: 250 };
ok(passageProblem(x2) === null, '…with them it is sound');
const a26 = passagePart(x2, 2026, [])!, a27 = passagePart(x2, 2027, [])!;
ok(a26.litres === 30 && a27.litres === 30, 'fuel split at the new year');
ok(a26.distance === 250 && a27.distance === 350, 'distance split');
ok(a26.hours === 39 && a27.hours === 33, 'hours split at midnight UTC');
ok(passagePart(x2, 2025, []) === undefined, 'another year: nothing');
ok(passagePart(P(), 2026, [B('2026-03-02', 500, 0.85)])!.litres === 20500, 'a bunker at sea is added to what was burnt');
ok(passagePart(P(), 2026, [B('2026-03-01', 500, 0.85), B('2026-03-04', 500, 0.85)])!.litres === 20000, 'a bunker on the first or last day is at the berth');
ok(passagePart(P({ robArr: 120000 }), 2026, [])!.suspect, 'more at the end than at the start: suspect');

// The year.
const y = Y();
ok(y.litres === 150000, `consumption from soundings and bunkers (${y.litres})`);
ok(near(y.tonnes, 127.5), `tonnes at the BDN density (${y.tonnes})`);
ok(near(y.co2, 127.5 * CF_CO2), 'CO2 x 3.206');
ok(near(y.ch4, 127.5 * 0.00005, 1e-6) && near(y.n2o, 127.5 * 0.00018, 1e-6), 'CH4 and N2O');
ok(y.distance === 1000 && y.hours === 72, 'distance and hours from the passages');
ok(Y({ bunkers: [B('2026-02-01', 50000, 0.85, { kind: 'petrol' })], readings: [R('2025-12-31', 200000), R('2026-12-31', 100000)] }).received === 0, "a tender's petrol is not ship's fuel");
ok(!!Y().cii, 'CII for a cruise ship');
ok(!Y({ vessel: V({ type: 'yacht' }) }).cii, 'no CII for a yacht');

// Density.
const w = Y({ bunkers: [B('2026-02-01', 1000, 0.8), B('2026-03-01', 3000, 0.9)] });
ok(near(w.density, 0.875, 1e-6) && w.densityFrom === 'year', 'litre-weighted');
const pre = Y({ bunkers: [B('2025-02-01', 1000, 0.84), B('2026-02-01', 1000)] });
ok(pre.density === 0.84 && pre.densityFrom === 'before', 'the last before the year, when the year has none');
ok(pre.gaps.some((g) => g.key === 'bunkerNoDensity'), '…and a bunker without one is said');
const none = Y({ bunkers: [B('2026-02-01', 1000)] });
ok(none.tonnes === undefined && none.co2 === undefined && none.gaps.some((g) => g.key === 'noDensity'), 'no density: no tonnes, never an assumed one');
const odd = Y({ bunkers: [B('2026-02-01', 1000, 845)] });
ok(odd.density === undefined && odd.gaps.some((g) => g.key === 'oddDensity'), 'kg/m3 typed for kg/L: left out and said');

// EU.
const leg = (id: string, from: string, fe: boolean, to: string, te: boolean, dep: string, arr: string, a: number, b: number): any => P({ id, fromPort: from, fromEu: fe, toPort: to, toEu: te, depAt: `${dep}T08:00`, faopAt: `${dep}T09:00`, eospAt: `${arr}T09:00`, arrAt: `${arr}T10:00`, robDep: a, robArr: b, distanceNm: 100 });
const eu = Y({ passages: [
  leg('a', 'Barcelona', true, 'Piraeus', true, '2026-03-01', '2026-03-03', 1000, 900),
  leg('b', 'Piraeus', true, 'Dubai', false, '2026-03-05', '2026-03-08', 880, 700),
  leg('c', 'Dubai', false, 'Muscat', false, '2026-03-10', '2026-03-11', 690, 660),
  leg('d', 'Muscat', false, 'Barcelona', true, '2026-03-12', '2026-03-16', 650, 500),
] }).mrv;
ok(eu.intra === 100 && eu.from === 180 && eu.to === 150, 'by the two ports');
ok(eu.berth === 20, 'at an EU berth, between arriving and leaving; not at a foreign one');
ok(eu.total === 450, 'a voyage between two foreign ports is outside');
const chain = Y({ passages: [leg('a', 'Barcelona', true, 'Piraeus', true, '2026-03-01', '2026-03-03', 1000, 900), leg('b', 'Limassol', true, 'Dubai', false, '2026-03-05', '2026-03-08', 880, 700)] });
ok(chain.gaps.some((g) => g.key === 'chain') && chain.mrv.berth === 0, 'a broken chain is said, no port-stay figure');

// Gaps.
const has = (k: string, o: any = {}) => Y(o).gaps.some((g) => g.key === k);
ok(!has('noFuel') && !has('noPassages'), 'nothing said of what is there');
ok(has('noFuel', { readings: [] }), 'no soundings');
ok(has('noPassages', { passages: [] }), 'no passages');
ok(has('badPassage', { passages: [P(), P({ id: 'p2', distanceNm: 0 })] }), 'a passage made incomplete by a correction');
ok(has('suspectPassage', { passages: [P({ robArr: 120000 })] }), 'a suspect passage');
ok(has('noOpening', { readings: [R('2026-03-01', 200000), R('2026-12-31', 100000)] }), 'no sounding before the first of the year');
ok(has('yearEnd', { readings: [R('2025-12-31', 200000), R('2026-12-20', 100000)] }), 'the year ended without a last sounding');
ok(!has('yearEnd', { today: '2026-12-25', readings: [R('2025-12-31', 200000), R('2026-12-20', 100000)] }), '…only once it has ended');
ok(has('gapDays'), 'days without a sounding');
ok(has('suspect', { readings: [R('2025-12-31', 100), R('2026-12-31', 900000)] }), 'negative consumption');
ok(has('seaNoPassage', { deck: [{ date: '2026-06-01', mode: 'sea', period: '08-12' }] }), 'a day at sea outside every passage');
ok(!has('seaNoPassage', { deck: [{ date: '2026-03-02', mode: 'sea', period: '08-12' }] }), '…inside one is fine');
ok(!has('seaNoPassage', { deck: [{ date: '2026-06-01', mode: 'port', period: 'port' }, { date: '2026-06-02', draft: true }] }), '…a port entry or a draft does not count');
ok(has('noTonnage', { vessel: V({ type: 'tanker', dwt: undefined }) }), 'CII type without its tonnage');

// The statement.
const st = (o: any = {}): any => ({ id: 's1', year: 2026, method: 'flow', split: { ...emptySplit(), main: { u: 100, n: 27.5 } }, frozen: frozenOf(y), by: 'Anna', at: 5, updatedAt: 5, ...o });
ok(statementGaps(y, undefined)[0].key === 'unsigned', 'not signed');
ok(statementGaps(y, st()).length === 0, 'signed and adding up');
ok(statementGaps(y, st({ split: { ...emptySplit(), main: { u: 50, n: 0 } } }))[0].key === 'splitOff', 'a split that does not add up');
ok(statementGaps(Y({ passages: [P({ distanceNm: 1100 })] }), st())[0].key === 'changed', 'records changed after the signature');
ok(statementOf([st({ id: 'a', at: 1 }), st({ id: 'b', at: 9 }), st({ id: 'c', year: 2025, at: 20 })], 2026).id === 'b', 'the newest of the year counts');
const psg = [P({ depAt: '2026-03-01T08:00', arrAt: '2026-03-04T10:00' })];
ok(statementDue(V(), [], psg, '2027-02-01')?.year === 2026 && !statementDue(V(), [], psg, '2027-02-01')?.late, 'due until 31 March');
ok(statementDue(V(), [], psg, '2027-04-01')?.late === true, 'late after it');
ok(statementDue(V(), [st()], psg, '2027-02-01') === null, 'signed: nothing');
ok(statementDue(V(), [], [], '2027-02-01') === null, 'no passages in the year: nothing owed');
ok(statementDue(V({ type: 'yacht', gt: 4525 }), [], psg, '2027-02-01') === null, 'below every threshold: nothing');

// The Board.
const base: any = {
  on: (k: string) => ['emissions', 'fuel'].includes(k), role: 'admin', me: null, today: '2027-02-01', now: '2027-02-01T10:00', labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
  emVessel: [V()], emPassages: psg, emStatements: [],
};
const note = (x: any = {}) => buildBoard({ ...base, ...x }).attention.find((n: any) => n.key === 'em:stmt');
ok(note()?.level === 'amber' && note()?.route === 'Emissions', 'Board: statement owed, amber to 31 March');
ok((note()?.params as any)?.year === 2026, '…opens the year it is about');
ok(note({ today: '2027-04-01', now: '2027-04-01T10:00' })?.level === 'red', '…red after it');
ok(!note({ emStatements: [st()] }), '…gone once signed');
ok(!note({ role: 'user' }), '…not on a crew device');
ok(!note({ on: (k: string) => k === 'fuel' }), '…not with the flag off');
ok(!note({ on: (k: string) => k === 'emissions' }), '…nor without fuel');
ok(!note({ emVessel: [V({ type: 'yacht', gt: 4525 })] }), '…nor below every threshold');

// English only on paper; rules and sync in place.
const src = readFileSync('services/emissionsReport.ts', 'utf8');
ok(!/\bt\(|\btk\(/.test(src), 'the report does not use t()');
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/em_passages/.test(rules) && /match \/em_statements/.test(rules) && /match \/em_vessel/.test(rules), 'rules for the three lists');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'em_passages'/.test(fb) && /sub: 'em_statements'/.test(fb) && /sub: 'em_vessel'/.test(fb), 'the three lists sync');

console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
process.exit(fail ? 1 : 0);
