// ===================================
// Request for quotation and the comparison — papers (services/rfq.ts does the maths).
//   RFQ PDF      to one supplier: the order's lines with empty price columns.
//   RFQ Excel    the same lines with a Line ID column — the supplier fills in the
//                prices and sends it back; "Read quote from Excel" (screens/QuoteSc)
//                matches the rows by that id (rfq.ts quoteFromSheet).
//   Comparison   lines × suppliers, the lowest price per line, totals, and who was
//                chosen and why — the record that the purchase was tendered.
// English, as every report (screens are translated, papers are not).
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { saveSheet } from './sheetFiles';
import { money } from './finance';
import { compareQuotes, quoteTotal } from './rfq';
import { ORDER_DEPT_LABEL, PurchaseOrder, Quote } from '../types/orders';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const num = (n: number) => money(n, '').trim();
const ref = (l: PurchaseOrder['lines'][number]) => [l.partNo, l.impa ? `IMPA ${l.impa}` : ''].filter(Boolean).join(' · ');

function rfqFacts(o: PurchaseOrder, q: Quote): string[] {
  return [
    `To: ${q.supplier}`,
    `Our ref: ${o.no} (${ORDER_DEPT_LABEL[o.dept]})`,
    `Date: ${dmy(q.askedAt)}`,
    ...(o.quoteBy ? [`Quote by: ${dmy(o.quoteBy)}`] : []),
    ...(o.deliveryPort ? [`Deliver to: ${o.deliveryPort}`] : []),
    ...(o.deliveryDate ? [`Needed aboard by: ${dmy(o.deliveryDate)}`] : []),
    `Please quote in ${q.currency}: unit prices, delivery charge, discount, lead time and validity. Mark any line you cannot supply.`,
  ];
}

export function exportRfq(o: PurchaseOrder, q: Quote, vessel: VesselInfo | null) {
  return exportPmsHistory('Request for quotation', `RFQ ${o.no} ${q.supplier}`, vessel, [{
    title: `Request for quotation — ${o.no}`,
    facts: rfqFacts(o, q),
    tables: [
      {
        title: 'Items',
        head: ['#', 'Description', 'Part no. / IMPA', 'Maker', 'Qty', 'Unit', `Unit price (${q.currency})`, 'Available', 'Lead time (days)', 'Remarks'],
        rows: o.lines.map((l, i) => [String(i + 1), [l.description, l.notes].filter(Boolean).join(' — '), ref(l), l.maker ?? '', String(l.qty), l.unit, '', '', '', '']),
        // Every column: the web PDF (jsPDF) sizes the table to the widths given — 277 mm.
        widths: { 0: 7, 1: 80, 2: 34, 3: 26, 4: 12, 5: 12, 6: 26, 7: 18, 8: 20, 9: 42 },
      },
      { title: 'Totals', head: ['Delivery charge', 'Discount %', 'Valid until', 'Your quotation no.', 'Name and signature'], rows: [['', '', '', '', '']], widths: { 0: 50, 1: 40, 2: 45, 3: 55, 4: 87 } },
    ],
  }]);
}

/** The sheet the supplier fills in. Keep "Line ID" — the quote is read back by it. */
export function rfqSheet(o: PurchaseOrder, q: Quote, vessel: VesselInfo | null) {
  const rows: unknown[][] = [
    [`Request for quotation — ${o.no}`],
    ...rfqFacts(o, q).map((f) => [f]),
    [],
    ['Line ID', '#', 'Description', 'Part no.', 'IMPA', 'Maker', 'Qty', 'Unit', `Unit price (${q.currency})`, 'Available (Y/N)', 'Lead time (days)', 'Remarks'],
    ...o.lines.map((l, i) => [l.id, i + 1, l.description, l.partNo ?? '', l.impa ?? '', l.maker ?? '', l.qty, l.unit, '', '', '', '']),
    [],
    // The value goes in the Unit price column (rfq.ts quoteFromSheet reads it there).
    ['', '', 'Delivery charge', '', '', '', '', '', ''],
    ['', '', 'Discount %', '', '', '', '', '', ''],
    ['', '', 'Valid until', '', '', '', '', '', ''],
    ['', '', 'Your quotation no.', '', '', '', '', '', ''],
    ['', '', 'Please fill in the Unit price and Available columns, and the values above in the Unit price column. Keep the Line ID column.'],
  ];
  return saveSheet(rows, 'RFQ', `RFQ ${o.no} ${q.supplier}`, vessel);
}

