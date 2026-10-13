// A medical report drawn in the browser — jsPDF + autotable, A4 portrait.
// Content: services/hospitalReport.ts (treatmentDoc).
/* eslint-disable @typescript-eslint/no-var-requires */
import type { MedDoc } from '../services/hospitalReport';
import { sigImage } from './sigImage';

const plain = (s: string) => s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/≈/g, '~').replace(/≤/g, '<=').replace(/≥/g, '>=');

export function medPdfBlob(d: MedDoc): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const grey: [number, number, number] = [91, 107, 126];
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const base = { styles: { fontSize: 9, cellPadding: 1.6, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' }, headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold' }, margin: { left: M, right: M }, theme: 'grid' };
  let y = 18;
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(plain(d.title), M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grey);
  doc.text(plain(d.vesselLine), M, y + 5);
  y += 9;
  for (const s of d.sections) {
    if (y > H - 30) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(s.title.toUpperCase(), M, y + 5);
    y += 7;
    if (s.rows) {
      autoTable(doc, { ...base, startY: y, body: s.rows.map(([k, v]) => [plain(k), plain(v)]), columnStyles: { 0: { cellWidth: 50, textColor: grey } } });
      y = (doc as any).lastAutoTable.finalY + 1;
    }
    if (s.table) {
      autoTable(doc, { ...base, startY: y, head: [s.table.head.map(plain)], body: s.table.rows.map((r) => r.map(plain)) });
      y = (doc as any).lastAutoTable.finalY + 1;
    }
    if (s.text) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...navy);
      const lines = doc.splitTextToSize(plain(s.text), doc.internal.pageSize.getWidth() - 2 * M);
      doc.text(lines, M, y + 4);
      y += 4 + lines.length * 4;
    }
    if (s.signatures?.length) {
      // Side by side, a box each: role, the drawn signature over a line, name, how and when.
      const W = doc.internal.pageSize.getWidth() - 2 * M;
      const gap = 5;
      const w = (W - gap * (s.signatures.length - 1)) / s.signatures.length;
      if (y > H - 50) {
        doc.addPage();
        y = 18;
      }
      s.signatures.forEach((g, i) => {
        const x = M + i * (w + gap);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...grey);
        doc.text(plain(g.role), x, y + 4);
        const img = g.drawing ? sigImage(g.drawing) : null;
        if (img) doc.addImage(img, 'PNG', x, y + 6, Math.min(w, 54), Math.min(w, 54) / 3);
        doc.setDrawColor(...navy);
        doc.setLineWidth(0.3);
        doc.line(x, y + 25, x + w, y + 25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...navy);
        doc.text(doc.splitTextToSize(plain(g.name || ' '), w), x, y + 29);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...grey);
        doc.text(doc.splitTextToSize(plain(g.detail), w), x, y + 33);
      });
      y += 42;
    }
  }
  return doc.output('blob');
}
