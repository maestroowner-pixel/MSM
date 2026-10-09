// ===================================
// The monthly hours-of-rest record as a real PDF, drawn in the browser (jsPDF).
//
// The web build used to PRINT the HTML record: the browser then chose the file
// name (the tab title), the folder, and added its own header and footer. Drawing
// the PDF here gives a file that can be saved straight into the remembered
// folder (utils/webSave) under its proper name, and looks the same every time.
// Native keeps expo-print (services/restReport.ts); Metro loads restPdf.ts there.
//
// Same layout as the HTML record: A4 landscape, a row per day, the 24 hours as
// 48 half-hour cells with work shaded, then Work / Rest / Min rest in 24 h /
// Breach / Note, the rules, the breaches in full, and two signature lines.
// ===================================
/* eslint-disable @typescript-eslint/no-var-requires */

export interface RestPdfRow {
  day: string;
  /** 48 chars, '1' = work; null = not recorded. */
  work: string | null;
  workH?: number;
  restH?: number;
  minRest?: number;
  breach: string;
  note: string;
  bad: boolean;
}

export interface RestPdfData {
  title: string;
  vesselLine: string;
  seafarerLine: string;
  rows: RestPdfRow[];
  rules: string;
  breaches: string[];
}

const NAVY: [number, number, number] = [11, 37, 69];
const GRID: [number, number, number] = [200, 208, 219];
const HOURLINE: [number, number, number] = [138, 150, 168];
const MUTED: [number, number, number] = [91, 107, 126];
const RED: [number, number, number] = [192, 57, 43];
const HEAD: [number, number, number] = [238, 242, 247];

export function restPdfBlob(d: RestPdfData): Blob {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 10;
  const R = W - 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(d.title, L, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(d.vesselLine, L, 19);
  doc.text(d.seafarerLine, L, 23);

  // Columns, in mm.
  const dayW = 7;
  const fixed = { work: 10, rest: 10, min: 12, breach: 17, note: 52 };
  const fixedW = fixed.work + fixed.rest + fixed.min + fixed.breach + fixed.note;
  const slotW = (R - L - dayW - fixedW) / 48;
  const gridX = L + dayW;
  const xWork = gridX + 48 * slotW;
  const xRest = xWork + fixed.work;
  const xMin = xRest + fixed.rest;
  const xBreach = xMin + fixed.min;
  const xNote = xBreach + fixed.breach;

  const top = 27;
  const headH = 7;
  const rowH = 4.4;

  doc.setLineWidth(0.15);
  // Header band
  doc.setFillColor(...HEAD);
  doc.rect(L, top, R - L, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...NAVY);
  const mid = (x: number, w: number, t: string, y = top + 4.4) => doc.text(t, x + w / 2, y, { align: 'center' });
  mid(L, dayW, 'Day');
  for (let h = 0; h < 24; h++) mid(gridX + h * 2 * slotW, 2 * slotW, String(h).padStart(2, '0'));
  mid(xWork, fixed.work, 'Work h');
  mid(xRest, fixed.rest, 'Rest h');
  doc.text('Min rest', xMin + fixed.min / 2, top + 3, { align: 'center' });
  doc.text('in 24 h', xMin + fixed.min / 2, top + 5.6, { align: 'center' });
  mid(xBreach, fixed.breach, 'Breach');
  mid(xNote, fixed.note, 'Note');

  let y = top + headH;
  doc.setFont('helvetica', 'normal');
  for (const r of d.rows) {
    // Work shading
    if (r.work) {
      doc.setFillColor(...NAVY);
      for (let i = 0; i < 48; i++) if (r.work[i] === '1') doc.rect(gridX + i * slotW, y, slotW, rowH, 'F');
    } else {
      doc.setFontSize(6);
      doc.setTextColor(154, 166, 181);
      doc.text('not recorded', gridX + 24 * slotW, y + 3, { align: 'center' });
    }
    doc.setFontSize(6.5);
    doc.setTextColor(...(r.bad ? RED : NAVY));
    doc.setFont('helvetica', 'bold');
    mid(L, dayW, r.day, y + 3.1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    if (r.work) {
      mid(xWork, fixed.work, String(r.workH ?? ''), y + 3.1);
      mid(xRest, fixed.rest, String(r.restH ?? ''), y + 3.1);
    }
    if (r.minRest != null) mid(xMin, fixed.min, String(r.minRest), y + 3.1);
    if (r.breach) {
      doc.setTextColor(...RED);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      mid(xBreach, fixed.breach, r.breach, y + 3);
      doc.setFont('helvetica', 'normal');
    }
    if (r.note) {
      doc.setTextColor(...NAVY);
      doc.setFontSize(5.5);
      let lines: string[] = doc.splitTextToSize(r.note, fixed.note - 2);
      if (lines.length > 2) lines = [lines[0], `${lines[1].replace(/\s*\S*$/, '')}…`];
      doc.text(lines, xNote + 1, y + (lines.length > 1 ? 1.9 : 3), { lineHeightFactor: 1.05 });
    }
    y += rowH;
  }

  // Grid lines
  doc.setDrawColor(...GRID);
  const bottom = y;
  for (let yy = top; yy <= bottom + 0.01; yy += yy === top ? headH : rowH) doc.line(L, yy, R, yy);
  const vline = (x: number, from = top, color = GRID) => {
    doc.setDrawColor(...color);
    doc.line(x, from, x, bottom);
  };
  vline(L);
  vline(gridX);
  // Hour lines in the header; half-hour cells only on the days that were
  // recorded, so "not recorded" reads as one empty band.
  doc.setDrawColor(...HOURLINE);
  for (let h = 1; h < 24; h++) doc.line(gridX + h * 2 * slotW, top, gridX + h * 2 * slotW, top + headH);
  d.rows.forEach((r, k) => {
    if (!r.work) return;
    const y0 = top + headH + k * rowH;
    for (let i = 1; i < 48; i++) {
      doc.setDrawColor(...(i % 2 === 0 ? HOURLINE : GRID));
      doc.line(gridX + i * slotW, y0, gridX + i * slotW, y0 + rowH);
    }
  });
  [xWork, xRest, xMin, xBreach, xNote, R].forEach((x) => vline(x));

  // Rules, breaches, signatures
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  let ty = bottom + 5;
  const rules: string[] = doc.splitTextToSize(d.rules, R - L);
  doc.text(rules, L, ty);
  ty += rules.length * 2.8 + 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Breaches shown by this record', L, ty);
  doc.setFont('helvetica', 'normal');
  ty += 3.2;
  const list = d.breaches.length ? d.breaches.map((b, i) => `${i + 1}. ${b}`) : ['No breach of the rest-hour rules is shown by this record.'];
  for (const b of list) {
    if (ty > H - 16) {
      doc.addPage();
      ty = 15;
    }
    doc.text(doc.splitTextToSize(b, R - L), L, ty);
    ty += 3;
  }
  const sigY = Math.max(ty + 8, H - 12);
  if (sigY > H - 6) doc.addPage();
  const sy = sigY > H - 6 ? 30 : sigY;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  const half = (R - L - 20) / 2;
  doc.line(L, sy, L + half, sy);
  doc.line(R - half, sy, R, sy);
  doc.setTextColor(...NAVY);
  doc.setFontSize(7);
  doc.text('Seafarer — name, signature, date', L, sy + 3.5);
  doc.text('Master or authorised person — name, signature, date', R - half, sy + 3.5);

  return doc.output('blob');
}
