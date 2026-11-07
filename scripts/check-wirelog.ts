// npm run check:wirelog — which items keep a rope log; wear, its rate and the discard date; length after cut and slip; age; a renewal; the Board; the papers' rows; rules, sync and words.
import { AHEAD_DAYS, diaOf, isWire, renewItem, slopePerDay, sortRopes, wireApplies, wireBoard, wireProblem, wireState } from '../services/wireLog';
import { entryLine, ropeRows } from '../services/wireRows';
import { buildBoard } from '../services/board';
import { LIFTING_KEYS } from '../constants/lifting';
import { en } from '../constants/i18n/en';
import { WIRE_FINDINGS, WIRE_KINDS, WIRE_RATINGS } from '../types/wireLog';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const I = (o: any = {}): any => ({ id: 'r1', category: 'mooring', type: 'Mooring line', marking: 'Fwd 1', diameter: '44 mm', material: 'Polyester / nylon', installedDate: '2025-01-01', ropeLength: 220, updatedAt: 1, ...o });
let n = 0;
const E = (o: any): any => ({ id: `e${++n}`, itemId: 'r1', by: 'Bosun', at: n, createdAt: n, updatedAt: n, ...o });
const TODAY = '2026-11-07';

// Which items.
ok(wireApplies(I(), LIFTING_KEYS) && wireApplies(I({ category: 'cranes', diameter: undefined }), LIFTING_KEYS), 'mooring and cranes keep a log, with or without a diameter');
ok(wireApplies(I({ category: 'deck_slings', diameter: '16mm' }), LIFTING_KEYS) && !wireApplies(I({ category: 'deck_slings', diameter: '' }), LIFTING_KEYS), 'other lifting gear: only with a diameter');
ok(!wireApplies(I({ category: 'lifebuoys', diameter: '20 mm' }), LIFTING_KEYS), 'never outside Lifting & Mooring');
ok(!isWire(I()) && isWire(I({ material: 'Galvanised steel' })) && isWire(I({ category: 'cranes', material: undefined, type: 'Hoist' })), 'fibre or wire by material, a crane\'s rope wire unless said otherwise');

// Diameters as marked.
ok(diaOf('44') === 44 && diaOf('11mm') === 11 && diaOf('Ø 28,5') === 28.5 && diaOf(' 64 mm ') === 64, 'diameter read from "44", "11mm", "Ø 28,5"');
ok(diaOf('1 1/2 in') === undefined && diaOf('2"') === undefined && diaOf('') === undefined && diaOf('n/a') === undefined, 'inches and nonsense: none, never converted');

// A new rope: nothing wrong, nominal and the assumed discard diameter.
const s0 = wireState(I(), [], TODAY);
ok(s0.level === 'ok' && s0.nominal === 44 && s0.discardAt === 39.6 && s0.discardAssumed, 'no entries: OK, discard at 10 % off the nominal, said to be assumed');
ok(wireState(I({ discardDia: 40 }), [], TODAY).discardAt === 40 && !wireState(I({ discardDia: 40 }), [], TODAY).discardAssumed, 'the item\'s discard diameter wins');
ok(s0.length === 220 && s0.cuts === 0 && s0.years === 1.8, 'length as fitted, age from installed');

// Wear: readings, the trend and the date.
const looks = [E({ kind: 'inspect', date: '2025-07-01', rating: 'good', diameterMm: 43 }), E({ kind: 'inspect', date: '2026-01-01', rating: 'fair', diameterMm: 42 }), E({ kind: 'inspect', date: '2026-07-01', rating: 'fair', diameterMm: 41 })];
const s1 = wireState(I(), looks, TODAY);
ok(s1.lastDia === 41 && s1.lossPct === 6.8, 'last reading and the share gone (41 of 44 = 6.8 %)');
ok(s1.mmPerYear === 2, 'losing 2 mm a year (nominal on the day fitted + three readings)');
ok(s1.discardOn! > '2027-03-01' && s1.discardOn! < '2027-04-01', `discard diameter reached in March 2027 at this rate (${s1.discardOn})`);
ok(s1.level === 'ok', '…more than 90 days off and under three quarters of the allowance: still OK');
ok(slopePerDay([{ day: 0, v: 44 }, { day: 10, v: 43 }]) === undefined, 'no trend from readings under 30 days apart');
const near = wireState(I(), [...looks, E({ kind: 'inspect', date: '2026-11-01', rating: 'fair', diameterMm: 40 })], TODAY);
ok(near.issues.includes('soon') && near.level === 'amber', 'discard diameter within 90 days → amber');
const at = wireState(I(), [...looks, E({ kind: 'inspect', date: '2026-11-01', rating: 'poor', diameterMm: 39.5 })], TODAY);
ok(at.issues.includes('diameter') && at.issues.includes('poor') && !at.issues.includes('soon') && at.level === 'red', 'at the discard diameter → red; "soon" not said as well');
ok(wireState(I(), [E({ kind: 'inspect', date: '2026-11-01', rating: 'discard' })], TODAY).issues[0] === 'discard', 'a look that says discard → red');
const quarter = wireState(I({ installedDate: undefined }), [E({ kind: 'inspect', date: '2026-11-01', rating: 'fair', diameterMm: 40.6 })], TODAY);
ok(quarter.issues.includes('nearDia') && quarter.mmPerYear === undefined, 'three quarters of the allowance gone, no trend (one reading) → amber nearDia');

