// npm run check:board — the notice board picks the right things from each module.
import { buildBoard, BoardInput } from '../services/board';
import { passengerFromCloud, passengerToCloud } from '../types/passengers';
import { planPaxImport, readPaxRows, paxSheet, PAX_HEAD } from '../services/passengerList';
import { uid } from '../utils/id';
import { heldByPerson, planStoreImport, readStoreSheet, storeStatus, storeSheet } from '../services/stores';
import { STORE_CODE_RE, nextRoomCode, roomByCode, roomOf, storeRooms } from '../types/stores';
import { parseStoreQr, storeQrPayload } from '../services/crewQr';
import { storeLabelSpecs } from '../services/gangwayLabels';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const base = (o: Partial<BoardInput> = {}): BoardInput => ({
  on: () => true, role: 'superadmin', me: null, today, now: `${today}T13:00`, labelOf: (c) => String(c), periodsOf: () => ['monthly'],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], ...o,
});
const pm = (() => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)); return t.toISOString().slice(0, 7); })();
const item = (id: string, expiry: string): any => ({ id, category: 'fire_extinguishers', expiryDate: expiry, nextInspection: expiry });

let b = buildBoard(base({ flat: [item('a', plus(-3)), item('b', plus(10)), item('c', plus(200))] }));
const eq = b.attention.find((x) => x.key === 'eq:fire_extinguishers');
ok(!!eq && eq.level === 'red' && /1 expired, 1 due soon/.test(eq.title), 'register grouped by category: 1 expired, 1 due');
ok(b.plan.some((p) => p.key === 'round:monthly' && /0 of 3 done/.test(p.sub)), 'monthly round progress 0 of 3');
ok(b.tiles.some((t) => t.key === 'eq' && t.level === 'red'), 'LSA/FFE tile red');

