// npm run check:orders — the Master's orders: who signs, where a night stands, revisions, the Board, the paper, rules, sync and words.
import { currentStanding, defaultWatch, hasSigned, isBridgeRank, nextRev, nightEditable, nightProblem, nightState, orderBoard, signStatus, standingProblem, standingReaders } from '../services/orderBook';
import { nightBook, nightRows, nightSheet, standingSheet, NIGHT_HEAD, NIGHT_WIDTHS } from '../services/orderBookRows';
import { buildBoard } from '../services/board';
import { en } from '../constants/i18n/en';
import { standingId, orderAckId } from '../types/orderBook';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const C = (id: string, name: string, rank: string, o: any = {}): any => ({ id, name, rank, active: true, addedAt: 1, updatedAt: 1, ...o });
const crew = [C('m', 'Ann', 'Master'), C('co', 'Bob', 'Chief Officer'), C('2o', 'Cid', '2nd Officer'), C('3o', 'Dan', 'Third Officer'), C('dpo', 'Eve', 'SDPO'),
  C('ce', 'Fay', 'Chief Engineer'), C('cad', 'Gus', 'Deck Cadet'), C('bos', 'Hal', 'Bosun'), C('off', 'Ivy', '2nd Officer', { onBoard: false })];

// Who signs.
ok(isBridgeRank('Chief Officer') && isBridgeRank('SDPO') && isBridgeRank('DP Operator') && !isBridgeRank('Master') && !isBridgeRank('Chief Engineer') && !isBridgeRank('Deck Cadet') && !isBridgeRank('Bosun'), 'bridge: mates and DPOs, not the Master, engineers, cadets or ratings');
ok(defaultWatch(crew).map((r) => r.key).join() === 'co,2o,3o,dpo', 'tonight\'s watch to start with: the bridge officers aboard');
ok(standingReaders(crew, 'bridge').map((r) => r.key).join() === 'co,2o,3o,dpo', 'standing orders for the bridge');
ok(standingReaders(crew, 'officers').map((r) => r.key).join() === 'co,2o,3o,dpo,ce', '…for every officer: engineers too, never the Master or a cadet');

// Signatures.
const A = (orderId: string, personKey: string, by: string, at = 5): any => ({ id: orderAckId(orderId, personKey), orderId, kind: 'night', personKey, by, at, updatedAt: at });
const N = (o: any = {}): any => ({ id: 'n1', date: '2026-11-14', text: 'Keep 2 nm off.', watch: defaultWatch(crew).slice(0, 3), by: 'Ann', byRank: 'Master', createdAt: 1, updatedAt: 1, ...o });
const acks = [A('n1', 'co', 'Bob'), A('n1', 'device:x', 'cid  '), A('n1', 'z', 'Relief Mate'), A('n2', '3o', 'Dan')];
const st = signStatus('n1', N().watch, acks);
ok(st.signed.map((x) => x.reader.key).join() === 'co,2o' && st.unsigned.map((r) => r.key).join() === '3o', 'signed by crew id, or by name from a device account');
ok(st.others.map((a) => a.by).join() === 'Relief Mate', 'someone not asked still shows');
ok(!!hasSigned('n1', acks, { key: 'device:y', name: 'Bob' }) && !hasSigned('n1', acks, { key: '3o', name: 'Dan' }), 'one night\'s signature is not another\'s');
ok(orderAckId('so_master_r2', 'device:a/b') === 'so_master_r2_device:a_b', 'one signature per person per order, a safe id');

// Where a night stands.
ok(nightState(N(), '2026-11-14T20:00') === 'tonight' && nightState(N(), '2026-11-15T02:00') === 'tonight' && nightState(N(), '2026-11-15T11:59') === 'tonight', 'the night holds until noon the day after');
ok(nightState(N(), '2026-11-15T12:00') === 'toClose', '…then the Master is to close it');
ok(nightState(N({ closed: { by: 'Ann', at: 9 } }), '2026-11-16T00:00') === 'closed' && nightState(N({ cancelled: { by: 'Ann', at: 9, note: 'twice' } }), '2026-11-14T20:00') === 'cancelled', 'closed, cancelled');
ok(nightEditable(N({ id: 'n9' }), acks) && !nightEditable(N(), acks) && !nightEditable(N({ id: 'n9', closed: { by: 'A', at: 1 } }), acks), 'put right only until the first signature, never once closed');
ok(nightProblem(N()) === null && nightProblem(N({ text: ' ' })) === 'text' && nightProblem(N({ date: '14.11.2026' })) === 'date', 'a night needs its date and its orders');

