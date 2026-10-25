// ===================================
// Order sheet — full A4 PDF for the supplier, and a small QR label for the delivery box.
//
// exportOrderPdf: native → printToFileAsync + shareAsync; web → printHtmlWeb (browser
//   Save-as-PDF). Includes vessel/order header, line items table, signature fields.
//
// printBoxQrLabel: generates a single page with a large QR and the order number — crew
//   print it and stick it on the incoming delivery box so the scanner maps it to the order.
// ===================================

import { Platform } from 'react-native';
import { ORDER_DEPT_LABEL, ORDER_STATUS_LABEL, PurchaseOrder } from '../types/orders';
import { qrSvg } from './qrLabel';
import { formatDate } from '../utils/dates';
import { VesselInfo } from './storage';
import { shipToday } from '../utils/shipTime';

function esc(s: string | undefined | null): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Full order sheet HTML ────────────────────────────────────────────────────

function buildOrderHtml(o: PurchaseOrder, vessel: VesselInfo | null): string {
  const qr = qrSvg(`po:${o.id}`, 50);
  const dept = ORDER_DEPT_LABEL[o.dept];
  const vesselName = vessel?.vessel_name ?? '';
  const imo = vessel?.imo ? `IMO ${vessel.imo}` : '';
  const totalQty = o.lines.reduce((s, l) => s + l.qty, 0);
  const totalRecv = o.lines.reduce((s, l) => s + (l.qtyReceived ?? 0), 0);

  const rows = o.lines.map((l, i) => {
    const recv = l.qtyReceived != null
      ? `<span style="color:${l.qtyReceived >= l.qty ? '#16a34a' : '#d97706'}">${l.qtyReceived} / ${l.qty}</span>`
      : `— / ${l.qty}`;
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(l.description)}${l.notes ? `<br><span class="sub">${esc(l.notes)}</span>` : ''}</td>
      <td class="c">${esc(l.partNo ?? '')}${l.impa ? `<br><span class="sub">IMPA: ${esc(l.impa)}</span>` : ''}</td>
      <td class="c">${esc(l.maker ?? '')}</td>
      <td class="c">${l.unitPrice != null ? `${l.currency ?? '€'} ${l.unitPrice.toFixed(2)}` : ''}</td>
      <td class="r">${l.qty} ${esc(l.unit)}</td>
      <td class="r">${recv}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(o.no)} — ${esc(dept)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 6mm; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; }
  .top-left { flex: 1; }
  .qr-box { border: 1pt solid #ccc; padding: 4mm; text-align: center; border-radius: 3mm; }
  .qr-box svg { width: 50mm; height: 50mm; }
  .qr-label { font-size: 8pt; color: #555; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  th { background: #0b2545; color: #fff; padding: 2mm 3mm; text-align: left; font-size: 9pt; }
  td { padding: 1.5mm 3mm; border-bottom: 0.5pt solid #e5e7eb; font-size: 9pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .c { text-align: center; }
  .r { text-align: right; }
  .sub { color: #777; font-size: 8pt; }
  .totals { text-align: right; margin-top: 3mm; font-size: 9pt; color: #444; }
  .footer { margin-top: 8mm; border-top: 0.5pt solid #ccc; padding-top: 3mm; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }
  .status-badge { display: inline-block; border: 1pt solid #0b2545; color: #0b2545; border-radius: 99pt; padding: 0.5mm 3mm; font-size: 9pt; font-weight: bold; margin-top: 2mm; }
  .sig { margin-top: 10mm; display: flex; gap: 20mm; }
  .sig-block { flex: 1; border-top: 0.5pt solid #333; padding-top: 2mm; font-size: 8pt; color: #555; }
</style>
</head>
<body>
<div class="top">
  <div class="top-left">
    <h1>${esc(o.no)}</h1>
    <div class="meta">
      ${vesselName ? `<strong>${esc(vesselName)}</strong>${imo ? ' · ' + esc(imo) : ''}<br>` : ''}
      Department: <strong>${esc(dept)}</strong><br>
      Date: ${formatDate(o.date)}${o.by ? ` · Raised by: ${esc(o.by)}` : ''}
      ${o.supplier ? `<br>Supplier: <strong>${esc(o.supplier)}</strong>` : ''}
      ${o.supplierRef ? ` · Ref: ${esc(o.supplierRef)}` : ''}
      ${o.sentAt ? `<br>Sent: ${formatDate(o.sentAt)}${o.sentBy ? ' by ' + esc(o.sentBy) : ''}` : ''}
    </div>
    <div class="status-badge">${esc(ORDER_STATUS_LABEL[o.status])}</div>
    ${o.notes ? `<p style="margin:4mm 0 0;font-size:9pt;color:#444">${esc(o.notes)}</p>` : ''}
  </div>
  <div class="qr-box">
    ${qr}
    <div class="qr-label">${esc(o.no)}<br>${esc(dept)}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:6mm">#</th>
      <th>Description</th>
      <th style="width:28mm" class="c">Part No. / IMPA</th>
      <th style="width:22mm" class="c">Maker</th>
      <th style="width:20mm" class="c">Unit price</th>
      <th style="width:18mm" class="r">Ordered</th>
      <th style="width:18mm" class="r">Received</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">Total lines: ${o.lines.length} · Total qty ordered: ${totalQty}${totalRecv > 0 ? ` · Received: ${totalRecv}` : ''}</div>

<div class="sig">
  <div class="sig-block">Received by (name &amp; rank)</div>
  <div class="sig-block">Signature</div>
  <div class="sig-block">Date</div>
</div>

<div class="footer">
  <span>${vesselName ? esc(vesselName) + ' · ' : ''}${esc(o.no)} · ${esc(dept)}</span>
  <span>Generated ${shipToday()}</span>
</div>
</body>
</html>`;
}

// ─── QR box label HTML (one per page, for sticking on the delivery box) ──────

function buildBoxLabelHtml(o: PurchaseOrder, vessel: VesselInfo | null): string {
  // 100×100 mm QR + order number — fits a standard label or a sheet of paper
  const qr = qrSvg(`po:${o.id}`, 90);
  const dept = ORDER_DEPT_LABEL[o.dept];
  const vesselName = vessel?.vessel_name ?? '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>QR — ${esc(o.no)}</title>
<style>
  @page { size: 100mm 130mm; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; text-align: center; }
  .qr svg { width: 90mm; height: 90mm; }
  h2 { font-size: 14pt; margin: 3mm 0 1mm; font-weight: 900; letter-spacing: 1px; }
  p { font-size: 9pt; color: #555; margin: 1mm 0; }
  .border { border: 2pt solid #000; padding: 4mm; display: inline-block; margin-top: 3mm; }
</style>
</head>
<body>
<div class="border">
  <div class="qr">${qr}</div>
  <h2>${esc(o.no)}</h2>
  <p>${esc(dept)}${o.supplier ? ' · ' + esc(o.supplier) : ''}</p>
  ${vesselName ? `<p>${esc(vesselName)}</p>` : ''}
</div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Export the full order sheet as a PDF file (share/email on native; Save-as-PDF on web). */
export async function exportOrderPdf(o: PurchaseOrder, vessel: VesselInfo | null): Promise<void> {
  const html = buildOrderHtml(o, vessel);
  const fileName = `${o.no}.pdf`;

  if (Platform.OS === 'web') {
    const { printHtmlWeb } = await import('../utils/webFile');
    printHtmlWeb(html, fileName);
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const FS = await import('expo-file-system/legacy');
    const { uri: tmpUri } = await Print.default.printToFileAsync({ html });
    const destUri = `${FS.cacheDirectory ?? ''}${fileName}`;
    await FS.deleteAsync(destUri, { idempotent: true });
    await FS.copyAsync({ from: tmpUri, to: destUri });
    await Sharing.default.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${o.no}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/** Print / save the QR box label — one large QR per page, for sticking on the delivery box. */
export async function printBoxQrLabel(o: PurchaseOrder, vessel: VesselInfo | null): Promise<void> {
  const html = buildBoxLabelHtml(o, vessel);

  if (Platform.OS === 'web') {
    const { printHtmlWeb } = await import('../utils/webFile');
    printHtmlWeb(html, `QR-${o.no}.pdf`);
  } else {
    const Print = await import('expo-print');
    await Print.default.printAsync({ html });
  }
}
