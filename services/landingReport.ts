// ===================================
// Landing Report PDF (#27, Oct 2026)
//
// Generates a printable handover document when equipment is sent ashore for
// service or returned aboard. Each item row carries its own QR code
// (msm://item/<id>) so anyone with the app can scan and pull up the full record.
// A second QR in the footer links to the vessel's inspector/PSC view.
// ===================================

import * as Print from 'expo-print';
import { printHtmlWeb } from '../utils/webFile';
import { onWeb } from '../utils/fileShare';
import { qrSvg, itemQrPayload } from './qrLabel';
import { LandingReport, ItemMovement, MOVEMENT_DIR_LABEL } from '../types/movement';
import { EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';
import { INSPECT_LINK_BASE } from './firebaseService';
import { signatureLine } from '../types/crew';
import { shipToday } from '../utils/shipTime';

function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export async function printLandingReport(
  report: LandingReport,
  movements: ItemMovement[],
  itemsById: Map<string, EquipmentItem>,
  vesselName: string,
  imo: string,
  inspectToken: string | null,
): Promise<void> {
  const html = buildLandingHtml(report, movements, itemsById, vesselName, imo, inspectToken);
  if (onWeb) {
    printHtmlWeb(html, `LR-${report.no}.pdf`);
  } else {
    await Print.printAsync({ html });
  }
}

export function buildLandingHtml(
  report: LandingReport,
  movements: ItemMovement[],
  itemsById: Map<string, EquipmentItem>,
  vesselName: string,
  imo: string,
  inspectToken: string | null,
): string {
  const dirLabel = report.dir === 'out' ? 'SENT ASHORE' : 'RETURNED ABOARD';
  const vesselQr = inspectToken
    ? qrSvg(INSPECT_LINK_BASE + inspectToken, 20)
    : qrSvg(`IMO:${imo}`, 20);

  const rows = movements.map((m) => {
    const item = itemsById.get(m.itemId);
    const cat = item ? (CATEGORY_MAP[item.category]?.label ?? item.category) : m.itemCategory;
    const serial = item?.serial ?? '—';
    const desc = item ? [item.no, item.type || item.make].filter(Boolean).join(' ') : m.itemSnap;
    const loc = item ? [item.deck, item.position].filter(Boolean).join(', ') : '—';
    const itemQr = qrSvg(itemQrPayload(m.itemId), 14);

    return `
      <tr>
        <td class="qr-cell"><img src="${svgToDataUri(itemQr)}" width="40" height="40"/></td>
        <td>${cat}</td>
        <td>${desc || '—'}</td>
        <td>${serial}</td>
        <td>${loc || '—'}</td>
        <td>${m.reason || '—'}</td>
        <td>${m.serviceRef || ''}</td>
      </tr>`;
  }).join('');

  const sigBlock = report.by
    ? `<p style="margin-top:6mm"><strong>Signed:</strong> ${signatureLine(report.by, report.byRank)}</p>`
    : `<p style="margin-top:10mm">Signed: _____________________________ &nbsp;&nbsp; Rank: _______________ &nbsp;&nbsp; Date: ___________</p>`;

  const vesselQrUri = svgToDataUri(vesselQr);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 10pt; margin: 15mm; color: #111; }
  h1 { font-size: 14pt; margin: 0 0 1mm; }
  h2 { font-size: 11pt; margin: 0 0 4mm; color: #444; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; }
  .vessel { flex: 1; }
  .vessel-qr { text-align: right; }
  .vessel-qr img { width: 18mm; height: 18mm; }
  .meta { display: flex; gap: 10mm; margin-bottom: 4mm; font-size: 9pt; }
  .meta span { white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #0B2545; color: #fff; text-align: left; padding: 2mm 3mm; }
  td { padding: 2mm 3mm; border-bottom: 1px solid #ddd; vertical-align: middle; }
  tr:nth-child(even) td { background: #f5f8ff; }
  .qr-cell { width: 12mm; }
  .qr-cell img { display: block; }
  .footer { margin-top: 8mm; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 3mm; }
  @page { margin: 10mm; }
</style></head><body>
<div class="header">
  <div class="vessel">
    <h1>Landing / Handover Report</h1>
    <h2>${dirLabel}</h2>
  </div>
  <div class="vessel-qr">
    <img src="${vesselQrUri}" title="Vessel inspector view"/>
    <div style="font-size:7pt;text-align:center;color:#666">Vessel view</div>
  </div>
</div>

<div class="meta">
  <span><strong>Report No:</strong> ${report.no}</span>
  <span><strong>Date:</strong> ${report.date}</span>
  <span><strong>Vessel:</strong> ${vesselName} (IMO ${imo})</span>
  ${report.port ? `<span><strong>Port:</strong> ${report.port}</span>` : ''}
  ${report.to ? `<span><strong>${report.dir === 'out' ? 'To:' : 'From:'}</strong> ${report.to}</span>` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>QR</th>
      <th>Category</th>
      <th>Description</th>
      <th>Serial No.</th>
      <th>Location</th>
      <th>Reason</th>
      <th>Service Ref.</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

${report.notes ? `<p style="margin-top:4mm"><strong>Notes:</strong> ${report.notes}</p>` : ''}
${sigBlock}

<div class="footer">
  ISM AI Pilot · Marine Safety Manager · ${shipToday()} · ${report.no}
</div>
</body></html>`;
}
