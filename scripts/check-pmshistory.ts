// npm run check:pmshistory — a machine's history for the surveyor; open defects order.
import { classPack, machineHistory, openDefects, packMachines } from '../services/pmsHistory';
import { Machine, PmsDefect, PmsDone, PmsJob } from '../types/pms';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const me: Machine = { id: 'm1', name: 'Main engine PS', dept: 'engineering', critical: true, maker: 'MTU', model: '16V', serial: 'S1', hours: 1000, hoursDate: '2026-10-10', updatedAt: 1 };
const gen: Machine = { id: 'm2', name: 'Generator', dept: 'engineering', updatedAt: 1 };
const jobs: PmsJob[] = [{ id: 'j1', machineId: 'm1', title: 'Oil change', type: 'maintenance', intervalHours: 500, lastDoneHours: 400, lastDoneDate: '2026-05-01', updatedAt: 1 }];
const done: PmsDone[] = [
  { id: 'd1', jobId: 'j1', machineId: 'm1', jobTitle: 'Oil change', machineName: 'Main engine PS', date: '2026-05-01', hours: 400, by: 'Tom Reed', byRank: 'C/E', at: 1, signedWith: { method: 'pin', at: 1 } as any, photos: [{ id: 'p', kind: 'photo', uri: 'x', addedAt: 1 }], defectId: 'x1', updatedAt: 1 },
  { id: 'd2', jobId: 'j9', machineId: 'm2', jobTitle: 'Other', machineName: 'Generator', date: '2026-05-02', by: 'X', at: 2, updatedAt: 2 },
];
const defects: PmsDefect[] = [
  { id: 'x1', machineId: 'm1', machineName: 'Main engine PS', category: 'operational', description: 'Weep at cooler', date: '2026-05-01', by: 'Tom Reed', at: 1, closed: { date: '2026-05-03', note: 'Gasket renewed', by: 'Tom Reed', at: 3 }, updatedAt: 3 },
  { id: 'x2', machineId: 'm1', machineName: 'Main engine PS', category: 'safety', description: 'Hot spot on exhaust', date: '2026-10-01', by: 'Ana', at: 5, updatedAt: 5 },
  { id: 'x3', machineId: 'm2', machineName: 'Generator', category: 'class', description: 'Mount cracked', date: '2026-09-01', by: 'Ana', at: 4, updatedAt: 4 },
];
const h = machineHistory(me, jobs, done, [], defects, '2026-10-11');
ok(h.facts.includes('CRITICAL EQUIPMENT') && h.facts.some((f) => f.includes('S/N S1')), 'facts name the machine');
const planned = h.tables.find((t) => t.title === 'Planned jobs')!;
ok(planned.rows[0][4] === 'OVERDUE' && /100 h overdue/.test(planned.rows[0][5]), `oil change overdue by 100 h: ${planned.rows[0].join(' | ')}`);
const work = h.tables.find((t) => t.title === 'Work done')!;
ok(work.rows.length === 1 && work.rows[0][5] === 'Tom Reed (C/E) · signed by PIN' && work.rows[0][7] === '1' && /Defect raised/.test(work.rows[0][6]), 'work done: only this machine, signer, photo count, defect');
const dx = h.tables.find((t) => t.title === 'Defects')!;
ok(dx.rows[0][4] === 'OPEN' && /Gasket renewed/.test(dx.rows[1][4]), 'defects: open first, closed with rectification');
ok(!h.tables.some((t) => t.title === 'Deferrals'), 'no deferrals table when none');
ok(packMachines([gen, me]).map((m) => m.id).join() === 'm1', 'survey pack: critical machines');
ok(packMachines([gen]).length === 1, 'survey pack: all when none critical');
ok(openDefects(defects).map((d) => d.id).join() === 'x2,x3', 'open defects: safety first, then class');
// The class survey pack.
{
  const ms: Machine[] = [
    { id: 'c1', name: 'Steering gear', classItem: true, classCode: 'SG-01', critical: true, counter: false, updatedAt: 1 },
    { id: 'c2', name: 'Fire pump', updatedAt: 1, counter: false },
    { id: 'c3', name: 'Old pump', classItem: true, classCode: 'P-9', scrapped: { date: '2026-01-01', reason: 'x', by: 'y' }, updatedAt: 1 },
  ];
  const js: PmsJob[] = [
    { id: 'a', machineId: 'c1', title: 'Function test', intervalDays: 30, lastDoneDate: '2026-08-01', updatedAt: 1 },
    { id: 'b', machineId: 'c2', title: 'Capacity test', intervalDays: 365, lastDoneDate: '2026-01-01', classJob: true, updatedAt: 1 },
    { id: 'c', machineId: 'c2', title: 'Gland', intervalDays: 30, lastDoneDate: '2026-09-30', updatedAt: 1 },
    { id: 'd', machineId: 'c3', title: 'Old job', intervalDays: 30, lastDoneDate: '2020-01-01', updatedAt: 1 },
  ];
  const dn: PmsDone[] = [
    { id: 'x', jobId: 'a', machineId: 'c1', jobTitle: 'Function test', machineName: 'Steering gear', date: '2026-08-01', by: 'C/E', at: 1, updatedAt: 1 },
    { id: 'y', jobId: 'srv1', machineId: 'c2', jobTitle: 'Seal renewed', machineName: 'Fire pump', date: '2026-09-01', by: '2/E', unplanned: true, at: 2, updatedAt: 2 } as any,
    { id: 'z', jobId: 'c', machineId: 'c2', jobTitle: 'Gland', machineName: 'Fire pump', date: '2025-01-01', by: '2/E', at: 0, updatedAt: 0 },
  ];
  const p = classPack(ms, js, dn, [], [], '2026-10-15', '2025-10-15');
  ok(p.length === 3, 'three pages');
  ok(p[0].tables[0].rows.map((r) => r[0]).join() === 'SG-01', 'class items: live ones only, by code (scrapped left out)');
  ok(p[0].tables[1].rows.map((r) => r[2]).join() === 'Function test (critical),Capacity test', 'class jobs: on a class item, or marked class');
  ok(p[1].tables[0].rows.map((r) => r[2]).join() === 'Function test (critical)', 'overdue: every job overdue, not only class');
  ok(p[2].tables[0].rows.map((r) => r[3]).join() === 'Function test' && p[2].tables[1].rows.map((r) => r[3]).join() === 'Unplanned: Seal renewed', 'in the period: class jobs done; corrective / unplanned work');
}
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
