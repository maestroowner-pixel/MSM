// npm run check:hospital — stock by batch, expiry, orders delivered in parts, the inventory, the register, the scale, the Excel list, the board.
import {
  chestStatus, checkLinesFor, differences, expiryState, followUpsDue, lastControlledCount, nextNo, normExpiry, onOrderByItem, orderOverdue, orderState,
  pickBatch, planImport, sortChest, purposeOf, earliestExpiry, matchesName, stockLevel, matchesSearch, purposeIcon, mmYY, readSheet, receivedByLine, registerLines, scaleEntry, scaleItems, stockByItem, toOrder,
} from '../services/hospital';
import { MED_SCALE, NURSING_SCALE } from '../constants/medScale';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-10-13';
let at = 0;
const I = (o: any): any => ({ id: 'p', name: 'Paracetamol', strength: 'tablet 500mg', unit: 'tablets', required: 100, kind: 'medicine', order: 0, updatedAt: 1, ...o });
const M = (o: any): any => ({ id: `m${++at}`, itemId: 'p', kind: 'received', qty: 10, date: T, by: 'Ann', at, updatedAt: at, ...o });

// stock
const moves = [M({ qty: 50, batchNo: 'A1', expiry: '2026-10-01' }), M({ qty: 60, batchNo: 'b2 ', expiry: '2026-11-01' }), M({ qty: 40, batchNo: 'C3', expiry: '2028-01-31' }), M({ kind: 'issued', qty: 10, batchNo: 'B2', expiry: '2026-11-01' }), M({ kind: 'count', qty: 38, batchNo: 'C3', expiry: '2028-01-31' })];
const b = stockByItem(moves).get('p')!;
ok(b.length === 3 && b[0].batchNo === 'A1' && b[1].qty === 50 && b[2].qty === 38, 'batches: received, issued (batch matched ignoring case/space), a count sets the batch; earliest expiry first');
const st = chestStatus([I({})], moves, T)[0];
ok(st.onHand === 138 && st.expired === 50 && st.usable === 88 && st.short === 12, 'on hand / out of date / in date / short');
ok(st.next === '2026-11-01' && st.nextState === 'soon', 'next expiry of what is in date — within 30 days');
ok(expiryState(T, '2026-10-20') === 'soon' && expiryState(T, '2026-10-12') === 'expired' && expiryState(T, undefined) === 'none', 'expiry states');
ok(pickBatch(b, 5, T)?.batchNo === 'b2', 'medicine given from the batch in date that expires first');
ok(normExpiry('2027-03') === '2027-03-31' && normExpiry('03/2027') === '2027-03-31' && normExpiry('15.04.2027') === '2027-04-15' && normExpiry(46000) === '2025-12-09' && normExpiry('soon') === undefined, 'expiry as written: month alone = its last day; dd.mm.yyyy; Excel serial');

// orders delivered in parts
const O = { id: 'o', no: 'MO-2026-001', date: '2026-10-01', due: '2026-10-10', lines: [{ id: 'l1', itemId: 'p', name: 'Paracetamol', unit: 'tablets', qty: 100 }, { id: 'l2', itemId: 'q', name: 'Ibuprofen', unit: 'tablets', qty: 50 }], by: 'Ann', at: 1, updatedAt: 1 } as any;
ok(orderState(O, []) === 'open', 'nothing received = open');
const d1 = [M({ qty: 60, orderId: 'o', lineId: 'l1' })];
ok(orderState(O, d1) === 'part' && receivedByLine(O, d1).get('l1') === 60, 'first delivery: part received, 60 of 100');
ok(onOrderByItem([O], d1).get('p') === 40 && onOrderByItem([O], d1).get('q') === 50, 'still to come, item by item');
ok(orderOverdue(O, d1, T), 'past the expected date and not complete = overdue');
const d2 = [...d1, M({ qty: 40, orderId: 'o', lineId: 'l1' }), M({ itemId: 'q', qty: 50, orderId: 'o', lineId: 'l2' })];
ok(orderState(O, d2) === 'done' && !orderOverdue(O, d2, T), 'every line in = complete, not overdue');
ok(orderState({ ...O, closedAt: 5 }, d1) === 'closed', 'closed with lines short');
ok(nextNo('MO', [O], '2026-12-01') === 'MO-2026-002' && nextNo('INV', [], T) === 'INV-2026-001', 'numbers MO / INV');
const need = toOrder(chestStatus([I({})], moves, T), T, new Map([['p', 30]]));
ok(need[0]?.need === 100 - 30 || need[0]?.need === Math.min(100, 12 + 50) - 30, 'to order: short + expiring, less what is on order');

// inventory
const lines = checkLinesFor(chestStatus([I({}), I({ id: 'z', name: 'Zinc' })], moves, T));
ok(lines.length === 4 && lines[3].itemId === 'z' && lines[3].expected === 0, 'a line per batch, and one for an item with none');
ok(differences({ lines: [{ ...lines[0], counted: 49 }, lines[1]] }).length === 1, 'differences');

// controlled drugs
const cd = [M({ itemId: 'mo', qty: 10, batchNo: 'X' }), M({ itemId: 'mo', kind: 'issued', qty: 1, batchNo: 'X' }), M({ itemId: 'mo', kind: 'count', qty: 8, batchNo: 'X', date: '2026-10-05' })];
const reg = registerLines('mo', cd);
ok(reg.map((l) => l.balance).join() === '10,9,8' && reg[2].out === 1, 'register: balance after each line; a short count shows as out');
ok(lastControlledCount([I({ id: 'mo', controlled: true })], cd) === '2026-10-05', 'last count of the controlled drugs');

