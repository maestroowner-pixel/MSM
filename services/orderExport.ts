// ===================================
// Purchase orders out of the app — one order (OrderSc) or the list as filtered (OrdersSc):
//
//   xlsx  two sheets: Orders (one row per order) and Lines (one row per line, with
//         its order number) — what a purchaser or the office pivots and sums.
//   docx  each order on its own landscape page: header table, lines table, approvals.
//         Written by hand with jszip (already a dependency): a minimal WordprocessingML
//         package opens in Word, Pages and LibreOffice, and needs nothing new in the web
//         shell's package.json.
//   json  the orders exactly as stored (steps, quotes, deliveries and all), with the
//         vessel and the format version — for another system to read.
//
// English, like every other paper the app writes. Pure, checked by `npm run check:orderexport`;
// writing the file is services/orderExportFile.ts.
// ===================================

import * as XLSX from 'xlsx';
import JSZip from 'jszip';

import { ORDER_DEPT_LABEL, ORDER_STATUS_LABEL, OrderLine, PurchaseOrder } from '../types/orders';
import { VesselInfo } from './storage';
import { completionPct } from './orders';
import { poStage } from './poApproval';
import { isoCurrency } from './finance';

export type OrderFormat = 'xlsx' | 'docx' | 'json';

/** The buttons — the format names are the same in every language. */
export const EXPORT_FORMATS: [OrderFormat, string][] = [['xlsx', 'Excel'], ['docx', 'Word'], ['json', 'JSON']];

export const MIME: Record<OrderFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  json: 'application/json',
};

