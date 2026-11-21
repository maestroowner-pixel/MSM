// npm run check:quotelink — a supplier quotes through a link (plan item 48): what the page shows, what an answer
// becomes in the quote, when the link is closed, and that an older copy of the order on a device cannot undo the answer.
/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;
const L = require('../../functions/quoteLink');
import { awaitingRevision, awardOrder, compareQuotes, foldOrder, foldQuotes, linkClosed, linkOpen, quoteTotal, withLink } from '../services/rfq';
import { copyOrder } from '../services/orders';
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
const aw = (quoteId: string) => ({ quoteId, supplier: 'x', at: '', by: '', total: 0, currency: 'EUR', cheapest: true, compared: 1 });
ok(L.closedWhy(po({ award: aw('qb') }), o.quotes![0], link, NOW) === 'awarded', 'awarded to another: closed');
ok(L.closedWhy(po({ award: aw('qa') }), o.quotes![0], link, NOW) === 'chosen', 'awarded to them, not sent yet: closed, the order follows');
ok(L.closedWhy(po({ award: aw('qa'), status: 'sent' }), o.quotes![0], link, NOW) === null && L.closedWhy(po({ award: aw('qa'), status: 'partial' }), o.quotes![0], link, NOW) === null, 'sent (or partly delivered) to them: open, to confirm');
ok(L.closedWhy(po({ award: aw('qa'), status: 'received' }), o.quotes![0], link, NOW) === 'received' && L.closedWhy(po({ award: aw('qa'), status: 'cancelled' }), o.quotes![0], link, NOW) === 'cancelled', 'received or cancelled: closed');
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

// ---- the app's copy of closedWhy --------------------------------------------------------
let same = 0, cases = 0;
for (const status of ['draft', 'standby', 'sent', 'partial', 'received', 'cancelled'] as const) {
  for (const award of [undefined, aw('qa'), aw('qb')]) {
    for (const expires of [NOW + DAY, NOW - 1]) {
      for (const deleted of [false, true]) {
        const oo = po({ status, award, deleted });
        const q = { ...oo.quotes![0], link: { sentAt: NOW, expires } };
        cases++;
        if (linkClosed(oo, q, NOW) === L.closedWhy(oo, q, { ...link, expires }, NOW)) same++;
      }
    }
  }
}
ok(same === cases, `rfq.ts linkClosed answers as the server's closedWhy (${same}/${cases})`);
ok(!linkOpen(o.quotes![0], NOW, po({ award: aw('qb') })) && linkOpen(o.quotes![0], NOW, o), 'with the order: a link of a quote that lost is shown closed, though its date is not past');

// ---- sent back for revision ----------------------------------------------------------------
const backQ: Quote = { ...answered, link: { ...answered.link!, sentAt: NOW + 3000, returned: { at: NOW + 3000, note: 'Line 1: quote the original' } } };
const pageBack = L.pageData({ ...o, quotes: [backQ] }, backQ, link, 'DreamBoat', {}, NOW);
ok(pageBack.returned && pageBack.returned.note === 'Line 1: quote the original' && pageBack.answer && pageBack.answer.lines.l1.price === 48, 'sent back: the note heads the page, their earlier answer is there to change');
ok(awaitingRevision(backQ), 'the app shows it waiting for their revision');
const revised: Quote = L.withAnswer(backQ, r.quote, 'Ana Ruiz', NOW + 4000, null);
ok(!L.pageData({ ...o, quotes: [revised] }, revised, link, 'DreamBoat', {}, NOW).returned && !awaitingRevision(revised) && revised.link!.returned!.note === 'Line 1: quote the original', 'answered again: no longer waiting; the note is kept on the quote');
const m = L.mailFor(o, backQ, 'DreamBoat', 'https://app.ismpilot.com/quote/x', NOW + 7 * DAY, 'quote', 'Line <1> & 2');
ok(/revise/i.test(m.subject) && m.html.includes('Line &lt;1&gt; &amp; 2'), 'the revision mail carries the note, escaped');

