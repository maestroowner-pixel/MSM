// The Oil Record Book Part I page drawn in the browser — jsPDF + autotable, A4
// portrait. Content: services/orbReport.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import { OrbEntry, OrbMasterSign } from '../types/orb';
import { ORB_HEAD, masterLine, orbMonthLabel, orbRows } from '../services/orbReport';

export function orbPdfBlob(entries: OrbEntry[], month: string, vesselLine: string, sign?: OrbMasterSign): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Oil Record Book — Part I · ${orbMonthLabel(month)}`, 12, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${vesselLine} · Machinery space operations (MARPOL Annex I)`, 12, 21);
  const rows = orbRows(entries).map((r) => r.map((c) => c.replace(/³/g, '3').replace(/–/g, '-')));
  autoTable(doc, {
    startY: 25,
    head: [ORB_HEAD],
    body: rows.length ? rows : [['No entries this month.', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 38 } },
    margin: { left: 12, right: 12 },
    theme: 'grid',
    didParseCell: (c: any) => {
      if (c.section === 'body' && entries[c.row.index]?.cancelled) c.cell.styles.textColor = [138, 151, 168];
    },
  });
  let y = (doc as any).lastAutoTable.finalY + 16;
  if (y > H - 12) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.line(W - 100, y, W - 12, y);
  doc.setFontSize(8);
  doc.text(masterLine(sign), W - 100, y + 4);
  return doc.output('blob');
}