const STAGE_LABEL: Record<string, string> = {
  draft: 'Draft', master: 'With the Master', office: 'Sent to the office', review: 'Under review', approved: 'Approved by the office',
  rejected: 'Rejected', returned: 'Returned for rework', inWork: 'In work', partial: 'Part delivered', delivered: 'Delivered', cancelled: 'Cancelled',
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const lineTotal = (l: OrderLine) => (l.unitPrice != null ? round2(l.unitPrice * l.qty) : undefined);

/** The order's total per currency — lines in different currencies are never added together. */
export function totals(o: PurchaseOrder): { currency: string; total: number }[] {
  const by = new Map<string, number>();
  for (const l of o.lines) {
    const t = lineTotal(l);
    if (t == null) continue;
    const c = isoCurrency(l.currency);
    by.set(c, round2((by.get(c) ?? 0) + t));
  }
  return [...by].map(([currency, total]) => ({ currency, total }));
}
const totalText = (o: PurchaseOrder) => totals(o).map((x) => `${x.currency} ${x.total.toFixed(2)}`).join(' + ');

export const ORDER_HEAD = ['Order No.', 'Department', 'Status', 'Stage', 'Date', 'Raised by', 'Urgency', 'Supplier', 'Supplier ref.', 'Sent', 'Delivery wanted', 'Delivery port', 'Received', 'Lines', 'Received %', 'Total', 'Notes'];
export const LINE_HEAD = ['Order No.', '#', 'Description', 'Part No.', 'IMPA', 'Maker', 'Qty', 'Unit', 'Received', 'Asked (before office cut)', 'Unit price', 'Currency', 'Line total', 'Budget', 'Notes'];

export function orderRow(o: PurchaseOrder): (string | number)[] {
  return [
    o.no, ORDER_DEPT_LABEL[o.dept] ?? o.dept, ORDER_STATUS_LABEL[o.status] ?? o.status, STAGE_LABEL[poStage(o)] ?? '', o.date,
    [o.by, o.byRank].filter(Boolean).join(', '), o.urgency ?? '', o.supplier ?? '', o.supplierRef ?? '', o.sentAt ?? '', o.deliveryDate ?? '', o.deliveryPort ?? '',
    o.receivedAt ?? '', o.lines.length, completionPct(o), totalText(o), o.notes ?? '',
  ];
}

export function lineRows(o: PurchaseOrder): (string | number)[][] {
  return o.lines.map((l, i) => [
    o.no, i + 1, l.description, l.partNo ?? '', l.impa ?? '', l.maker ?? '', l.qty, l.unit, l.qtyReceived ?? '', l.cut ? l.cut.asked : '',
    l.unitPrice ?? '', l.unitPrice != null ? isoCurrency(l.currency) : '', lineTotal(l) ?? '', l.budget ?? '', [l.notes, l.cut ? `Office: ${l.cut.note}` : ''].filter(Boolean).join(' — '),
  ]);
}

export function ordersWorkbook(orders: PurchaseOrder[], vessel: VesselInfo | null): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const title = [`Purchase orders — ${vesselLine(vessel)}`.trim()];
  const sheet = (head: string[], rows: (string | number)[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([title, [], head, ...rows]);
    ws['!cols'] = head.map((h) => ({ wch: /Description|Notes/.test(h) ? 40 : Math.max(10, h.length + 2) }));
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, sheet(ORDER_HEAD, orders.map(orderRow)), 'Orders');
  XLSX.utils.book_append_sheet(wb, sheet(LINE_HEAD, orders.flatMap(lineRows)), 'Lines');
  return wb;
}

export const JSON_FORMAT = 'ismpilot.purchase-orders';

export function ordersJson(orders: PurchaseOrder[], vessel: VesselInfo | null, now = new Date()): string {
  return JSON.stringify({
    format: JSON_FORMAT, version: 1, exportedAt: now.toISOString(),
    vessel: { name: vessel?.vessel_name ?? null, imo: vessel?.imo ?? null },
    orders,
  }, null, 2);
}

function vesselLine(v: VesselInfo | null): string {
  return [v?.vessel_name, v?.imo ? `IMO ${v.imo}` : ''].filter(Boolean).join(' · ');
}

// ---- docx ----

/** Text for XML: escaped, and stripped of the control characters XML 1.0 forbids (they make Word refuse the file). */
export function xmlText(s: unknown): string {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const run = (text: unknown, o: { bold?: boolean; size?: number } = {}) =>
  `<w:r><w:rPr>${o.bold ? '<w:b/>' : ''}<w:sz w:val="${o.size ?? 18}"/></w:rPr><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
const para = (text: unknown, o: { bold?: boolean; size?: number; pageBreak?: boolean; after?: number } = {}) =>
  `<w:p><w:pPr>${o.pageBreak ? '<w:pageBreakBefore/>' : ''}<w:spacing w:after="${o.after ?? 80}"/></w:pPr>${run(text, o)}</w:p>`;

/** A table at full page width; the first row is the header when `head` is set. */
function table(rows: unknown[][], widths: number[], head = true): string {
  const total = widths.reduce((a, b) => a + b, 0);
  const tw = 15138; // A4 landscape less 2 × 850 twips margins
  const cols = widths.map((w) => Math.round((w / total) * tw));
  const border = (n: string) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
  const cell = (v: unknown, w: number, bold: boolean, shade: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF2"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(v, { bold })}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${tw}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`
    + `<w:tblGrid>${cols.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
    + rows.map((r, i) => `<w:tr>${i === 0 && head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${r.map((v, j) => cell(v, cols[j], i === 0 && head, i === 0 && head)).join('')}</w:tr>`).join('')
    + '</w:tbl>';
}

const STEP_TEXT: Record<string, string> = {
  submit: 'Submitted to the Master', master: 'Approved by the Master, sent to the office', masterReturn: 'Returned by the Master',
  emergency: 'Emergency — sent by the Master without office approval', review: 'Opened by the office', approve: 'Approved by the office',
  return: 'Returned by the office', reject: 'Rejected by the office', ordered: 'Placed with the supplier by the office',
};

export function docxBody(orders: PurchaseOrder[], vessel: VesselInfo | null, now = new Date()): string {
  const parts: string[] = [];
  orders.forEach((o, k) => {
    parts.push(para(`Purchase order ${o.no}`, { bold: true, size: 32, pageBreak: k > 0, after: 60 }));
    parts.push(para([vesselLine(vessel), `exported ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`].filter(Boolean).join(' · '), { size: 16, after: 160 }));
    const r = orderRow(o);
    const info = ORDER_HEAD.map((h, i) => [h, r[i]]).filter(([h, v]) => v !== '' && h !== 'Order No.' && h !== 'Notes');
    // Two label/value pairs per row.
    const pairs: unknown[][] = [];
    for (let i = 0; i < info.length; i += 2) pairs.push([info[i][0], info[i][1], info[i + 1]?.[0] ?? '', info[i + 1]?.[1] ?? '']);
    parts.push(table(pairs, [3, 5, 3, 5], false));
    parts.push(para('', { after: 120 }));
    const head = ['#', 'Description', 'Part No.', 'IMPA', 'Maker', 'Qty', 'Unit', 'Received', 'Unit price', 'Line total', 'Notes'];
    const lines = o.lines.map((l, i) => [
      i + 1, l.description, l.partNo ?? '', l.impa ?? '', l.maker ?? '', l.cut ? `${l.qty} (asked ${l.cut.asked})` : l.qty, l.unit, l.qtyReceived ?? '',
      l.unitPrice != null ? `${isoCurrency(l.currency)} ${l.unitPrice.toFixed(2)}` : '', lineTotal(l) != null ? `${isoCurrency(l.currency)} ${lineTotal(l)!.toFixed(2)}` : '',
      [l.notes, l.cut ? `Office: ${l.cut.note}` : ''].filter(Boolean).join(' — '),
    ]);
    parts.push(table([head, ...lines], [2, 14, 5, 4, 5, 3, 3, 3, 5, 5, 12]));
    const tot = totalText(o);
    if (tot) parts.push(para(`Total: ${tot}`, { bold: true, after: 120 }));
    if (o.notes) parts.push(para(`Notes: ${o.notes}`, { after: 120 }));
    if (o.approval?.length) {
      parts.push(para('Approvals', { bold: true, size: 22, after: 60 }));
      parts.push(table([['Step', 'By', 'When (UTC)', 'Reason'], ...o.approval.map((s) => [STEP_TEXT[s.kind] ?? s.kind, [s.by, s.byRank].filter(Boolean).join(', '), new Date(s.at).toISOString().slice(0, 16).replace('T', ' '), s.note ?? ''])], [6, 4, 3, 8]));
    }
  });
  return parts.join('');
}

export function docxXml(orders: PurchaseOrder[], vessel: VesselInfo | null, now = new Date()): Record<string, string> {
  return {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + docxBody(orders, vessel, now)
      + '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>',
  };
}

export async function docxBase64(orders: PurchaseOrder[], vessel: VesselInfo | null): Promise<string> {
  const zip = new JSZip();
  for (const [path, xml] of Object.entries(docxXml(orders, vessel))) zip.file(path, xml);
  return zip.generateAsync({ type: 'base64', mimeType: MIME.docx });
}

// ---- the file ----

/** "PO-EN-003-2026" for one order, "Purchase orders 021126" for several; the vessel's name after. */
export function exportName(orders: PurchaseOrder[], vessel: VesselInfo | null, format: OrderFormat, today: string): string {
  const stem = orders.length === 1 ? orders[0].no : `Purchase orders ${today.slice(8, 10)}${today.slice(5, 7)}${today.slice(2, 4)}`;
  const v = (vessel?.vessel_name ?? '').trim();
  return `${`${stem}${v ? `-${v}` : ''}`.replace(/[\\/:*?"<>|]+/g, ' ')}.${format}`;
}
