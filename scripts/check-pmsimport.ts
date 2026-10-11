// npm run check:pmsimport — the maintenance plan read from the template.
import * as XLSX from 'xlsx';
import { EXAMPLE_ROWS, PLAN_HEAD, planImport, planRows, planWorkbook, sheetRows } from '../services/pmsImport';
import { Machine, PmsJob, hasCounter } from '../types/pms';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
let n = 0;
const id = (p: string) => `${p}${++n}`;

// An empty plan loads the examples: 3 systems, 4 jobs, system carried down.
const r1 = planImport([PLAN_HEAD, ...EXAMPLE_ROWS], [], [], id, 1);
ok(r1.addedSystems.length === 3 && r1.addedJobs === 4 && !r1.errors.length, `examples: ${r1.addedSystems.length} systems, ${r1.addedJobs} jobs, ${r1.errors.join(' | ')}`);
const me = r1.machines.find((m) => m.name === 'Main engine PS')!;
ok(me.critical === true && hasCounter(me) && me.maker === 'MTU', 'system details read');
ok(r1.jobs.filter((j) => j.machineId === me.id).length === 2, 'second row joins the system above');
const oil = r1.jobs.find((j) => j.title === 'Oil and filter change')!;
ok(oil.intervalHours === 500 && oil.intervalDays === 365 && oil.lastDoneDate === '2026-06-01' && oil.lastDoneHours === 11250 && oil.type === 'maintenance', 'job fields read');

// Loading the plan back changes nothing; a changed interval updates one job.
const machines: Machine[] = r1.machines, jobs: PmsJob[] = r1.jobs;
const back = planImport([PLAN_HEAD, ...planRows(machines, jobs)], machines, jobs, id, 2);
ok(back.machines.length === 0 && back.jobs.length === 0 && back.addedJobs === 0, 'the downloaded plan loads back with no changes');
const rows = planRows(machines, jobs).map((r) => (r[7] === 'Oil and filter change' ? r.map((c, i) => (i === 9 ? 250 : c)) : r));
const upd = planImport([PLAN_HEAD, ...rows], machines, jobs, id, 3);
ok(upd.updatedJobs === 1 && upd.jobs.length === 1 && upd.jobs[0].id === oil.id && upd.jobs[0].intervalHours === 250, 'changed interval updates the same job');

// Errors: hours on a system without a counter; no interval; names in another case match.
const bad = planImport([PLAN_HEAD,
  ['Safety', 'FIRE PUMP', '', '', '', '', '', 'Run test', '', 50, '', '', '', ''],
  ['', '', '', '', '', '', '', 'Packing check', '', '', '', '', '', ''],
  ['Kitchen', 'Galley', '', '', '', '', '', 'Hood filters', 'Visual', '', '30', '15.09.2026', '', ''],
], machines, jobs, id, 4);
ok(bad.errors.some((e) => /Hours counter/.test(e)), 'hours interval without a counter → error');
ok(bad.errors.some((e) => /Packing check\): give an interval/.test(e)), 'no interval → error');
ok(bad.errors.some((e) => /department “Kitchen”/.test(e)), 'unknown department → named');
const hood = bad.jobs.find((j) => j.title === 'Hood filters');
ok(!!hood && hood.lastDoneDate === '2026-09-15' && hood.type === 'visual', 'dd.mm.yyyy date and type by label');
ok(!bad.addedSystems.includes('FIRE PUMP'), 'system matched regardless of case');

// Through a real workbook (Excel dates).
const b64 = XLSX.write(planWorkbook(machines, jobs), { type: 'base64', bookType: 'xlsx' });
const rt = planImport(sheetRows(b64), machines, jobs, id, 5);
ok(rt.jobs.length === 0 && !rt.errors.length, `template round-trip through xlsx: ${rt.errors.join(' | ')}`);
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
