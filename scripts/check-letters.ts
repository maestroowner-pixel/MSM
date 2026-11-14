// npm run check:letters — the correspondence register: numbers, what an incoming letter waits for, answers, the Board, the paper, rules, sync and words.
import { isOpen, letterBoard, letterMatches, letterProblem, letterState, nextLetterNo, repliesTo, replyDraft, sortLetters } from '../services/correspondence';
import { inPeriod, letterRows, letterSheet } from '../services/correspondenceRows';
import { buildBoard } from '../services/board';
import { en } from '../constants/i18n/en';
import { LETTER_VIA, PARTY_KINDS } from '../types/correspondence';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = '2026-11-14';
const L = (o: any = {}): any => ({ id: 'l1', dir: 'in', no: 'IN-2026-001', date: '2026-11-10', party: 'DPA', kind: 'office', subject: 'Circular 12/2026', by: 'Chief Officer', createdAt: 1, updatedAt: 1, ...o });

// Numbers: per direction, per year; a cancelled one stays counted.
const nos = [L(), L({ id: 'l2', no: 'IN-2026-002', cancelled: { by: 'M', at: 2, note: 'twice' } }), L({ id: 'o1', dir: 'out', no: 'OUT-2026-001' }), L({ id: 'old', no: 'IN-2025-117', date: '2025-12-30' })];
ok(nextLetterNo(nos, 'in', today) === 'IN-2026-003', 'next incoming: after a cancelled number, never re-used');
ok(nextLetterNo(nos, 'out', today) === 'OUT-2026-002', 'outgoing counted on its own');
ok(nextLetterNo(nos, 'in', '2027-01-02') === 'IN-2027-001', 'a new year starts at 001');
ok(nextLetterNo([L({ no: 'IN-2026-999' })], 'in', today) === 'IN-2026-1000', 'past 999 the number simply grows');

// What an incoming letter waits for.
const st = (l: any, list: any[] = [l]) => letterState(l, list, today);
ok(st(L()) === 'info', 'nothing expected: for information');
ok(st(L({ needsReply: true })) === 'waiting', 'expected, no date: waiting');
ok(st(L({ needsReply: true, replyBy: '2026-11-13' })) === 'overdue', 'past the date: overdue');
ok(st(L({ needsReply: true, replyBy: today })) === 'soon' && st(L({ needsReply: true, replyBy: '2026-11-17' })) === 'soon', 'today and three days ahead: soon');
ok(st(L({ needsReply: true, replyBy: '2026-11-18' })) === 'waiting', 'four days ahead: waiting');
const q = L({ needsReply: true, replyBy: '2026-11-01' });
const ans = L({ id: 'a1', dir: 'out', no: 'OUT-2026-004', date: '2026-11-12', replyTo: 'l1' });
ok(st(q, [q, ans]) === 'answered' && repliesTo(q, [q, ans]).length === 1, 'an outgoing letter naming it answers it — even late');
ok(st(q, [q, { ...ans, cancelled: { by: 'M', at: 3 } }]) === 'overdue', 'a cancelled answer does not');
ok(st(L({ needsReply: true, replyBy: '2026-11-01', closed: { by: 'Master', at: 4, note: 'By phone' } })) === 'closed', 'closed without a letter');
ok(st(L({ needsReply: true, replyBy: '2026-11-01', cancelled: { by: 'M', at: 2 } })) === 'info', 'a cancelled letter owes nothing');
ok(st(L({ dir: 'out', needsReply: true, replyBy: '2026-11-01' })) === 'info', 'an outgoing letter owes nothing');
ok(isOpen('overdue') && isOpen('soon') && isOpen('waiting') && !isOpen('answered') && !isOpen('closed') && !isOpen('info'), 'open = overdue, soon, waiting');