// Cut and slip, length.
const cuts = [E({ kind: 'cutSlip', date: '2026-03-01', cutM: 10, end: 'outboard' }), E({ kind: 'cutSlip', date: '2026-09-01', cutM: 5.5, end: 'drum' })];
const s2 = wireState(I({ minLength: 200 }), cuts, TODAY);
ok(s2.length === 204.5 && s2.cuts === 2 && s2.cutTotal === 15.5, 'length after two cuts: 220 − 10 − 5.5');
ok(s2.issues.includes('nearLength') && s2.level === 'amber', 'within 10 % of the shortest length → amber');
ok(wireState(I({ minLength: 210 }), cuts, TODAY).issues.includes('length'), 'below the shortest length → red');
ok(wireState(I({ minLength: 200 }), [], TODAY).level === 'ok', 'exactly 10 % above the shortest length is not "close" (no rounding error)');
ok(wireProblem({ kind: 'cutSlip', date: TODAY, cutM: 300 }, 204.5) === 'cut' && wireProblem({ kind: 'cutSlip', date: TODAY, cutM: 2 }, 204.5) === null, 'a cut longer than what is left is refused');

// Age, brake.
ok(wireState(I({ retireYears: 1.5 }), [], TODAY).issues.includes('age'), 'past its years in service → red');
ok(wireState(I({ retireYears: 2 }), [], TODAY).issues.includes('nearAge'), `retiring within ${AHEAD_DAYS} days → amber`);
ok(wireState(I({ category: 'cranes' }), [E({ kind: 'brake', date: '2026-10-01', brakeOk: false, brakeLoad: '26 t' })], TODAY).issues.includes('brake'), 'a brake that did not hold → red');
ok(wireState(I(), [E({ kind: 'brake', date: '2026-10-01', brakeOk: false }), E({ kind: 'brake', date: '2026-10-02', brakeOk: true })], TODAY).level === 'ok', '…until a later test holds');

// Renewed: everything counts again from there.
const renewed = E({ kind: 'renewed', date: '2026-10-15', lengthM: 200, diaNew: 48, certNo: 'C-778' });
const s3 = wireState(I({ minLength: 210 }), [...looks, ...cuts, E({ kind: 'inspect', date: '2026-10-10', rating: 'discard', diameterMm: 39 }), renewed], TODAY);
ok(s3.since === '2026-10-15' && s3.nominal === 48 && s3.length === 200 && s3.cuts === 0 && s3.lastDia === undefined, 'after renewal: the new rope\'s diameter and length, old cuts and readings left behind');
ok(!s3.issues.includes('discard') && !s3.issues.includes('diameter') && s3.issues.includes('length'), '…the old discard is gone; a new rope shorter than the shortest length is still said');
const item2 = renewItem(I(), renewed, 99);
ok(item2.installedDate === '2026-10-15' && item2.diameter === '48 mm' && item2.ropeLength === 200 && item2.testCertNo === 'C-778' && item2.id === 'r1', 'renewal writes the new rope onto the item, same id');
ok(renewItem(I({ diameter: '44 mm' }), E({ kind: 'renewed', date: '2026-10-15', certNo: 'X' }), 1).diameter === '44 mm', '…only what was given changes');
ok(wireProblem({ kind: 'renewed', date: TODAY }) === 'renewed' && wireProblem({ kind: 'inspect', date: TODAY }) === 'rating' && wireProblem({ kind: 'inspect', date: TODAY, rating: 'good', diameterMm: -1 }) === 'diameter', 'forms: renewal needs a detail, a look a rating, a diameter a figure');
ok(wireProblem({ kind: 'brake', date: TODAY }) === 'brake' && wireProblem({ kind: 'lube', date: '7.11.2026' }) === 'date', '…a brake test whether it held, a date a real one');

