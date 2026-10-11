// The monthly PMS report drawn in the browser — jsPDF + autotable, A4 landscape.
// Content: services/pmsReport.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import type { PmsMonth } from '../services/pmsKpi';
import { PMS_HEAD, completionLine, monthLabelPms } from '../services/pmsKpi';

export function pmsPdfBlob(r: PmsMonth, vesselLine: string): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  // jsPDF's standard fonts have no ⚑ — the flag is written as [!] in the PDF.
  const flag = (rows: string[][]) => rows.map((x) => x.map((c) => c.replace('⚑ ', '[!] ')));
  const base = { styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' }, headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 }, margin: { left: M, right: M }, theme: 'grid' };
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Planned maintenance — ${monthLabelPms(r.month)}`, M, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${vesselLine} · [!] critical equipment`, M, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(completionLine(r), M, 26);
  let y = 30;
  const section = (title: string, head: string[], rows: string[][], empty: string) => {
    if (y > H - 25) {
      doc.addPage();
      y = 14;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title.toUpperCase(), M, y + 4);
    autoTable(doc, { ...base, startY: y + 6, head: [head], body: rows.length ? flag(rows) : [[empty, ...head.slice(1).map(() => '')]] });
    y = (doc as any).lastAutoTable.finalY + 4;
  };
  section(`Done this month (${r.done.length})`, PMS_HEAD.done, r.done, 'Nothing recorded.');
  section(`Deferred this month (${r.deferred.length})`, PMS_HEAD.deferred, r.deferred, 'No deferrals.');
  section(`Overdue now (${r.overdue.length})`, PMS_HEAD.overdue, r.overdue, 'Nothing overdue.');
  return doc.output('blob');
}