// The Board's lists and the list's order.
const list = [
  L({ id: 'a', no: 'IN-2026-001', needsReply: true, replyBy: '2026-11-20' }),
  L({ id: 'b', no: 'IN-2026-002', needsReply: true, replyBy: '2026-11-02' }),
  L({ id: 'c', no: 'IN-2026-003', needsReply: true, replyBy: '2026-11-15' }),
  L({ id: 'd', no: 'IN-2026-004', needsReply: true }),
  L({ id: 'e', no: 'IN-2026-005', date: '2026-11-13' }),
  L({ id: 'f', dir: 'out', no: 'OUT-2026-001', date: '2026-11-11' }),
];
const b = letterBoard(list, today);
ok(b.overdue.map((x) => x.id).join() === 'b' && b.soon.map((x) => x.id).join() === 'c' && b.waiting.map((x) => x.id).join() === 'a,d', 'Board lists: overdue, soon, waiting (dated first)');
ok(sortLetters(list, today).map((x) => x.id).join() === 'b,c,a,d,e,f', 'list: overdue, soon, waiting by date, then the rest newest first');

// The Board itself.
const base: any = {
  on: (k: string) => k === 'letters', role: 'admin', me: null, today, now: `${today}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [], letters: list,
};
const all = (x: any = {}) => buildBoard({ ...base, ...x }).attention.filter((n: any) => n.key.startsWith('letters:'));
const lv = Object.fromEntries(all().map((n: any) => [n.key, n.level]));
ok(lv['letters:overdue'] === 'red' && lv['letters:soon'] === 'amber' && lv['letters:waiting'] === 'blue', 'Board: red overdue, amber soon, blue waiting');
ok(all()[0].route === 'Letters' && all().find((n: any) => n.key === 'letters:overdue')?.sub === 'IN-2026-002 DPA', '…opens the register, names number and sender');
ok(!all({ role: 'user' }).length, '…not on a crew device');
ok(!all({ on: () => false }).length, '…not with the flag off');

// A draft before saving; an answer ready to fill in; search.
ok(letterProblem(L({ no: '' })) === null, 'a complete letter passes');
ok(letterProblem(L({ party: ' ' })) === 'party' && letterProblem(L({ subject: '' })) === 'subject' && letterProblem(L({ date: '14.11.2026' })) === 'date', 'from/to, subject and date are needed');
ok(letterProblem(L({ replyBy: '2026-11-01' })) === 'replyBy', 'the answer date is not before the letter');
const r = replyDraft(L({ via: 'email' }), 'r1', today, 'Master', 'Master');
ok(r.dir === 'out' && r.no === '' && r.replyTo === 'l1' && r.party === 'DPA' && r.kind === 'office' && r.subject === 'Re: Circular 12/2026' && r.via === 'email' && r.date === today, 'answer: to the sender, "Re:", today, no number yet');
ok(replyDraft(L({ subject: 'RE: x' }), 'r2', today, 'M').subject === 'RE: x', '…no second "Re:"');
ok(letterMatches(L({ ref: 'MI-118' }), 'mi-118') && letterMatches(L(), 'circular') && letterMatches(L({ party: 'Bureau Véritas' }), 'veritas') && !letterMatches(L(), 'class'), 'search: reference, subject, accents');

// The paper.
const rows = letterRows([q, ans], [q, ans], today);
ok(rows[0][0] === 'IN-2026-001' && rows[0][7] === 'Answered by OUT-2026-004 12.11.2026', 'register: the incoming row says which letter answered it');
ok(rows[1][7] === 'Answers IN-2026-001', '…and the answer says what it answers');
ok(letterRows([L({ needsReply: true, replyBy: '2026-11-01' })], [], today)[0][7] === 'ANSWER OVERDUE since 01.11.2026', '…an overdue one is said in capitals');
ok(letterRows([L({ cancelled: { by: 'M', at: Date.UTC(2026, 10, 12), note: 'Twice' } })], [], today)[0][7] === 'CANCELLED 12.11.2026: Twice', '…a cancelled one stays, with why');
ok(letterRows([L({ needsReply: true, closed: { by: '', at: Date.UTC(2026, 10, 12), note: 'By phone' } })], [], today)[0][7] === 'Closed 12.11.2026: By phone', '…closed on a device with no names: no empty "by"');
ok(inPeriod(nos, '2026-01-01', '2026-12-31').length === 3 && inPeriod(nos, '', '').length === 4, 'period: the year, or all dates');
const src = readFileSync('services/correspondenceReport.ts', 'utf8');
ok(!/\bt\(|\btk\(/.test(src), 'the report does not use t()');
for (const m of src.matchAll(/widths: \{([^}]+)\}/g)) {
  const w = m[1].split(',').map((p) => Number(p.split(':')[1]));
  ok(w.length === 10 && w.reduce((a, x) => a + x, 0) === 277, `the PDF table: a width for every column (${w.reduce((a, x) => a + x, 0)} mm)`);
}

// The superintendent: a letter to the vessel, and an office letter answering one of ours.
const ours = L({ id: 'o9', dir: 'out', no: 'OUT-2026-007', date: '2026-11-05', party: 'DPA', subject: 'Request for spares budget' });
const office = L({ id: 's1', no: 'IN-2026-011', date: '2026-11-12', kind: 'superintendent', party: 'J. Smith', subject: 'Re: spares budget', replyTo: 'o9', needsReply: true, replyBy: '2026-11-20' });
ok(repliesTo(ours, [ours, office]).map((x) => x.id).join() === 's1', 'an office letter naming ours answers it');
ok(repliesTo(office, [ours, office]).length === 0, '…and is not answered by the letter it answers');
ok(st(office, [ours, office]) === 'waiting', 'the office letter still asks the vessel for its own answer');
const r2 = letterRows([ours, office], [ours, office], today);
ok(r2.find((x) => x[0] === 'OUT-2026-007')![7] === 'Answered by IN-2026-011 12.11.2026', 'register: ours says the office answered it');
ok(r2.find((x) => x[0] === 'IN-2026-011')![7] === 'Answers OUT-2026-007; Answer by 20.11.2026' && r2.find((x) => x[0] === 'IN-2026-011')![2] === 'J. Smith — Superintendent', '…the office letter says what it answers and what it asks');
const sh = letterSheet(office, [ours, office], today);
ok(sh.title === 'IN-2026-011 — Re: spares budget' && sh.facts[1] === 'From J. Smith (Superintendent)' && sh.tables[1].rows[0][0] === 'OUT-2026-007', 'one letter\'s page: title, from, the letter it answers');
for (const tb of sh.tables) ok(Object.keys(tb.widths).length === tb.head.length && Object.values(tb.widths).reduce((a, x) => a + x, 0) === 277, `…"${tb.title}" sized to the page`);
const shr = readFileSync('firestore.rules', 'utf8');
ok(/allow create: if shore\(v\)[\s\S]{0,120}dir == 'in'[\s\S]{0,120}kind == 'superintendent'/.test(shr), 'rules: the office creates only incoming letters from the superintendent');

// Rules, sync, words.
const rules = readFileSync('firestore.rules', 'utf8');
const blk = /match \/letters\/\{id\} \{([\s\S]*?)\n      \}/.exec(rules)?.[1] ?? '';
ok(/allow read: if isAdmin\(v\) \|\| shore\(v\)/.test(blk) && /allow delete: if false/.test(blk) && /no == resource\.data\.no/.test(blk) && /https/.test(blk), 'rules: officers and the office, number fixed, never deleted, file only as a link');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'letters', key: storage\.LETTERS_KEY, module: 'letters', officers: true/.test(fb), 'sync: officers only, with the flag');
const keys = Object.keys(en);
ok(PARTY_KINDS.every((k) => keys.includes(`lt.kind.${k}`)) && LETTER_VIA.every((k) => keys.includes(`lt.via.${k}`)), 'words for every party and way');
ok(['info', 'answered', 'closed', 'overdue', 'soon', 'waiting'].every((s) => keys.includes(`lt.st.${s}`)) && ['date', 'party', 'subject', 'replyBy'].every((s) => keys.includes(`lt.bad.${s}`)), 'words for every state and problem');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