// Revisions.
const S = (rev: number, o: any = {}): any => ({ id: standingId('master', rev), kind: 'master', rev, issued: '2026-11-01', text: `Rev ${rev}`, readers: 'bridge', by: 'Ann', createdAt: rev, updatedAt: rev, ...o });
const revs = [S(1), S(3), S(2), { ...S(1), id: standingId('dp', 1), kind: 'dp' }];
ok(currentStanding(revs, 'master')?.rev === 3 && currentStanding(revs, 'dp')?.rev === 1 && nextRev(revs, 'master') === 4 && nextRev([], 'dp') === 1, 'the highest revision is in force; the next is one up');
ok(standingId('dp', 2) === 'so_dp_r2' && standingProblem(S(1)) === null && standingProblem(S(1, { text: '' })) === 'text', 'ids and a revision\'s problems');

// The Board's lists.
const nights = [N(), N({ id: 'n0', date: '2026-11-12' }), N({ id: 'n2', date: '2026-11-13', watch: defaultWatch(crew), closed: { by: 'A', at: 1 } })];
const sAcks = [A('so_master_r3', 'co', 'Bob'), ...acks];
const ob = (me: any, now = '2026-11-14T22:00', dp = true) => orderBoard({ nights, standing: revs, acks: sAcks, crew, now, me, dp });
const b = ob({ key: 'device:q', name: 'Dan' });
ok(b.mineNight.map((o) => o.id).join() === 'n1', 'Dan keeps a watch tonight and has not signed');
ok(b.mineStanding.map((s) => s.id).join() === 'so_master_r3,so_dp_r1', '…nor the standing orders in force');
ok(ob({ key: 'co', name: 'Bob' }).mineStanding.map((s) => s.id).join() === 'so_dp_r1' && !ob({ key: 'co', name: 'Bob' }).mineNight.length, 'Bob signed tonight and the Master\'s revision 3');
ok(!ob({ key: 'm', name: 'Ann' }).mineNight.length && !ob({ key: 'm', name: 'Ann' }).mineStanding.length, 'the Master is not asked to sign their own orders');
ok(b.toClose.map((o) => o.id).join() === 'n0' && b.unsignedNight.map((u) => u.order.id).join() === 'n1', 'the Master: the night of the 12th to close, tonight\'s unsigned');
ok(!ob(null, '2026-11-14T22:00', false).unsignedStanding.some((u) => u.order.kind === 'dp'), 'no DP orders without the DP module');
ok(!ob({ key: 'device:q', name: 'Dan' }, '2026-11-15T13:00').mineNight.length, 'a night over is not asked to be signed any more');

// The Board itself.
const base: any = {
  on: (k: string) => k === 'orderBook' || k === 'dp', role: 'superadmin', me: { key: 'device:q', name: 'Dan' }, today: '2026-11-14', now: '2026-11-14T22:00', labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew, crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [], nightOrders: nights, standingOrders: revs, orderAcks: sAcks,
};
const all = (x: any = {}) => buildBoard({ ...base, ...x }).attention.filter((n: any) => n.key.startsWith('ob:'));
const keys = all().map((n: any) => n.key);
ok(keys.includes('ob:mine:n1') && keys.includes('ob:mine:so_master_r3') && keys.includes('ob:close') && keys.includes('ob:night:n1') && keys.includes('ob:so:so_master_r3'), 'Board: to sign, to close, who has not signed');
ok(all().find((n: any) => n.key === 'ob:mine:n1')?.first === true && all().find((n: any) => n.key === 'ob:mine:n1')?.route === 'OrderEntry', '…the person\'s own line first, opening the night');
ok(!all({ role: 'admin' }).some((n: any) => n.key === 'ob:close') && all({ role: 'admin' }).some((n: any) => n.key === 'ob:mine:n1'), '…closing is the Master\'s; signing is the officer\'s');
ok(!all({ role: 'user' }).length && !all({ on: () => false }).length, '…not on a crew device, not with the flag off');

