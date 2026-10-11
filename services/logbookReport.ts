// ===================================
// A month of a record book on the shared screen (Sewage, Ballast water) —
// PDF (A4 portrait: date, code, record of operations, officer's signature) and
// Excel. Amended and deleted entries are marked; the Master's signature at the
// foot. The same page as the Oil Record Book (services/orbReport).
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
import { logbookPdfBlob } from '../utils/logbookPdf';
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

export async function exportLogPdf(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, sign?: LogMonthSign): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const name = fileName(spec, vessel, month, 'pdf');
  if (onWeb) return saveFileWeb(logbookPdfBlob(titleOf(spec, month), `${vesselHeader(vessel)} · ${spec.subtitle}`, entries, sign), name, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(spec, entries, month, vessel, sign), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export async function exportLogExcel(spec: BookSpec, entries: LogEntry[], month: string, vessel: VesselInfo | null, sign?: LogMonthSign): Promise<string | null | void> {
  const ws = XLSX.utils.aoa_to_sheet([[titleOf(spec, month)], [vesselHeader(vessel)], [], LOG_HEAD, ...logRows(entries), [], [masterLine(sign)]]);
  ws['!cols'] = [{ wch: 16 }, { wch: 7 }, { wch: 90 }, { wch: 26 }];
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
