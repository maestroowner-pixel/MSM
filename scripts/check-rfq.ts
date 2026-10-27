// npm run check:rfq — quotes compared, the order awarded, a filled sheet read back, a supplier's record.
import { awardOrder, awardProblem, compareQuotes, findSuppliers, quoteFromSheet, quoteTotal, supplierStats } from '../services/rfq';
import { PurchaseOrder, Quote } from '../types/orders';
import { Supplier } from '../types/suppliers';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const po = (p: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po1', no: 'PO-EN-001-2026', dept: 'engine', status: 'draft', date: '2026-10-01', by: 'Sven',
  lines: [
    { id: 'l1', description: 'Fuel filter', qty: 10, unit: 'pcs', partNo: 'FF-1' },
    { id: 'l2', description: 'Oil filter', qty: 4, unit: 'pcs' },
    { id: 'l3', description: 'Impeller', qty: 2, unit: 'pcs', impa: '123456' },
  ],
  at: 1, updatedAt: 1, ...p,
});
const q = (id: string, p: Partial<Quote>): Quote => ({ id, supplier: id.toUpperCase(), askedAt: '2026-10-01', receivedAt: '2026-10-03', currency: 'EUR', prices: {}, ...p });

const A = q('a', { prices: { l1: 10, l2: 20, l3: 50 }, delivery: 30, discountPct: 10 });   // 100+80+100=280 −28 +30 = 282
const B = q('b', { prices: { l1: 9, l2: 25, l3: 45 } });                                   // 90+100+90 = 280
const C = q('c', { prices: { l1: 5, l2: 5 }, unavailable: ['l3'] });                         // 70, incomplete
const D = q('d', { prices: { l1: 1, l2: 1, l3: 1 }, currency: 'USD' });                     // other currency
const W = q('w', { receivedAt: undefined });
const X = q('x', { declined: true });

const o = po({ quotes: [A, B, C, D, W, X] });
const ta = quoteTotal(o, A);
ok(ta.goods === 280 && ta.discount === 28 && ta.delivery === 30 && ta.total === 282 && ta.complete, 'total = goods − discount + delivery, complete');
const tc = quoteTotal(o, C);
ok(!tc.complete && tc.priced === 2 && tc.unavailable.length === 1 && tc.missing.length === 0, 'a line they cannot supply is not missing, but the quote is incomplete');
ok(quoteTotal(o, q('e', { prices: { l1: 1 } })).missing.length === 2, 'unanswered lines are missing');

const c = compareQuotes(o);
ok(c.currency === 'EUR', 'ranking currency = the one most quotes came in');
ok(c.cheapestId === 'b', 'cheapest = lowest COMPLETE quote (C is cheaper but incomplete)');
ok(c.ranked[0].q.id === 'b' && c.ranked[c.ranked.length - 1].q.id === 'c', 'complete quotes first, then by total');
ok(c.other.length === 1 && c.other[0].q.id === 'd', 'a quote in another currency is listed, not ranked');
ok(c.waiting.length === 1 && c.declined.length === 1, 'waiting and declined are counted apart');
ok(c.bestByLine.l1.join() === 'c' && c.bestByLine.l3.join() === 'b', 'lowest price per line, from the ranked quotes only (D is not)');
ok(compareQuotes(po({ quotes: [q('a', { prices: { l1: 2, l2: 2, l3: 2 } }), q('b', { prices: { l1: 2, l2: 3, l3: 3 } })] })).bestByLine.l1.length === 2, 'a tie stars both');

ok(awardProblem(o, 'b') === null, 'awarding the cheapest needs no reason');
ok(awardProblem(o, 'a') === 'rfq.p.reason', 'anyone else needs a reason');
ok(awardProblem(o, 'a', 'in port on time') === null, '… and with one it is fine');
ok(awardProblem(o, 'w') === 'rfq.p.notIn' && awardProblem(o, 'x') === 'rfq.p.notIn', 'not to a supplier who has not quoted or declined');

const won = awardOrder({ ...o, lines: o.lines.map((l) => (l.id === 'l3' ? { ...l, unitPrice: 99, currency: '$' } : l)) }, 'c', 'Chief Eng', '2026-10-05', 'only one with stock');
ok(won.supplier === 'C' && won.award?.quoteId === 'c' && won.award.reason === 'only one with stock' && !won.award.cheapest, 'award records who, why, not the cheapest');
ok(won.lines[0].unitPrice === 5 && won.lines[0].currency === '€', 'their prices go onto the lines, with the symbol');
ok(won.lines[2].unitPrice === 99 && won.lines[2].currency === '$', 'a line they cannot supply keeps what it had');
const won2 = awardOrder(o, 'b', 'Chief Eng', '2026-10-05');
ok(won2.award?.cheapest === true && won2.award.compared === 2 && won2.award.total === 280 && !won2.award.reason, 'the cheapest: compared against the complete quotes');
ok(awardOrder(po({ quotes: [q('n', { prices: { l1: 1, l2: 1, l3: 1 }, currency: 'NOK' })] }), 'n', 'x', '2026-10-05').lines[0].currency === 'NOK', 'other currencies keep their ISO code on the line');

