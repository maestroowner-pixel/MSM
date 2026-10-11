// ===================================
// The planned-maintenance report for a month — for the superintendent and the
// audit (11 Oct 2026, after the usual class-aligned PMS):
//
//   completion   jobs done in the month ÷ (done + still overdue), all and critical
//   done         every completion of the month, signed
//   deferred     the deferrals made in the month, with reason and Master
//   overdue      jobs overdue now (critical first)
//
// PDF (A4 landscape) and Excel. The browser draws the PDF with jsPDF
// (utils/pmsPdf.web.ts); phones print the HTML.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { PMS_HEAD, PmsMonth, completionLine, monthLabelPms } from './pmsKpi';
export { pmsMonth, PMS_HEAD, completionLine, monthLabelPms } from './pmsKpi';
export type { PmsMonth } from './pmsKpi';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { pmsPdfBlob } from '../utils/pmsPdf';

function pmsFileName(vessel: VesselInfo | null, month: string, ext: 'pdf' | 'xlsx') {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `PMS report-${month.slice(5, 7)}${month.slice(2, 4)}${v ? `-${v}` : ''}.${ext}`;
}

function html(r: PmsMonth, vessel: VesselInfo | null): string {
  const t = (head: string[], rows: string[][], empty: string) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}">${esc(empty)}</td></tr>`}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; } body { margin: 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 8.5px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; margin: 12px 0 4px; } .sub { color: #5b6b7e; margin: 2px 0 6px; }
    .kpi { font-size: 11px; font-weight: 700; margin: 6px 0; } table { border-collapse: collapse; width: 100%; } td, th { border: .5px solid #c8d0db; padding: 3px 4px; text-align: left; vertical-align: top; } th { background: #eef2f7; font-size: 8px; }
  </style></head><body>
    <h1>Planned maintenance — ${esc(monthLabelPms(r.month))}</h1><div class="sub">${esc(vesselHeader(vessel))} · ⚑ critical equipment</div>
    <div class="kpi">${esc(completionLine(r))}</div>
    <h2>Done this month (${r.done.length})</h2>${t(PMS_HEAD.done, r.done, 'Nothing recorded.')}
    <h2>Deferred this month (${r.deferred.length})</h2>${t(PMS_HEAD.deferred, r.deferred, 'No deferrals.')}
    <h2>Overdue now (${r.overdue.length})</h2>${t(PMS_HEAD.overdue, r.overdue, 'Nothing overdue.')}
  </body></html>`;
}

export async function exportPmsPdf(r: PmsMonth, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const fileName = pmsFileName(vessel, r.month, 'pdf');
  if (onWeb) return saveFileWeb(pmsPdfBlob(r, vesselHeader(vessel)), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(r, vessel), width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

export async function exportPmsExcel(r: PmsMonth, vessel: VesselInfo | null): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const top = [[`Planned maintenance — ${monthLabelPms(r.month)}`], [vesselHeader(vessel)], [completionLine(r)], []];
  const add = (name: string, head: string[], rows: string[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([...top, head, ...rows]);
    ws['!cols'] = head.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Done', PMS_HEAD.done, r.done);
  add('Deferred', PMS_HEAD.deferred, r.deferred);
  add('Overdue', PMS_HEAD.overdue, r.overdue);
  const fileName = pmsFileName(vessel, r.month, 'xlsx');
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
