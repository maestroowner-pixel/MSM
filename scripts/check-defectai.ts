// npm run check:defectai — a machinery defect diagnosed by the AI: what goes (no names, no signers), keys that are ours only (plan AI-6).
import { checksAsNotes, defectForAi, faultJobTitle, readDiagnosis, sisters } from '../services/defectAi';
import { peopleOf } from '../services/incidentAi';
import { Machine, PmsDefect, PmsDone, PmsJob } from '../types/pms';
import { SparePart } from '../types/spares';
import { OilPoint, OilSample } from '../types/oil';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const today = '2026-11-06';
const people = peopleOf({ crew: [{ name: 'Ivan Petrov', rank: '2nd Engineer' }, { name: 'Anna Berg', rank: 'Chief Engineer' }] });
const mc = (p: Partial<Machine>): Machine => ({ id: 'x', name: 'x', updatedAt: 1, ...p });
const ps = mc({ id: 'ps', name: 'Generator PS', maker: 'Kohler', model: '99EFOZ', counter: true, hours: 12000, critical: true, readings: [{ date: '2026-10-01', hours: 11500 }, { date: '2026-11-01', hours: 12000 }] });
const sb = mc({ id: 'sb', name: 'Generator SB', maker: 'kohler ', model: '99efoz', counter: true, hours: 11000 });
const other = mc({ id: 'fp', name: 'Fire pump', maker: 'Kohler' });
const gone = mc({ id: 'old', name: 'Generator old', maker: 'Kohler', model: '99EFOZ', deleted: true });
const machines = [ps, sb, other, gone];
ok(sisters(ps, machines).map((m) => m.id).join() === 'sb', 'a sister is the same maker and model, any case, not deleted; no model = none');
ok(sisters(other, machines).length === 0, 'a machine with no model has no sisters');

const df = (p: Partial<PmsDefect>): PmsDefect => ({ id: 'd', machineId: 'ps', machineName: 'Generator PS', category: 'operational', description: '', date: '2026-01-01', by: 'Ivan Petrov', byRank: '2nd Engineer', at: 1, updatedAt: 1, ...p });
const open = df({ id: 'now', date: '2026-11-01', description: 'High exhaust temp cyl 3, Ivan noticed at 0400', category: 'class', awaitingSpares: { since: '2026-11-02' }, outOfService: { from: '2026-11-03', by: 'Anna Berg', at: 2 }, office: { result: 'returned', note: 'Ask Anna Berg for the photo', by: 'Super', at: 3 } });
const defects = [
  open,
  df({ id: 'a', date: '2026-03-01', description: 'Exhaust temp high cyl 3', closed: { date: '2026-03-04', note: 'Injector 3 replaced by Petrov', by: 'Anna Berg', at: 4 } }),
  df({ id: 'b', machineId: 'sb', machineName: 'Generator SB', date: '2026-08-01', description: 'Coolant leak' }),
  df({ id: 'c', machineId: 'fp', machineName: 'Fire pump', date: '2026-09-01', description: 'Gland leak' }),
];
const done: PmsDone[] = [
  { id: 'w1', jobId: 'j1', machineId: 'ps', jobTitle: 'Injectors overhaul', machineName: 'Generator PS', date: '2026-02-01', hours: 10000, by: 'Ivan Petrov', at: 5, note: 'Ivan found nozzle 3 dribbling', conditionBefore: 'fair', conditionAfter: 'good', updatedAt: 5 },
  { id: 'w2', jobId: 'j2', machineId: 'ps', jobTitle: 'Oil change', machineName: 'Generator PS', date: '2026-10-01', by: 'Anna Berg', at: 6, cancelled: true, updatedAt: 6 },
  { id: 'w3', jobId: 'j9', machineId: 'sb', jobTitle: 'Oil change', machineName: 'Generator SB', date: '2026-10-01', by: 'Anna Berg', at: 7, updatedAt: 7 },
];
const jobs: PmsJob[] = [
  { id: 'j1', machineId: 'ps', title: 'Injectors overhaul', intervalHours: 1500, lastDoneHours: 10000, lastDoneDate: '2026-02-01', updatedAt: 1 },
  { id: 'j2', machineId: 'ps', title: 'Air filter', intervalDays: 180, updatedAt: 1 },
  { id: 'j3', machineId: 'ps', title: 'Removed job', intervalDays: 30, deleted: true, updatedAt: 1 },
  { id: 'j9', machineId: 'sb', title: 'Oil change', intervalHours: 500, updatedAt: 1 },
];
const spares: SparePart[] = [
  { id: 'p1', name: 'Injector nozzle', partNo: 'K-123', machineIds: ['ps', 'sb'], minQty: 2, updatedAt: 1 },
  { id: 'p2', name: 'Exhaust gasket', machineIds: ['ps'], updatedAt: 1 },
  { id: 'p3', name: 'Pump seal', machineIds: ['fp'], updatedAt: 1 },
  { id: 'p4', name: 'Old part', machineIds: ['ps'], deleted: true, updatedAt: 1 },
];
const stock = new Map([['p1', 1], ['p2', 4]]);
const oilPoints = [{ id: 'o1', machineId: 'ps', name: 'PS sump', compartment: 'engine', updatedAt: 1 } as unknown as OilPoint];
const oilSamples = [
  { id: 's1', pointId: 'o1', date: '2026-09-01', result: { date: '2026-09-10', values: { fuelDilution: 6 }, labVerdict: 'caution', labComment: 'Fuel dilution' }, updatedAt: 1 } as unknown as OilSample,
  { id: 's2', pointId: 'o1', date: '2026-10-01', updatedAt: 1 } as unknown as OilSample,
];

