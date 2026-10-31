// npm run check:poapproval — requisitions through the Master and the office: stages, who may do what, cuts, emergency, progress, Board, rules.
import * as fs from 'fs';
import * as path from 'path';
import {
  approvedNotPlaced, emergencyOpen, emergencyRejected, emergencySend, lastCuts, linesEditable, markReview, masterApprove, masterReturn, mayOrder,
  OFFICE_STEPS, officeApprove, officeOrdered, officeQueue, officeReject, officeReturn, poStage, poSummary, progress, returnedBy, round, submit, VESSEL_STEPS, NEEDS_NOTE,
} from '../services/poApproval';
import { copyOrder, liveLines } from '../services/orders';
import { quoteTotal } from '../services/rfq';
import { buildBoard } from '../services/board';
import { PurchaseOrder } from '../types/orders';
import { MANUAL, releasedManual } from '../constants/manual';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

const PO = (p: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po1', no: 'PO-EN-001-2026', dept: 'engine', status: 'draft', date: '2026-10-31', by: '2/E',
  lines: [{ id: 'l1', description: 'Filter', qty: 10, unit: 'pcs', unitPrice: 5 }, { id: 'l2', description: 'Paint', qty: 4, unit: 'L', unitPrice: 20 }],
  at: 1, updatedAt: 1, ...p,
});
const officer = { name: 'Tom', rank: '2/E' };
const master = { name: 'Ann', rank: 'Master' };
const office = { name: 'Supt', rank: 'Office' };

// The way, step by step
let o = PO();
ok(poStage(o) === 'draft' && !mayOrder(o) && linesEditable(o), 'new: draft, editable, not to be placed');
o = submit(o, officer, 2);
ok(poStage(o) === 'master' && linesEditable(o), 'submitted: with the Master, still editable');
ok(throws(() => submit(o, officer, 3)), 'cannot submit twice');
ok(throws(() => masterReturn(o, master, ' ', 3)), 'the Master returns only with a reason');
const back = masterReturn(o, master, 'Add the part numbers', 3);
ok(poStage(back) === 'returned' && returnedBy(back)?.note === 'Add the part numbers' && linesEditable(back), "Master's return: back to the officer with the reason");
ok(round(back).length === 0, 'a return starts a new round');
o = masterApprove(submit(back, officer, 4), master, 5);
ok(poStage(o) === 'office' && !linesEditable(o) && !mayOrder(o), 'sent to the office: locked, not to be placed');
ok(throws(() => officeOrdered(o, office, 6, '2026-10-31')), 'the office cannot place it before approving');
o = markReview(o, office, 6);
ok(poStage(o) === 'review', 'opened by the office: under review');
ok(markReview(o, office, 7) === o, '…recorded once');
ok(throws(() => officeApprove(o, office, 8, '', { l2: { to: 0, note: '' } })), 'a cut needs its reason');
ok(throws(() => officeApprove(o, office, 8, '', { l2: { to: 6, note: 'More' } })), 'the office cannot raise a quantity');
ok(throws(() => officeApprove(o, office, 8, '', { l1: { to: 0, note: 'No' }, l2: { to: 0, note: 'No' } })), 'every line struck: reject instead');
const ap = officeApprove(o, office, 8, 'OK', { l2: { to: 0, note: 'Paint in stock in Palma' }, l1: { to: 10, note: '' } });
ok(poStage(ap) === 'approved' && mayOrder(ap), 'approved: may be placed');
ok(ap.lines[1].qty === 0 && ap.lines[1].cut?.asked === 4 && ap.lines[1].cut?.note === 'Paint in stock in Palma', 'struck line keeps what was asked and why');
ok(ap.lines[0].cut === undefined, 'an unchanged quantity is not a cut');
ok(lastCuts(ap).length === 1 && lastCuts(ap)[0].from === 4 && lastCuts(ap)[0].to === 0, 'the approval records the cut');
ok(liveLines(ap).length === 1, 'struck lines are not ordered');
ok(quoteTotal(ap, { id: 'q', supplier: 'S', askedAt: '2026-10-31', currency: 'EUR', prices: { l1: 5 } }).complete, 'a quote need not price a struck line');
const placed = officeOrdered(ap, office, 9, '2026-11-01', 'Order 4411');
ok(placed.status === 'sent' && placed.sentAt === '2026-11-01' && poStage(placed) === 'inWork', 'the office places it: in work');

// Progress line
const pr = progress(placed);
ok(pr.map((m) => m.key).join() === 'sent,review,approved,inWork,delivered', 'five milestones');
ok(pr[0].state === 'done' && pr[1].state === 'done' && pr[2].state === 'done' && pr[3].state === 'now' && pr[4].state === 'todo', 'placed: three done, in work now');
ok(pr[0].at === 5 && pr[0].by === 'Ann (Master)', "'sent' is the Master's send to the office");
const rcv = { ...placed, status: 'received' as const, receivedAt: '2026-11-05', receivedBy: 'Tom' };
ok(progress(rcv).every((m) => m.state === 'done') && poStage(rcv) === 'delivered', 'received: all done');
ok(progress(PO({ status: 'partial' }))[4].state === 'now', 'part delivered: delivery is now');
const atMaster = submit(PO(), officer, 2);
ok(progress(atMaster)[0].state === 'now' && progress(atMaster)[1].state === 'todo', 'with the Master: sending is now');
const sentOnly = masterApprove(PO(), master, 2);
ok(progress(sentOnly)[1].state === 'now', 'sent: review is now');