// The paper.
const rows = nightRows(nights, acks, '2026-11-14T22:00');
ok(rows.map((r) => r[0]).join() === '12.11.2026,13.11.2026,14.11.2026', 'the book: oldest night first');
const r14 = rows[2];
ok(/^Bob \(Chief Officer\) /.test(r14[4]) && /Relief Mate/.test(r14[4]) && r14[5] === 'Dan (Third Officer)' && r14[6] === 'In force' && r14[7] === 'Ann (Master)', '…who signed, who did not, the state, who wrote it');
ok(rows[0][6] === 'NOT CLOSED', '…a night not closed is said in capitals');
ok(NIGHT_HEAD.length === Object.keys(NIGHT_WIDTHS).length && Object.values(NIGHT_WIDTHS).reduce((a, x) => a + x, 0) === 277, 'the book\'s table sized to the page');
const book = nightBook(nights, acks, '2026-11-13', '2026-11-14', '2026-11-14T22:00');
ok(book.tables[0].rows.length === 2 && book.facts.includes('2 nights'), '…for the period chosen');
const sheets = [nightSheet(N({ callMe: 'Any doubt.' }), acks, '2026-11-14T22:00'), standingSheet(S(3, { changeNote: 'New CPA.' }), revs, sAcks, crew, '2026-11-14', true), standingSheet(S(1), revs, sAcks, crew, '2026-11-14', false)];
for (const sh of sheets) for (const tb of sh.tables) ok(Object.keys(tb.widths ?? {}).length === tb.head.length && Object.values(tb.widths ?? {}).reduce((a: number, x: any) => a + x, 0) === 277, `"${sh.title}" / "${tb.title}" sized to the page`);
ok(sheets[1].tables.find((tb) => tb.title === 'Read and signed')!.rows.filter((r) => r[2] === 'NOT SIGNED').length === 3, 'a revision in force lists who has not signed');
ok(sheets[2].facts.includes('SUPERSEDED') && sheets[2].tables.find((tb) => tb.title === 'Revisions')!.rows[0][0] === '3', 'a superseded revision says so, newest revision first');
const src = readFileSync('services/orderBookRows.ts', 'utf8') + readFileSync('services/orderBookReport.ts', 'utf8');
ok(!/\bt\(|\btk\(/.test(src), 'the paper does not use t()');

// Rules, sync, words.
const rules = readFileSync('firestore.rules', 'utf8');
const blk = (name: string) => new RegExp(`match /${name}/\\{id\\} \\{([\\s\\S]*?)\\n      \\}`).exec(rules)?.[1] ?? '';
ok(/allow create: if isSuper\(v\)/.test(blk('night_orders')) && /date == resource\.data\.date/.test(blk('night_orders')) && /allow delete: if false/.test(blk('night_orders')), 'rules: a night is the Master\'s, its date fixed, never deleted');
ok(/allow create: if isSuper\(v\)/.test(blk('standing_orders')) && /allow update, delete: if false/.test(blk('standing_orders')), 'rules: a revision issued once by the Master');
ok(/allow create: if isAdmin\(v\)/.test(blk('order_acks')) && /allow update, delete: if false/.test(blk('order_acks')), 'rules: officers sign, nobody changes a signature');
for (const b2 of ['night_orders', 'standing_orders', 'order_acks']) ok(/allow read: if isAdmin\(v\) \|\| shore\(v\)/.test(blk(b2)), `rules: ${b2} for officers and the office`);
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'night_orders',[^\n]*module: 'orderBook', officers: true/.test(fb) && /sub: 'standing_orders',[^\n]*appendOnly: true, module: 'orderBook', officers: true/.test(fb) && /sub: 'order_acks',[^\n]*appendOnly: true, module: 'orderBook', officers: true/.test(fb), 'sync: officers only, with the flag; revisions and signatures append-only');
const k = Object.keys(en);
ok(['cancelled', 'closed', 'tonight', 'toClose'].every((s) => k.includes(`ob.st.${s}`)) && ['date', 'text'].every((s) => k.includes(`ob.bad.${s}`)) && ['night', 'master', 'dp'].every((v) => k.includes(`ob.view.${v}`) && k.includes(`ob.sub.${v}`)), 'words for every state, problem and page');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
