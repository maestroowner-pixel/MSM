// npm run check:extinsp — external inspections: numbers, PSC dates, findings as NCs, the visit's state, Board and Fleet.
import { FINDING_HEAD, inspReport, dueForAction, extSummary, findingProblem, findingsOf, findingsToNcs, inspStatus, nextInspNo, sortInspections } from '../services/extInspections';
import { ncState } from '../services/safety';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-10-29';
const E = (o: any): any => ({ id: 'e', no: 'EI-2026-01', kind: 'psc', date: '2026-10-20', port: 'Palma', by: 'Mate', at: 1, updatedAt: 1, ...o });
const me = { name: 'Liam', rank: 'C/O' };

ok(nextInspNo([], T) === 'EI-2026-01', 'first of the year');
ok(nextInspNo([E({ no: 'EI-2026-04' }), E({ no: 'EI-2025-09' })], T) === 'EI-2026-05', 'next after the highest of the year');

ok(dueForAction('17', '2026-10-20') === '2026-10-20', '17 — before departure: the day of the inspection');
ok(dueForAction('16', '2026-10-20') === '2026-11-03', '16 — 14 days');
ok(dueForAction('18', '2026-11-30') === '2027-02-28', '18 — 3 months, clamped to the month end');
ok(dueForAction('15', '2026-10-20') === undefined && dueForAction(undefined, '2026-10-20') === undefined, '15 / no code — the officer sets the date');

ok(findingProblem({ text: ' ', grade: 'nc', due: T, owner: 'Bosun' }) === 'text', 'a finding needs its text');
ok(findingProblem({ text: 'x', grade: 'nc', due: '', owner: 'Bosun' }) === 'due', '… its date');
ok(findingProblem({ text: 'x', grade: 'nc', due: T, owner: '' }) === 'owner', '… and who puts it right');

const e = E({ reportNo: 'FORM-B 123' });
const prior: any[] = [{ id: 'old', no: 'NC-2026-003', actions: [] }];
const made = findingsToNcs(e, [
  { text: 'Fire door self-closer defective\nDeck 3', grade: 'nc', pscCode: '07105', pscAction: '17', due: '2026-10-20', owner: 'Bosun' },
  { text: 'Emergency fire pump fails to deliver', grade: 'nc', pscAction: '30', due: '2026-10-20', owner: 'C/E', todo: 'Overhaul the pump' },
  { text: 'Garbage placard missing', grade: 'observation', pscAction: '10', due: '2026-10-20', owner: 'Bosun' },
], prior, me, 5);
ok(made.map((n) => n.no).join() === 'NC-2026-004,NC-2026-005,NC-2026-006', 'numbered after the vessel\'s NCs, in order');
ok(made.every((n) => n.inspId === e.id && n.source === 'psc' && n.sourceRef === 'FORM-B 123' && n.where === 'Palma'), 'linked to the inspection, source PSC, its report and port');
ok(made[0].title === 'Fire door self-closer defective' && made[0].pscCode === '07105' && made[0].actions[0].text.startsWith('Rectify:'), 'title is the first line; code kept; correction "Rectify…"');
ok(made[1].grade === 'major' && made[1].actions[0].text === 'Overhaul the pump' && made[1].actions[0].owner === 'C/E', 'code 30 → major; own correction and owner');
ok(!!made[2].actions[0].doneAt && made[2].actions[0].doneBy === 'Liam' && ncState(made[2], T) === 'ready', 'code 10 → the correction is already done');
ok(findingsToNcs(E({ kind: 'superintendent', reportNo: undefined }), [{ text: 'x', grade: 'nc', due: T, owner: 'a' }], [], me, 1)[0].sourceRef === 'EI-2026-01', 'no report number → the inspection number');

