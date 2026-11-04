// npm run check:threads — discussion on a record: mentions, what waits for the office, what is unread, the Board and Fleet's inbox.
import { makeMessage, mentionsIn, mentionsToNotify, threadKey, threadOf, threadRows, threadsToAnswer, unreadFromOffice, unreadMentions } from '../services/threads';
import { inboxOf } from '../services/officeInbox';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const PEOPLE = ['Ann', 'Ann Lee', 'Jez Dodd', 'Юрій'];
const M = (o: any = {}): any => ({ id: `m${o.at ?? 1}`, rec: 'defect', recId: 'd1', title: 'Pump — leak', text: 'x', by: 'Liam', at: 1, side: 'vessel', ...o });
const K = threadKey('defect', 'd1');

// Mentions
ok(mentionsIn('Ask @Jez Dodd please', PEOPLE).mentions.join() === 'Jez Dodd', 'a name after @');
ok(mentionsIn('@jez dodd', PEOPLE).mentions.join() === 'Jez Dodd', 'in any case');
ok(mentionsIn('@Ann Lee', PEOPLE).mentions.join() === 'Ann Lee', 'the longest name, not the shorter inside it');
ok(mentionsIn('@Ann Lee and @Ann', PEOPLE).mentions.sort().join() === 'Ann,Ann Lee', 'both when both are named');
ok(mentionsIn('@Annabel', PEOPLE).mentions.length === 0, 'not part of a longer word');
ok(mentionsIn('@Юрій, дякую', PEOPLE).mentions.join() === 'Юрій', 'Cyrillic, followed by a comma');
ok(mentionsIn('@Юрійко', PEOPLE).mentions.length === 0, 'Cyrillic, part of a longer word');
ok(mentionsIn('Dear @office.', PEOPLE).office, '@Office in any case');
ok(!mentionsIn('The office', PEOPLE).office, 'no @, no mention');
ok(mentionsIn('Jez Dodd', PEOPLE).mentions.length === 0, 'a name without @ is not a mention');

// A message
const made = makeMessage({ rec: 'nc', recId: 'n1', title: 'NC', text: '  Hi @Office  ', by: 'Liam', side: 'vessel' }, PEOPLE, 5);
ok(made.text === 'Hi @Office' && made.office === true && made.at === 5 && !('mentions' in made) && !('byRank' in made), 'trimmed, no empty fields (the rules and Firestore refuse undefined)');
ok(throws(() => makeMessage({ rec: 'nc', recId: 'n1', title: 'NC', text: '   ', by: 'L', side: 'vessel' }, [], 1)), 'nothing to send');
ok(throws(() => makeMessage({ rec: 'nc', recId: 'n1', title: 'NC', text: 'x'.repeat(2001), by: 'L', side: 'vessel' }, [], 1)), 'too long');
ok(threadOf([M({ at: 3 }), M({ at: 1 }), M({ at: 2, recId: 'other' })], 'defect', 'd1').map((m) => m.at).join() === '1,3', 'one record, oldest first');

// What waits for the office
ok(threadsToAnswer([M()]).length === 0, 'aboard talking among themselves: nothing for the office');
const called = threadsToAnswer([M({ at: 1 }), M({ at: 2, office: true }), M({ at: 3 })]);
ok(called.length === 1 && called[0].since === 2 && called[0].last.at === 3, 'called on: waits since the call, names the last word');
ok(threadsToAnswer([M({ at: 1, office: true }), M({ at: 2, side: 'office' })]).length === 0, 'answered: off the list');
const replied = threadsToAnswer([M({ at: 1, office: true }), M({ at: 2, side: 'office' }), M({ at: 3 })]);
ok(replied.length === 1 && replied[0].since === 3, 'the office in the conversation: a reply waits without @Office');
ok(threadsToAnswer([M({ at: 1, side: 'office' }), M({ at: 2 })]).length === 1, 'the office started it: the reply waits');