// Office return and rejection
const rv = markReview(masterApprove(PO(), master, 2), office, 3);
ok(throws(() => officeReturn(rv, office, '', 4)), 'the office returns only with a reason');
const ret = officeReturn(rv, office, 'Split by department', 4);
ok(poStage(ret) === 'returned' && returnedBy(ret)?.kind === 'return' && progress(ret).every((m) => m.state === 'todo'), 'office return: new round, progress starts again');
const rej = officeReject(rv, office, 'Not needed this season', 4);
ok(poStage(rej) === 'rejected' && progress(rej)[2].state === 'bad' && !mayOrder(rej), 'rejected: shown as bad, never placed');

// Emergency
ok(throws(() => emergencySend(PO(), master, 'Pump', 2, '2026-10-31')), 'only an emergency order goes without the office');
ok(throws(() => emergencySend(PO({ urgency: 'emergency' }), master, '', 2, '2026-10-31')), '…and only with the reason');
const em = emergencySend(PO({ urgency: 'emergency' }), master, 'Steering gear pump', 2, '2026-10-31');
ok(em.status === 'sent' && emergencyOpen(em) && poStage(em) === 'inWork', 'emergency: sent at once, open for the office');
ok(progress(em)[0].note === 'Steering gear pump', 'progress shows the reason');
ok(officeQueue([em]).length === 1 && poSummary([em]).emergency === 1 && poSummary([em]).waiting === 0, 'in the office queue as an emergency');
const emOk = officeApprove(em, office, 3, '', { l1: { to: 1, note: 'ignored' } });
ok(!emergencyOpen(emOk) && emOk.lines[0].qty === 10, 'approved afterwards — lines already ordered are not cut');
const emNo = officeReject(em, office, 'Should have waited for Palma', 3);
ok(!emergencyOpen(emNo) && emergencyRejected(emNo), 'rejected afterwards');

// Queue and summary
const q1 = masterApprove(PO({ id: 'a', at: 1 }), master, 50);
const q2 = markReview(masterApprove(PO({ id: 'b', at: 2 }), master, 20), office, 30);
const q3 = { ...q1, id: 'c', deleted: true };
ok(officeQueue([q1, q2, q3, ap]).map((x) => x.id).join() === 'b,a', 'queue: waiting only, oldest send first, deleted left out');
ok(poSummary([q1, q2]).waiting === 2 && poSummary([q1, q2]).oldest === 20, 'summary: count and oldest');
ok(approvedNotPlaced([ap, placed]).length === 1, 'approved, not placed');

// Copying an order does not copy its approval
const cp = copyOrder(ap, []);
ok(!cp.approval && cp.lines.length === 1 && !cp.lines[0].cut, 'a copy starts a fresh requisition without struck lines');

// Board
const base: any = { on: (m: string) => ['orders', 'poApproval'].includes(m), role: 'superadmin', today: '2026-10-31', now: '2026-10-31T10:00', labelOf: (c: string) => c, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [], fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [], visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [] };
const keys = (orders: PurchaseOrder[], role = 'superadmin', on = base.on) => buildBoard({ ...base, role, on, purchaseOrders: orders }).attention.map((n: any) => n.key);
ok(keys([atMaster]).includes('po:master'), 'Master: requisitions waiting for approval');
ok(keys([back], 'admin').includes('po:back:po1'), 'officer: returned with the reason');
ok(keys([ap], 'admin').includes('po:ok:po1'), 'officer: approved, place it');
ok(keys([em]).includes('po:em:po1'), 'Master: sent without the office');
ok(keys([{ ...rej, approval: rej.approval!.map((s) => ({ ...s, at: Date.parse('2026-10-30T00:00:00Z') })) }], 'admin').includes('po:rej:po1'), 'officer: rejected (fresh)');
ok(!keys([rej], 'admin').includes('po:rej:po1'), 'an old rejection is no longer news');
ok(!keys([atMaster, ap, em], 'superadmin', (m: string) => m === 'orders').some((k: string) => k.startsWith('po:')), 'flag off: no requisition notices');

// The rules know the same step names, and the reason-required list
const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
const vessel = rules.match(/poStepAdded\(\['submit'\]\)[\s\S]*?poStepAdded\(\[([^\]]+)\]\)/);
const shore = rules.match(/shore\(v\)\s*&& onlyChanges[\s\S]*?poStepAdded\(\[([^\]]+)\]\)/);
const names = (s?: string) => (s ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort().join();
ok(names(`'submit',${vessel?.[1]}`) === [...VESSEL_STEPS].sort().join(), 'rules: vessel steps match the app');
ok(names(shore?.[1]) === [...OFFICE_STEPS].sort().join(), 'rules: office steps match the app');
const noteList = rules.match(/kind in \[('masterReturn'[^\]]+)\]\)\s*\n\s*\|\| n\[o\.size\(\)\]\.get\('note'/);
ok(names(noteList?.[1]) === [...NEEDS_NOTE].sort().join(), 'rules: steps needing a reason match the app');

// The manual: one paragraph per language, hidden while the flag is off
for (const lang of ['en', 'ru', 'uk', 'es', 'pt', 'no'] as const) {
  const i = MANUAL.en.sections.findIndex((x) => x.title === 'Suppliers and quotations');
  const full = MANUAL[lang].sections[i]?.body ?? [];
  const shown = releasedManual(lang).sections.find((x) => x.title === MANUAL[lang].sections[i]?.title)?.body ?? [];
  ok(full.length === 3 && shown.length === 2 && !shown.some((b) => b.includes('→')), `manual ${lang}: the paragraph is there and hidden with the flag off`);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
