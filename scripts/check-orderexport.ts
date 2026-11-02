// npm run check:orderexport — purchase orders to xlsx / docx / json (services/orderExport.ts).
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as fs from 'fs';
import { JSON_FORMAT, docxXml, exportName, lineRows, orderRow, ordersJson, ordersWorkbook, totals, xmlText, ORDER_HEAD, LINE_HEAD } from '../services/orderExport';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const vessel: any = { vessel_name: 'M/Y Test', imo: '1234567' };
const o1: any = {
  id: 'a', no: 'PO-EN-003-2026', dept: 'engine', status: 'partial', date: '2026-11-02', by: 'Ana', byRank: 'Chief Engineer', supplier: 'Sea & Co <Ltd>', sentAt: '2026-11-03', updatedAt: 0, at: 0,
  lines: [
    { id: 'l1', description: 'Impeller "Jabsco" & seal', partNo: '1210', qty: 2, unit: 'pcs', unitPrice: 42.5, currency: '€', qtyReceived: 1 },
    { id: 'l2', description: 'Filter\u0007', qty: 3, unit: 'pcs', unitPrice: 10, currency: '$' },
    { id: 'l3', description: 'Gasket', qty: 0, unit: 'pcs', cut: { asked: 4, note: 'Stock in Palma', by: 'Office' } },
  ],
  approval: [{ kind: 'master', by: 'Master', at: Date.UTC(2026, 10, 2, 9, 0) }, { kind: 'approve', by: 'Office', at: Date.UTC(2026, 10, 2, 12, 0), cuts: [] }],
};
const o2: any = { id: 'b', no: 'PO-DK-001-2026', dept: 'deck', status: 'draft', date: '2026-11-01', by: '', lines: [], updatedAt: 0, at: 0 };

ok(JSON.stringify(totals(o1)) === JSON.stringify([{ currency: 'EUR', total: 85 }, { currency: 'USD', total: 30 }]), 'totals per currency, never added across');
const r = orderRow(o1);
ok(r.length === ORDER_HEAD.length && r[0] === 'PO-EN-003-2026' && r[3] === 'Part delivered' && r[15] === 'EUR 85.00 + USD 30.00', 'order row: stage from the steps, totals');
const lr = lineRows(o1);
ok(lr.length === 3 && lr[0].length === LINE_HEAD.length && lr[0][12] === 85 && lr[2][9] === 4 && /Office: Stock in Palma/.test(String(lr[2][14])), 'line rows: line total, office cut with what was asked');

const wb = XLSX.read(XLSX.write(ordersWorkbook([o1, o2], vessel), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const sheet = (n: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1 });
ok(wb.SheetNames.join() === 'Orders,Lines', 'xlsx: two sheets');
ok(sheet('Orders').length === 5 && sheet('Lines').length === 6 && sheet('Lines')[3][2] === 'Impeller "Jabsco" & seal', 'xlsx round trip: 2 orders, 3 lines, text intact');

const j = JSON.parse(ordersJson([o1], vessel, new Date('2026-11-02T10:00:00Z')));
ok(j.format === JSON_FORMAT && j.version === 1 && j.vessel.imo === '1234567' && j.orders[0].approval.length === 2 && j.orders[0].lines[2].cut.asked === 4, 'json: format, vessel, orders as stored');

ok(xmlText('a<b>&"\u0007') === 'a&lt;b&gt;&amp;&quot;', 'xml text escaped, control characters dropped');
const files = docxXml([o1, o2], vessel, new Date('2026-11-02T10:00:00Z'));
const doc = files['word/document.xml'];
ok(doc.includes('Sea &amp; Co &lt;Ltd&gt;') && !doc.includes('\u0007') && (doc.match(/<w:pageBreakBefore\/>/g) ?? []).length === 1, 'docx: escaped, one page per order');
const opens = (doc.match(/<w:(tbl|tr|tc|p)\b/g) ?? []).length;
const closes = (doc.match(/<\/w:(tbl|tr|tc|p)>/g) ?? []).length;
ok(opens === closes, `docx: every table, row, cell and paragraph closed (${opens})`);
ok(exportName([o1], vessel, 'docx', '2026-11-02') === 'PO-EN-003-2026-M Y Test.docx' && exportName([o1, o2], null, 'json', '2026-11-02') === 'Purchase orders 021126.json', 'file names');

(async () => {
  const zip = new JSZip();
  for (const [p, x] of Object.entries(files)) zip.file(p, x);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const back = await JSZip.loadAsync(buf);
  ok(!!back.file('word/document.xml') && !!back.file('[Content_Types].xml') && !!back.file('_rels/.rels'), 'docx package: the three parts');
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, buf);
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
