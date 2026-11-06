// npm run check:incidentai — an incident told for an NC: names go as ranks, the draft fills only empty fields (plan AI-4).
import { applyIncident, pastForAi, peopleOf, readIncident, scrubNames } from '../services/incidentAi';
import { NonConformity } from '../types/safety';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const people = peopleOf({
  crew: [{ name: 'Anna Berg', rank: 'Bosun' }, { name: 'Ivan Petrov', rank: 'AB' }, { name: 'Li', rank: 'Cook' }, { name: 'Jon Smith-Hale' }],
  passengers: [{ name: 'Ola Nordmann' }],
  medTreatments: [{ patient: 'Petra Novak' }],
});

const s = scrubNames('Anna Berg and anna saw Ivan slip; Mr Petrov hurt his hand. Ola Nordmann watched. Hale helped. Annabel is not Anna. Li was in the galley, Lisbon too. Petra had first aid.', people);
ok(s.text.includes('[Bosun] and [Bosun] saw [AB] slip; Mr [AB] hurt'), 'whole names and their parts, any case, become the rank');
ok(s.text.includes('[guest] watched') && s.text.includes('[crew member] helped') && s.text.includes('[patient] had'), 'guests, a crew member with no rank, patients');
ok(s.text.includes('Annabel is not [Bosun]') && s.text.includes('[Cook] was in the galley, Lisbon'), 'only whole words; a short name goes whole, never inside a word');
ok(!/Anna |Berg|Ivan|Petrov|Nordmann|Novak|Hale/.test(s.text) && s.replaced === 9, `nine replaced (${s.replaced})`);
ok(scrubNames('Иван Петров упал', peopleOf({ crew: [{ name: 'Иван Петров', rank: 'Матрос' }] })).text === '[Матрос] упал', 'Cyrillic names');

const nc = (p: Partial<NonConformity>): NonConformity => ({ id: 'x', no: '', date: '2026-01-01', source: 'incident', grade: 'nc', title: '', what: '', actions: [], raisedBy: 'Anna Berg', raisedAt: 1, updatedAt: 1, ...p });
const ncs = [
  nc({ id: 'n1', no: 'NC-2026-001', date: '2026-03-01', title: 'Mooring line parted', what: 'Ivan was near the bight', rootCause: 'Worn line', closedAt: 5, closedBy: 'Master X' }),
  nc({ id: 'n2', no: 'NC-2026-002', date: '2026-05-01', title: 'Tender davit wire', what: 'Frayed' }),
  nc({ id: 'n3', no: '', date: '2026-06-01', title: 'draft' }),
];
const { past, ids } = pastForAi(ncs, people, 'n2');
ok(ids.join() === 'n1' && past[0].key === 'C1' && past[0].closed, 'raised NCs only, not the one being written, under C1…');
ok(!/Ivan|Anna|Master X|raisedBy/.test(JSON.stringify(past)) && past[0].what === '[AB] was near the bight', 'no names and no signers in the past NCs');

const r = readIncident({
  title: 'Near miss — mooring line parted', what: 'During mooring the stern line parted.', source: 'near_miss', grade: 'bogus', where: 'Aft mooring deck',
  rootCause: 'Immediate: worn line. Underlying: to be established — line inspection records.',
  actions: [
    { kind: 'correction', text: 'Replace the stern line', owner: 'Bosun', days: 0 },
    { kind: 'corrective', text: 'Add mooring lines to the monthly round', owner: '', days: '14' },
    { kind: 'nonsense', text: 'Drop me' },
    { kind: 'preventive', text: 'Toolbox talk on snap-back zones', owner: 'Chief Officer', days: 900 },
  ],
  similar: [{ key: 'C1', why: 'Same line' }, { key: 'C9', why: 'Invented' }, { key: 'C1' }],
  missing: ['When exactly?', ''],
}, ncs, ids, '2026-11-06');
ok(r.source === 'near_miss' && r.grade === undefined, 'a known source stays, an unknown grade goes');
ok(r.actions.length === 3 && r.actions[0].due === '2026-11-06' && r.actions[1].due === '2026-11-20' && r.actions[1].owner === 'Master' && r.actions[2].due === '2026-12-06', 'unknown kind dropped; due from today; no owner → Master; days out of range → 30');
ok(r.similar.length === 1 && r.similar[0].nc.id === 'n1' && r.similar[0].why === 'Same line', 'a similar NC only by a key that was sent, once');
ok(r.missing.length === 1, 'empty questions dropped');

const draft = nc({ id: 'new', title: 'My own title', what: '', actions: [{ id: 'k', kind: 'correction', text: 'Replace the stern line', owner: 'Bosun', due: '2026-11-06' }] });
const a = applyIncident(draft, r, r.actions, { kind: true }, (p) => `${p}1`);
ok(a.nc.title === 'My own title' && a.kept === 1 && a.nc.what === 'During mooring the stern line parted.' && a.nc.where === 'Aft mooring deck', 'what was typed stays; empty fields are filled');
ok(a.nc.actions.length === 3 && a.nc.actions[0].id === 'k', 'an action already on the NC is not added twice');
ok(a.nc.source === 'near_miss' && a.nc.grade === 'nc', 'source set on a new NC; grade kept when the AI gave none valid');
const b = applyIncident(nc({ source: 'observation' }), r, [], { kind: false }, (p) => p);
ok(b.nc.source === 'observation' && b.nc.actions.length === 0, 'from a card the source stays; nothing ticked, no actions');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
