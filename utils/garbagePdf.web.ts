// The month's Garbage Record Book page as a PDF drawn in the browser (jsPDF +
// autotable). Phones print the HTML version in services/garbageReport.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import { GarbageEntry, GarbageMasterSign } from '../types/garbage';
import { VesselInfo } from '../services/storage';
import { vesselHeader } from '../services/export';
import { GRB_HEAD, gDmy, gMonthLabel, grbRows } from '../services/garbageReport';

export function garbagePdfBlob(entries: GarbageEntry[], month: string, vessel: VesselInfo | null, sign?: GarbageMasterSign): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Garbage Record Book — Part I · ${gMonthLabel(month)}`, 10, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${vesselHeader(vessel)} · MARPOL Annex V · categories A–I`, 10, 19);
  const rows = grbRows(entries);
  autoTable(doc, {
    startY: 23,
    head: [GRB_HEAD],
    body: rows.length ? rows : [['No entries this month.', '', '', '', '', '', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 48 }, 2: { cellWidth: 36 }, 3: { cellWidth: 17, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 19, halign: 'right' }, 6: { cellWidth: 19, halign: 'right' }, 8: { cellWidth: 36 } },
    margin: { left: 10, right: 10 },
    theme: 'grid',
  });
  let y = (doc as any).lastAutoTable.finalY + 16;
  if (y > H - 12) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.line(W - 120, y, W - 10, y);
  doc.setFontSize(8);
  doc.text(
    `Master's signature${sign ? `: ${sign.by}${sign.byRank ? ` (${sign.byRank})` : ''}, ${gDmy(new Date(sign.at).toISOString().slice(0, 10))}${sign.signedWith ? ` · ${sign.signedWith.method === 'pin' ? 'PIN' : 'biometric'}` : ''}` : ''}`,
    W - 120,
    y + 4
  );
  return doc.output('blob');
}
