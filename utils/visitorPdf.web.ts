// The Visitor Logbook page as a PDF drawn in the browser (jsPDF + autotable),
// each visitor's signature painted from its SVG path onto a canvas and placed
// in the Signature column. Phones print the HTML page in services/visitorLog.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import { CrewMove, Visitor } from '../types/security';
import { VesselInfo } from '../services/storage';
import { vesselHeader } from '../services/export';
import { MOVES_HEAD, SIG_COL, VLOG_HEAD, moveRows, vlogRows, vlogTitle } from '../services/visitorLog';
import { SIG_H, SIG_W } from '../components/SignaturePad';
import { sigImage } from './sigImage';

export function visitorPdfBlob(visits: Visitor[], moves: CrewMove[], period: string, vessel: VesselInfo | null): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Visitor Logbook · ${vlogTitle(period)}`, 10, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${vesselHeader(vessel)} · ISPS Code — access control`, 10, 19);
  const rows = vlogRows(visits);
  const sigs = visits.map((v) => (v.signature ? sigImage(v.signature) : null));
  autoTable(doc, {
    startY: 23,
    head: [VLOG_HEAD],
    body: rows.length ? rows : [['', 'No visitors.', ...VLOG_HEAD.slice(2).map(() => '')]],
    styles: { fontSize: 7, cellPadding: 1.2, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak', minCellHeight: 9, valign: 'middle' },
    headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 6.8 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 17 }, 8: { cellWidth: 11 }, 9: { cellWidth: 13 }, [SIG_COL]: { cellWidth: 27 } },
    margin: { left: 10, right: 10 },
    theme: 'grid',
    didDrawCell: (d: any) => {
      if (d.section !== 'body' || d.column.index !== SIG_COL) return;
      const img = sigs[d.row.index];
      if (!img) return;
      const h = Math.min(d.cell.height - 1, 8);
      const w = (h * SIG_W) / SIG_H;
      doc.addImage(img, 'PNG', d.cell.x + (d.cell.width - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h);
    },
  });
  if (moves.length) {
    let y = (doc as any).lastAutoTable.finalY + 10;
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Crew ashore / back aboard', 10, y);
    autoTable(doc, {
      startY: y + 3,
      head: [MOVES_HEAD],
      body: moveRows(moves),
      styles: { fontSize: 7, cellPadding: 1.2, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15 },
      headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 6.8 },
      margin: { left: 10, right: 10 },
      theme: 'grid',
    });
  }
  return doc.output('blob');
}
