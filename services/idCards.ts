// ===================================
// Cards for a card printer and tags for a laser (17 Oct 2026: "not a laminated
// embarrassment — a quality, elegant product").
//
//   Crew ID cards   CR80 (85.6 × 54 mm), one card per page, FRONT then BACK for
//                   each person — what a duplex card printer (Evolis, Zebra,
//                   Fargo, Magicard) expects. Front: vessel band, photo, name,
//                   rank, cabin. Back: the gangway QR, the vessel, "if found".
//   Key tags        CR80 "3-up" break-away key tag cards, three tags a card:
//                   QR, ID, what it opens; the right end left clear for the hole.
//   Engraving file  SVG in millimetres for a fibre laser: each tag's outline and
//                   hole in red (to place or cut), QR and text in black, the QR
//                   at the highest error correction (H) for metal.
// The QR is drawn from its modules, as on every other label (services/crewCards).
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { esc, share } from './export';
import { CARD_H, CARD_W, qrMatrix } from './crewCards';
import { crewQrPayload, keyQrPayload } from './crewQr';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const NAVY: [number, number, number] = [11, 37, 69];
const TEAL: [number, number, number] = [26, 158, 143];
const GREY: [number, number, number] = [91, 107, 126];
const hex = (c: [number, number, number]) => `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;

export interface IdCardPerson {
  id: string;
  name: string;
  rank?: string;
  cabin?: string;
  photo?: string; // data: URI
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
const vesselLine = (v: VesselInfo | null) => [v?.imo ? `IMO ${v.imo}` : '', v?.flag ?? '', v?.call_sign ? `Call sign ${v.call_sign}` : ''].filter(Boolean).join(' · ');
const fileStem = (title: string, v: VesselInfo | null) => {
  const n = (v?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `${title}${n ? `-${n}` : ''}`;
};

function qrSvgPath(text: string, ecl: 'Q' | 'H' = 'Q'): { d: string; n: number } {
  const m = qrMatrix(text, ecl);
  let d = '';
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c} ${r}h1v1h-1z`; }));
  return { d, n: m.length };
}

function drawQr(doc: any, text: string, x: number, y: number, size: number, ecl: 'Q' | 'H' = 'Q') {
  const m = qrMatrix(text, ecl);
  const cell = size / (m.length + 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, 'F');
  doc.setFillColor(0, 0, 0);
  m.forEach((row, r) => row.forEach((on, c) => { if (on) doc.rect(x + (c + 1) * cell, y + (r + 1) * cell, cell + 0.01, cell + 0.01, 'F'); }));
}

// ---- crew ID cards ----------------------------------------------------------------

function idCardsPdf(people: IdCardPerson[], v: VesselInfo | null): Blob {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });
  people.forEach((p, i) => {
    if (i) doc.addPage([CARD_W, CARD_H], 'landscape');
    // FRONT — the band with the vessel, the photo, the person.
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, CARD_W, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text((v?.vessel_name ?? '').toUpperCase(), 5, 7.2);
    doc.setTextColor(...TEAL);
    doc.setFontSize(7);
    doc.text('CREW', CARD_W - 5, 7.2, { align: 'right' });
    if (p.photo) {
      try {
        doc.addImage(p.photo, 'JPEG', 5, 15, 22, 28, undefined, 'FAST');
      } catch {
        /* a photo the PDF cannot read — the initials below stand */
      }
    } else {
      doc.setFillColor(230, 236, 242);
      doc.rect(5, 15, 22, 28, 'F');
      doc.setTextColor(...GREY);
      doc.setFontSize(16);
      doc.text(initials(p.name), 16, 31.5, { align: 'center' });
    }
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.4);
    doc.rect(5, 15, 22, 28);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    const name = doc.splitTextToSize(p.name, 50).slice(0, 2);
    doc.text(name, 31, 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const y = 21 + name.length * 5.2;
    if (p.rank) doc.text(doc.splitTextToSize(p.rank, 50).slice(0, 2), 31, y);
    if (p.cabin) {
      doc.setTextColor(...GREY);
      doc.setFontSize(7.5);
      doc.text(`Cabin ${p.cabin}`, 31, 41);
    }
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.6);
    doc.line(5, 47, CARD_W - 5, 47);
    doc.setTextColor(...GREY);
    doc.setFontSize(6);
    doc.text(vesselLine(v), 5, 51);

    // BACK — the gangway QR and what to do with a card found.
    doc.addPage([CARD_W, CARD_H], 'landscape');
    drawQr(doc, crewQrPayload(p.id), 5, 7, 38);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Scan at the gangway', 47, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(doc.splitTextToSize('going ashore and coming back aboard', 34), 47, 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(v?.vessel_name ?? '', 34), 47, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text(doc.splitTextToSize(vesselLine(v), 34), 47, 32);
    doc.text(doc.splitTextToSize('If found, please return to the vessel.', 34), 47, 41);
    doc.setFillColor(...NAVY);
    doc.rect(0, 49, CARD_W, 5, 'F');
  });
  return doc.output('blob');
}

