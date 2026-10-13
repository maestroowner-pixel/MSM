// A drill report / attendance list drawn in the browser — jsPDF + autotable,
// A4 portrait. Content: services/drillReport.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import type { DrillDoc } from '../services/drills';
import { sigImage } from './sigImage';

// The PDF's built-in Helvetica has no subscripts or math signs: "CO₂" spread a
// whole line letter by letter. Write them the way a typewriter would.
const plain = (s: string) => s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/≈/g, '~').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/→/g, '->');
const deep = <T,>(v: T): T => (typeof v === 'string' ? (plain(v) as any) : Array.isArray(v) ? (v.map(deep) as any) : v && typeof v === 'object' ? (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'drawing' ? x : deep(x)])) as any) : v);

export function drillPdfBlob(raw: DrillDoc): Blob {
  const d = deep(raw);
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const grey: [number, number, number] = [91, 107, 126];
  const H = doc.internal.pageSize.getHeight();
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  const base = { styles: { fontSize: 8, cellPadding: 1.4, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' }, headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7.5 }, margin: { left: M, right: M }, theme: 'grid' };
  let y = 16;
  const after = () => (doc as any).lastAutoTable.finalY;
  const heading = (t: string) => {
    if (y > H - 30) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    doc.text(t.toUpperCase(), M, y + 6);
    y += 8;
  };
  const red = (c: any) => {
    if (c.section === 'body' && String(c.cell.raw ?? '').startsWith('ABSENT')) {
      c.cell.styles.textColor = [231, 76, 60];
      c.cell.styles.fontStyle = 'bold';
    }
  };

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(d.title, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text(`${d.vesselLine} · ${d.status}`, M, y + 5);
  y += 8;
  autoTable(doc, { ...base, startY: y, body: d.facts, columnStyles: { 0: { cellWidth: 45, textColor: grey } } });
  y = after();

  if (!d.listOnly && d.content.length) {
    heading('Content of the drill');
    autoTable(doc, { ...base, startY: y, body: d.content.map((c) => [`• ${c}`]), theme: 'plain' });
    y = after();
  }
  if (!d.listOnly && d.scenario.length) {
    heading('Scenario');
    autoTable(doc, { ...base, startY: y, head: [['T+min', 'Clock', 'Action', 'Who', 'Actual']], body: d.scenario, columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 14 }, 3: { cellWidth: 32 }, 4: { cellWidth: 15 } } });
    y = after();
  }
  heading('Attendance');
  autoTable(doc, { ...base, startY: y, head: [['#', 'Name', 'Rank', 'Attendance', 'Signature']], body: d.attendance, styles: { ...base.styles, minCellHeight: 8, valign: 'middle' }, columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 32 }, 3: { cellWidth: 38 }, 4: { cellWidth: 42 } }, didParseCell: red });
  y = after();
  if (!d.listOnly && d.debrief) {
    heading('Debrief — lessons and actions');
    autoTable(doc, { ...base, startY: y, body: [[d.debrief]] });
    y = after();
  }
  heading('Signature');
  if (d.signature) {
    const img = d.signature.drawing ? sigImage(d.signature.drawing) : null;
    autoTable(doc, { ...base, startY: y, head: [['Conducted by', 'Signed', 'How', 'Signature']], body: [[d.signature.who, d.signature.when, d.signature.how, '']], styles: { ...base.styles, minCellHeight: 10, valign: 'middle' }, columnStyles: { 3: { cellWidth: 36 } },
      didDrawCell: (c: any) => {
        if (c.section !== 'body' || c.column.index !== 3 || !img) return;
        const h = Math.min(c.cell.height - 1, 8);
        doc.addImage(img, 'PNG', c.cell.x + 2, c.cell.y + (c.cell.height - h) / 2, h * 3, h);
      } });
  } else {
    autoTable(doc, { ...base, startY: y, body: [['Conducted by', '', 'Signature', '']], styles: { ...base.styles, minCellHeight: 10 }, columnStyles: { 0: { cellWidth: 30, textColor: grey }, 2: { cellWidth: 25, textColor: grey } } });
  }

  if (d.theory) {
    doc.addPage();
    y = 16;
    heading('Annex — theory briefing');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(d.theory.title, M, y + 2);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const p of d.theory.text) {
      const lines = doc.splitTextToSize(p, W - 2 * M);
      for (const l of lines) {
        if (y > H - 14) {
          doc.addPage();
          y = 16;
        }
        doc.text(l, M, y);
        y += 4.2;
      }
      y += 2.5;
    }
  }
  return doc.output('blob');
}
