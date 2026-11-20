// ===================================
// A month of a record book as a certified true copy (25 Oct 2026, MEPC.312(74)
// §4.1.4 and §6.3) — one page layout for the Oil Record Book, the Garbage Record
// Book, Sewage and Ballast water, on every platform.
//
// jsPDF is plain JS (it runs under Node as it does in a browser), so phones draw
// the same file the web does. They used to print an HTML page, which cannot say
// "Page 2 of 3" — and a copy whose completeness cannot be checked is not one.
//
// What §6.3 wants on EVERY printed page, and where it is here:
//   who entered each record — name, rank, ID ........ the rows (each book's report)
//   every change made to the entries ................. the rows: earlier versions struck through
//   date and time of printing ........................ footer, UTC
//   name and version of the electronic record book ... footer
//   page numbering and number of pages ............... footer, "Page n of N"
// plus a line on each page for the Master to sign it as a true copy.
// ===================================

/* eslint-disable @typescript-eslint/no-var-requires */
import { utcStamp } from './verification';

// Pure — no React Native here, so `npm run check:verification` draws it under Node.
// Delivery (save / share) is utils/trueCopyPdf.
const APP = require('../app.json').expo;

export interface TrueCopy {
  title: string;
  /** Vessel header · the book's regulation. */
  subtitle: string;
  /** Short vessel line for the footer. */
  vessel: string;
  orientation: 'portrait' | 'landscape';
  head: string[];
  rows: string[][];
  /** Rows to print struck through and grey — earlier versions and deleted entries. */
  struck: boolean[];
  columnStyles?: Record<number, Record<string, unknown>>;
  /** One line per Master's signature of the month. */
  verifications: string[];
  /** The seals and the chain checked (services/verification integrityLines) — said under the verifications. */
  integrity?: string[];
  /** Entries on the page not verified yet, if any — said under the table. */
  awaiting?: number;
  printedAt?: number;
  /** The table's text when there are no rows (default: no entries this month). */
  emptyText?: string;
}

/** The software line every page carries. */
export const SOFTWARE = `ISM AI Pilot electronic record book, version ${APP.version} (build ${APP.android?.versionCode ?? APP.ios?.buildNumber ?? '-'})`;

