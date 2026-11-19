// npm run check:chat — the chat: channels, a new message, what is unread, what the office owes, paper, the Board, Fleet's inbox, rules and sync.
import { readFileSync } from 'fs';
import { CHAT_CHANNELS, CHAT_SUB, channelsFor, chatMentions, chatOf, chatSheet, chatPeople, chatToNotify, chatToShow, makeChatMessage, officeOwes, recent, unreadChat } from '../services/chat';
import { inboxOf } from '../services/officeInbox';
import { buildBoard } from '../services/board';
import { en } from '../constants/i18n/en';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const PEOPLE = ['Ann', 'Jez Dodd'];
const C = (o: any = {}): any => ({ id: `c${o.at ?? 1}${o.ch ?? 'crew'}`, ch: 'crew', text: 'x', by: 'Liam', at: 1, side: 'vessel', ...o });

// Who sees what
ok(channelsFor(false).join() === 'crew', 'a crew device: Crew only');
ok(channelsFor(true).join() === 'crew,officers,office', 'an officer: all three');

// A message
const m = makeChatMessage({ ch: 'office', text: '  Spares? @Office @Jez Dodd ', by: 'Liam', side: 'vessel' }, PEOPLE, 5);
ok(m.text === 'Spares? @Office @Jez Dodd' && m.office === true && m.mentions?.join() === 'Jez Dodd' && m.ch === 'office' && !('byRank' in m), 'trimmed, mentions read, no empty fields');
ok(!('office' in makeChatMessage({ ch: 'crew', text: 'tell @Office', by: 'L', side: 'vessel' }, [], 1)), '@Office means nothing outside the office channel');
ok(throws(() => makeChatMessage({ ch: 'crew', text: ' ', by: 'L', side: 'vessel' }, [], 1)), 'nothing to send');
ok(throws(() => makeChatMessage({ ch: 'crew', text: 'x'.repeat(2001), by: 'L', side: 'vessel' }, [], 1)), 'too long');
ok(throws(() => makeChatMessage({ ch: 'crew', text: 'hi', by: 'Supt', side: 'office' }, [], 1)), 'the office writes only in its channel');
ok(chatOf([C({ at: 3 }), C({ at: 1 }), C({ at: 2, ch: 'officers' })], 'crew').map((x) => x.at).join() === '1,3', 'one channel, oldest first');

// Unread, mentions
const list = [C({ at: 1, by: 'Ann' }), C({ at: 2, by: 'Liam' }), C({ at: 3, by: 'Ann', mentions: ['Liam'] })];
ok(unreadChat(list, 'crew', 'Liam').length === 2, 'unread: not my own');
ok(unreadChat(list, 'crew', 'Liam', { crew: 2 }).length === 1, 'unread: after what this device saw');
ok(chatMentions(list, 'liam')[0]?.at === 3, 'a mention, in any case');
ok(chatMentions(list, 'Liam', { crew: 3 }).length === 0, 'seen: no mention');
ok(chatToNotify(list, 'Liam', {}, 3).length === 0 && chatToNotify(list, 'Liam', {}, 2).length === 1, 'notified once');
ok(unreadChat([C({ ch: 'office', side: 'office', by: 'Liam', at: 4 })], 'office', 'Liam').length === 1, "the office's message is never 'mine', even with the same name");

// What the office owes
ok(officeOwes([]) === null, 'nothing said: nothing owed');
const off = (o: any) => C({ ch: 'office', ...o });
ok(officeOwes([off({ at: 1 }), off({ at: 2, side: 'office' })]) === null, 'the office answered: nothing owed');
const owed = officeOwes([off({ at: 1 }), off({ at: 2, side: 'office' }), off({ at: 3 }), off({ at: 4 })]);
ok(owed?.n === 2 && owed.since === 3 && owed.last.at === 4, 'since the office last wrote: two, from the first');
ok(officeOwes([C({ at: 9 })]) === null, 'the crew channel owes the office nothing');

// A page at a time
const many = Array.from({ length: 70 }, (_, i) => C({ at: i + 1 }));
ok(recent(many, 60).shown.length === 60 && recent(many, 60).earlier === 10 && recent(many, 60).shown[0].at === 11, 'the latest 60, ten earlier');
ok(recent(many, 100).earlier === 0, 'all when they fit');

// Paper
const sheet = chatSheet([C({ at: Date.UTC(2026, 10, 1) }), C({ at: Date.UTC(2026, 10, 10), side: 'office', ch: 'crew', by: 'Supt', byRank: 'Office' })], 'crew', Date.UTC(2026, 10, 5), Date.UTC(2026, 10, 14));
ok(sheet.tables[0].rows.length === 1 && sheet.tables[0].rows[0][1] === 'Supt, Office (office)', 'from a date; the office marked');
ok(sheet.title === 'Chat — Crew' && sheet.facts.some((f) => f.startsWith('From 2026-11-0')), 'English, with the period');