// A filled-in request sheet.
const rows: unknown[][] = [
  ['Request for quotation — PO-EN-001-2026'], [],
  ['Line ID', '#', 'Description', 'Part no.', 'IMPA', 'Maker', 'Qty', 'Unit', 'Unit price (EUR)', 'Available (Y/N)', 'Lead time (days)', 'Remarks'],
  ['l1', 1, 'Fuel filter', '', '', '', 10, 'pcs', '12,50', 'Y', 5, ''],
  ['l2', 2, 'Oil filter', '', '', '', 4, 'pcs', '1.234,00', '', 9, ''],
  ['l3', 3, 'Impeller', '', '', '', 2, 'pcs', '', 'No', '', ''],
  ['zz', 4, 'Something', '', '', '', 1, 'pcs', 5, '', '', ''],
  [],
  ['', '', 'Delivery charge', '', '', '', '', '', 40],
  ['', '', 'Discount %', '', '', '', '', '', '5'],
  ['', '', 'Your quotation no.', '', '', '', '', '', 'Q-77'],
];
const sq = quoteFromSheet(po(), rows)!;
ok(sq.prices.l1 === 12.5 && sq.prices.l2 === 1234, 'prices read, decimal comma and thousands');
ok(sq.unavailable.join() === 'l3' && sq.matched === 3 && sq.foreign === 1, '"No" = cannot supply; a row of another order is skipped');
ok(sq.leadDays === 9 && sq.delivery === 40 && sq.discountPct === 5 && sq.ref === 'Q-77', 'lead time (longest), delivery, discount and their number');
ok(quoteFromSheet(po(), [['Description', 'Price']]) === null, 'no Line ID column → null');

// A supplier's record.
const sup: Supplier = { id: 's1', name: 'Marine Parts Ltd', updatedAt: 0 };
const orders: PurchaseOrder[] = [
  po({ id: 'o1', no: 'PO-1', date: '2026-09-01', status: 'received', supplier: 'marine parts ltd ', deliveryDate: '2026-09-10', receivedAt: '2026-09-09', deliveries: [{ date: '2026-09-09', by: 'x', lines: {} }], lines: [{ id: 'a', description: 'Fuel filter', partNo: 'FF-1', qty: 1, unit: 'pcs', unitPrice: 11, currency: '€' }] }),
  po({ id: 'o2', no: 'PO-2', date: '2026-10-01', status: 'received', supplierId: 's1', supplier: 'MPL', deliveryDate: '2026-10-05', receivedAt: '2026-10-08', deliveries: [{ date: '2026-10-06', by: 'x', lines: {} }, { date: '2026-10-08', by: 'x', lines: {} }], lines: [{ id: 'b', description: 'Fuel filter', partNo: 'FF-1', qty: 1, unit: 'pcs', unitPrice: 12, currency: '€' }],
    quotes: [q('q1', { supplierId: 's1', supplier: 'MPL', askedAt: '2026-09-25', receivedAt: '2026-09-29' }), q('q2', { supplier: 'Other' })], award: { quoteId: 'q1', supplier: 'MPL', at: '2026-09-30', by: 'x', total: 12, currency: 'EUR', cheapest: true, compared: 1 } }),
  po({ id: 'o3', no: 'PO-3', date: '2026-10-02', status: 'draft', supplier: 'Marine Parts Ltd', quotes: [q('q3', { supplierId: 's1', supplier: 'MPL', receivedAt: undefined })] }),
  po({ id: 'o4', no: 'PO-4', date: '2026-10-03', status: 'sent', supplierId: 'other', supplier: 'Marine Parts Ltd' }),
];
const st = supplierStats(sup, orders);
ok(st.asked === 2 && st.answered === 1 && st.won === 1 && st.replyDays === 4, 'quotes asked / answered / won, days to answer');
ok(st.orders === 2 && st.received === 2, 'orders matched by id, or by name when there is no id (a different id is someone else)');
ok(st.withDate === 2 && st.onTime === 1 && st.complete === 1, 'on time and in one delivery');
ok(st.lastPrices.length === 1 && st.lastPrices[0].price === 12 && st.lastPrices[0].poNo === 'PO-2', 'last price = the newest order');

const dir: Supplier[] = [
  { id: '1', name: 'Bravo Marine', ports: 'Palma', updatedAt: 0 },
  { id: '2', name: 'Alpha Supply', updatedAt: 0 },
  { id: '3', name: 'Marine Alpha', updatedAt: 0 },
  { id: '4', name: 'Gone', deleted: true, updatedAt: 0 },
];
ok(findSuppliers(dir, '').map((s) => s.id).join() === '2,1,3', 'empty search: all live suppliers by name');
ok(findSuppliers(dir, 'alpha').map((s) => s.id).join() === '2,3', 'name starting with the text first');
ok(findSuppliers(dir, 'palma').map((s) => s.id).join() === '1' && !findSuppliers(dir, 'gone').length, 'ports searched; a removed supplier is not offered');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
