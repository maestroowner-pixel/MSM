// npm run check:quotelink — a supplier quotes through a link (plan item 48): what the page shows, what an answer
// becomes in the quote, when the link is closed, and that an older copy of the order on a device cannot undo the answer.
/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;
const L = require('../../functions/quoteLink');
import { compareQuotes, foldOrder, foldQuotes, linkOpen, quoteTotal, withLink } from '../services/rfq';
import { PurchaseOrder, Quote } from '../types/orders';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const NOW = Date.parse('2026-11-08T10:00:00Z');
const DAY = 86400000;
const po = (p: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po1', no: 'PO-EN-007-2026', dept: 'engine', status: 'draft', date: '2026-11-08', by: 'Sven Larsen', byRank: 'Chief Engineer',
  deliveryPort: 'Palma', quoteBy: '2026-11-12',
  lines: [
    { id: 'l1', description: 'Fuel filter', qty: 10, unit: 'pcs', partNo: '1R-0751', maker: 'CAT', spareId: 'sp1', notes: 'for ME PS, ask Sven' },
    { id: 'l2', description: 'Impeller', qty: 2, unit: 'pcs', impa: '123456' },
    { id: 'l3', description: 'Rag', qty: 0, unit: 'kg', cut: { asked: 20, note: 'not needed', by: 'office' } },
  ],
  quotes: [{ id: 'qa', supplier: 'Palma Marine', askedAt: '2026-11-08', currency: 'EUR', prices: {}, link: { sentAt: NOW, expires: NOW + 7 * DAY } }],
  at: 1, updatedAt: NOW, ...p,
});
const link = { vessel: '1234567', orderId: 'po1', quoteId: 'qa', expires: NOW + 7 * DAY };

// ---- the page --------------------------------------------------------------------
const o = po();
const page = L.pageData(o, o.quotes![0], link, 'DreamBoat', { l1: [{ maker: 'Caterpillar', model: 'C32', serial: 'CPX123' }] }, NOW);
const json = JSON.stringify(page);
ok(page.lines.length === 2 && page.lines[1].n === 2, 'a line the office struck out is not asked for');
ok(page.lines[0].fits[0].serial === 'CPX123' && page.lines[0].partNo === '1R-0751', 'the line carries part no. and the maker, model and serial of the machine it fits');
ok(!json.includes('Sven') && !json.includes('Chief') && !json.includes('ask Sven'), 'no person on the page: not who raised the order, not the line notes');
ok(page.vessel === 'DreamBoat' && page.po === 'PO-EN-007-2026' && page.port === 'Palma' && !page.closed && page.answer === null, 'vessel, PO, port; open; nothing answered yet');

// ---- closed ----------------------------------------------------------------------
ok(L.closedWhy(o, o.quotes![0], { ...link, expires: NOW - 1 }, NOW) === 'expired', 'past its date: expired');
ok(L.closedWhy(po({ status: 'sent' }), o.quotes![0], link, NOW) === 'ordered', 'the order is sent: closed');
ok(L.closedWhy(po({ award: { quoteId: 'qa', supplier: 'x', at: '', by: '', total: 0, currency: 'EUR', cheapest: true, compared: 1 } }), o.quotes![0], link, NOW) === 'awarded', 'awarded: closed');
ok(L.closedWhy(o, undefined, link, NOW) === 'removed' && L.closedWhy(po({ deleted: true }), o.quotes![0], link, NOW) === 'removed', 'the quote removed or the order deleted: closed');
ok(L.closedWhy(po({ status: 'standby' }), o.quotes![0], link, NOW) === null, 'on standby it still takes quotes');

// ---- an answer --------------------------------------------------------------------
const body = {
  currency: 'eur', ref: 'Q-991', validUntil: '2026-12-01', delivery: '35,5', discountPct: 5, name: 'Ana Ruiz',
  charges: [{ label: 'Packing', amount: '12' }, { label: '', amount: '' }],
  lines: {
    l1: { price: '48', unit: 'box', per: '5', kind: 'oem', lead: '4', partNo: 'FF-5', remark: 'Fleetguard' },
    l2: { na: true },
    l3: { price: 1 },
    lx: { price: 1 },
  },
};
const r = L.readAnswer(o, body);
ok(!r.error && r.quote.currency === 'EUR', 'the currency is taken in capitals');
ok(r.quote.prices.l1 === 9.6 && r.quote.lineInfo.l1.unitPrice === 48 && r.quote.lineInfo.l1.per === 5 && r.quote.lineInfo.l1.unit === 'box', 'their 48 a box of 5 → 9.60 per our pcs; what they typed stays in lineInfo');
ok(r.quote.unavailable.join() === 'l2' && r.quote.prices.l3 == null && r.quote.prices.lx == null, 'cannot supply is kept; a struck or unknown line is ignored');
ok(r.quote.lineInfo.l1.kind === 'oem' && r.quote.leadDays === 4 && r.quote.delivery === 35.5 && r.quote.charges.length === 1, 'part type, lead time (the longest line), delivery with a comma, an empty charge row dropped');
ok(L.readAnswer(o, { ...body, currency: 'euro' }).error && L.readAnswer(o, { currency: 'EUR', lines: {} }).error, 'no currency, or nothing priced: refused');
ok(L.readAnswer(o, { currency: 'EUR', lines: { l1: { price: '5', unit: 'box' } } }).error && L.readAnswer(o, { currency: 'EUR', lines: { l1: { price: '-1' } } }).error, 'a unit without how many it holds, a negative price: refused');
ok(L.readAnswer(o, { ...body, discountPct: 120 }).error && L.readAnswer(o, { ...body, charges: [{ label: 'Docs' }] }).error, 'discount over 100 %, a charge without an amount: refused');
const declined = L.readAnswer(o, { declined: true, notes: 'out of stock' });
ok(declined.quote.declined === true && declined.quote.notes === 'out of stock', 'we will not quote, with a reason');

