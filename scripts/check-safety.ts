// npm run check:safety — NC states, numbers, register rows, and the board.
import { NC_HEAD, ncRows, ncState, nextNcNo, obsCounts, obsRows, sortNcs, sortObservations } from '../services/safety';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-10-12';
const N = (o: any): any => ({ id: 'n', no: 'NC-2026-001', date: '2026-10-01', source: 'internal_audit', grade: 'nc', title: 'Guard', what: 'Guard missing', actions: [], raisedBy: 'Jez', raisedAt: 1, updatedAt: 1, ...o });
const A = (o: any): any => ({ id: 'a', kind: 'corrective', text: 'Fit guard', owner: 'Bosun', due: '2026-10-20', ...o });

ok(ncState(N({}), T) === 'open', 'no actions yet = open');
ok(ncState(N({ actions: [A({})] }), T) === 'open', 'action not yet due = open');
ok(ncState(N({ actions: [A({ due: '2026-10-11' })] }), T) === 'overdue', 'action past its date = overdue');
ok(ncState(N({ actions: [A({ due: '2026-10-11', doneAt: 5 })] }), T) === 'ready', 'all done = ready to close');
ok(ncState(N({ closedAt: 9, actions: [A({ due: '2026-10-01' })] }), T) === 'closed', 'closed wins');

ok(nextNcNo([], '2026-10-12') === 'NC-2026-001', 'first of the year');
ok(nextNcNo([N({ no: 'NC-2026-007' }), N({ no: 'NC-2025-031' })], '2026-11-01') === 'NC-2026-008', 'next after the highest of the same year');
ok(nextNcNo([N({ no: 'NC-2026-007' })], '2027-01-03') === 'NC-2027-001', 'a new year starts again at 001');

const s = sortNcs([N({ id: 'c', closedAt: 1 }), N({ id: 'o', actions: [A({})] }), N({ id: 'x', actions: [A({ due: '2026-10-01' })] }), N({ id: 'r', actions: [A({ doneAt: 1 })] })], T);
ok(s.map((n) => n.id).join('') === 'xroc', 'order: overdue, to close, open, closed');

const so = sortObservations([{ id: '1', date: '2026-10-10', at: 1, reviewedAt: 2 } as any, { id: '2', date: '2026-10-01', at: 1 } as any]);
ok(so[0].id === '2', 'unreviewed cards first');

const rows = ncRows([N({ actions: [A({ doneAt: Date.parse('2026-10-05T10:00:00'), doneBy: 'Max', doneByRank: 'Deckhand' })], closedAt: Date.parse('2026-10-10T10:00:00'), closedBy: 'Liam', closedWith: { method: 'pin', at: 1 }, effectiveness: 'Checked on round' })], T);
ok(rows[0].length === NC_HEAD.length, 'register row has every column');
ok(/done 05\.10\.2026 Max \(Deckhand\)/.test(rows[0][7]), 'action line shows who did it and when');
ok(/signed by PIN/.test(rows[0][9]) && /Effective: Checked on round/.test(rows[0][9]), 'closure shows the signature and effectiveness');
const or = obsRows([{ id: 'o', date: '2026-10-02', kind: 'near_miss', topic: 'PPE', what: 'x', anonymous: true, at: 1, ncId: 'n', updatedAt: 1 } as any], [N({})]);
ok(or[0][7] === 'Anonymous' && or[0][9] === 'NC-2026-001' && or[0][8] === 'Not reviewed', 'anonymous card, linked NC, not reviewed');
const c = obsCounts([{ date: '2026-10-02', kind: 'near_miss' }, { date: '2026-10-03', kind: 'good_practice', stoppedWork: false }, { date: '2026-09-30', kind: 'near_miss' }] as any, '2026-10');
ok(c.total === 2 && c.near === 1 && c.good === 1, 'month counts');

const base: any = {
  on: (m: string) => m === 'qhse', role: 'superadmin', me: null, today: T, now: `${T}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [],
};
const b = buildBoard({ ...base, ncs: [N({ id: 'x', actions: [A({ due: '2026-10-01' })] }), N({ id: 'r', no: 'NC-2026-002', actions: [A({ doneAt: 1 })] })], observations: [{ id: 'o', date: T, kind: 'unsafe_act', at: 1 }] });
ok(b.attention.some((n) => n.key === 'nc:x' && n.level === 'red'), 'overdue action → red notice');
ok(b.attention.some((n) => n.key === 'nc:r' && /to close/.test(n.title)), 'ready → the Master is told to close');
ok(b.attention.some((n) => n.key === 'obs:new'), 'new card → officers are told');
ok(b.tiles.some((t) => t.key === 'qhse' && t.level === 'red' && /2 NC open/.test(t.line)), 'Safety tile red, 2 open');
const crewB = buildBoard({ ...base, role: 'user', ncs: [N({ id: 'r', actions: [A({ doneAt: 1 })] })], observations: [] });
ok(!crewB.attention.some((n) => n.key === 'nc:r'), 'crew are not told to close an NC');
ok(!buildBoard({ ...base, on: () => false }).tiles.some((t) => t.key === 'qhse'), 'module off → no tile');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
