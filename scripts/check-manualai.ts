// npm run check:manualai — a maker's manual read by the AI adds or changes only what was ticked, on this machine's own jobs (plan AI-3).
import { applyManual, jobKeyIds, jobsForAi, machineForAi, makerNote, readManual } from '../services/manualAi';
import { TYPICAL_NOTE } from '../services/pmsWizard';
import { Machine, PmsJob } from '../types/pms';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const m: Machine = { id: 'g1', name: 'Generator No.1', dept: 'engineering', counter: true, maker: 'Kohler', model: '99EFOZ', updatedAt: 1 };
const jobs: PmsJob[] = [
  { id: 'j1', machineId: 'g1', title: 'Change oil and filter', intervalHours: 250, intervalDays: 365, notes: TYPICAL_NOTE, lastDoneDate: '2026-10-01', updatedAt: 1 },
  { id: 'j2', machineId: 'g1', title: 'Check V-belt', intervalHours: 500, notes: 'Belt 123-45', updatedAt: 1 },
  { id: 'j3', machineId: 'g1', title: 'Replace impeller', intervalDays: 365, updatedAt: 1 },
  { id: 'jx', machineId: 'g1', title: 'Old', intervalDays: 30, deleted: true, updatedAt: 1 },
  { id: 'jo', machineId: 'g1', title: 'Fix leak', oneOff: true, dueDate: '2026-12-01', updatedAt: 1 },
  { id: 'k1', machineId: 'other', title: 'Change oil and filter', intervalHours: 250, updatedAt: 1 },
];

const sent = jobsForAi('g1', jobs);
ok(sent.map((j) => j.key).join() === 'J1,J2,J3' && sent[0].hours === 250 && sent[0].days === 365, 'only the machine\'s live planned jobs, under J1…');
ok(!/2026|notes|Belt/.test(JSON.stringify(sent)) && JSON.stringify(machineForAi(m)) === '{"name":"Generator No.1","maker":"Kohler","model":"99EFOZ","counter":true}', 'no dates or notes go; the machine as name, maker, model, counter');
const ids = jobKeyIds('g1', jobs);

const r = readManual(m, jobs, {
  covers: 'yes', model: '99EFOZ, 125EFOZ',
  jobs: [
    { title: 'Change engine oil and filter', hours: 500, days: 365, type: 'maintenance', parts: 'Filter 359771', page: 42, key: 'J1' },
    { title: 'Check V-belt tension', hours: 500, key: 'J2' },
    { title: 'Replace oil filter', hours: 500, key: 'J1' },
    { title: 'Clean air filter', hours: 250, type: 'bogus', page: '43' },
    { title: 'Inspect exhaust', hours: null, days: null },
    { title: 'Check oil level', days: 1 },
    { title: 'Ghost', hours: 100, key: 'J9' },
    { title: 'replace  impeller', days: 730 },
    { title: 'Clean air filter', hours: 100 },
    { title: 'Absurd', hours: 2_000_000 },
    { title: '  ', hours: 10 },
  ],
}, ids);
const by = (t: string) => r.proposals.find((p) => p.title === t);
ok(r.same === 1 && !by('Check V-belt tension'), 'a job already at the maker\'s interval is counted, not offered');
ok(by('Change engine oil and filter')?.jobId === 'j1' && by('Change engine oil and filter')?.pick === true, 'a typical-interval job with another interval is offered as a change, ticked');
ok(by('Replace oil filter')?.jobId == null && by('Replace oil filter')?.pick === false, 'a second answer on the same plan job is a new job, not ticked');
ok(by('Clean air filter')?.jobId == null && by('Clean air filter')?.pick === true && by('Clean air filter')?.type == null, 'a new job is ticked; an unknown type is dropped; a repeated title keeps the first');
ok(by('Ghost')?.jobId == null, 'an invented key does not land on a job');
ok(by('replace impeller')?.jobId === 'j3' && by('replace impeller')?.pick === false, 'the same title matches without a key; a non-typical job is offered unticked');
ok(by('Check oil level')?.daily === true && by('Check oil level')?.pick === false, 'a daily check is offered unticked');
ok(r.noInterval.join() === 'Inspect exhaust,Absurd', 'no interval, or one out of range, is listed, not guessed');
ok(r.covers === 'yes' && r.model === '99EFOZ, 125EFOZ', 'covers and model kept');

// Hours on a machine without a counter cannot be counted.
const hull: Machine = { id: 'h', name: 'Davit', dept: 'deck', counter: false, updatedAt: 1 };
const rh = readManual(hull, [], { covers: 'maybe', jobs: [{ title: 'Grease sheaves', hours: 50 }, { title: 'Load test', hours: 500, days: 1825 }] });
ok(rh.covers === 'unclear' && rh.noInterval.join() === 'Grease sheaves' && rh.proposals[0].hours == null && rh.proposals[0].days === 1825, 'no counter: hours dropped; only hours = no interval');

// A job added since the manual was sent does not shift the keys.
const later: PmsJob[] = [{ id: 'j0', machineId: 'g1', title: 'Added later', intervalDays: 30, updatedAt: 2 }, ...jobs];
const rl = readManual(m, later, { jobs: [{ title: 'Check V-belt tension', hours: 400, key: 'J2' }] }, ids);
ok(rl.proposals[0].jobId === 'j2', 'keys stay on the jobs they were sent with');

// Applying: only the ticked, the change log is the screen's.
const picked = r.proposals.filter((p) => p.pick);
const out = applyManual(m, jobs, picked, 'Kohler 99EFOZ.pdf', (p) => `${p}-new`, 99);
const j1 = out.change.find((j) => j.id === 'j1')!;
ok(out.change.length === 1 && j1.intervalHours === 500 && j1.intervalDays === 365 && j1.lastDoneDate === '2026-10-01', 'a change keeps the job and its history, takes the maker\'s interval');
ok(j1.notes === "Maker's manual (Kohler 99EFOZ.pdf), p. 42 — Filter 359771", 'the typical note gives way to the maker\'s');
ok(out.add.length === 2 && out.add.every((j) => j.machineId === 'g1' && !j.lastDoneDate && j.id === 'job-new'), 'new jobs on this machine, no last done');
const j3 = applyManual(m, jobs, [{ id: 'x', title: 'Replace impeller', days: 730, jobId: 'j2', pick: true }], undefined, (p) => p, 1).change[0];
ok(j3.intervalHours == null && j3.intervalDays === 730 && j3.notes === "Belt 123-45\nMaker's manual", 'another note stays, the maker\'s after it; the plan\'s hours give way to the maker\'s days');
ok(applyManual(hull, [], [{ id: 'y', title: 'Grease', hours: 50, pick: true }], undefined, (p) => p, 1).add.length === 0, 'hours alone on a machine without a counter add nothing');
ok(makerNote({}) === "Maker's manual", 'the bare note');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