const answered: Quote = L.withAnswer({ ...o.quotes![0], notes: 'officer note' }, r.quote, r.name, NOW + 1000, null);
ok(answered.receivedAt === '2026-11-08' && answered.link!.answeredAt === NOW + 1000 && answered.link!.answeredBy === 'Ana Ruiz' && answered.link!.expires === link.expires, 'the answer stamps receivedAt and link.answeredAt, keeps the link');
ok(answered.notes === undefined && answered.supplier === 'Palma Marine', 'the fields the page owns are replaced, the rest kept');
const again = L.withAnswer(answered, L.readAnswer(o, { currency: 'USD', lines: { l2: { price: 30 } } }).quote, '', NOW + 2000, null);
ok(again.prices.l1 == null && again.unavailable!.length === 0 && again.link!.answeredBy === undefined && again.currency === 'USD', 'a changed answer replaces the earlier one whole');

// The page shows the earlier answer in THEIR unit.
const page2 = L.pageData({ ...o, quotes: [answered] }, answered, link, 'DreamBoat', {}, NOW);
ok(page2.answer.lines.l1.price === 48 && page2.answer.lines.l1.unit === 'box' && page2.answer.lines.l2.na && page2.answer.ref === 'Q-991', 'the earlier answer comes back as they typed it');

// ---- totals in the app --------------------------------------------------------------
const withQ = { ...o, quotes: [answered] };
const t = quoteTotal(withQ, answered);
ok(t.goods === 96 && t.discount === 4.8 && t.delivery === 35.5 && t.charges === 12 && t.total === 138.7, 'total = goods − discount + delivery + other charges (96 − 4.8 + 35.5 + 12)');
ok(compareQuotes(withQ).ranked.length === 1, 'an answered link quote is ranked like any other');

// ---- the sync cannot undo it ----------------------------------------------------------
const cloud = { ...o, quotes: [answered], updatedAt: NOW + 1000 };
const stale = { ...o, notes: 'edited on the bridge', updatedAt: NOW + 5000 };
const kept = foldOrder(stale, cloud);
ok(kept.quotes![0].link!.answeredAt === NOW + 1000 && kept.notes === 'edited on the bridge' && kept.updatedAt === NOW + 5001, 'newer local copy without the answer: keeps its edit, takes the answer, one ms newer so it goes up');
ok(foldOrder(o, cloud).quotes![0].prices.l1 === 9.6, 'newer cloud copy: taken with the answer');
ok(foldOrder(cloud, { ...cloud, updatedAt: NOW }) === cloud, 'nothing newer anywhere: the same record (nothing to send)');
const resent = { ...stale, quotes: [{ ...o.quotes![0], link: { sentAt: NOW + 4000, expires: NOW + 11 * DAY, to: 'x@y.com' } }] };
const both = foldQuotes(resent.quotes, cloud.quotes)[0];
ok(both.link!.sentAt === NOW + 4000 && both.link!.answeredAt === NOW + 1000 && both.prices.l1 === 9.6, 'a newer link here and an answer there: the later link with the answer');
ok(foldQuotes([o.quotes![0]], []).length === 1 && foldQuotes([], cloud.quotes).length === 0, 'a quote removed here is not brought back');

ok(linkOpen(o.quotes![0], NOW) && !linkOpen(o.quotes![0], NOW + 8 * DAY) && !linkOpen({ ...o.quotes![0], link: undefined }, NOW), 'open until its date');
ok(withLink(o, 'qa', { sentAt: 1, expires: 2 }).quotes![0].link!.expires === 2, 'withLink replaces one quote\'s link');

console.log(bad ? `\n${bad} failed` : '\nall passed');
if (bad) process.exit(1);
