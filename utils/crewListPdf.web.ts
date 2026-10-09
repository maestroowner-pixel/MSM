// The crew list (FAL Form 5) as a PDF drawn in the browser — jsPDF + autotable,
// like the register export (utils/webPdf.web). Native draws HTML with expo-print
// (services/crewListReport.ts); Metro loads crewListPdf.ts there.
/* eslint-disable @typescript-eslint/no-var-requires */
import type { CrewListRow } from '../services/crewList';

export interface CrewListPdfData {
  vessel: { name?: string; imo?: string; flag?: string; callSign?: string };
  arrival: boolean;
  port: string;
  date: string;
  rows: CrewListRow[];
}

export function crewListPdfBlob(d: CrewListPdfData): Blob {
  const { jsPDF } = require('jspdf');
  const autoTableMod = require('jspdf-autotable');
  const autoTable = autoTableMod.default ?? autoTableMod;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const navy: [number, number, number] = [11, 37, 69];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navy);
  doc.text('CREW LIST', 10, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('IMO FAL Form 5', W - 10, 14, { align: 'right' });

  const box = (x: number, y: number, w: number, label: string, value: string) => {
    doc.setDrawColor(200, 208, 219);
    doc.rect(x, y, w, 11);
    doc.setFontSize(6.5);
    doc.setTextColor(91, 107, 126);
    doc.text(label, x + 1.5, y + 3.5);
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(value || '', x + 1.5, y + 8.8);
  };
  const y0 = 18;
  const cw = (W - 20) / 4;
  box(10, y0, cw * 2, '1.1 Name of ship', d.vessel.name ?? '');
  box(10 + cw * 2, y0, cw, '1.2 IMO number', d.vessel.imo ?? '');
  box(10 + cw * 3, y0, cw, '1.3 Call sign', d.vessel.callSign ?? '');
  box(10, y0 + 11, cw * 2, `2. Port of ${d.arrival ? 'arrival' : 'departure'}`, d.port);
  box(10 + cw * 2, y0 + 11, cw, `3. Date of ${d.arrival ? 'arrival' : 'departure'}`, d.date);
  box(10 + cw * 3, y0 + 11, cw, '4. Flag State of ship', d.vessel.flag ?? '');

  autoTable(doc, {
    startY: y0 + 26,
    head: [['5. No.', '6. Family name, given names', '7. Rank or rating', '8. Nationality', '9. Date and place of birth', '10. Nature and No. of identity document (passport, expiry)', 'Date and port of embarkation']],
    body: d.rows.map((r) => [r.no, r.name, r.rank, r.nationality, r.birth, r.passport, r.embarked]),
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15 },
    headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 58 }, 2: { cellWidth: 36 }, 3: { cellWidth: 28 }, 4: { cellWidth: 46 }, 5: { cellWidth: 52 } },
    margin: { left: 10, right: 10 },
    theme: 'grid',
  });

  const end = (doc as any).lastAutoTable.finalY + 16;
  const sy = end > H - 14 ? (doc.addPage(), 30) : end;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.line(W - 110, sy, W - 10, sy);
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text('11. Date and signature by master, authorized agent or officer', W - 110, sy + 4);
  return doc.output('blob');
}