// Unread
const named = M({ at: 4, by: 'Anna', mentions: ['Jez Dodd'] });
ok(unreadMentions([named], 'jez dodd').length === 1, 'named: unread');
ok(unreadMentions([named], 'Liam').length === 0, 'somebody else named');
ok(unreadMentions([named], undefined).length === 0, 'nobody on this device');
ok(unreadMentions([named], 'Jez Dodd', { [K]: 4 }).length === 0, 'opened: read');
ok(unreadMentions([M({ by: 'Jez Dodd', mentions: ['Jez Dodd'] })], 'Jez Dodd').length === 0, 'not by yourself');
ok(mentionsToNotify([named], 'Jez Dodd', {}, 4).length === 0 && mentionsToNotify([named], 'Jez Dodd', {}, 3).length === 1, 'notified once');
const fromOffice = [M({ at: 1, side: 'office' }), M({ at: 2, side: 'office' }), M({ at: 3 })];
ok(unreadFromOffice(fromOffice).map((m) => m.at).join() === '2', "the office's latest per thread");
ok(unreadFromOffice(fromOffice, { [K]: 2 }).length === 0, "the office's message opened");

// Fleet's list
const rows = threadRows([M({ at: 1 }), M({ at: 9, rec: 'nc', recId: 'n1', title: 'NC-1' })], [{ rec: 'defect', recId: 'd1', title: 'Pump — leak' }, { rec: 'po', recId: 'p1', title: 'PO-1' }]);
ok(rows.map((r) => r.recId).join() === 'n1,d1,p1' && rows[2].count === 0, 'latest first, then open records not discussed, none twice');
const base: any = { imo: '1', name: 'V', machines: [], jobs: [], certificates: [], items: [], threads: [M({ office: true })] };
const on = { office: false, po: false, crit: false, ext: false, moc: false, threads: true };
const row = inboxOf(base, on);
ok(row.length === 1 && row[0].kind === 'thread' && row[0].tab === 'talk' && row[0].id === 'd1', 'in Waiting for you');
ok(inboxOf(base, { ...on, threads: false }).length === 0, 'module off: not in the inbox');

// The Board
const EMPTY = {
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const board = (x: any) => buildBoard({ ...EMPTY, on: (m: string) => m === 'threads', role: 'user', me: null, today: '2026-11-04', now: '2026-11-04T10:00', labelOf: String, periodsOf: () => [], ...x } as any).attention.filter((n: any) => n.key.startsWith('th:'));
ok(board({ me: { key: 'k', name: 'Jez Dodd' }, threads: [named] })[0]?.level === 'amber', 'named: on the Board of the person');
ok(board({ me: { key: 'k', name: 'Liam' }, threads: [named] }).length === 0, "not on anybody else's");
ok(board({ me: { key: 'k', name: 'Jez Dodd' }, threads: [named], prefs: { threadRead: { [K]: 4 } } }).length === 0, 'opened: gone');
ok(board({ role: 'user', threads: [M({ side: 'office' })] }).length === 0, "the office's message: not for crew");
ok(board({ role: 'admin', threads: [M({ side: 'office' })] })[0]?.level === 'blue', "the office's message: for officers");
ok(board({ role: 'admin', me: { key: 'k', name: 'Jez Dodd' }, threads: [M({ side: 'office', by: 'Supt', mentions: ['Jez Dodd'] })] }).length === 1, 'named by the office: one line, not two');

const redFirst = buildBoard({ ...EMPTY, on: (m: string) => m === 'threads' || m === 'pms', role: 'admin', me: { key: 'k', name: 'Jez Dodd' }, today: '2026-11-04', now: '2026-11-04T10:00', labelOf: String, periodsOf: () => [], machines: [{ id: 'q', name: 'Q' }], pmsJobs: [{ id: 'j', machineId: 'q', title: 'J' }], threads: [named], pmsDefects: [{ id: 'x', machineId: 'q', machineName: 'Q', description: 'd', category: 'safety', by: 'A', at: 1, date: '2026-11-01' }] } as any).attention;
ok(redFirst.some((n: any) => n.level === 'red') && redFirst[0].key.startsWith('th:me:'), 'named: above the red lines, not hidden behind Show more');

console.log(fail ? `\n${fail} failed` : '\nAll passed');
process.exit(fail ? 1 : 0);