// medical log
ok(followUpsDue([{ id: 't1', followUp: '2026-10-12' } as any, { id: 't2', followUp: '2026-10-20' } as any, { id: 't3', followUp: '2026-10-01' } as any, { id: 't4', followUpOf: 't3' } as any], T).map((t) => t.id).join() === 't1', 'follow-ups due, not yet written');

// the scale
const c = scaleItems('C');
const a = scaleItems('A');
ok(c.length < a.length && c.every((x) => x.required > 0), 'category C has fewer lines than A, each with a quantity');
ok(a.some((x) => x.controlled && /morphine/i.test(x.name)), 'morphine is controlled');
ok(MED_SCALE.length === 75 && NURSING_SCALE.length === 83, 'scale from Marine Hospital Manager: 75 medicines, 83 equipment');
ok(!!scaleEntry({ name: 'Adrenaline', strength: 'ampoule 1:1000 (1mg/ml)' }).med?.ref, 'IMGS reference found by name');
ok(!scaleEntry({ name: 'Morphine sulfate' }).med?.ref, 'no reference where the guide’s form differs (morphine injection vs oral)');

// Excel list
const sheet = readSheet([['Medicine chest'], ['Name', 'Strength / form', 'Unit', 'Required', 'Kind', 'Location', 'Controlled', 'Batch', 'Expiry', 'Quantity'], ['Paracetamol', 'tablet 500mg', 'tablets', 100, 'medicine', 'Hospital', '', 'A1', '2027-03', 40], ['Paracetamol', 'tablet 500mg', 'tablets', 100, '', '', '', 'A2', '04/2028', 60], ['Morphine', 'amp 10mg', 'ampoules', 10, '', 'Safe', 'yes', 'M1', '2027-01', 10], ['', '', '', '', '', '', '', '', '', 'stray']]);
ok(sheet.lines.length === 3 && sheet.skipped === 1 && sheet.lines[2].controlled && sheet.lines[1].expiry === '2028-04-30', 'reads the list: header found, controlled, expiry, a stray row skipped');
const plan = planImport(sheet.lines, [I({})]);
ok(plan.update.length === 1 && plan.add.length === 1 && plan.counts.length === 3, 'existing item updated, new added, each batch with a quantity counted');

// the register's order
const sorted = chestStatus([
  I({ id: 'z', name: 'Zinc oxide', strength: 'paste/ointment 20%', required: 1 }),
  I({ id: 'a', name: 'Adrenaline', strength: 'ampoule 1:1000 (1mg/ml)', required: 1 }),
  I({ id: 'g', name: 'Gauze', group: 'Bandages & Sutures', kind: 'consumable', required: 1 }),
], [M({ itemId: 'z', expiry: '2026-11-30' }), M({ itemId: 'a', expiry: '2028-01-31' }), M({ itemId: 'g', expiry: '2026-10-01' })], T);
ok(sortChest(sorted, 'name').map((r) => r.item.id).join() === 'a,g,z', 'A–Z');
ok(sortChest(sorted, 'expiry').map((r) => r.item.id).join() === 'g,z,a', 'by expiry, out of date first');
ok(purposeOf(sorted[1].item) === 'Cardiovascular' && purposeOf(sorted[2].item) === 'Bandages & Sutures', 'purpose from the WHO IMGS group, or the item’s own');
ok(sortChest(sorted, 'purpose').map((r) => purposeOf(r.item)).join() === 'Bandages & Sutures,Cardiovascular,Dermatology', 'by purpose, groups in order');
ok(earliestExpiry(sorted[2]) === '2026-10-01', 'soonest expiry includes out of date');
ok(matchesSearch(sorted[1].item, 'anaphylaxis') && matchesSearch(sorted[1].item, 'C01CA24'), 'MHM search: indication and ATC');
ok(stockLevel({ usable: 0, item: { required: 10 } } as any) === 'empty' && stockLevel({ usable: 2, item: { required: 10 } } as any) === 'critical' && stockLevel({ usable: 4, item: { required: 10 } } as any) === 'low' && stockLevel({ usable: 9, item: { required: 10 } } as any) === 'adequate' && stockLevel({ usable: 10, item: { required: 10 } } as any) === 'good', 'MHM stock levels <25 / <50 / <100 %');
ok(purposeIcon('Cardiovascular') === '❤️' && mmYY('2027-11-30') === '11/27', 'group mark, MM/YY');
ok(matchesName(sorted[1].item, 'adren') && !matchesName(sorted[1].item, 'zinc'), 'search by name');

// board
const base: any = { on: (k: string) => k === 'hospital', role: 'admin', me: null, today: T, now: `${T}T10:00`, labelOf: (k: any) => k, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], rest: [], machines: [], pmsJobs: [], pmsDone: [], pmsDeferrals: [], pmsDefects: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [], fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [], visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], rounds: [], categories: [], templates: {} };
try {
  const bd = buildBoard({ ...base, role: 'superadmin', medItems: [I({}), I({ id: 'mo', name: 'Morphine', controlled: true })], medMoves: moves, medOrders: [O], medTreatments: [] });
  ok(bd.attention.some((n: any) => n.key === 'med:exp'), 'board: out of date');
  ok(bd.attention.some((n: any) => n.key === 'med:ord:o'), 'board: overdue order');
  ok(bd.attention.some((n: any) => n.key === 'med:cd'), 'board: controlled drugs never counted');
  ok(bd.tiles.some((t: any) => t.key === 'med'), 'board: Hospital tile');
} catch (e: any) {
  ok(false, `board builds: ${e?.message}`);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