function idCardsHtml(people: IdCardPerson[], v: VesselInfo | null): string {
  const q = (text: string, mm: number) => {
    const { d, n } = qrSvgPath(text);
    return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}"/></svg>`;
  };
  const pages = people
    .map(
      (p) => `<section class="f"><div class="band"><b>${esc((v?.vessel_name ?? '').toUpperCase())}</b><i>CREW</i></div>
        <div class="ph">${p.photo ? `<img src="${p.photo}">` : `<span>${esc(initials(p.name))}</span>`}</div>
        <div class="who"><div class="nm">${esc(p.name)}</div><div class="rk">${esc(p.rank ?? '')}</div>${p.cabin ? `<div class="cb">Cabin ${esc(p.cabin)}</div>` : ''}</div>
        <div class="foot">${esc(vesselLine(v))}</div></section>
      <section class="b"><div class="qr">${q(crewQrPayload(p.id), 38)}</div><div class="bt"><b>Scan at the gangway</b><div>going ashore and coming back aboard</div><b class="vs">${esc(v?.vessel_name ?? '')}</b><div class="g">${esc(vesselLine(v))}</div><div class="g">If found, please return to the vessel.</div></div><div class="bb"></div></section>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${CARD_W}mm ${CARD_H}mm; margin: 0; } body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${hex(NAVY)}; }
    section { width: ${CARD_W}mm; height: ${CARD_H}mm; position: relative; overflow: hidden; page-break-after: always; }
    .band { position: absolute; left: 0; top: 0; right: 0; height: 11mm; background: ${hex(NAVY)}; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 5mm; font-size: 9.5pt; }
    .band i { font-style: normal; color: ${hex(TEAL)}; font-size: 7pt; font-weight: 700; }
    .ph { position: absolute; left: 5mm; top: 15mm; width: 22mm; height: 28mm; border: 0.4mm solid ${hex(TEAL)}; background: #e6ecf2; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .ph img { width: 100%; height: 100%; object-fit: cover; } .ph span { font-size: 16pt; color: ${hex(GREY)}; }
    .who { position: absolute; left: 31mm; top: 16mm; right: 5mm; } .nm { font-size: 12.5pt; font-weight: 800; line-height: 1.15; } .rk { font-size: 9.5pt; margin-top: 1.5mm; } .cb { font-size: 7.5pt; color: ${hex(GREY)}; margin-top: 2mm; }
    .foot { position: absolute; left: 5mm; right: 5mm; bottom: 2.5mm; border-top: 0.6mm solid ${hex(TEAL)}; padding-top: 1.2mm; font-size: 6pt; color: ${hex(GREY)}; }
    .qr { position: absolute; left: 5mm; top: 7mm; } .bt { position: absolute; left: 47mm; top: 9mm; right: 4mm; font-size: 7pt; } .bt b { font-size: 8.5pt; display: block; } .bt .vs { margin-top: 5mm; font-size: 8pt; } .g { color: ${hex(GREY)}; font-size: 6.3pt; margin-top: 1.5mm; }
    .bb { position: absolute; left: 0; right: 0; bottom: 0; height: 5mm; background: ${hex(NAVY)}; }
  </style></head><body>${pages}</body></html>`;
}

async function deliver(blob: () => Blob, html: () => string, name: string, size: { width: number; height: number }) {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  if (onWeb) return saveFileWeb(blob(), name);
  const { uri } = await Print.printToFileAsync({ html: html(), ...size });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

const PT = 72 / 25.4;
/** Crew ID cards for a card printer: CR80, front then back per person (print double-sided). */
export function exportIdCards(people: IdCardPerson[], v: VesselInfo | null) {
  return deliver(() => idCardsPdf(people, v), () => idCardsHtml(people, v), `${fileStem('Crew ID cards CR80', v)}.pdf`, { width: CARD_W * PT, height: CARD_H * PT });
}

// ---- key tags -------------------------------------------------------------------------

export interface TagKey {
  id: string;
  code: string;
  name: string;
}

/** The right end of each tag is left clear for the punched hole. */
const HOLE_CLEAR = 14;

function keyTagsPdf(keys: TagKey[], v: VesselInfo | null): Blob {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });
  const h = CARD_H / 3;
  keys.forEach((k, i) => {
    if (i && i % 3 === 0) doc.addPage([CARD_W, CARD_H], 'landscape');
    const y = (i % 3) * h;
    drawQr(doc, keyQrPayload(k.id), 2.5, y + 1.5, h - 3);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(k.code, h + 1, y + 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(doc.splitTextToSize(k.name, CARD_W - h - 1 - HOLE_CLEAR).slice(0, 2), h + 1, y + 11.5);
    doc.setTextColor(...GREY);
    doc.setFontSize(5);
    doc.text((v?.vessel_name ?? '').toUpperCase(), h + 1, y + h - 1.6);
  });
  return doc.output('blob');
}

