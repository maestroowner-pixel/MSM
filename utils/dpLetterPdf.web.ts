// The DP confirmation letter drawn in the browser — jsPDF + autotable, the same
// layout as services/dp.ts letterHtml (A4 portrait, 35 mm left for the letterhead).
/* eslint-disable @typescript-eslint/no-var-requires */
import type { Letter } from '../services/dp';

export function dpLetterPdfBlob(l: Letter): Blob {
  const { jsPDF } = require('jspdf');
  const autoTableMod = require('jspdf-autotable');
  const autoTable = autoTableMod.default ?? autoTableMod;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const L = 20;
  const W = doc.internal.pageSize.getWidth() - 2 * L;
  let y = 15 + 35;
  const para = (text: string, size = 9, style: 'normal' | 'bold' | 'italic' = 'normal', gap = 1.5, color = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, W);
    doc.text(lines, L, y);
    y += lines.length * size * 0.42 + gap;
  };
  for (const a of l.address) para(a, 9, 'normal', 0);
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.text(l.date, L + W, y, { align: 'right' });
  y += 6;
  para(l.heading, 10, 'bold', 0.5);
  para(l.subheading, 7.5, 'italic', 2.5, 85);
  for (const p of l.paras) para(p, 9, 'normal', 2);
  if (l.notes.length) {
    para(l.notes[0], 9, 'bold', 0);
    for (const n of l.notes.slice(1)) para(n, 9, 'normal', 0);
    y += 2;
  }
  autoTable(doc, {
    startY: y,
    head: [l.head],
    body: [l.row, ...l.dates.map(([k, v]) => [{ content: k, styles: { fontStyle: 'bold' } }, { content: v, colSpan: l.head.length - 1, styles: { fontSize: 7.5 } }])],
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineColor: [187, 187, 187], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 33, 71], textColor: 255, fontSize: 7.5 },
    margin: { left: L, right: L },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  if (l.footnote) para(l.footnote, 7.5, 'italic', 2, 85);
  para(l.closing[0], 9, 'normal', 5);
  para(l.closing[1], 9, 'normal', 0);
  para(l.closing[2], 9, 'normal', 0);
  y += 10;
  doc.setDrawColor(85);
  doc.line(L, y, L + 63, y);
  y += 5;
  l.signature.forEach((s, k) => para(s, 9, k === 0 ? 'bold' : 'normal', 0));
  return doc.output('blob');
}
