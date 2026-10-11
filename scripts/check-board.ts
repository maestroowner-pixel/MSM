// npm run check:board — the notice board picks the right things from each module.
import { buildBoard, BoardInput } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const base = (o: Partial<BoardInput> = {}): BoardInput => ({
  on: () => true, role: 'superadmin', me: null, today, now: `${today}T13:00`, labelOf: (c) => String(c), periodsOf: () => ['monthly'],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], ...o,
});
const pm = (() => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)); return t.toISOString().slice(0, 7); })();
const item = (id: string, expiry: string): any => ({ id, category: 'fire_extinguishers', expiryDate: expiry, nextInspection: expiry });

let b = buildBoard(base({ flat: [item('a', plus(-3)), item('b', plus(10)), item('c', plus(200))] }));
const eq = b.attention.find((x) => x.key === 'eq:fire_extinguishers');
ok(!!eq && eq.level === 'red' && /1 expired, 1 due soon/.test(eq.title), 'register grouped by category: 1 expired, 1 due');
ok(b.plan.some((p) => p.key === 'round:monthly' && /0 of 3 done/.test(p.sub)), 'monthly round progress 0 of 3');
ok(b.tiles.some((t) => t.key === 'eq' && t.level === 'red'), 'LSA/FFE tile red');

b = buildBoard(base({ on: (m) => m === 'fuel', fuelTanks: [{ id: 't', name: 'P', order: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((x) => x.key === 'fuel:snd'), 'after noon, no sounding → notice');
ok(b.today.some((t) => t.key === 'fuel:snd' && !t.done), 'today: sounding not done');
ok(!b.tiles.some((t) => t.key === 'sec'), 'module off → no tile');

b = buildBoard(base({ on: (m) => m === 'surveys', surveys: [{ id: 's', name: 'Class annual', due: plus(20), before: 3, after: 0, repeat: 12, anniversary: true, order: 0, updatedAt: 0 }] as any }));
ok(b.plan.some((p) => p.key === 'sv:s') && b.attention.some((x) => x.key === 'sv:s:n'), 'survey window closing in 20 days → plan + notice');

b = buildBoard(base({ role: 'user', on: (m) => m === 'garbage' || m === 'security', garbage: [{ date: `${pm}-05`, method: 'shore' }] as any }));
ok(!b.attention.some((x) => x.key === 'grb:sign'), 'crew do not see the Master’s unsigned month');
ok(!b.attention.some((x) => x.key === 'isps:drill'), 'crew do not see officer items');
b = buildBoard(base({ role: 'superadmin', on: (m) => m === 'garbage', garbage: [{ date: `${pm}-05`, method: 'shore' }] as any }));
ok(b.attention.some((x) => x.key === 'grb:sign'), 'the Master sees it');
b = buildBoard(base({ role: 'user', on: (m) => m === 'pms', machines: [{ id: 'm', name: 'Steering gear', updatedAt: 0 }] as any, pmsJobs: [{ id: 'j', machineId: 'm', title: 'x', intervalDays: 30, lastDoneDate: plus(0), updatedAt: 0 }] as any, pmsDefects: [{ id: 'd', machineId: 'm', machineName: 'Steering gear', category: 'safety', description: 'Ram seal leaking', date: plus(0), by: 'x', at: 0, updatedAt: 0 }, { id: 'e', machineId: 'm', machineName: 'Steering gear', category: 'class', description: 'y', date: plus(0), by: 'x', at: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((a) => a.key === 'pms:defect-safety' && /Steering gear/.test(a.title)) && !b.attention.some((a) => a.key === 'pms:defect-class'), 'safety-critical defect shown to crew; class-affecting only to officers');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