const { input, keys, replaced } = defectForAi({ defect: open, machine: ps, machines, defects, done, jobs, deferrals: [], spares, stock, oilPoints, oilSamples, people, today }, 'Anna says it smokes white');
const sent = JSON.stringify(input);
ok(!/Ivan|Petrov|Anna|Berg|"by"|Super/.test(sent), 'no names and no signers anywhere in what goes');
ok(input.defect.what.includes('[2nd Engineer] noticed') && input.seen === '[Chief Engineer] says it smokes white' && input.defect.returnedByOffice === 'Ask [Chief Engineer] for the photo', 'names in the defect, the office note and what is seen become ranks');
ok(replaced === 5, `names counted (${replaced})`);
ok(input.defect.daysOpen === 5 && input.defect.outOfServiceDays! >= 3 && input.defect.awaitingSpares === true && input.defect.category === 'class', 'the defect: days open, out of service, waiting for spares, category');
ok(input.machine.sisters?.join() === 'Generator SB' && input.machine.critical === true && input.machine.hoursPerDay === 16.1, 'the machine: sisters, critical, hours a day');
ok(keys.defects.join() === 'a,b' && input.past[0].key === 'D1' && !input.past[0].on && input.past[1].on === 'Generator SB', 'earlier defects: its own first, then a sister\'s; not this one, not another machine');
ok(input.past[0].fix === 'Injector 3 replaced by [2nd Engineer]' && input.past[0].daysOpen === 3, 'how it was put right goes, names as ranks');
ok(keys.work.join() === 'w1' && input.work[0].note === '[2nd Engineer] found nozzle 3 dribbling' && input.work[0].condition === 'fair → good', 'work: this machine only, a cancelled sign-out does not go');
ok(keys.jobs.join() === 'j1,j2' && input.jobs[0].state === 'overdue' && input.jobs[1].state === 'never done' && input.jobs[0].every === '1500 h', 'jobs: this machine, not deleted, the state in English');
ok(keys.parts.join() === 'p1,p2' && input.parts[0].stock === 1 && input.parts[1].stock === 4 && input.parts[0].min === 2, 'parts that fit it, not deleted, with stock');
ok(input.oil.length === 1 && input.oil[0].verdict === 'caution' && input.oil[0].findings.some((f) => /Fuel dilution/.test(f)), 'oil: results only, with their verdict and findings');

