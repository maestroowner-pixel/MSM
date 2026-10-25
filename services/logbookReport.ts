// ===================================
// A month of a record book on the shared screen (Sewage, Ballast water) —
// PDF (A4 portrait: date, code, record of operations, officer's signature) and
// Excel. Amended and deleted entries are marked; the Master's signature at the
// foot. The same page as the Oil Record Book (services/orbReport) — since 2.68
// a certified true copy (utils/trueCopyPdf, MEPC.312 §6.3).
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { BookSpec } from './logbooks';
import { LogEntry, LogMonthSign } from '../types/logbook';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { deliverTrueCopy } from '../utils/trueCopyPdf';
import { awaiting, copyRows, integrityLines, monthIntegrity, verificationLines, verifiedIds } from './verification';
import type { TrueCopy } from './trueCopy';
import { masterLine, orbMonthLabel as monthLabel } from './orbReport';

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export const LOG_HEAD = ['Date', 'Code', 'Record of operations', 'Signature of officer in charge'];

export function logRows(entries: LogEntry[]): string[][] {
  return entries.map((e) => [
    `${dmy(e.date)}${e.time ? ` ${e.time}` : ''}`,
    e.code,
    [e.cancelled ? `[DELETED — ${e.editReason ?? ''} (${e.editedBy ?? ''})]` : e.supersedes ? `[Amended — ${e.editReason ?? ''} (${e.editedBy ?? ''})]` : '', e.text].filter(Boolean).join(' '),
    e.byRank ? `${e.by} (${e.byRank})` : e.by,
  ]);
}
export { masterLine, monthLabel };

export const LOG_COPY_HEAD = ['Date', 'Code', 'Record of operations', 'Officer in charge', "Master's verification"];
export const logCopyRows = (book: LogEntry[], all: LogEntry[], signs: LogMonthSign[]) => copyRows(book, all, signs, (r) => logRows([r])[0].slice(0, 3), 2);

const titleOf = (spec: BookSpec, month: string) => `${spec.subtitle.split(' · ')[0]} · ${monthLabel(month)}`;
function fileName(spec: BookSpec, vessel: VesselInfo | null, month: string, ext: 'pdf' | 'xlsx') {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `${spec.title} record-${month.slice(5, 7)}${month.slice(2, 4)}${v ? `-${v}` : ''}.${ext}`;
}

function html(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, sign?: LogMonthSign): string {
  const rows = logRows(entries).map((r, i) => `<tr${entries[i].cancelled ? ' class="x"' : ''}>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 8px; } table { border-collapse: collapse; width: 100%; }
    td, th { border: .5px solid #c8d0db; padding: 3px 4px; vertical-align: top; text-align: left; } th { background: #eef2f7; font-size: 8px; } tr.x td { text-decoration: line-through; color: #8a97a8; }
    .sig { margin-top: 24px; width: 45%; margin-left: auto; border-top: .8px solid #0B2545; padding-top: 3px; }
  </style></head><body>
    <h1>${esc(titleOf(spec, month))}</h1><div class="sub">${esc(vesselHeader(vessel))} · ${esc(spec.subtitle)}</div>
    <table><thead><tr>${LOG_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="4">No entries this month.</td></tr>'}</tbody></table>
    <div class="sig">${esc(masterLine(sign))}</div>
  </body></html>`;
}

/** The month's certified true copy and its file name — the PDF, and the Master's signed copy (services/signedCopy). */
export function logCopy(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, signs: LogMonthSign[], all: LogEntry[]): { copy: TrueCopy; name: string } {
  const name = fileName(spec, vessel, month, 'pdf');
  const { rows, struck } = logCopyRows(entries, all, signs);
  const copy = {
    title: titleOf(spec, month),
    subtitle: `${vesselHeader(vessel)} · ${spec.subtitle}`,
    vessel: [vessel?.vessel_name, vessel?.imo ? `IMO ${vessel.imo}` : null].filter(Boolean).join(' · ') || 'Vessel',
    orientation: 'portrait' as const,
    head: LOG_COPY_HEAD,
    rows,
    struck,
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 11, halign: 'center' }, 3: { cellWidth: 40 }, 4: { cellWidth: 32 } },
    verifications: verificationLines(signs.filter((s) => s.month === month)),
    integrity: integrityLines(monthIntegrity(entries, all, signs, month)),
    awaiting: awaiting(entries, verifiedIds(all, signs)).length,
  };
  return { copy, name };
}

export async function exportLogPdf(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, signs: LogMonthSign[], all: LogEntry[]): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const { copy, name } = logCopy(spec, entries, month, vessel, signs, all);
  if (onWeb) return deliverTrueCopy(copy, name);
  try {
    return await deliverTrueCopy(copy, name);
  } catch {
    // jsPDF failed on this phone: the plain page, without the true-copy footer.
  }
  const { uri } = await Print.printToFileAsync({ html: html(spec, entries, month, vessel, signs[signs.length - 1]), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export async function exportLogExcel(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, signs: LogMonthSign[], all: LogEntry[]): Promise<string | null | void> {
  const ws = XLSX.utils.aoa_to_sheet([[titleOf(spec, month)], [vesselHeader(vessel)], [], LOG_COPY_HEAD, ...logCopyRows(entries, all, signs).rows, [], ...verificationLines(signs.filter((s) => s.month === month)).map((l) => [l])]);
  ws['!cols'] = [{ wch: 16 }, { wch: 7 }, { wch: 90 }, { wch: 34 }, { wch: 34 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.title);
  const name = fileName(spec, vessel, month, 'xlsx');
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
