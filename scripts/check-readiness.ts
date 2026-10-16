// npm run check:readiness — inspection readiness judges each record against the inspection DAY.
import { buildReadiness, dateLevel, ReadinessInput, verdict } from '../services/readiness';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const base = (o: Partial<ReadinessInput> = {}): ReadinessInput => ({
  kind: 'psc', date: today, today, on: () => false, labelOf: (c) => String(c), periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], ...o,
});
const item = (id: string, expiry: string): any => ({ id, category: 'fire_extinguishers', type: 'CO2 5 kg', expiry, nextInspection: expiry, updatedAt: 0 });
const keys = (r: ReturnType<typeof buildReadiness>) => r.sections.flatMap((s) => s.gaps.map((g) => `${g.key}:${g.level}`));

// The date rule.
ok(dateLevel(plus(-1), today) === 'red' && dateLevel(today, today) === 'red', 'out of date, or running out on the day → red');
ok(dateLevel(plus(10), today) === 'amber' && dateLevel(plus(31), today) === null && dateLevel(undefined, today) === null, '≤ 30 days after → amber; later or no date → nothing');

// An item fine today but out of date on an inspection 14 days away.
let r = buildReadiness(base({ flat: [item('a', plus(10)), item('b', plus(100))] }));
ok(keys(r).includes('eq:a:amber') && !keys(r).some((k) => k.startsWith('eq:b')), 'today: runs out in 10 days → amber');
r = buildReadiness(base({ date: plus(14), flat: [item('a', plus(10)), item('b', plus(100))] }));
ok(keys(r).includes('eq:a:red'), 'PSC in 14 days: the same item is a finding');
ok(/^Not ready — 1 finding$/.test(verdict(r)), `verdict: ${verdict(r)}`);

// Clean vessel: every area checked, ready.
r = buildReadiness(base({ flat: [item('c', plus(400))] }));
ok(r.red === 0 && r.amber === 0 && verdict(r) === 'Ready — nothing found' && r.sections.length >= 4, 'clean → Ready, areas listed');

// Modules decide the sections; class leaves the crew out.
const crew = [{ id: 'm1', name: 'Ann Lee', active: true, addedAt: 0, updatedAt: 0 }] as any;
const certs = [{ id: 'cc', scope: 'crew', crewId: 'm1', name: 'STCW basic safety', expiryDate: plus(5) }, { id: 'vc', scope: 'vessel', name: 'Safety Equipment Certificate', expiryDate: plus(-2) }] as any;
r = buildReadiness(base({ on: (m) => m === 'crewCerts', crew, certificates: certs }));
ok(keys(r).includes('cc:cc:amber') && keys(r).includes('vc:vc:red'), 'PSC: crew certificate + vessel certificate');
r = buildReadiness(base({ kind: 'class', on: (m) => m === 'crewCerts', crew, certificates: certs }));
ok(!r.sections.some((s) => s.key === 'crew') && keys(r).includes('vc:vc:red'), 'class: no crew papers, vessel certificate still');
r = buildReadiness(base({ certificates: certs }));
ok(!r.sections.some((s) => s.key === 'crew'), 'crewCerts off → no crew section');

// Open defect.
r = buildReadiness(base({ inspections: [{ id: 'i1', itemId: 'a', category: 'fire_extinguishers', at: Date.now() - 86400000, period: 'monthly', defect: { note: 'Seal broken', open: true }, item: { type: 'CO2' } }] as any }));
ok(keys(r).includes('def:i1:red'), 'open defect → finding');

// Rounds: a vessel that began last month and skipped an item.
const d = new Date();
const lastMonth = new Date(d.getFullYear(), d.getMonth() - 1, 10, 10).getTime();
const flat = [item('x', plus(400)), item('y', plus(400))];
r = buildReadiness(base({ flat, periodsOf: () => ['monthly'], inspections: [{ id: 'r1', itemId: 'x', category: 'fire_extinguishers', at: lastMonth, period: 'monthly' }] as any }));
const rnd = r.sections.find((s) => s.key === 'rounds')!;
ok(rnd.gaps.some((g) => g.level === 'red' && /1 of 2 items have no record/.test(g.sub ?? '')), 'last month: 1 of 2 never inspected → finding');
ok(!rnd.gaps.some((g) => /never recorded/.test(g.title)) && rnd.gaps.filter((g) => g.level === 'red').length === 1, 'months before the first record are not gaps');
r = buildReadiness(base({ flat, periodsOf: () => ['monthly'] }));
ok(r.sections.find((s) => s.key === 'rounds')!.gaps.some((g) => /never recorded/.test(g.title)), 'no round ever → finding');

// Drills: overdue on the day.
r = buildReadiness(base({ on: (m) => m === 'drills', drills: [] }));
ok(r.sections.find((s) => s.key === 'drills')!.gaps.some((g) => g.level === 'red'), 'no drills recorded → findings');

// QHSE.
r = buildReadiness(base({ on: (m) => m === 'qhse', ncs: [{ id: 'n', no: 'NC-2026-001', title: 'Fire door', actions: [{ id: 'a', text: 'fix', due: plus(-1) }] }, { id: 'n2', no: 'NC-2026-002', title: 'Log', actions: [{ id: 'b', text: 'x', due: plus(60) }] }] as any }));
ok(keys(r).includes('nc:n:red') && keys(r).includes('nc:n2:amber'), 'NC past its date red, open NC amber');

// Hours of rest: a day of 6 h rest in the last weeks.
const work = (h: number) => '1'.repeat(h * 2) + '0'.repeat(48 - h * 2);
const rest = [-3, -2, -1].map((k) => ({ id: `m1_${plus(k)}`, crewId: 'm1', holderName: 'Ann Lee', date: plus(k), work: work(k === -2 ? 18 : 8), updatedAt: 0 }));
r = buildReadiness(base({ on: (m) => m === 'rest', crew, rest: rest as any }));
ok(keys(r).includes('rest:m1:v:red'), 'a day with 6 h rest → finding');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