const ncs: any[] = [...made];
let s = inspStatus(e, ncs, T);
ok(s.state === 'overdue' && s.total === 3 && s.closed === 0 && s.overdue === 2, 'two past their date → overdue');
ok(inspStatus(E({ id: 'clean' }), ncs, T).state === 'clean', 'no findings → clean');
const closedAll = made.map((n) => ({ ...n, closedAt: 9 }));
ok(inspStatus(e, closedAll, T).state === 'closed', 'all closed aboard → closed');
ok(inspStatus(e, closedAll.map((n) => ({ ...n, office: { result: 'verified', by: 'S', at: 10 } })), T).state === 'verified', 'and all verified → verified');
ok(inspStatus(E({ detained: true }), ncs, T).detainedNow && !inspStatus(E({ detained: true, releasedOn: T }), ncs, T).detainedNow, 'a detention holds until released');
ok(findingsOf(e, [...ncs, { id: 'z', no: 'NC-2026-009', inspId: 'other', actions: [] }]).length === 3, 'findings are only its own NCs');

const order = sortInspections([E({ id: 'clean', date: '2026-10-25' }), e, E({ id: 'det', date: '2026-01-01', detained: true })], ncs, T);
ok(order.map((x) => x.id).join() === 'det,e,clean', 'a detention first, then overdue, then clean');

const sum = extSummary([e, E({ id: 'flag', kind: 'flag', date: '2026-10-25' }), E({ id: 'p2', date: '2026-09-01', detained: true, releasedOn: '2026-09-03' })], ncs, T);
ok(sum.lastPsc?.date === '2026-10-20' && sum.lastPsc.findings === 3 && sum.open === 3 && sum.overdue === 2 && !sum.detained, 'fleet: last PSC, open, overdue, no detention now');

const verifiedNc: any = { ...made[1], closedAt: Date.parse('2026-10-25T10:00:00'), closedBy: 'Max', closedByRank: 'Master', closedWith: { method: 'pin', at: 1 }, effectiveness: 'Pump tested', rootCause: 'Wear', office: { result: 'verified', by: 'Supt', at: Date.parse('2026-10-26T10:00:00') } };
const rep = inspReport(E({ reportNo: 'FORM-B 123', detained: true, inspector: 'J. Ferrer', authority: 'Paris MOU', signedWith: { method: 'drawn', at: 1 } }), [made[0], verifiedNc, made[2]], T);
ok(rep.title === 'Port State Control — Palma, 20.10.2026 (EI-2026-01)', 'report title: kind, port, date, number');
ok(rep.facts.some((f) => f === 'DETAINED — not yet lifted') && rep.facts.some((f) => /Inspector: J\. Ferrer · Report: FORM-B 123/.test(f)) && rep.facts.some((f) => /signed by hand/.test(f)), 'facts: detention, inspector, report, signature');
ok(rep.tables[0].head === FINDING_HEAD && rep.tables[0].rows.length === 3 && rep.tables[0].rows.every((r) => r.length === FINDING_HEAD.length), 'one row per finding, every column');
ok(/Deficiency 07105\nAction 17 Rectify before departure/.test(rep.tables[0].rows[0][2]), 'PSC codes in words');
ok(/^Verified 26\.10\.2026 Supt/.test(rep.tables[0].rows[1][9]) && /signed by PIN · Effective: Pump tested/.test(rep.tables[0].rows[1][8]), 'closure and the office\'s verification');
ok(inspReport(E({ id: 'clean' }), ncs, T).tables.length === 0, 'clean inspection — no findings table');

const base: any = {
  on: (m: string) => m === 'qhse' || m === 'extInsp', role: 'superadmin', me: null, today: T, now: `${T}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
let b = buildBoard({ ...base, ncs, extInspections: [E({ detained: true })] });
ok(b.attention[0]?.key === 'ei:e' && b.attention[0].level === 'red' && b.attention[0].who === 'master' && /Palma/.test(b.attention[0].title), 'detention → red for the Master, first on the list');
ok(b.attention.some((n) => n.key === `nc:${made[0].id}` && /^Port State Control Palma:/.test(n.sub ?? '')), 'overdue finding says which inspection');
b = buildBoard({ ...base, ncs, extInspections: [E({ detained: true, releasedOn: T })] });
ok(!b.attention.some((n) => n.key === 'ei:e'), 'released → no detention notice');
b = buildBoard({ ...base, on: (m: string) => m === 'qhse', ncs, extInspections: [E({ detained: true })] });
ok(!b.attention.some((n) => n.key === 'ei:e') && b.attention.some((n) => n.key === `nc:${made[0].id}` && n.sub === made[0].title), 'module off → plain NC notices, no detention');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
