// npm run check:makerlib — the makers' library (plan item 54): what a manual read leaves for every vessel, how a unit finds it, and what the wizard and a machine's screen make of it.
/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;
const L = require('../../functions/makerLibrary');
import { asManualReply, libraryJobs, libraryNote, pairOf, LIBRARY_CHECK, LibraryEntry } from '../services/makerLibrary';
import { readManual } from '../services/manualAi';
import { buildPlan, TYPICAL_NOTE, WizardAnswers } from '../services/pmsWizard';
import { Machine, PmsJob } from '../types/pms';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

// The key: one maker under its names, one model however it is typed.
const k = L.libraryKey;
ok(k('Caterpillar Inc.', 'C-32') === 'cat__c32' && k('CAT', 'C32') === 'cat__c32' && k('cat', 'CAT C32') === 'cat__c32', 'Caterpillar Inc. C-32 = CAT C32 = cat "CAT C32"');
ok(k('MTU Friedrichshafen GmbH', '16V 2000 M96') === 'mtu__16v2000m96' && k('mtu', '16V2000M96') === 'mtu__16v2000m96', 'MTU Friedrichshafen GmbH = MTU, spaces in the model do not matter');
ok(k('Kohler Power', '99 EFOZ') === k('Kohler', '99EFOZ') && k('Yanmar Marine', '6LY3') === 'yanmar__6ly3' && k('Volvo', 'D13') === k('Volvo Penta', 'D13'), 'Kohler Power = Kohler, Yanmar Marine = Yanmar, Volvo = Volvo Penta');
ok(k('Fischer Panda', '8000i') === k('FischerPanda', '8000 i') && k('Wärtsilä', '20') === 'wartsila__20', 'Fischer Panda however spaced; Wärtsilä without the accent');
ok(k('CAT', 'C32') !== k('CAT', 'C32 ACERT') && k('CAT', 'C18') !== k('CAT', 'C18A'), 'another model is another key (C32 ≠ C32 ACERT)');
ok(k('', 'C32') === null && k('CAT', '') === null && k('X', 'C32') === null && k('Diesel', 'C32') === 'diesel__c32', 'no maker, no model or one letter → no key; a maker word alone is kept');

// What a read leaves: only for this maker and model, only the maker's figures.
const machine = { name: 'Main engine PS', maker: 'Caterpillar', model: 'C32', counter: true };
const reply = {
  covers: 'yes', model: 'C32 ACERT, C32',
  jobs: [
    { title: 'Change engine oil and filter', hours: 500, days: 365, type: 'maintenance', parts: '1R-0739', page: 88, key: 'J1' },
    { title: 'change  engine oil and filter', hours: 250 },
    { title: 'Check valve lash', hours: 3000, type: 'bogus' },
    { title: 'Inspect hoses', hours: null, days: null },
    { title: 'Check oil level', days: 1 },
    { title: 'Absurd', hours: 9_000_000 },
  ],
  unreadable: 'Severe duty table not used',
};
const e = L.entryFromRead(machine, reply);
ok(!!e && e.key === 'cat__c32' && e.maker === 'Caterpillar' && e.manualModel === 'C32 ACERT, C32', 'a read for this model is kept under its key, with the models the manual names');
ok(e.jobs.length === 5 && e.jobs[0].page === '88' && e.jobs[0].parts === '1R-0739' && e.jobs[1].type === null && e.jobs[4].hours === null, 'a title once; a bad type or an absurd interval is dropped, not the job');
ok(!/Main engine PS|J1|unreadable|Severe/.test(JSON.stringify(e)), 'not the machine\'s name, the plan\'s keys or the remarks');
ok(L.entryFromRead(machine, { ...reply, covers: 'unclear' }) === null && L.entryFromRead(machine, { ...reply, covers: 'no' }) === null, 'a manual not clearly for this model is not kept');
ok(L.entryFromRead({ name: 'Generator', counter: true }, reply) === null, 'a machine with no maker or model leaves nothing');
ok(L.entryFromRead(machine, { covers: 'yes', jobs: [{ title: 'As required', hours: null, days: null }] }) === null, 'a read with no interval at all is no schedule');

