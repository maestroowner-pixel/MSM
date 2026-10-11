// The permit to work (with its toolbox meeting report) drawn in the browser —
// jsPDF + autotable, A4 portrait. Content: services/permitReport.ts.
/* eslint-disable @typescript-eslint/no-var-requires */
import type { PermitDoc } from '../services/permitReport';
import { sigImage } from './sigImage';

export function permitPdfBlob(d: PermitDoc): Blob {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const grey: [number, number, number] = [91, 107, 126];
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const base = { styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' }, headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 }, margin: { left: M, right: M }, theme: 'grid' };
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

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(d.title, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text(`${d.vesselLine} · Status: ${d.status}`, M, y + 5);
  y += 7;

  heading('The work');
  autoTable(doc, { ...base, startY: y, body: d.work, columnStyles: { 0: { cellWidth: 50, textColor: grey } } });
  y = after();

  heading('Precautions');
  autoTable(doc, { ...base, startY: y, head: [['Precaution', 'Answer']], body: d.checks, columnStyles: { 1: { cellWidth: 18, halign: 'center' } },
    didParseCell: (c: any) => { if (c.section === 'body' && c.column.index === 1 && c.cell.raw === 'NO') { c.cell.styles.textColor = [231, 76, 60]; c.cell.styles.fontStyle = 'bold'; } } });
  y = after();

  if (d.gas.length) {
    heading('Gas readings');
    autoTable(doc, { ...base, startY: y, head: [['Time', 'O2 %', 'LEL %', 'H2S ppm', 'CO ppm', 'By', 'Instrument']], body: d.gas });
    y = after();
  }
  if (d.notes) {
    heading('Isolations and notes');
    autoTable(doc, { ...base, startY: y, body: [[d.notes]] });
    y = after();
  }
  if (d.hazards.length) {
    heading('Hazards (risk assessment)');
    autoTable(doc, { ...base, startY: y, head: [['Hazard', 'Controls', 'Risk', 'Residual']], body: d.hazards, columnStyles: { 2: { cellWidth: 18 }, 3: { cellWidth: 18 } } });
    y = after();
  }

  heading('Toolbox meeting report');
  if (d.toolbox) {
    autoTable(doc, { ...base, startY: y, body: d.toolbox.lines, columnStyles: { 0: { cellWidth: 50, textColor: grey } } });
    y = after() + 2;
    autoTable(doc, { ...base, startY: y, head: [['#', 'Name', '', 'Attendance', 'Signature']], body: d.toolbox.attendees, styles: { ...base.styles, minCellHeight: 8, valign: 'middle' }, columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24 }, 3: { cellWidth: 22 }, 4: { cellWidth: 45 } },
      didParseCell: (c: any) => { if (c.section === 'body' && c.column.index === 3 && c.cell.raw === 'ABSENT') { c.cell.styles.textColor = [231, 76, 60]; c.cell.styles.fontStyle = 'bold'; } } });
    y = after() + 2;
    const half = Math.ceil(d.toolbox.topics.length / 2);
    const rows = Array.from({ length: half }, (_, i) => [d.toolbox!.topics[i].replace('☑', '[x]').replace('☐', '[  ]'), (d.toolbox!.topics[i + half] ?? '').replace('☑', '[x]').replace('☐', '[  ]')]);
    autoTable(doc, { ...base, startY: y, body: rows, theme: 'plain' });
    y = after();
    if (d.toolbox.concerns) {
      autoTable(doc, { ...base, startY: y + 1, body: [['Raised / agreed', d.toolbox.concerns]], columnStyles: { 0: { cellWidth: 50, textColor: grey } } });
      y = after();
    }
  } else {
    autoTable(doc, { ...base, startY: y, body: [['Not held.']] });
    y = after();
  }

  heading('Signatures');
  const imgs = d.signatures.map((s) => (s.drawing ? sigImage(s.drawing) : null));
  autoTable(doc, { ...base, startY: y, head: [['Step', 'Name', 'Time', 'Signed', 'Signature']], body: d.signatures.length ? d.signatures.map((s) => [s.step, s.who, s.when, s.how, '']) : [['Not signed.', '', '', '', '']],
    styles: { ...base.styles, minCellHeight: 9, valign: 'middle' }, columnStyles: { 3: { cellWidth: 22 }, 4: { cellWidth: 32 } },
    didDrawCell: (c: any) => {
      if (c.section !== 'body' || c.column.index !== 4) return;
      const img = imgs[c.row.index];
      if (!img) return;
      const h = Math.min(c.cell.height - 1, 8);
      doc.addImage(img, 'PNG', c.cell.x + 2, c.cell.y + (c.cell.height - h) / 2, h * 3, h);
    } });
  return doc.output('blob');
}