// ---- the order to confirm -------------------------------------------------------------------
const win: Quote = { ...answered, lineInfo: { ...answered.lineInfo, l2: { partNo: 'X' } } };
const awarded = awardOrder({ ...o, quotes: [win] }, 'qa', 'Sven Larsen', '2026-11-09');
const sentO: PurchaseOrder = { ...awarded, status: 'sent', sentAt: '2026-11-10', sentBy: 'Sven Larsen' };
const op = L.pageData(sentO, sentO.quotes![0], link, 'DreamBoat', {}, NOW);
ok(op.mode === 'order' && op.lines.length === 0 && op.answer === null, 'the order page: mode order, no quotation form');
ok(op.order.lines.length === 1 && op.order.lines[0].price === 9.6 && op.order.lines[0].theirUnit === 'box' && op.order.left === 1, 'the lines ordered from them at their price (their box of 5 shown); the line they could not supply is left out and counted');
ok(op.order.total === quoteTotal(sentO, sentO.quotes![0]).total && op.order.ref === 'Q-991', 'the total is the app\'s quote total; their quotation no.');
ok(!JSON.stringify(op).includes('Sven'), 'no person on the order page either');
const mo = L.mailFor(sentO, sentO.quotes![0], 'DreamBoat', 'https://app.ismpilot.com/quote/x', NOW + 7 * DAY, 'order');
ok(/please confirm/.test(mo.subject) && mo.html.includes('Q-991'), 'the order mail asks them to confirm, on their quotation');
const c1 = L.readConfirm({ name: 'Ana', confirm: { ok: true, ref: 'SO-55', eta: '2026-11-20' } });
ok(!c1.error && c1.confirm.ok && c1.confirm.ref === 'SO-55' && c1.confirm.eta === '2026-11-20' && c1.name === 'Ana', 'confirmed with their order no. and delivery date');
ok(L.readConfirm({ confirm: { ok: false, note: 'no' } }).error && !L.readConfirm({ confirm: { ok: false, note: 'out of stock until Dec' } }).error, 'cannot confirm: only with a reason');
ok(L.readConfirm({ confirm: {} }).error && L.readConfirm({ confirm: { ok: true, eta: '20.11.2026' } }).confirm.eta === undefined, 'no answer refused; a date not yyyy-mm-dd dropped');
const confirmed: Quote = L.withConfirm(sentO.quotes![0], c1.confirm, c1.name, NOW + 9000);
ok(confirmed.confirm!.at === NOW + 9000 && confirmed.confirm!.by === 'Ana' && confirmed.prices.l1 === 9.6, 'the confirmation lands on the quote, the prices untouched');
const cloudC = { ...sentO, quotes: [confirmed], updatedAt: NOW + 9000 };
const staleC = { ...sentO, notes: 'bridge edit', updatedAt: NOW + 9500 };
const keptC = foldOrder(staleC, cloudC);
ok(keptC.quotes![0].confirm?.ok === true && keptC.notes === 'bridge edit' && keptC.updatedAt === NOW + 9501, 'an older copy on a device keeps its edit and takes the confirmation');
const ext = foldQuotes([{ ...o.quotes![0], link: { sentAt: NOW, expires: NOW + 7 * DAY } }], [{ ...o.quotes![0], link: { sentAt: NOW, expires: NOW + 12 * DAY } }])[0];
ok(ext.link!.expires === NOW + 12 * DAY, 'the same link extended elsewhere: the later date is kept');

const copy = copyOrder(sentO, [sentO]);
ok(!copy.quotes && !copy.award && !copy.quoteBy && copy.status === 'draft', 'a copied order asks for its own quotes: no quotes, award or date copied');

ok(linkOpen(o.quotes![0], NOW) && !linkOpen(o.quotes![0], NOW + 8 * DAY) && !linkOpen({ ...o.quotes![0], link: undefined }, NOW), 'open until its date');
ok(withLink(o, 'qa', { sentAt: 1, expires: 2 }).quotes![0].link!.expires === 2, 'withLink replaces one quote\'s link');

console.log(bad ? `\n${bad} failed` : '\nall passed');
if (bad) process.exit(1);