function keyTagsHtml(keys: TagKey[], v: VesselInfo | null): string {
  const h = CARD_H / 3;
  const cards: string[] = [];
  for (let i = 0; i < keys.length; i += 3) {
    cards.push(
      `<section>${keys
        .slice(i, i + 3)
        .map((k) => {
          const { d, n } = qrSvgPath(keyQrPayload(k.id));
          return `<div class="t"><svg viewBox="-1 -1 ${n + 2} ${n + 2}" width="${h - 3}mm" height="${h - 3}mm" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}"/></svg><div><b>${esc(k.code)}</b><div class="n">${esc(k.name)}</div><div class="v">${esc((v?.vessel_name ?? '').toUpperCase())}</div></div></div>`;
        })
        .join('')}</section>`
    );
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${CARD_W}mm ${CARD_H}mm; margin: 0; } body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${hex(NAVY)}; }
    section { width: ${CARD_W}mm; height: ${CARD_H}mm; page-break-after: always; overflow: hidden; }
    .t { height: ${h}mm; display: flex; align-items: center; gap: 1.5mm; padding: 0 ${HOLE_CLEAR}mm 0 2.5mm; box-sizing: border-box; }
    b { font-size: 12pt; } .n { font-size: 7pt; } .v { font-size: 5pt; color: ${hex(GREY)}; margin-top: 0.6mm; }
  </style></head><body>${cards.join('')}</body></html>`;
}

/** Key tags for a card printer: CR80 3-up break-away key tag cards. */
export function exportKeyTagCards(keys: TagKey[], v: VesselInfo | null) {
  return deliver(() => keyTagsPdf(keys, v), () => keyTagsHtml(keys, v), `${fileStem('Key tags 3-up CR80', v)}.pdf`, { width: CARD_W * PT, height: CARD_H * PT });
}

/** Tag size for engraving — a common metal key tag. */
export const ENGRAVE_W = 50;
export const ENGRAVE_H = 22;

/**
 * The engraving file: millimetre SVG, tags in a grid of four. Red hairlines are
 * the tag's outline and its hole (to line the blanks up, or to cut); black is
 * engraved — the QR (error correction H: still reads when the metal is scuffed)
 * and the ID and name.
 */
/** Words into lines of at most `max` characters, at most `lines` lines (the last cut short). */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`;
    else out.push(w.slice(0, max));
  }
  return out.slice(0, lines);
}

export function engravingSvg(keys: TagKey[], v: VesselInfo | null): string {
  const gap = 5;
  const cols = 4;
  const rows = Math.max(1, Math.ceil(keys.length / cols));
  const W = cols * ENGRAVE_W + (cols + 1) * gap;
  const H = rows * ENGRAVE_H + (rows + 1) * gap;
  const q = 18;
  const tags = keys
    .map((k, i) => {
      const x = gap + (i % cols) * (ENGRAVE_W + gap);
      const y = gap + Math.floor(i / cols) * (ENGRAVE_H + gap);
      const { d, n } = qrSvgPath(keyQrPayload(k.id), 'H');
      const s = q / n;
      return `<g transform="translate(${x} ${y})">
  <rect x="0" y="0" width="${ENGRAVE_W}" height="${ENGRAVE_H}" rx="3" fill="none" stroke="#ff0000" stroke-width="0.1"/>
  <circle cx="${ENGRAVE_W - 4}" cy="${ENGRAVE_H / 2}" r="2.3" fill="none" stroke="#ff0000" stroke-width="0.1"/>
  <path transform="translate(2 2) scale(${s.toFixed(5)})" d="${d}" fill="#000"/>
  <text x="22" y="9" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="6" fill="#000">${esc(k.code)}</text>
  ${wrap(k.name, 15, 2).map((ln, j) => `<text x="22" y="${13 + j * 3}" font-family="Helvetica, Arial, sans-serif" font-size="2.5" fill="#000">${esc(ln)}</text>`).join('')}
  <text x="22" y="20" font-family="Helvetica, Arial, sans-serif" font-size="2" fill="#000">${esc((v?.vessel_name ?? '').toUpperCase().slice(0, 18))}</text>
</g>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
<!-- ISMpilot key tags for laser engraving: red = outline and hole (not engraved), black = engrave. ${ENGRAVE_W} x ${ENGRAVE_H} mm tags. -->
${tags}
</svg>`;
}

export async function exportEngravingSvg(keys: TagKey[], v: VesselInfo | null) {
  const name = `${fileStem('Key tags engraving', v)}.svg`;
  const svg = engravingSvg(keys, v);
  if (onWeb) return saveFileWeb(new Blob([svg], { type: 'image/svg+xml' }), name);
  const dest = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(dest, svg);
  await share(dest, 'image/svg+xml', name);
}
