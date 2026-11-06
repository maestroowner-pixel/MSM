// npm run check:briefai — the brief on a handover and the Master's note to the office (plan AI-7): what goes (no names), what comes back, what the PDF and the mail print.
import { briefText, handoverForAi, monthFacts, monthForAi, readBrief } from '../services/briefAi';
import { handoverPages, emptyDraft } from '../services/handover';
import { peopleOf } from '../services/incidentAi';
import { Readiness } from '../services/readiness';
import { PmsDefect } from '../types/pms';
import { NonConformity } from '../types/safety';
import { Drill } from '../types/drills';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { _noteHtml } = require(require('path').join(process.cwd(), 'functions/emailReport.js'));

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const people = peopleOf({ crew: [{ name: 'Ivan Petrov', rank: '2nd Engineer' }, { name: 'Anna Berg', rank: 'Chief Engineer' }] });
const r: Readiness = {
  kind: 'psc', date: '2026-11-06', today: '2026-11-06', red: 2, amber: 1,
  sections: [
    { key: 'equipment', title: 'Equipment', icon: 'x', gaps: [{ key: 'eq:1', level: 'amber', title: 'Liferaft 2 — service', date: '2026-12-01', route: 'X' }, { key: 'eq:2', level: 'red', title: 'EEBD 3 expired', route: 'X' }] },
    { key: 'crew', title: 'Crew', icon: 'x', gaps: [{ key: 'crew:c7', level: 'red', title: 'Ivan Petrov — STCW basic safety', route: 'X' }] },
    { key: 'drills', title: 'Drills', icon: 'x', gaps: [] },
  ],
};

// Handover
const d = { ...emptyDraft(), area: 'Engine room', ahead: 60, progress: '- Ivan Petrov overhauling the purifier\n- Spares for GE PS ordered', remarks: 'Ask Anna Berg about the bilge alarm' };
const h = handoverForAi(r, d, people);
const sent = JSON.stringify(h.input);
ok(!/Ivan|Petrov|Anna|Berg/.test(sent), 'no name goes: notes scrubbed, the crew line by rank only');
ok(h.replaced === 2, `two names replaced in the notes (${h.replaced})`);
ok(sent.includes('[2nd Engineer] overhauling') && sent.includes('[Chief Engineer]'), 'names become ranks in brackets');
ok(h.input.gaps[0].level === 'red' && h.input.gaps.length === 3, 'red lines first, all of them');
ok(h.input.for === 'handover' && h.input.ahead === 60 && h.input.area === 'Engine room', 'the trip and the area go');

// The reply
const pts = readBrief({ points: [
  { text: 'EEBD 3 has expired — replace before sailing.', keys: ['eq:2', 'eq:99'], from: 'list' },
  { text: 'Made up from nowhere.', keys: ['eq:42'], from: 'list' },
  { text: '  Purifier overhaul   in progress. ', keys: [], from: 'notes' },
  { text: 'A point with no source tag and no keys' },
  { text: '' , keys: ['eq:1'] },
  { text: 'Defects piling up.', from: 'facts' },
] }, h.input.gaps);
ok(pts.length === 3, `invented-only, untagged and empty points go (${pts.length} kept)`);
ok(pts[0].lines.join() === 'EEBD 3 expired', 'a point shows only the real lines it names');
ok(pts[1].text === 'Purifier overhaul in progress.' && pts[1].from === 'notes', 'a notes point stays, spaces tidied');
ok(briefText(pts).split('\n').length === 3 && briefText(pts).startsWith('- EEBD'), 'one point a line in the field');
ok(readBrief({ points: Array.from({ length: 12 }, (_, i) => ({ text: `p${i}`, from: 'notes' })) }, []).length === 8, 'at most 8 points');
ok(readBrief({}, []).length === 0, 'an empty reply is no points');

// The PDF prints the brief first
const page = handoverPages({ ...d, brief: briefText(pts) }, r)[0];
ok(page.tables[0].title === 'In brief' && page.tables[0].rows.length === 3, 'In brief is the first table on the handover');
ok(handoverPages({ ...d, brief: '  \n' }, r)[0].tables[0].title === 'Work in progress', 'no brief, no table');

// The month
const df = (p: Partial<PmsDefect>): PmsDefect => ({ id: 'd', machineId: 'm', machineName: 'GE', category: 'operational', description: 'x', date: '2026-10-01', by: 'Ivan Petrov', at: 1, updatedAt: 1, ...p });
const defects = [df({ id: 'a', date: '2026-11-02' }), df({ id: 'b', date: '2026-10-02', closed: { date: '2026-11-03', note: 'done', by: 'Anna Berg', at: 2 } }), df({ id: 'c' })];
const nc = (p: Partial<NonConformity>): NonConformity => ({ id: 'n', no: 'NC-1', date: '2026-11-01', source: 'internal', grade: 'minor', title: 't', what: 'w', actions: [], raisedBy: 'Anna Berg', raisedAt: 1, updatedAt: 1, ...p } as NonConformity);
const ncs = [nc({}), nc({ id: 'n2', date: '2026-09-01', closedAt: new Date(2026, 10, 4, 12).getTime() })];
const dr = (p: Partial<Drill>): Drill => ({ id: 'x', no: 'DR', type: 'fire', topic: 'Fire in the galley', date: '2026-11-05', scenario: [], theory: false, attendance: [], plannedBy: 'Anna Berg', updatedAt: 1, ...p } as Drill);
const drills = [dr({ doneAt: 5 }), dr({ id: 'y', topic: 'Abandon ship' }), dr({ id: 'z', doneAt: 6, deleted: true }), dr({ id: 'w', doneAt: 7, date: '2026-10-30', topic: 'Old' })];
const facts = monthFacts({ month: '2026-11', defects, ncs, drills });
ok(facts.includes('Machinery defects: 1 raised, 1 closed this month, 2 open now'), `defects counted (${facts[0]})`);
ok(facts.includes('Non-conformities: 1 raised, 1 closed this month, 1 open now'), `NCs counted (${facts[1]})`);
ok(facts.includes('Drills held this month: 1 (Fire in the galley)'), `only drills signed this month (${facts[2]})`);
ok(monthFacts({ month: '2026-11' }).length === 0, 'a module off says nothing');
const m = monthForAi(r, '2026-11', [...facts, 'Drill led by Ivan Petrov'], 'Please send the Anna Berg spares', people);
ok(!/Ivan|Petrov|Anna|Berg/.test(JSON.stringify(m.input)) && m.replaced === 2, `no names in the month either (${m.replaced})`);
ok(m.input.for === 'month' && m.input.month === '2026-11', 'the month goes');

// The mail
const html: string = _noteHtml({ text: '- Spares <urgent> & needed\n\n• Survey due', at: 1 });
ok(html.includes('From the Master') && html.includes('&lt;urgent&gt; &amp;') && (html.match(/<li/g) || []).length === 2, 'the note prints a point a line, escaped');
ok(_noteHtml(null) === '' && _noteHtml({ text: ' \n ' }) === '', 'no note, nothing printed');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
