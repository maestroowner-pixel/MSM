// npm run check:purchaseai — a quotation or invoice read by the AI lands only on the order's own lines (plan AI-2).
import { checkInvoice, linesForAi, readQuote } from '../services/purchaseAi';
import { PurchaseOrder } from '../types/orders';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const o: PurchaseOrder = {
  id: 'po1', no: 'PO-2026-001', dept: 'engine', status: 'partial', date: '2026-11-01', by: 'Chief Engineer',
  lines: [
    { id: 'a', description: 'Oil filter', qty: 4, unit: 'pcs', partNo: 'OF-12', unitPrice: 25, currency: '€', qtyReceived: 4 },
    { id: 'x', description: 'Struck', qty: 0, unit: 'pcs', cut: { asked: 2, note: 'not needed', by: 'Office' } },
    { id: 'b', description: 'V-belt', qty: 2, unit: 'pcs', unitPrice: 10, currency: '€', qtyReceived: 1 },
    { id: 'c', description: 'Gasket', qty: 1, unit: 'pcs', unitPrice: 5, currency: '€', qtyReceived: 1 },
  ],
  quotes: [{ id: 'q1', supplier: 'Marine Parts', askedAt: '2026-10-20', receivedAt: '2026-10-22', currency: 'EUR', prices: { a: 25, b: 10, c: 5 }, delivery: 15 }],
  award: { quoteId: 'q1', supplier: 'Marine Parts', at: '2026-10-23', by: 'Master', total: 140, currency: 'EUR', cheapest: true, compared: 1 },
  at: 1, updatedAt: 1,
};

const sent = linesForAi(o);
ok(sent.length === 3 && sent.map((l) => l.key).join() === 'L1,L2,L3', 'a struck line is not sent; keys run over the live lines');
ok(!/unitPrice|25|Chief|Master/.test(JSON.stringify(sent)), 'no prices or people go with the lines');

const q = readQuote(o, { currency: 'eur', ref: ' Q-77 ', validUntil: '2026-12-01', leadDays: 6.4, delivery: 15, discountPct: 120,
  lines: [{ key: 'L1', unitPrice: 24.999 }, { key: 'L2', unavailable: true }, { key: 'L9', unitPrice: 3 }, { key: 'L1', unitPrice: 1 }, { key: 'L3', unitPrice: -2 }],
  other: [{ description: 'Alternative belt' }, { description: ' ' }] });
ok(q.prices.a === 25 && q.prices.b == null && q.unavailable.join() === 'b', 'prices by key onto line ids, rounded; unavailable kept');
ok(Object.keys(q.prices).length === 1, 'an invented key, a second answer and a negative price are dropped');
ok(q.currency === 'EUR' && q.ref === 'Q-77' && q.leadDays === 6 && q.delivery === 15 && q.discountPct == null, 'currency, ref, lead; a discount of 100 % or more is dropped');
ok(q.other.length === 1, 'quoted lines not on the order are counted');

const clean = checkInvoice({ ...o, status: 'received', lines: o.lines.map((l) => (l.id === 'b' ? { ...l, qtyReceived: 2 } : l)) }, {
  number: 'INV-1', currency: 'EUR', delivery: 15, total: 140,
  lines: [{ key: 'L1', qty: 4, unitPrice: 25, amount: 100 }, { key: 'L2', qty: 2, unitPrice: 10, amount: 20 }, { key: 'L3', qty: 1, unitPrice: 5, amount: 5 }],
});
ok(clean.problems === 0 && !clean.totalOff, 'an invoice that matches has nothing to query');

const c = checkInvoice(o, {
  currency: 'EUR', delivery: 25, total: 200,
  lines: [{ key: 'L1', qty: 5, unitPrice: 26 }, { key: 'L2', qty: 2, unitPrice: 10.04 }, { key: null, description: 'Packing', amount: 8 }],
});
const row = (id: string) => c.rows.find((r) => r.lineId === id)!;
ok(row('a').issues.includes('moreThanOrdered') && row('a').issues.includes('moreThanReceived') && row('a').issues.includes('price'), 'more than ordered, than received, at another price');
ok(row('b').issues.join() === 'moreThanReceived', 'two invoiced, one aboard; a 4-cent rounding is not a price finding');
ok(row('c').issues.join() === 'notInvoiced', 'received and not invoiced is shown');
ok(c.extra.length === 1 && c.extra[0].description === 'Packing', 'a charge not on the order is listed');
ok(Math.abs(c.computed - 183.08) < 0.001, 'the total is computed from the invoice lines');
ok(c.totalOff, 'a total that does not add up is a finding');
ok(c.problems === 2 + 1 + 1 + 1, 'problems: two lines, the extra, the delivery above the quote, the total');

// A job that waited: a line put in front of the others since must not shift L1 onto it.
const later = { ...o, lines: [{ id: 'n', description: 'New first line', qty: 1, unit: 'pcs' }, ...o.lines] };
const shifted = readQuote(later, { lines: [{ key: 'L1', unitPrice: 25 }] }, ['a', 'b', 'c']);
ok(shifted.prices.a === 25 && shifted.prices.n == null, 'the keys of a waiting job are the lines as they were sent');
ok(Object.keys(readQuote(o, { lines: [{ key: 'L1', unitPrice: 1 }] }, ['gone']).prices).length === 0, 'a line struck since the document went is not priced');

const usd = checkInvoice(o, { currency: 'USD', lines: [{ key: 'L1', qty: 4, unitPrice: 30 }] });
ok(!usd.sameCurrency && !usd.rows[0].issues.includes('price'), 'another currency: prices are not compared');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