function comparisonTables(o: PurchaseOrder) {
  const c = compareQuotes(o);
  const all = [...c.ranked, ...c.other];
  const cell = (q: Quote, lineId: string) => {
    if (q.unavailable?.includes(lineId)) return 'n/a';
    const p = q.prices[lineId];
    if (p == null) return '—';
    // '*', not a star: the web PDF's built-in font has no ★.
    return `${num(p)}${c.bestByLine[lineId]?.includes(q.id) && c.ranked.length > 1 ? ' *' : ''}`;
  };
  const head = ['#', 'Description', 'Qty', ...all.map(({ q }) => `${q.supplier} (${q.currency})`)];
  const lines = o.lines.map((l, i) => [String(i + 1), l.description, `${l.qty} ${l.unit}`, ...all.map(({ q }) => cell(q, l.id))]);
  const sums = (label: string, f: (t: ReturnType<typeof quoteTotal>, q: Quote) => string) => ['', label, '', ...all.map(({ q, t }) => f(t, q))];
  const totals = [
    sums('Goods', (t) => num(t.goods)),
    sums('Discount', (t, q) => (t.discount ? `-${num(t.discount)} (${q.discountPct} %)` : '')),
    sums('Delivery', (t) => (t.delivery ? num(t.delivery) : '')),
    sums('TOTAL', (t) => num(t.total)),
    sums('Lines priced', (t) => `${t.priced} of ${o.lines.length}${t.unavailable.length ? ` · ${t.unavailable.length} n/a` : ''}`),
    sums('Lead time', (_t, q) => (q.leadDays != null ? `${q.leadDays} days` : '')),
    sums('Valid until', (_t, q) => dmy(q.validUntil)),
    sums('Their ref.', (_t, q) => q.ref ?? ''),
  ];
  // Every column gets a width (the web PDF sizes the table to them): suppliers up to 40 mm each.
  const sup = Math.min(40, Math.floor((277 - 7 - 18 - 60) / Math.max(1, all.length)));
  const widths: Record<number, number> = { 0: 7, 1: 277 - 7 - 18 - sup * all.length, 2: 18 };
  all.forEach((_x, i) => { widths[3 + i] = sup; });
  return { c, head, rows: [...lines, ...totals], widths };
}

function awardFacts(o: PurchaseOrder): string[] {
  const c = compareQuotes(o);
  const a = o.award;
  return [
    `${o.no} · ${ORDER_DEPT_LABEL[o.dept]}`,
    `Asked: ${(o.quotes ?? []).length} · answered: ${c.ranked.length + c.other.length}${c.declined.length ? ` · declined: ${c.declined.length}` : ''}${c.waiting.length ? ` · no answer: ${c.waiting.map((q) => q.supplier).join(', ')}` : ''}`,
    ...(c.other.length ? [`Not ranked (other currency than ${c.currency}): ${c.other.map(({ q }) => q.supplier).join(', ')}`] : []),
    ...(a ? [`Awarded to ${a.supplier} — ${money(a.total, a.currency)} — ${dmy(a.at)} by ${a.by}`, a.cheapest ? `Lowest complete quote of ${a.compared}.` : `Not the lowest complete quote. Reason: ${a.reason ?? ''}`] : ['Not awarded yet.']),
    '* lowest price for the line',
  ];
}

export function exportComparison(o: PurchaseOrder, vessel: VesselInfo | null) {
  const { head, rows, widths } = comparisonTables(o);
  return exportPmsHistory('Quotation comparison', `Quotes ${o.no}`, vessel, [{
    title: `Quotation comparison — ${o.no}`,
    facts: awardFacts(o),
    tables: [
      { title: 'Prices per unit', head, rows, widths },
      { title: 'Signed', head: ['Prepared by', 'Approved by the Master', 'Approved by the management'], rows: [['', '', '']], widths: { 0: 91, 1: 91, 2: 91 } },
    ],
  }]);
}

export function comparisonSheet(o: PurchaseOrder, vessel: VesselInfo | null) {
  const { head, rows } = comparisonTables(o);
  return saveSheet([[`Quotation comparison — ${o.no}`], ...awardFacts(o).map((f) => [f]), [], head, ...rows], 'Quotes', `Quotes ${o.no}`, vessel);
}