b = buildBoard(base({ on: (m) => m === 'fuel', fuelTanks: [{ id: 't', name: 'P', order: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((x) => x.key === 'fuel:snd'), 'after noon, no sounding → notice');
ok(b.today.some((t) => t.key === 'fuel:snd' && !t.done), 'today: sounding not done');
ok(!b.tiles.some((t) => t.key === 'sec'), 'module off → no tile');

b = buildBoard(base({ on: (m) => m === 'surveys', surveys: [{ id: 's', name: 'Class annual', due: plus(20), before: 3, after: 0, repeat: 12, anniversary: true, order: 0, updatedAt: 0 }] as any }));
ok(b.plan.some((p) => p.key === 'sv:s') && b.attention.some((x) => x.key === 'sv:s:n'), 'survey window closing in 20 days → plan + notice');

b = buildBoard(base({ role: 'user', on: (m) => m === 'garbage' || m === 'security', garbage: [{ id: 'g1', date: `${pm}-05`, method: 'shore', at: Date.parse(`${pm}-05T10:00:00`) }] as any }));
ok(!b.attention.some((x) => x.key === 'grb:verify'), 'crew do not see the Master’s verification');
ok(!b.attention.some((x) => x.key === 'isps:drill'), 'crew do not see officer items');
b = buildBoard(base({ role: 'superadmin', on: (m) => m === 'garbage', garbage: [{ id: 'g1', date: `${pm}-05`, method: 'shore', at: Date.parse(`${pm}-05T10:00:00`) }] as any }));
ok(b.attention.some((x) => x.key === 'grb:verify'), 'the Master sees it');
b = buildBoard(base({ role: 'user', on: (m) => m === 'pms', machines: [{ id: 'm', name: 'Steering gear', updatedAt: 0 }] as any, pmsJobs: [{ id: 'j', machineId: 'm', title: 'x', intervalDays: 30, lastDoneDate: plus(0), updatedAt: 0 }] as any, pmsDefects: [{ id: 'd', machineId: 'm', machineName: 'Steering gear', category: 'safety', description: 'Ram seal leaking', date: plus(0), by: 'x', at: 0, updatedAt: 0 }, { id: 'e', machineId: 'm', machineName: 'Steering gear', category: 'class', description: 'y', date: plus(0), by: 'x', at: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((a) => a.key === 'pms:defect-safety' && /Steering gear/.test(a.title)) && !b.attention.some((a) => a.key === 'pms:defect-class'), 'safety-critical defect shown to crew; class-affecting only to officers');
// on board is not signed on: those ashore apart (13 Oct 2026); passengers count too
const crew9 = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, active: true, addedAt: 0, updatedAt: 0, ...(i === 11 ? { onBoard: false } : {}) }));
const away9 = Array.from({ length: 9 }, (_, i) => ({ id: `mv${i}`, crewId: `c${i}`, name: `C${i}`, dir: 'ashore', date: today, time: '09:00', at: 1, by: 'w', via: 'qr', updatedAt: 1 }));
b = buildBoard(base({ crew: crew9 as any, crewMoves: away9 as any, passengers: [{ id: 'p1', name: 'Sophie', embarked: today, addedAt: 0, updatedAt: 0 }, { id: 'p2', name: 'Leo', embarked: plus(3), addedAt: 0, updatedAt: 0 }] as any }));
ok(b.tiles.find((t) => t.key === 'crew')?.line === '2 on board · 9 ashore · 1 on leave', 'crew tile: on board, ashore, on leave apart');
ok(b.status.pob?.total === 3 && b.status.pob?.ashore === 9, 'persons on board: 2 crew + 1 passenger; 9 ashore');
ok(/3 on board · 9 ashore/.test(b.tiles.find((t) => t.key === 'sec')?.line ?? ''), 'security tile: on board and ashore');
ok(b.tiles.find((t) => t.key === 'pax')?.line === '1 on board' && b.plan.some((p) => p.key === 'pax:in:p2'), 'passengers tile; one joining in 3 days on the plan');

// monthly safety meeting
const sm = (date: string, actions: any[] = []) => ({ id: `sm${date}`, no: `SM-${date}`, date, agenda: [], attendance: [], carried: [], actions, plannedBy: 'x', doneAt: 1, doneBy: 'Master', updatedAt: 1 });
b = buildBoard(base({ on: (k) => k === 'meetings', safetyMeetings: [] }));
ok(b.plan.some((p) => p.key === 'sm:due'), 'meeting: none held → on the plan');
b = buildBoard(base({ on: (k) => k === 'meetings', safetyMeetings: [sm(plus(-50), [{ id: 'a', text: 'Replace the torn life ring line', due: plus(-5) }])] as any }));
ok(b.attention.some((x) => x.key === 'sm:due' && x.level === 'red') && b.attention.some((x) => x.key === 'sm:act'), 'meeting: over a month ago → red; its action past due');

// gangway names for the Master only
const gw = (role: any) => buildBoard(base({ role, crew: crew9 as any, crewMoves: away9 as any })).summaries.find((v) => v.key === 'gangway')!;
ok(!!gw('superadmin').rows.find((r) => r.label === 'Ashore now')?.more?.length && !gw('admin').rows.some((r) => r.more?.length) && !gw('user').rows.some((r) => r.more?.length), 'gangway summary: names for the Master, counts for the others');
const tb = gw('user').table!;
ok(JSON.stringify(tb.head) === '["","On board","Ashore"]' && tb.rows[0].cells.join() === 'Crew,2,9' && tb.rows[tb.rows.length - 1].cells.join() === 'Total,2,9', 'gangway table: crew 2 on board, 9 ashore; total');

// tile order: Passengers in Documents' place
const order = buildBoard(base({ me: { key: 'k', name: 'Jez' }, docs: [{ id: 'd', title: 'SMS', updatedAt: 0 }] as any, passengers: [] })).tiles.map((t) => t.key);
ok(order.includes('docs') && order.includes('pax') && order.indexOf('pax') < order.indexOf('docs'), 'tiles: Passengers and Documents swapped');

// stores — PPE and provisions (14 Oct 2026)
{
  const it = (o: any): any => ({ store: 'provisions', unit: 'packs', min: 10, order: 0, updatedAt: 0, ...o });
  const mv = (o: any): any => ({ id: uid('m'), kind: 'received', date: today, by: 'x', at: Date.now(), updatedAt: 0, ...o });
  const items = [it({ id: 'pasta', name: 'Pasta' }), it({ id: 'milk', name: 'Milk', min: 6 }), it({ id: 'boots', store: 'ppe', name: 'Safety boots', size: '42', unit: 'pairs', min: 1 })];
  const moves = [mv({ itemId: 'pasta', qty: 24, expiry: plus(200) }), mv({ itemId: 'milk', qty: 4, expiry: plus(-1) }), mv({ itemId: 'milk', qty: 6, expiry: plus(3) }), mv({ itemId: 'boots', qty: 2 }), mv({ itemId: 'boots', kind: 'issued', qty: 1, to: 'Ann Lee', toId: 'c2', at: Date.now() + 1 }), mv({ itemId: 'pasta', kind: 'issued', qty: 20, expiry: plus(200), at: Date.now() + 2 })];
  const st = storeStatus(items, moves, today);
  const g = (id: string) => st.find((r) => r.item.id === id)!;
  ok(g('pasta').usable === 4 && g('pasta').short === 6, 'stores: issued to the galley, 4 left, 6 below the minimum');
  ok(g('milk').expired === 4 && g('milk').usable === 6 && g('milk').soon && g('milk').short === 0, 'stores: out-of-date batch apart, best before within a week flagged');
  ok(heldByPerson(items, moves).get('Ann Lee')?.[0]?.qty === 1 && g('boots').usable === 1, 'PPE: what a person holds; the store has 1 pair left');
  const lines = readStoreSheet([['Provision list'], ['Item', 'Section', 'UoM', 'Par', 'Shelf', 'Qty', 'Best before'], ['Example: x', '', '', '', '', '', ''], ['Olive oil 1 l', 'Dry store', 'bottles', 4, 'Rack A', 6, '11/27'], ['Pasta', 'Dry store', '', 12, '', '', '']]);
  ok(lines.length === 2 && lines[0].unit === 'bottles' && lines[0].min === 4 && lines[0].qty === 6 && lines[0].expiry === '2027-11-30', `store sheet: other people's headings read: ${JSON.stringify(lines[0])}`);
  const plan = planStoreImport(lines, items, 'provisions');
  ok(plan.added.join() === 'Olive oil 1 l' && plan.updated.join() === 'Pasta' && plan.save.find((x) => x.name === 'Pasta')?.min === 12 && plan.counts.length === 1, 'store import: matched by name, minimum updated, quantity counted in');
  ok(storeSheet(st.filter((r) => r.item.store === 'provisions')).length === 1 + 3, 'store export: a line per batch');
  const b = buildBoard(base({ on: (k) => k === 'stores', storeItems: items, storeMoves: moves }));
  ok(b.attention.some((x) => x.key === 'sto:pro:exp') && b.attention.some((x) => x.key === 'sto:pro:short') && b.tiles.some((t) => t.key === 'sto'), 'board: provisions out of date and below the minimum; Stores tile');

  // the vessel's own stores (gear on the Stores menu entry, 15 Oct 2026)
  const bosun: any = { id: 'str1', code: 'ST-01', name: "Bosun's store", kind: 'general', location: 'fwd lazarette', order: 2, updatedAt: 1 };
  const rooms = storeRooms([bosun, { id: 'ppe', code: 'PPE-1', name: 'Crew PPE', kind: 'provisions', order: 0, updatedAt: 1 } as any, { id: 'gone', code: 'X', name: 'Old', kind: 'general', order: 3, deleted: true, updatedAt: 1 } as any]);
  ok(rooms.map((r) => r.id).join() === 'ppe,provisions,str1' && rooms[0].name === 'Crew PPE' && rooms[0].kind === 'ppe' && storeRooms([]).length === 2, 'stores: the two built-in first (renamed, kind kept), the vessel’s own after, removed ones gone');
  ok(nextRoomCode(rooms) === 'ST-02' && nextRoomCode(storeRooms([])) === 'ST-01', 'store ID: the next free ST-nn offered');
  ok(STORE_CODE_RE.test('ST-01') && STORE_CODE_RE.test('ER_2') && !STORE_CODE_RE.test('ST 01') && !STORE_CODE_RE.test('ST/1') && !STORE_CODE_RE.test(''), 'store ID: letters, digits, - and _ only');
  ok(roomByCode(rooms, ' st-01 ')?.id === 'str1' && roomByCode(rooms, 'prov')?.id === 'provisions' && !roomByCode(rooms, 'ST-09'), 'store ID typed: found whatever the case');
  ok(parseStoreQr(storeQrPayload('str1')) === 'str1' && parseStoreQr('MSM://STORE/str1') === 'str1' && parseStoreQr('msm://sopep/x') === null && parseStoreQr('msm://store/') === null, 'store label: msm://store/<id> read back, others not');
  ok(roomOf({ store: 'provisions' }) === 'provisions' && roomOf({ store: 'general', roomId: 'str1' }) === 'str1', 'an item’s store: its room, or the built-in store of its kind');
  const bl = readStoreSheet([['Name', 'Category', 'Unit', 'Min', 'Quantity'], ['Shackle 16 mm', 'Deck', 'pcs', 4, 6], ['Pasta', '', 'packs', 2, 1]]);
  const bp = planStoreImport(bl, items, { id: 'str1', kind: 'general' });
  ok(bp.added.length === 2 && bp.updated.length === 0 && bp.save.every((x) => x.roomId === 'str1' && x.store === 'general') && bp.counts.length === 2, 'Excel into a store: its own list — Pasta of the provisions not touched, both lines added there');
  const bp2 = planStoreImport(bl.slice(0, 1), [...items, ...bp.save], { id: 'str1', kind: 'general' });
  ok(bp2.updated.join() === 'Shackle 16 mm' && bp2.added.length === 0, 'Excel into a store again: matched within that store');
  ok(planStoreImport(lines, items, { id: 'provisions', kind: 'provisions' }).save.every((x) => !x.roomId), 'built-in store: items keep no room id');
  const sp = storeLabelSpecs([bosun], { vessel_name: 'DreamBoat' }, '50x30');
  ok(sp[0].qrPayload === 'msm://store/str1' && sp[0].name === 'ST-01' && (sp[0].lines ?? []).join('|') === "Bosun's store|fwd lazarette|DreamBoat", 'store label sticker: QR with the id, the ID large, name and place');
  const sItems = [...items, ...bp.save.map((x) => ({ ...x, min: 10 }))];
  const b2 = buildBoard(base({ on: (k: string) => k === 'stores', storeItems: sItems, storeMoves: moves, storeRoomList: [bosun] }));
  ok(b2.attention.some((x) => x.key === 'sto:str1:short' && (x.params as any)?.view === 'str1' && x.title.startsWith("Bosun's store")), 'board: a general store below the minimum, opening that store');
}

// the guest list does not leave the vessel
const guest: any = { id: 'pax1', name: 'Sophie Martin', cabin: 'VIP', nationality: 'FR', notes: 'Vegetarian', embarked: today, addedAt: 0, updatedAt: 1 };
const up = passengerToCloud(guest);
ok(up.name === 'S…n' && !('nationality' in up) && !('notes' in up) && up.cabin === 'VIP' && guest.name === 'Sophie Martin', 'guest up: masked name, no nationality or notes');
const back = passengerFromCloud(guest, { ...up, disembarked: today, updatedAt: 5 });
ok(back.name === 'Sophie Martin' && back.nationality === 'FR' && back.disembarked === today && passengerFromCloud(undefined, up).name === 'S…n', 'guest down: own copy put back together; elsewhere the letters');
ok(uid('pax').startsWith('pax'), 'passenger ids start with pax (crossings masked by id)');
// passenger list Excel
const sheet = readPaxRows([['Passenger list'], PAX_HEAD, ['Example: X'], ['Sophie  Martin', "Owner's guest", 'VIP', 'France', '1985-04-12', 'Passport', '18AB23456', '2031-06-30', '2026-10-10', 'Palma', '', '', '+33', 'Paul', 'Vegetarian'], ['', 'x']]);
ok(sheet.length === 1 && sheet[0].name === 'Sophie Martin' && sheet[0].idNo === '18AB23456' && sheet[0].dateOfBirth === '1985-04-12', 'Excel read: name, passport, date of birth; examples and blanks skipped');
const plan = planPaxImport(sheet, [guest], [], today);
ok(plan.updated.length === 1 && plan.passengers[0].id === 'pax1' && plan.privates[0].idNo === '18AB23456' && plan.passengers[0].cabin === 'VIP', 'Excel import: matched by name, documents to the private record');
ok(paxSheet([guest], [], false)[0].length < PAX_HEAD.length, 'Excel out without documents for the crew');
const agent = readPaxRows([['Guest manifest — MY Aurora'], ['Surname', 'Given names', 'Nationality', 'DOB', 'Passport No.', 'Passport expiry', 'Stateroom', 'Arrival date', 'Remarks'], ['Example', 'Row', '', '', '', '', '', '', ''], ['MARTIN', 'Sophie', 'France', '12/04/1985', '18AB23456', '30/06/2031', 'VIP', '13/10/2026', 'Vegetarian']]);
ok(agent.length === 1 && agent[0].name === 'Sophie MARTIN' && agent[0].idNo === '18AB23456' && agent[0].cabin === 'VIP' && agent[0].nationality === 'France' && agent[0].notes === 'Vegetarian' && !!agent[0].dateOfBirth && !!agent[0].embarked, `an agent's manifest reads: ${JSON.stringify(agent[0])}`);
const fal = readPaxRows([['Family name, given names', 'Nationality', 'Date of birth', 'Nature and No. of identity document'], ['TESTOV Alexander', 'Cyprus', '1971-03-14', 'Passport K12345678']]);
ok(fal[0]?.name === 'TESTOV Alexander' && fal[0].idNo === 'Passport K12345678', 'a FAL Form 6 layout reads');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