// The standard PDF fonts are WinAnsi: keep what they cannot draw from turning into noise.
const clean = (s: string) => s.replace(/³/g, '3').replace(/²/g, '2').replace(/[−‐]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

export function trueCopyDoc(c: TrueCopy): any {
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable');
  const autoTable = at.default ?? at;
  const doc = new jsPDF({ orientation: c.orientation, unit: 'mm', format: 'a4' });
  const navy: [number, number, number] = [11, 37, 69];
  const grey: [number, number, number] = [138, 151, 168];
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const printed = utcStamp(c.printedAt ?? Date.now());

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(clean(c.title), M, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(clean(c.subtitle), M, 19);

  autoTable(doc, {
    startY: 23,
    head: [c.head.map(clean)],
    body: c.rows.length ? c.rows.map((r) => r.map(clean)) : [[{ content: c.emptyText ?? 'No entries this month.', colSpan: c.head.length }]],
    styles: { fontSize: 7.5, cellPadding: 1.3, textColor: navy, lineColor: [200, 208, 219], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [238, 242, 247], textColor: navy, fontStyle: 'bold', fontSize: 7 },
    columnStyles: c.columnStyles ?? {},
    // Room at the foot of every page for the true-copy line and the footer.
    margin: { left: M, right: M, top: 14, bottom: 24 },
    theme: 'grid',
    didParseCell: (cell: any) => {
      if (cell.section === 'body' && c.struck[cell.row.index]) {
        cell.cell.styles.textColor = grey;
        cell.cell.styles.fontStyle = 'italic';
      }
    },
    // jsPDF cannot strike text through; a line across each struck row does it.
    didDrawCell: (cell: any) => {
      if (cell.section === 'body' && c.struck[cell.row.index]) {
        doc.setDrawColor(...grey);
        doc.setLineWidth(0.2);
        const y = cell.cell.y + Math.min(cell.cell.height / 2, 3);
        doc.line(cell.cell.x, y, cell.cell.x + cell.cell.width, y);
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  const lines = [
    ...(c.verifications.length ? c.verifications : ['Not verified by the Master yet.']),
    ...(c.awaiting ? [`${c.awaiting} ${c.awaiting === 1 ? 'entry' : 'entries'} on this page awaiting the Master's verification.`] : []),
    ...(c.integrity ?? []),
  ];
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  if (y > H - 30) {
    doc.addPage();
    y = 20;
  }
  doc.text("Master's verification", M, y);
  doc.setFont('helvetica', 'normal');
  for (const l of lines) {
    y += 4.2;
    if (y > H - 26) {
      doc.addPage();
      y = 20;
    }
    doc.text(clean(l), M, y);
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.3);
    doc.setTextColor(...navy);
    doc.setFontSize(7.5);
    const sy = H - 14;
    doc.text('Certified true copy.  Master (name):', M, sy);
    doc.line(M + 46, sy + 0.5, M + 96, sy + 0.5);
    doc.text('Signature:', M + 100, sy);
    doc.line(M + 114, sy + 0.5, M + 150, sy + 0.5);
    doc.text('Date:', M + 154, sy);
    doc.line(M + 162, sy + 0.5, Math.min(M + 200, W - M), sy + 0.5);
    doc.setFontSize(6.5);
    doc.setTextColor(...grey);
    doc.text(clean(`${c.vessel} · Printed ${printed} · ${SOFTWARE}`), M, H - 8);
    doc.text(`Page ${i} of ${n}`, W - M, H - 8, { align: 'right' });
  }
  return doc;
}


// ---- a period, the whole book, one entry (20 Nov 2026, MEPC.312 §6.3: "the specific entry, relevant page,
// pages or the entirety of the electronic record book") ----------------------------------------------------
// Each book draws its true copy a month at a time; a longer copy is those months one after the other, in one
// file, so "Page n of N" counts the whole of what was printed.

/** Every month from `from` to `to` (yyyy-mm), in order; the two given either way round. */
export function monthsBetween(from: string, to: string): string[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const out: string[] = [];
  let [y, m] = a.split('-').map(Number);
  for (let n = 0; n < 1200; n++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k >= b) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const monthWord = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** `October 2026` or `October 2026 – March 2027`. */
export function periodLabel(months: string[]): string {
  if (!months.length) return '';
  return months.length === 1 ? monthWord(months[0]) : `${monthWord(months[0])} – ${monthWord(months[months.length - 1])}`;
}

/**
 * Months' copies as one. `title` replaces the first month's; each month's verifications and seal check are
 * said under its name. Months with no entries are left out of the table but named, so the reader sees the
 * period was complete and nothing was skipped.
 */
export function joinCopies(title: string, parts: { month: string; copy: TrueCopy }[]): TrueCopy {
  if (!parts.length) throw new Error('No months to print.');
  const first = parts[0].copy;
  const empty = parts.filter((p) => !p.copy.rows.length).map((p) => monthWord(p.month));
  const notes: string[] = [];
  for (const p of parts) {
    if (!p.copy.rows.length) continue;
    const head = monthWord(p.month);
    for (const l of p.copy.verifications.length ? p.copy.verifications : ['Not verified by the Master yet.']) notes.push(`${head}: ${l}`);
    for (const l of p.copy.integrity ?? []) notes.push(`${head}: ${l}`);
  }
  if (empty.length) notes.push(`No entries in ${empty.join(', ')}.`);
  return {
    ...first,
    title,
    rows: parts.flatMap((p) => p.copy.rows),
    struck: parts.flatMap((p) => p.copy.struck),
    verifications: notes,
    integrity: [],
    awaiting: parts.reduce((n, p) => n + (p.copy.awaiting ?? 0), 0),
    emptyText: 'No entries in this period.',
  };
}

/** `<book title> · <period>` — a month's title with its month taken off. */
export function bookTitle(monthTitle: string): string {
  return monthTitle.replace(/\s·\s[^·]*$/, '');
}
