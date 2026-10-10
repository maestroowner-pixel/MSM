// The monthly fuel report drawn in the browser (jsPDF + autotable). Phones use
// the HTML version in services/fuelReport.ts; Metro loads fuelPdf.ts there.
/* eslint-disable @typescript-eslint/no-var-requires */
import { FuelMonth, orbBunkerLine, transferText } from '../services/fuel';
import { FuelTank } from '../types/fuel';
import { VesselInfo } from '../services/storage';
import { vesselHeader } from '../services/export';
import { dmy, monthLabel, n, rows } from '../services/fuelReport';

export function fuelPdfBlob(m: FuelMonth, tanks: FuelTank[], vessel: VesselInfo | null): Blob {
    const { jsPDF } = require('jspdf');
    const at = require('jspdf-autotable');
    const autoTable = at.default ?? at;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const navy: [number, number, number] = [11, 37, 69];
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Fuel report — ${monthLabel(m.month)}`, 12, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${vesselHeader(vessel)} · Diesel (MGO), litres`, 12, 21);
    const box = (x: number, label: string, v?: number) => {
      doc.setDrawColor(200, 208, 219);
      doc.roundedRect(x, 25, 44, 14, 1.5, 1.5);
      doc.setFontSize(7.5);
      doc.text(label, x + 2, 29.5);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(n(v) || '—', x + 2, 36);
      doc.setFont('helvetica', 'normal');
    };
    box(12, 'Opening ROB', m.opening);
    box(59, 'Received', m.received);
    box(106, 'Consumed', m.consumed);
    box(153, 'Closing ROB', m.closing);
    autoTable(doc, {
      startY: 43,
      head: [['Date', 'ROB, L', 'Received, L', 'Consumed, L']],
      body: rows(m),
      styles: { fontSize: 8, cellPadding: 1.4, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15 },
      headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 12, right: 12 },
      theme: 'grid',
    });
    let y = (doc as any).lastAutoTable.finalY + 8;
    const H = doc.internal.pageSize.getHeight();
    const line = (t: string, bold = false, size = 8.5) => {
      if (y > H - 20) { doc.addPage(); y = 16; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const parts: string[] = doc.splitTextToSize(t, 186);
      doc.text(parts, 12, y);
      y += parts.length * (size * 0.42) + 1;
    };
    line('Bunkering — Oil Record Book Part I entries (code H)', true, 10);
    if (!m.bunkers.length) line('No bunkering this month.');
    for (const b of m.bunkers) {
      line(dmy(b.date), true);
      for (const l of orbBunkerLine(b, tanks).split('\n')) line(l);
      y += 1;
    }
    if (m.transfers.length) {
      y += 2;
      line('Transfers', true, 10);
      for (const t of m.transfers) line(`${dmy(t.date)} — ${transferText(t, tanks)} (${t.by})`);
    }
    y = Math.max(y + 14, H - 24);
    if (y > H - 10) { doc.addPage(); y = 40; }
    doc.setDrawColor(...navy);
    doc.line(12, y, 92, y);
    doc.line(118, y, 198, y);
    doc.setFontSize(7.5);
    doc.text('Chief Engineer — name, signature, date', 12, y + 4);
    doc.text('Master — name, signature, date', 118, y + 4);
    return doc.output('blob');
}
