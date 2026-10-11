// Machine history / survey pack drawn in the browser — jsPDF + autotable, A4
// landscape, one machine per page. Content: services/pmsHistory.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import type { MachineHistory } from '../services/pmsHistory';

const plain = (s: string) => s.replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/≈/g, '~').replace(/³/g, '3').replace(/·/g, '-');

export function pmsHistoryPdfBlob(title: string, vesselLine: string, list: MachineHistory[]): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const base = { styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' }, headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 }, margin: { left: M, right: M }, theme: 'grid' };
  list.forEach((h, i) => {
    if (i) doc.addPage();
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(plain(`${title} - ${vesselLine}`), M, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(plain(h.title), M, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(plain(h.facts.join('  -  ')), M, 22);
    let y = 26;
    for (const t of h.tables) {
      if (y > H - 25) {
        doc.addPage();
        y = 12;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${t.title.toUpperCase()} (${t.rows.length})`, M, y + 4);
      const columnStyles = Object.fromEntries(Object.entries(t.widths ?? {}).map(([k, w]) => [k, { cellWidth: w }]));
      autoTable(doc, { ...base, startY: y + 6, head: [t.head], columnStyles, body: t.rows.length ? t.rows.map((r) => r.map(plain)) : [['None.', ...t.head.slice(1).map(() => '')]] });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  });
  return doc.output('blob');
}
