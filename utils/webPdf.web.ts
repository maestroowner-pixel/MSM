// ===================================
// Web-only PDF generation (jsPDF + autotable).
// The web build's "Export PDF" builds a real .pdf FILE client-side and downloads
// it — no print dialog. Native (iOS/Android) uses expo-print instead and never
// loads this file (Metro picks webPdf.ts there). jspdf is only installed in the
// web project, so it's required lazily to keep it off the native bundle.
// ===================================
/* eslint-disable @typescript-eslint/no-var-requires */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// r: { title, vesselHeader, today, fileName, statusLabel, statusHex,
//      groups: [{ label, rows: [{no,type,serial,position,mfg,due,status,remarks}] }] }
export function downloadPdfWeb(r: any): void {
  const { jsPDF } = require('jspdf');
  const autoTableMod = require('jspdf-autotable');
  const autoTable = autoTableMod.default ?? autoTableMod;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.setTextColor(31, 86, 112);
  doc.text(String(r.title), 12, 15);
  doc.setFontSize(9);
  doc.setTextColor(127, 140, 141);
  doc.text(`${r.vesselHeader} — generated ${r.today}`, 12, 21);

  let y = 28;
  for (const g of r.groups) {
    if (y > pageH - 30) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(11);
    doc.setTextColor(46, 125, 153);
    doc.text(`${g.label} (${g.rows.length})`, 12, y);

    autoTable(doc, {
      startY: y + 2,
      head: [['No', 'Type', 'Serial', 'Position', 'Mfg', 'Due', 'Status', 'Remarks']],
      body: g.rows.map((row: any) => [
        row.no ?? '',
        row.type ?? '',
        row.serial ?? '',
        row.position ?? '',
        row.mfg ?? '',
        row.due ?? '',
        r.statusLabel[row.status] ?? '',
        row.remarks ?? '',
      ]),
      styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [218, 238, 247], textColor: 40, fontStyle: 'bold' },
      columnStyles: { 7: { cellWidth: 55 } },
      margin: { left: 12, right: 12 },
      theme: 'grid',
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 6) {
          const st = g.rows[data.row.index]?.status;
          const hex = r.statusHex[st];
          if (hex) {
            data.cell.styles.textColor = hexToRgb(hex);
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.save(String(r.fileName));
}