// Order on the same day: by the signature.
const sameDay = wireState(I(), [E({ kind: 'inspect', date: '2026-11-01', rating: 'discard' }), E({ kind: 'inspect', date: '2026-11-01', rating: 'good' })], TODAY);
ok(sameDay.lastLook?.rating === 'good', 'two looks on one day: the later signature is the last look');

// Sorting and the Board.
const rows = sortRopes([{ name: 'B', state: s0 }, { name: 'A', state: at }, { name: 'C', state: near }]);
ok(rows.map((r) => r.name).join('') === 'ACB', 'red first, then amber, then the rest');
const items = [I(), I({ id: 'r2', marking: 'Aft 2' }), I({ id: 'ls', category: 'lifebuoys' })];
const log = [E({ itemId: 'r1', kind: 'inspect', date: '2026-11-01', rating: 'discard' }), E({ itemId: 'r2', kind: 'inspect', date: '2026-11-01', rating: 'poor' })];
const wb = wireBoard(items, log, TODAY, LIFTING_KEYS, (i) => i.marking ?? i.id);
ok(wb.red.join() === 'Fwd 1' && wb.amber.join() === 'Aft 2', 'Board: red and amber ropes by name');
const base: any = {
  on: (k: string) => ['wires', 'lifting'].includes(k), role: 'admin', me: null, today: TODAY, now: `${TODAY}T10:00`, labelOf: String, periodsOf: () => [],
  flat: items, certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [], wireLog: log,
};
const board = (role: string, on = (m: string) => m === 'wires' || m === 'lifting') => buildBoard({ ...base, role, on });
const keys = (b: any) => b.attention.map((x: any) => x.key);
const bo = board('admin');
ok(keys(bo).includes('wire:red') && keys(bo).includes('wire:amber'), 'officers see the red and the amber ropes');
ok(bo.attention.find((x: any) => x.key === 'wire:red')?.level === 'red' && bo.attention.find((x: any) => x.key === 'wire:red')?.route === 'WireLog', '…red opens Ropes and wires');
ok(!keys(board('user')).some((k: string) => k.startsWith('wire:')), 'crew do not');
ok(!keys(board('admin', (m) => m === 'lifting')).some((k: string) => k.startsWith('wire:')), 'flag off: nothing');

// Papers.
const pr = ropeRows([I()], looks, TODAY);
ok(pr.length === 1 && pr[0][3] === '44' && pr[0][5] === '6.8' && pr[0][6].includes('assumed') && pr[0][13] === 'OK', 'paper row: nominal, loss, assumed discard, status');
ok(entryLine(E({ kind: 'inspect', date: TODAY, rating: 'poor', diameterMm: 40, brokenWires: 3, findings: ['abrasion', 'kinks'], photos: [{ id: 'p' }] })) === 'POOR · 40 mm · 3 broken wires · abrasion / chafe, kinks · 1 photo', 'an entry in a line, in English');
ok(entryLine(E({ kind: 'cutSlip', date: TODAY, cutM: 5, end: 'drum' })) === '5 m cut at the drum end', '…cut and slip');

// Words: every kind, rating, finding and issue has its string; the rules know every kind.
const missing = [...WIRE_KINDS.map((k) => `rope.k.${k}`), ...WIRE_RATINGS.map((r) => `rope.r.${r}`), ...WIRE_FINDINGS.map((f) => `rope.f.${f}`),
  ...['discard', 'diameter', 'length', 'age', 'brake', 'poor', 'soon', 'nearDia', 'nearLength', 'nearAge'].map((i) => `rope.i.${i}`),
  ...['date', 'rating', 'diameter', 'cut', 'brake', 'renewed'].map((p) => `rope.need.${p}`)].filter((k) => !(k in en));
ok(!missing.length, `every kind, rating, finding, issue and form problem has a string${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);
const rules = readFileSync('firestore.rules', 'utf8');
const m = /match \/wire_log\/\{id\}[\s\S]*?kind in \[([^\]]+)\]/.exec(rules);
ok(!!m && JSON.stringify(m[1].split(',').map((s) => s.trim().replace(/'/g, ''))) === JSON.stringify(WIRE_KINDS), 'the rules list exactly the kinds');
ok(/match \/wire_log\/\{id\}[\s\S]*?allow update, delete: if false;/.test(rules), 'the rules: never changed, never deleted');
ok(/sub: 'wire_log', key: storage\.WIRE_LOG_KEY, appendOnly: true, module: 'wires'/.test(readFileSync('services/firebaseService.ts', 'utf8')), 'synced append-only under the flag');
ok(/wireLog/.test(readFileSync('services/backup.ts', 'utf8')) && /WIRE_LOG_KEY,/.test(readFileSync('services/storage.ts', 'utf8')), 'in the .msm backup and erased with the device');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