// The Board
const EMPTY = {
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const board = (x: any) => buildBoard({ ...EMPTY, on: (k: string) => k === 'chat', role: 'user', me: null, today: '2026-11-14', now: '2026-11-14T10:00', labelOf: String, periodsOf: () => [], ...x } as any).attention.filter((n: any) => n.key.startsWith('chat:'));
const named = C({ at: 5, by: 'Ann', mentions: ['Jez Dodd'] });
const b1 = board({ me: { key: 'k', name: 'Jez Dodd' }, chat: [named] });
ok(b1.length === 1 && b1[0].key === 'chat:me:crew' && !!b1[0].first && b1[0].level === 'amber', 'named: first, amber, one line');
ok(board({ me: { key: 'k', name: 'Ann' }, chat: [named] }).length === 0, 'my own message: nothing');
ok(board({ me: { key: 'k', name: 'Liam' }, chat: [named] })[0]?.key === 'chat:new:crew', 'someone else: new in Crew (blue)');
ok(board({ me: { key: 'k', name: 'Liam' }, chat: [named], prefs: { chatRead: { crew: 5 } } }).length === 0, 'opened: gone');
ok(board({ role: 'user', chat: [C({ ch: 'officers', by: 'Ann' })] }).length === 0, "the officers' channel: not on a crew Board");
ok(board({ role: 'admin', chat: [C({ ch: 'office', side: 'office', by: 'Supt' })] })[0]?.title.includes('office'), 'the office wrote: said so, for officers');
ok(board({ on: () => false, chat: [named], me: { key: 'k', name: 'Jez Dodd' } }).length === 0, 'module off: nothing');

// Fleet's inbox
const base: any = { imo: '1', name: 'V', machines: [], jobs: [], certificates: [], items: [], chatOffice: [off({ at: 1, text: 'Need the class report' })] };
const parts = { office: false, po: false, crit: false, ext: false, moc: false, threads: false, chat: true };
const row = inboxOf(base, parts);
ok(row.length === 1 && row[0].kind === 'chat' && row[0].tab === 'chat' && row[0].title === 'Need the class report', 'in Waiting for you');
ok(inboxOf(base, { ...parts, chat: false }).length === 0, 'module off: not in the inbox');
ok(inboxOf({ ...base, chatOffice: [...base.chatOffice, off({ at: 2, side: 'office' })] }, parts).length === 0, 'answered: off the list');

// Who can be mentioned: connected people who read the channel, then the crew list
const D = (o: any): any => ({ id: o.firstName, role: 'user', approved: true, ...o });
const devs = [
  D({ firstName: 'Liam', lastName: 'Ng', position: 'AB', lastSeenAt: 9 }),
  D({ firstName: 'Ann', lastName: 'Lee', role: 'superadmin', position: 'Master' }),
  D({ firstName: 'Bo', lastName: 'Ek', role: 'admin', position: 'C/O' }),
  D({ firstName: 'liam', lastName: 'ng', platform: 'web', lastSeenAt: 1 }),
  D({ firstName: 'Off', lastName: 'X', disabled: true }),
  D({ firstName: 'Old', lastName: 'X', disabled: true, retiredAt: 1 }),
  D({ firstName: 'Wait', lastName: 'X', approved: false }),
  D({ firstName: 'Tab', lastName: 'X', shared: true }),
  D({ firstName: 'Hosp', lastName: 'X', app: 'mhm' }),
  D({ firstName: 'Supt', lastName: 'X', role: 'shore' }),
];
const crewP = chatPeople(devs, [{ name: 'Ann Lee', rank: 'Master' }, { name: 'Tom Cook', rank: 'Cook' }], 'crew');
ok(crewP.map((p) => p.name).join() === 'Ann Lee,Bo Ek,Liam Ng,Tom Cook', 'crew: connected officers first, once each, then the crew list');
ok(crewP[0].rank === 'Master', 'crew: rank from the account');
ok(chatPeople(devs, [], 'officers').map((p) => p.name).join() === 'Ann Lee,Bo Ek', 'officers: officers only, no shore');

// What the strip says
const S = [C({ at: 1, by: 'Ann' }), C({ at: 5, by: 'Ann' }), C({ at: 6, by: 'Liam' }), C({ at: 7, ch: 'officers', by: 'Bo' }), C({ at: 8, ch: 'office', by: 'Supt', side: 'office' })];
ok(chatToShow(S, ['crew'], 'Liam', {}, undefined).fresh.length === 0 && chatToShow(S, ['crew'], 'Liam', {}, undefined).mark === 6, 'first run: the mark only');
ok(chatToShow([], ['crew'], 'Liam', {}, undefined).mark === 0, 'first run, no messages: mark 0, so the first message is said');
const s1 = chatToShow(S, ['crew'], 'Liam', {}, 2);
ok(s1.fresh.map((x) => x.at).join() === '5' && s1.mark === 6, 'crew device: newer than the mark, not my own, not the officers\'');
ok(chatToShow(S, ['crew'], 'Liam', {}, 6).mark === undefined, 'nothing newer: mark kept');
ok(chatToShow(S, ['crew'], 'Liam', { crew: 5 }, 2).fresh.length === 0, 'opened already: not said');
const s2 = chatToShow(S, ['crew', 'officers', 'office'], 'Liam', {}, 4, 'crew');
ok(s2.fresh.map((x) => x.at).join() === '8,7' && s2.mark === 8, 'officer: newest first, the channel on screen left out');

// Rules and sync name the same collections
const rules = readFileSync('firestore.rules', 'utf8');
const sync = readFileSync('services/firebaseService.ts', 'utf8');
for (const ch of CHAT_CHANNELS) {
  ok(rules.includes(`match /${CHAT_SUB[ch]}/{id}`) && rules.includes(`chatMessageOk(id, '${ch}')`), `rules: ${CHAT_SUB[ch]}`);
  ok(sync.includes(`sub: '${CHAT_SUB[ch]}'`), `sync: ${CHAT_SUB[ch]}`);
  ok(!!(en as any)[`chat.ch.${ch}`] && !!(en as any)[`chat.who.${ch}`], `words: ${ch}`);
}
ok(/sub: 'chat_crew'[^\n]*\n/.test(sync) && !/sub: 'chat_crew'[^\n]*officers: true/.test(sync), 'crew channel: on every device');
ok(/sub: 'chat_officers'[^\n]*officers: true/.test(sync) && /sub: 'chat_office'[^\n]*officers: true/.test(sync), 'officers and office: officers only');

console.log(fail ? `\n${fail} failed` : '\nAll passed');
process.exit(fail ? 1 : 0);
