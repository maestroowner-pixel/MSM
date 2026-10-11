// npm run check:pmshistory — a machine's history for the surveyor; open defects order.
import { machineHistory, openDefects, packMachines } from '../services/pmsHistory';
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
ok(work.rows.length === 1 && work.rows[0][3] === 'Tom Reed (C/E) · PIN' && work.rows[0][5] === '1' && /Defect raised/.test(work.rows[0][4]), 'work done: only this machine, signer, photo count, defect');
const dx = h.tables.find((t) => t.title === 'Defects')!;
ok(dx.rows[0][4] === 'OPEN' && /Gasket renewed/.test(dx.rows[1][4]), 'defects: open first, closed with rectification');
ok(!h.tables.some((t) => t.title === 'Deferrals'), 'no deferrals table when none');
ok(packMachines([gen, me]).map((m) => m.id).join() === 'm1', 'survey pack: critical machines');
ok(packMachines([gen]).length === 1, 'survey pack: all when none critical');
ok(openDefects(defects).map((d) => d.id).join() === 'x2,x3', 'open defects: safety first, then class');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
