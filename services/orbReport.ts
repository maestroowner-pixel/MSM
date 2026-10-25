// ===================================
// The Oil Record Book Part I page for a month — PDF (A4 portrait, the book's
// columns: date, code, item / record of operations, signature of the officer in
// charge) and Excel. Amended and deleted entries are marked; the Master's
// signature for the month at the foot.
//
// Since 2.68 the PDF is a certified true copy (utils/trueCopyPdf, MEPC.312 §6.3):
// every earlier version printed struck under the entry that replaced it, who
// entered each one with their ID and the time, each entry's verification stage,
// and on every page the print time, the software version and "Page n of N".
// The HTML page below is kept only as a phone's fallback if jsPDF fails there.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { OrbEntry, OrbMasterSign } from '../types/orb';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { deliverTrueCopy } from '../utils/trueCopyPdf';
import { awaiting, copyRows, integrityLines, monthIntegrity, verificationLines, verifiedIds } from './verification';
import type { TrueCopy } from './trueCopy';

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export const ORB_HEAD = ['Date', 'Code', 'Item No. / record of operations', 'Signature of officer in charge'];

export function orbRows(entries: OrbEntry[]): string[][] {
  return entries.map((e) => [
    `${dmy(e.date)}${e.time ? ` ${e.time}` : ''}`,
    e.code,
    [e.cancelled ? `[DELETED — ${e.editReason ?? ''} (${e.editedBy ?? ''})]` : e.supersedes ? `[Amended — ${e.editReason ?? ''} (${e.editedBy ?? ''})]` : '', e.text].filter(Boolean).join(' '),
    e.byRank ? `${e.by} (${e.byRank})` : e.by,
  ]);
}

/** The true copy's columns and rows: each entry, then its earlier versions struck. */
export const ORB_COPY_HEAD = ['Date', 'Code', 'Item No. / record of operations', 'Officer in charge', "Master's verification"];
export const orbCopyRows = (book: OrbEntry[], all: OrbEntry[], signs: OrbMasterSign[]) => copyRows(book, all, signs, (r) => orbRows([r])[0].slice(0, 3), 2);

export function orbMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export const masterLine = (s?: OrbMasterSign) => (s ? `Master: ${s.byRank ? `${s.by} (${s.byRank})` : s.by}, ${dmy(new Date(s.at).toISOString().slice(0, 10))}` : 'Master’s signature:');

function fileName(vessel: VesselInfo | null, month: string, ext: 'pdf' | 'xlsx') {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Oil record book Part I-${month.slice(5, 7)}${month.slice(2, 4)}${v ? `-${v}` : ''}.${ext}`;
}

function html(entries: OrbEntry[], month: string, vessel: VesselInfo | null, sign?: OrbMasterSign): string {
  const rows = orbRows(entries).map((r, i) => `<tr${entries[i].cancelled ? ' class="x"' : ''}>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 8px; } table { border-collapse: collapse; width: 100%; }
    td, th { border: .5px solid #c8d0db; padding: 3px 4px; vertical-align: top; text-align: left; } th { background: #eef2f7; font-size: 8px; } tr.x td { text-decoration: line-through; color: #8a97a8; }
    .sig { margin-top: 24px; width: 45%; margin-left: auto; border-top: .8px solid #0B2545; padding-top: 3px; }
  </style></head><body>
    <h1>Oil Record Book — Part I · ${esc(orbMonthLabel(month))}</h1><div class="sub">${esc(vesselHeader(vessel))} · Machinery space operations (MARPOL Annex I)</div>
    <table><thead><tr>${ORB_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="4">No entries this month.</td></tr>'}</tbody></table>
    <div class="sig">${esc(masterLine(sign))}</div>
  </body></html>`;
}

/** The month's certified true copy and its file name — the PDF, and the Master's signed copy (services/signedCopy). */
export function orbCopy(entries: OrbEntry[], month: string, vessel: VesselInfo | null, signs: OrbMasterSign[], all: OrbEntry[]): { copy: TrueCopy; name: string } {
  const name = fileName(vessel, month, 'pdf');
  const { rows, struck } = orbCopyRows(entries, all, signs);
  const copy = {
    title: `Oil Record Book — Part I · ${orbMonthLabel(month)}`,
    subtitle: `${vesselHeader(vessel)} · Machinery space operations (MARPOL Annex I)`,
    vessel: [vessel?.vessel_name, vessel?.imo ? `IMO ${vessel.imo}` : null].filter(Boolean).join(' · ') || 'Vessel',
    orientation: 'portrait' as const,
    head: ORB_COPY_HEAD,
    rows,
    struck,
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 40 }, 4: { cellWidth: 32 } },
    verifications: verificationLines(signs.filter((s) => s.month === month)),
    integrity: integrityLines(monthIntegrity(entries, all, signs, month)),
    awaiting: awaiting(entries, verifiedIds(all, signs)).length,
  };
  return { copy, name };
}

export async function exportOrbPdf(entries: OrbEntry[], month: string, vessel: VesselInfo | null, signs: OrbMasterSign[], all: OrbEntry[]): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const { copy, name } = orbCopy(entries, month, vessel, signs, all);
  if (onWeb) return deliverTrueCopy(copy, name);
  try {
    return await deliverTrueCopy(copy, name);
  } catch {
    // jsPDF failed on this phone: the plain page, without the true-copy footer.
  }
  const sign = signs[signs.length - 1];
  const { uri } = await Print.printToFileAsync({ html: html(entries, month, vessel, sign), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export async function exportOrbExcel(entries: OrbEntry[], month: string, vessel: VesselInfo | null, signs: OrbMasterSign[], all: OrbEntry[]): Promise<string | null | void> {
  const ws = XLSX.utils.aoa_to_sheet([[`Oil Record Book — Part I · ${orbMonthLabel(month)}`], [vesselHeader(vessel)], [], ORB_COPY_HEAD, ...orbCopyRows(entries, all, signs).rows, [], ...verificationLines(signs.filter((s) => s.month === month)).map((l) => [l])]);
  ws['!cols'] = [{ wch: 16 }, { wch: 6 }, { wch: 90 }, { wch: 34 }, { wch: 34 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Part I');
  const name = fileName(vessel, month, 'xlsx');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: mime }), name, 'reports');
  }
  await deliverFile(name, b64, true, mime);
}
