// ===================================
// Crew cards — one per crew member, credit-card size (85.6 × 54 mm), with the
// QR the gangway scans going ashore and coming back aboard. Ten to an A4 page,
// cut along the lines; laminate or put in a card holder.
//
// The QR is drawn from its modules (qrcode's create()), so the same squares go
// into the browser's PDF and the phone's printed HTML — no image to render.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'qrcode';

import { VesselInfo } from './storage';
import { esc, share } from './export';
import { crewQrPayload, passQrPayload, sopepQrPayload } from './crewQr';
import { CrewMember } from '../types/crew';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

export const CARD_W = 85.6;
export const CARD_H = 54;

/** The QR as a square matrix of dark (true) / light modules. */
export function qrMatrix(text: string): boolean[][] {
  const q = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const n = q.modules.size;
  const out: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(!!q.modules.data[r * n + c]);
    out.push(row);
  }
  return out;
}

function qrSvg(text: string, size: string): string {
  const m = qrMatrix(text);
  const n = m.length;
  let d = '';
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c} ${r}h1v1h-1z`; }));
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** One card on the sheet: vessel line, the name (or "VISITOR 07"), a second line, the foot, the QR. */
interface CardSpec {
  name: string;
  sub: string;
  foot: string;
  qr: string;
  /** A visitor pass: the number printed large. */
  big?: boolean;
}

function html(cards: CardSpec[], vessel: VesselInfo | null): string {
  const body = cards
    .map((c) => `<div class="card"><div class="txt"><div class="ves">${esc(vessel?.vessel_name ?? '')}</div>${c.big ? `<div class="name">${esc(c.name.split(' ')[0])}</div><div class="big">${esc(c.name.split(' ')[1] ?? '')}</div>` : `<div class="name">${esc(c.name)}</div>`}<div class="rank">${esc(c.sub)}</div><div class="foot">${esc(c.foot)}</div></div>${qrSvg(c.qr, '40mm')}</div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm 15mm; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0B2545; }
    .grid { display: grid; grid-template-columns: ${CARD_W}mm ${CARD_W}mm; gap: 0; }
    .card { width: ${CARD_W}mm; height: ${CARD_H}mm; box-sizing: border-box; border: 0.3mm dashed #9aa7b8; padding: 5mm; display: flex; align-items: center; justify-content: space-between; page-break-inside: avoid; }
    .txt { flex: 1; padding-right: 3mm; } .ves { font-size: 8pt; color: #5b6b7e; text-transform: uppercase; letter-spacing: 0.5px; }
    .name { font-size: 13pt; font-weight: 800; margin-top: 3mm; } .big { font-size: 30pt; font-weight: 900; line-height: 1; }
    .rank { font-size: 10pt; margin-top: 1mm; } .foot { font-size: 6pt; color: #5b6b7e; margin-top: 6mm; }
  </style></head><body><div class="grid">${body}</div></body></html>`;
}

function pdfBlob(cards: CardSpec[], vessel: VesselInfo | null): Blob {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const left = 15;
  const top = 12;
  cards.forEach((c, i) => {
    const k = i % 10;
    if (i && !k) doc.addPage();
    const x = left + (k % 2) * CARD_W;
    const y = top + Math.floor(k / 2) * CARD_H;
    doc.setDrawColor(154, 167, 184);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.rect(x, y, CARD_W, CARD_H);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(91, 107, 126);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text((vessel?.vessel_name ?? '').toUpperCase(), x + 5, y + 9);
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    if (c.big) {
      // "VISITOR" on one line, the number large under it.
      const [word, no] = c.name.split(' ');
      doc.setFontSize(12);
      doc.text(word, x + 5, y + 17);
      doc.setFontSize(30);
      doc.text(no ?? '', x + 5, y + 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(c.sub, x + 5, y + 37);
    } else {
      doc.setFontSize(13);
      doc.text(doc.splitTextToSize(c.name, 36), x + 5, y + 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      // Wrapped to the text column, clear of the QR (a long locker place ran under it).
      doc.text(doc.splitTextToSize(c.sub, 36).slice(0, 3), x + 5, y + 31);
    }
    doc.setTextColor(91, 107, 126);
    doc.setFontSize(5.5);
    doc.text(c.foot, x + 5, y + CARD_H - 6);
    const m = qrMatrix(c.qr);
    const size = 40;
    const cell = size / (m.length + 4);
    const qx = x + CARD_W - size - 4;
    const qy = y + (CARD_H - size) / 2;
    doc.setFillColor(0, 0, 0);
    m.forEach((row, r) => row.forEach((on, col) => { if (on) doc.rect(qx + (col + 2) * cell, qy + (r + 2) * cell, cell + 0.01, cell + 0.01, 'F'); }));
  });
  return doc.output('blob');
}

async function exportCards(cards: CardSpec[], vessel: VesselInfo | null, title: string): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = `${title}${v ? `-${v}` : ''}.pdf`;
  if (onWeb) return saveFileWeb(pdfBlob(cards, vessel), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(cards, vessel), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

export function exportCrewCards(crew: CrewMember[], vessel: VesselInfo | null) {
  return exportCards(crew.map((c) => ({ name: c.name, sub: [c.rank, c.cabin ? `cabin ${c.cabin}` : null].filter(Boolean).join(' · '), foot: 'CREW CARD · scan at the gangway', qr: crewQrPayload(c.id) })), vessel, 'Crew cards');
}

/** Passenger cards — the same QR scheme as the crew's: the gangway knows a passenger by id (types/passengers.ts). */
export function exportPassengerCards(list: { id: string; name: string; cabin?: string }[], vessel: VesselInfo | null) {
  return exportCards(list.map((p) => ({ name: p.name, sub: p.cabin ? `Guest · cabin ${p.cabin}` : 'Guest', foot: 'PASSENGER CARD · scan at the gangway', qr: crewQrPayload(p.id) })), vessel, 'Passenger cards');
}

/** SOPEP locker labels — name big, where it is, the QR that opens its contents (types/sopep.ts). */
export function exportLockerLabels(list: { id: string; name: string; location?: string }[], vessel: VesselInfo | null) {
  return exportCards(list.map((l) => ({ name: l.name, sub: l.location ?? '', foot: 'SOPEP LOCKER · scan to see what is inside', qr: sopepQrPayload(l.id) })), vessel, 'SOPEP locker labels');
}

/** Reusable numbered visitor passes, 01…count — laminated and kept at the gangway. */
export function exportVisitorPasses(count: number, vessel: VesselInfo | null) {
  const cards = Array.from({ length: count }, (_, i) => {
    const no = String(i + 1).padStart(2, '0');
    return { name: `VISITOR ${no}`, sub: 'Wear while on board', foot: 'Return this pass at the gangway when you leave', qr: passQrPayload(no), big: true };
  });
  return exportCards(cards, vessel, 'Visitor passes');
}

// Label-printer stickers of the same cards: services/gangwayLabels.ts (pure, tested).
export { GANGWAY_STOCKS, crewCardSpecs, visitorPassSpecs } from './gangwayLabels';
