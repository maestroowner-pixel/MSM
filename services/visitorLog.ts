// ===================================
// The Visitor Logbook as a book: rows in the paper book's column order, the
// page for a day or a month as PDF (with the visitors' signatures drawn in)
// and as Excel.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { CrewMove, Visitor } from '../types/security';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { visitorPdfBlob } from '../utils/visitorPdf';
import { SIG_H, SIG_W } from '../components/SignaturePad';

export const vDmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** The visits of a day ("yyyy-mm-dd") or a month ("yyyy-mm"), oldest first. */
export function visitsOf(all: Visitor[], period: string): Visitor[] {
  return all.filter((v) => v.date.startsWith(period)).sort((a, b) => `${a.date}${a.timeIn}`.localeCompare(`${b.date}${b.timeIn}`));
}

export const VLOG_HEAD = ['No.', 'Date', 'Name', 'Company', 'Purpose of visit', 'ID document', 'Pass', 'Host', 'In', 'Out', 'Signature', 'Watch', 'Remarks'];
export const SIG_COL = 10;

export function vlogRows(visits: Visitor[]): string[][] {
  return visits.map((v, i) => [
    String(i + 1),
    vDmy(v.date),
    v.name,
    v.company ?? '',
    v.purpose,
    v.idNo ? `${v.idType ?? ''} ${v.idNo}`.trim() : '',
    v.passNo ?? '',
    v.host ?? '',
    v.timeIn,
    v.timeOut ? `${v.dateOut ? `${vDmy(v.dateOut).slice(0, 5)} ` : ''}${v.timeOut}` : 'on board',
    '',
    v.outBy && v.outBy !== v.inBy ? `${v.inBy} / ${v.outBy}` : v.inBy,
    v.remarks ?? '',
  ]);
}

export const MOVES_HEAD = ['Date', 'Time', 'Crew member', 'Went', 'Recorded by', 'How'];
export function movesOf(all: CrewMove[], period: string): CrewMove[] {
  return all.filter((m) => m.date.startsWith(period)).sort((a, b) => a.at - b.at);
}
export function moveRows(moves: CrewMove[]): string[][] {
  return moves.map((m) => [vDmy(m.date), m.time, m.name, m.dir === 'ashore' ? 'ashore' : 'back aboard', m.by, m.via === 'qr' ? 'crew card QR' : 'by the watch']);
}

export function vlogTitle(period: string) {
  if (period.length === 7) {
    const [y, m] = period.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return vDmy(period);
}

export function vlogFileName(vessel: VesselInfo | null, period: string, ext: 'pdf' | 'xlsx') {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const p = period.length === 7 ? `${period.slice(5, 7)}${period.slice(2, 4)}` : `${period.slice(8, 10)}${period.slice(5, 7)}${period.slice(2, 4)}`;
  return `Visitor logbook-${p}${v ? `-${v}` : ''}.${ext}`;
}

function html(visits: Visitor[], moves: CrewMove[], period: string, vessel: VesselInfo | null): string {
  const mrows = moveRows(moves).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const rows = vlogRows(visits)
    .map((r, i) => `<tr>${r.map((c, j) => (j === SIG_COL ? `<td class="sig">${visits[i].signature ? `<svg viewBox="0 0 ${SIG_W} ${SIG_H}" width="66" height="22"><path d="${esc(visits[i].signature)}" stroke="#0B2545" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` : ''}</td>` : `<td>${esc(c)}</td>`)).join('')}</tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; } body { margin: 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 8.5px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 8px; } table { border-collapse: collapse; width: 100%; }
    td, th { border: 0.5px solid #c8d0db; padding: 3px 4px; vertical-align: middle; } th { background: #eef2f7; font-size: 8px; text-align: left; } td.sig { padding: 1px; }
  </style></head><body>
    <h1>Visitor Logbook · ${esc(vlogTitle(period))}</h1>
    <div class="sub">${esc(vesselHeader(vessel))} · ISPS Code — access control</div>
    <table><thead><tr>${VLOG_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${VLOG_HEAD.length}">No visitors.</td></tr>`}</tbody></table>
    ${mrows ? `<h2 style="font-size:12px;margin:14px 0 6px">Crew ashore / back aboard</h2><table><thead><tr>${MOVES_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${mrows}</tbody></table>` : ''}
  </body></html>`;
}

export async function exportVisitorPdf(all: Visitor[], allMoves: CrewMove[], period: string, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const visits = visitsOf(all, period);
  const moves = movesOf(allMoves, period);
  const fileName = vlogFileName(vessel, period, 'pdf');
  if (onWeb) return saveFileWeb(visitorPdfBlob(visits, moves, period, vessel), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(visits, moves, period, vessel), width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

export async function exportVisitorExcel(all: Visitor[], allMoves: CrewMove[], period: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const visits = visitsOf(all, period);
  const head = VLOG_HEAD.map((h, i) => (i === SIG_COL ? 'Signed' : h));
  const rows = vlogRows(visits).map((r, i) => r.map((c, j) => (j === SIG_COL ? (visits[i].signature ? 'yes' : '') : c)));
  const ws = XLSX.utils.aoa_to_sheet([[`Visitor Logbook · ${vlogTitle(period)}`], [vesselHeader(vessel)], [], head, ...rows]);
  ws['!cols'] = head.map((h) => ({ wch: h === 'No.' ? 5 : h === 'In' || h === 'Out' ? 9 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
  const ms = XLSX.utils.aoa_to_sheet([MOVES_HEAD, ...moveRows(movesOf(allMoves, period))]);
  ms['!cols'] = MOVES_HEAD.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ms, 'Crew ashore');
  const fileName = vlogFileName(vessel, period, 'xlsx');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: mime }), fileName, 'reports');
  }
  await deliverFile(fileName, b64, true, mime);
}