const nothing = defectForAi({ defect: df({ id: 'z', machineId: 'fp', description: 'Noise' }), machine: other, machines, defects: [], done: [], jobs: [], deferrals: [], spares: [], stock: new Map(), people: [], today });
ok(!nothing.input.seen && !nothing.input.machine.sisters && nothing.input.past.length === 0 && nothing.input.oil.length === 0, 'a machine with no records sends an empty picture, no "seen"');

const dg = readDiagnosis({
  summary: 'Injector 3 again.',
  causes: [{ cause: 'Injector 3 dribbling', why: 'Same as D1', likely: 'high', refs: ['D1', 'W1', 'D9', 'X1', 'D1'] }, { cause: '', why: 'empty' }, { cause: 'Exhaust valve', likely: 'bogus', refs: 'D2' }],
  checks: [{ step: 'Check exhaust temperatures across cylinders', look: 'Cyl 3 > 50 °C above the rest', safety: '', refs: ['J1'] }, { step: 'Pull injector 3 and pop-test it', look: 'Opening pressure, spray', safety: 'Stop and isolate the engine, fuel off', refs: [] }, { step: '' }],
  parts: [{ key: 'P1', why: 'If the nozzle is worn' }, { key: 'P1', why: 'again' }, { key: 'P7', name: 'Invented' }, { key: null, name: 'Fuel injection pump element', why: 'If the pump' }, { key: 'P2' }],
  similar: [{ key: 'D1', why: 'Same cylinder' }, { key: 'D1' }, { key: 'D5' }, { key: 'W1' }],
  jobs: [{ key: 'J1', why: 'Overdue by 500 h' }, { key: 'J7' }],
  stop: '',
  missing: ['Exhaust temps of all cylinders?', '', 42],
}, keys, { defects, jobs, spares, stock });
ok(dg.causes.length === 2 && dg.causes[0].refs.map((r) => r.key).join() === 'D1,W1' && dg.causes[1].likely === 'medium' && dg.causes[1].refs.length === 0, 'causes: empty dropped, made-up keys and repeats dropped, unknown likelihood → medium, refs must be a list');
ok(dg.causes[0].refs[0].id === 'a' && dg.causes[0].refs[1].kind === 'work' && dg.causes[0].refs[1].id === 'w1', 'a key resolves to the record sent under it');
ok(dg.checks.length === 2 && dg.checks[0].refs[0].id === 'j1' && dg.checks[1].safety.startsWith('Stop and isolate'), 'checks kept in order with their safety note; an empty step dropped');
ok(dg.parts.length === 3 && dg.parts[0].id === 'p1' && dg.parts[0].low === true && dg.parts[1].id === undefined && dg.parts[1].name === 'Fuel injection pump element' && dg.parts[2].id === 'p2' && dg.parts[2].low === false, 'parts: ours with stock (low at or below the minimum), one not in the list by name; a made-up key and a repeat dropped');
ok(dg.similar.length === 1 && dg.similar[0].id === 'a' && dg.similar[0].why === 'Same cylinder', 'similar: an earlier defect by a key sent, once; a work key is not a defect');
ok(dg.jobs.length === 1 && dg.jobs[0].id === 'j1', 'jobs: only keys sent');
ok(dg.missing.length === 1 && dg.stop === '', 'empty and non-text questions dropped');

const later = readDiagnosis({ similar: [{ key: 'D1' }], jobs: [{ key: 'J2' }] }, keys, { defects: defects.filter((x) => x.id !== 'a'), jobs: jobs.map((j) => (j.id === 'j2' ? { ...j, deleted: true } : j)), spares, stock });
ok(later.similar.length === 0 && later.jobs.length === 0, 'a waited reply: a record gone since is not shown');

const notes = checksAsNotes(dg);
ok(notes.startsWith('Fault finding, drafted by the AI') && notes.includes('\n1. Check exhaust temperatures across cylinders — Cyl 3 > 50 °C above the rest') && notes.includes('2. Pull injector 3 and pop-test it — Opening pressure, spray Safety: Stop and isolate'), 'the checks as job notes, numbered, with the safety note');
ok(faultJobTitle(open) === 'Fault finding: High exhaust temp cyl 3, Ivan noticed at 0400', 'the job title from the defect');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
