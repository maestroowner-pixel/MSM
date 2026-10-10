// npm run check:garbage — MARPOL Annex V sea-discharge rules and month totals (services/garbage.ts).
import { garbageMonth, placeText, seaDischargeProblem } from '../services/garbage';
import { GarbageEntry } from '../types/garbage';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };

ok(seaDischargeProblem({ category: 'A', method: 'sea', distanceNm: 50 })!.includes('prohibited'), 'plastics into the sea: prohibited at any distance');
ok(seaDischargeProblem({ category: 'C', method: 'sea', distanceNm: 50 }) !== null, 'domestic waste into the sea: prohibited');
ok(seaDischargeProblem({ category: 'B', method: 'sea', distanceNm: 8 })!.includes('12 nm'), 'food waste 8 nm: too close (12 nm)');
ok(seaDischargeProblem({ category: 'B', method: 'sea', distanceNm: 8, comminuted: true }) === null, 'comminuted food waste 8 nm: allowed (3 nm)');
ok(seaDischargeProblem({ category: 'B', method: 'sea', distanceNm: 13 }) === null, 'food waste 13 nm: allowed');
ok(seaDischargeProblem({ category: 'G', method: 'sea', distanceNm: 60 })!.includes('100 nm'), 'carcass 60 nm: too close');
ok(seaDischargeProblem({ category: 'A', method: 'shore' }) === null && seaDischargeProblem({ category: 'A', method: 'accidental' }) === null, 'shore delivery and accidental loss: no sea-discharge rule');

const E = (o: Partial<GarbageEntry>): GarbageEntry => ({ id: o.id ?? 'x', date: '2026-10-05', time: '10:00', category: 'A', method: 'shore', volume: 0.5, by: 'x', at: 0, updatedAt: 0, ...o });
const m = garbageMonth([E({ id: '1', volume: 0.4 }), E({ id: '2', category: 'B', method: 'sea', volume: 0.2, date: '2026-10-02' }), E({ id: '3', volume: 0.35 }), E({ id: '4', date: '2026-09-30' })], '2026-10');
ok(m.entries.length === 3 && m.entries[0].id === '2', 'month: only October, in date order');
ok(m.totals.A.shore === 0.75 && m.totals.B.sea === 0.2 && m.total === 0.95, 'totals by category and method (m³)');
ok(placeText(E({ port: 'Palma' })) === 'Palma' && placeText(E({ position: "38°45'N 002°10'E", distanceNm: 14 })).endsWith('14 nm from land'), 'place: port, or position and distance');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
