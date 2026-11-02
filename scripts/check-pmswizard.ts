// npm run check:pmswizard — the plan wizard (services/pmsWizard.ts).
import { CATALOGUE } from '../services/pmsCatalogue';
import { KIND_SYSTEMS, TYPICAL_NOTE, WizardAnswers, buildPlan, defaultCounts, jobKey, resize, systemsFor, unitNames } from '../services/pmsWizard';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
let seq = 0;
const newId = (p: string) => `${p}_${++seq}`;
const today = '2026-11-02';

// Every system a kind asks about is in the catalogue.
for (const [k, map] of Object.entries(KIND_SYSTEMS)) {
  const missing = Object.keys(map).filter((key) => !CATALOGUE.some((c) => c.key === key));
  ok(!missing.length, `${k}: every system is in the catalogue${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);
}
const s = systemsFor('sail');
ok(s.asked.some((c) => c.key === 'rig') && s.more.some((c) => c.key === 'me_large') && s.asked.length + s.more.length === CATALOGUE.length, 'sail: rig asked, merchant main engine under More, nothing lost');

ok(unitNames('engine', 2).join() === 'Main engine PS,Main engine SB', 'two main engines: PS / SB');
ok(unitNames('engine', 3).join() === 'Main engine PS,Main engine CL,Main engine SB', 'three: PS / CL / SB');
ok(unitNames('generator', 1).join() === 'Generator' && unitNames('generator', 2).join() === 'Generator No.1,Generator No.2', 'generators: one plain, more numbered');
ok(unitNames('thruster', 2).join() === 'Bow thruster,Stern thruster', 'two thrusters: bow and stern');
ok(unitNames('me_large', 1).join() === 'Main engine', 'merchant main engine named without the description');
ok(unitNames('watermaker', 0).length === 0, 'none fitted: no units');

let u = resize('generator', 1);
u = resize('generator', 2, u);
ok(u.map((x) => x.name).join() === 'Generator No.1,Generator No.2', 'adding a second generator renames the default first one');
u = resize('generator', 3, [{ name: 'Harbour gen', maker: 'Kohler' }, { name: 'Generator No.2' }]);
ok(u[0].name === 'Harbour gen' && u[0].maker === 'Kohler' && u[1].name === 'Generator No.2' && u[2].name === 'Generator No.3', 'a typed name and maker are kept when the count changes');
ok(resize('generator', 1, u).length === 1 && resize('generator', 1, u)[0].name === 'Harbour gen', 'lowering the count keeps the first units');

const counts = defaultCounts('motor');
const units = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, resize(k, n)]));
units.engine[0] = { ...units.engine[0], maker: ' MTU ', model: '16V2000 M96L', hours: 4120 };
units.steering[0] = { name: '  ' };
const a: WizardAnswers = {
  kind: 'motor', units,
  off: [jobKey('engine', 'Valve clearances check')],
  intervals: { [jobKey('engine', 'Engine oil and oil filter change')]: { hours: 500, days: 365 }, [jobKey('hull', CATALOGUE.find((c) => c.key === 'hull')!.jobs[0].title)]: {} },
};
const have: any[] = [{ id: 'm0', name: 'generator no.1', updatedAt: 0 }, { id: 'm9', name: 'Bow thruster', scrapped: { date: today, reason: 'x', by: 'M' }, updatedAt: 0 }];
const p = buildPlan(a, have, newId, today, 1);
const me = p.machines.find((m) => m.name === 'Main engine PS')!;
ok(!!me && me.maker === 'MTU' && me.model === '16V2000 M96L' && me.hours === 4120 && me.hoursDate === today && me.counter === true, 'unit details trimmed onto the machine, counter now dated today');
const meJobs = p.jobs.filter((j) => j.machineId === me.id);
const eng = CATALOGUE.find((c) => c.key === 'engine')!;
ok(meJobs.length === eng.jobs.length - 1 && !meJobs.some((j) => j.title === 'Valve clearances check'), 'a job left out is left out of every engine');
const oil = meJobs.find((j) => j.title === 'Engine oil and oil filter change')!;
ok(oil.intervalHours === 500 && !oil.notes, 'changed interval used, and the job no longer says "typical"');
ok(meJobs.find((j) => j.title === 'Fuel filters (primary and secondary)')!.notes === TYPICAL_NOTE, 'unchanged job keeps the typical note');
const sb = p.machines.find((m) => m.name === 'Main engine SB')!;
ok(p.jobs.filter((j) => j.machineId === sb.id).find((j) => j.title === 'Engine oil and oil filter change')!.intervalHours === 500, 'the change applies to both engines');
ok(p.skipped.join() === 'Generator No.1', 'a unit already on the plan (any case) is skipped');
ok(p.machines.some((m) => m.name === 'Bow thruster'), 'a scrapped machine\'s name may be used again');
ok(!p.machines.some((m) => !m.name.trim()), 'a unit with no name is not added');
const hullM = p.machines.find((m) => m.dept === 'hull')!;
ok(p.jobs.filter((j) => j.machineId === hullM.id).length === CATALOGUE.find((c) => c.key === 'hull')!.jobs.length - 1, 'a job with both intervals blanked is not created');
const nav = p.machines.find((m) => m.name === 'Navigation equipment')!;
ok(!!nav && p.jobs.filter((j) => j.machineId === nav.id).every((j) => j.intervalHours == null), 'no hours interval on a system without a counter');
ok(p.machines.find((m) => m.name === 'Tender')?.dept === 'deck' && p.machines.every((m) => !!m.dept), 'machines carry their system\'s department');
ok(new Set([...p.machines.map((m) => m.id), ...p.jobs.map((j) => j.id)]).size === p.machines.length + p.jobs.length, 'ids unique');
ok(p.jobs.every((j) => p.machines.some((m) => m.id === j.machineId)), 'every job belongs to a machine added');

const again = buildPlan(a, [...have, ...p.machines], newId, today, 2);
ok(again.machines.length === 0 && again.jobs.length === 0, 'run again on the same plan: nothing added');

const crit = buildPlan({ kind: 'merchant', units: { steering_merchant: resize('steering_merchant', 1) }, off: [], intervals: {} }, [], newId, today, 3);
ok(crit.machines[0].critical === true, 'critical by default from the catalogue');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