// The store, against a small Firestore of its own.
function fakeDb() {
  const data: Record<string, any> = {};
  const doc = (path: string) => ({ path, id: path.split('/').pop() });
  const snap = (r: any) => ({ id: r.id, exists: r.path in data, data: () => (r.path in data ? JSON.parse(JSON.stringify(data[r.path])) : undefined) });
  return {
    data,
    doc,
    getAll: async (...refs: any[]) => refs.map(snap),
    runTransaction: async (fn: any) => fn({ get: async (r: any) => snap(r), set: (r: any, v: any, o: any) => { data[r.path] = o?.merge ? { ...(data[r.path] || {}), ...v } : v; } }),
  };
}
(async () => {
  const db = fakeDb();
  await L.remember(db, '1234567', machine, reply);
  const poor = { covers: 'yes', jobs: [{ title: 'Change oil', hours: 250 }] };
  await L.remember(db, '1234567', { ...machine, maker: 'CAT' }, poor);
  await L.remember(db, '9876543', { ...machine, model: 'C-32' }, poor);
  const st = db.data['maker_library/cat__c32'];
  ok(st.reads === 3 && st.vessels.length === 2 && st.jobs.length === 5, 'three reads on two vessels; a poorer read does not replace the fuller one');
  ok(!JSON.stringify(st).includes('1234567') && !JSON.stringify(st).includes('9876543'), 'the vessels are counted by a hash, never named');
  await L.remember(db, '1111111', machine, { covers: 'yes', jobs: [...reply.jobs, { title: 'Turbocharger inspection', hours: 6000 }] });
  ok(db.data['maker_library/cat__c32'].jobs.length === 6 && db.data['maker_library/cat__c32'].reads === 4, 'a fuller read replaces the jobs');
  ok(await L.remember(db, '1', { name: 'x' }, reply) === null && Object.keys(db.data).length === 1, 'nothing kept for a machine with no model');

  const r = await L.lookup(db, { units: [{ maker: 'Caterpillar', model: 'C 32' }, { maker: 'MTU', model: '2000' }, { maker: '', model: 'C32' }, { maker: 'cat', model: 'c32' }] });
  ok(r.found.length === 4 && r.found[0]?.key === 'cat__c32' && r.found[1] === null && r.found[2] === null && r.found[3]?.jobs.length === 6, 'one answer per unit, in order; unknown or blank → null');
  ok(r.found[0].vessels === 3 && !('reads' in r.found[0]) && !JSON.stringify(r).match(/[0-9a-f]{16}/), 'it says on how many vessels; the hashes stay on the server');
  ok((await L.lookup(db, {})).found.length === 0 && (await L.lookup(db, { units: Array(60).fill({ maker: 'CAT', model: 'C32' }) })).found.length === 40, 'at most 40 units a call');

  // The app's side: the wizard.
  const entry: LibraryEntry = { ...r.found[0] };
  const lj = libraryJobs(entry, true);
  ok(lj.jobs.length === 3 && lj.left === 3 && lj.jobs.every((j) => j.notes.includes("ISMpilot library, Caterpillar C32") && j.notes.endsWith(LIBRARY_CHECK)), 'the wizard takes jobs with an interval; no interval and the daily check are left out and counted');
  ok(libraryJobs(entry, false).jobs.length === 1 && libraryJobs(entry, false).jobs[0].days === 365 && !libraryJobs(entry, false).jobs[0].hours, 'with no counter only the calendar interval counts');
  ok(libraryNote({ page: '88', parts: '1R-0739' }, entry) === "Maker's manual (ISMpilot library, Caterpillar C32), p. 88 — 1R-0739. " + LIBRARY_CHECK, 'the note says where it came from');

  const pair = pairOf({ maker: 'Caterpillar', model: 'C32' })!;
  const a: WizardAnswers = {
    kind: 'motor', off: [], intervals: {},
    units: { engine: [{ name: 'Main engine PS', maker: 'Caterpillar', model: 'C32' }, { name: 'Main engine SB', maker: ' Caterpillar ', model: 'C32' }, { name: 'Wing engine', maker: 'Yanmar', model: '6LY3' }] },
    makers: { [pair]: entry },
  };
  let n = 0;
  const plan = buildPlan(a, [], (p) => `${p}${++n}`, '2026-11-08', 1);
  const of = (name: string) => plan.jobs.filter((j) => j.machineId === plan.machines.find((m) => m.name === name)!.id);
  ok(of('Main engine PS').length === 3 && of('Main engine SB').length === 3 && of('Main engine PS').every((j) => j.notes!.includes('ISMpilot library')), 'both units of the model take the maker\'s schedule, with its note');
  ok(of('Wing engine').length > 3 && of('Wing engine').every((j) => j.notes === TYPICAL_NOTE), 'a model the library does not know takes the typical list');
  ok(plan.fromLibrary.join() === 'Main engine PS,Main engine SB' && plan.libraryLeft === 3, 'the summary names the units; what was left out is counted once per model');
  const typical = buildPlan({ ...a, makers: {} }, [], (p) => `${p}${++n}`, '2026-11-08', 1);
  ok(typical.fromLibrary.length === 0 && typical.jobs.every((j) => j.notes === TYPICAL_NOTE), 'the model switched to the typical list: as before');

  // The app's side: a machine's screen compares its plan with the library.
  const m: Machine = { id: 'g', name: 'Main engine PS', dept: 'engineering', counter: true, maker: 'Caterpillar', model: 'C32', updatedAt: 1 };
  const have: PmsJob[] = [{ id: 'j1', machineId: 'g', title: 'Change engine oil and filter', intervalHours: 250, intervalDays: 365, notes: TYPICAL_NOTE, updatedAt: 1 }];
  const read = readManual(m, have, asManualReply(entry), [], { untickNew: true });
  const change = read.proposals.find((p) => p.jobId === 'j1');
  ok(!!change && change.hours === 500 && change.pick, 'the same title is offered as a change of interval, ticked over a typical figure');
  ok(read.proposals.filter((p) => !p.jobId).every((p) => !p.pick) && read.proposals.some((p) => !p.jobId), 'new jobs from the library are offered unticked — a job worded otherwise is not added twice');
  ok(readManual(m, [], asManualReply(entry), [], { untickNew: false }).proposals.filter((p) => !p.daily).every((p) => p.pick), 'a machine with no jobs yet: ticked as from a manual');

  console.log(bad ? `\n${bad} FAILED` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
