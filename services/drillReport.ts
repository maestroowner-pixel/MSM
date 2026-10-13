// ===================================
// Drill reports (13 Oct 2026) — A4 portrait.
//
//   Drill report      the facts (drill, topic, when, where, attendance), what it
//                     covers, the scenario minute by minute (planned clock and
//                     the time it actually happened), who was there with a
//                     column to sign by hand, the debrief, the signature; the
//                     theory briefing as an annex. Printable as a PLAN before
//                     the drill — the same sheet, marked so.
//   Attendance list   the list alone, to pass round and sign on paper.
//   Register          every drill carried out and the schedule — PDF / Excel.
//
// The rows are built once here; the browser draws them with jsPDF
// (utils/drillPdf.web.ts), phones print the HTML below.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import type { DrillDoc } from './drills';
import { REGISTER_HEAD, SCHEDULE_HEAD, ScheduleRow, drillDoc, registerRows, scheduleRows } from './drills';
import { Drill, drillTitle } from '../types/drills';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { drillPdfBlob } from '../utils/drillPdf';

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

export function drillFileName(d: Drill, vessel: VesselInfo | null, listOnly = false) {
  const v = clean(vessel?.vessel_name ?? '');
  return clean(`${d.no || 'Drill plan'} ${listOnly ? 'Attendance' : drillTitle(d)} ${d.date}${v ? `-${v}` : ''}`) + '.pdf';
}

const kv = (rows: [string, string][]) => `<table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
const table = (head: string[], rows: string[][], cls = '') => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td class="${c.startsWith('ABSENT') ? 'bad' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

function html(d: DrillDoc): string {
  const sig = d.signature
    ? `<table><thead><tr><th>Conducted by</th><th>Signed</th><th>How</th><th>Signature</th></tr></thead><tbody><tr><td>${esc(d.signature.who)}</td><td>${esc(d.signature.when)}</td><td>${esc(d.signature.how)}</td><td class="sig">${d.signature.drawing ? `<svg viewBox="0 0 300 100" width="72" height="24"><path d="${esc(d.signature.drawing)}" stroke="#0B2545" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` : ''}</td></tr></tbody></table>`
    : '<table><tr><td class="k">Conducted by</td><td class="sig"></td><td class="k">Signature</td><td class="sig"></td></tr></table>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } h2 { font-size: 11px; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: .5px; }
    .sub { color: #5b6b7e; margin: 2px 0 6px; } table { border-collapse: collapse; width: 100%; } td, th { border: .5px solid #c8d0db; padding: 3px 4px; vertical-align: top; text-align: left; }
    th { background: #eef2f7; font-size: 8px; } td.k { width: 28%; color: #5b6b7e; } td.sig { min-width: 90px; height: 24px; } td.bad { color: #e74c3c; font-weight: bold; }
    table.att td { height: 20px; vertical-align: middle; } ul { margin: 0; padding-left: 16px; } li { margin: 1px 0; }
    .annex { page-break-before: always; } .annex p { font-size: 9.5px; line-height: 1.45; margin: 0 0 6px; }
  </style></head><body>
    <h1>${esc(d.title)}</h1><div class="sub">${esc(d.vesselLine)} · ${esc(d.status)}</div>
    ${kv(d.facts)}
    ${!d.listOnly && d.content.length ? `<h2>Content of the drill</h2><ul>${d.content.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${!d.listOnly && d.scenario.length ? `<h2>Scenario</h2>${table(['T+min', 'Clock', 'Action', 'Who', 'Actual'], d.scenario)}` : ''}
    <h2>Attendance</h2><table class="att"><thead><tr>${['#', 'Name', 'Rank', 'Attendance', 'Signature'].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.attendance.map((r, i) => `<tr>${r.map((c, k) => `<td class="${c.startsWith('ABSENT') ? 'bad' : ''}">${esc(c)}${k === 4 && d.attSigs[i] ? ` <svg viewBox="0 0 300 100" width="66" height="22"><path d="${esc(d.attSigs[i])}" stroke="#0B2545" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${!d.listOnly && d.debrief ? `<h2>Debrief — lessons and actions</h2><div>${esc(d.debrief).replace(/\n/g, '<br>')}</div>` : ''}
    <h2>Signature</h2>${sig}
    ${d.theory ? `<div class="annex"><h2>Annex — theory briefing</h2><h1>${esc(d.theory.title)}</h1>${d.theory.text.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
  </body></html>`;
}

export async function exportDrillPdf(drill: Drill, vessel: VesselInfo | null, listOnly = false): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const doc: DrillDoc = drillDoc(drill, vesselHeader(vessel), listOnly);
  const fileName = drillFileName(drill, vessel, listOnly);
  if (onWeb) return saveFileWeb(drillPdfBlob(doc), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(doc), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

// ---- the register ----

function sheets(drills: Drill[], schedule: ScheduleRow[]) {
  const done = drills.filter((d) => d.doneAt);
  const overdue = schedule.filter((r) => (r.left ?? -1) < 0).length;
  return {
    facts: [`${done.length} ${done.length === 1 ? 'drill' : 'drills'} carried out`, overdue ? `${overdue} due or overdue` : 'Nothing overdue'],
    schedule: { title: 'Schedule', head: SCHEDULE_HEAD, rows: scheduleRows(schedule), widths: { 0: 44, 1: 30, 2: 20, 3: 20, 4: 26, 5: 28 } },
    register: { title: 'Drills carried out', head: REGISTER_HEAD, rows: registerRows(drills), widths: { 0: 20, 1: 18, 2: 18, 3: 30, 4: 36, 5: 26, 6: 12, 7: 30, 8: 28, 9: 58 } },
  };
}

export async function exportDrillRegisterPdf(drills: Drill[], schedule: ScheduleRow[], today: string, vessel: VesselInfo | null) {
  const s = sheets(drills, schedule);
  return exportPmsHistory('Drill register', `Drill register ${today}`, vessel, [{ title: 'Drill register', facts: s.facts, tables: [s.schedule, s.register] }]);
}

export async function exportDrillRegisterExcel(drills: Drill[], schedule: ScheduleRow[], today: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const s = sheets(drills, schedule);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Drill register'], [vesselHeader(vessel)], s.facts, [], s.register.head, ...s.register.rows]), 'Drills');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.schedule.head, ...s.schedule.rows]), 'Schedule');
  const attendance: string[][] = [['No.', 'Date', 'Drill', 'Name', 'Rank', 'Attendance']];
  for (const d of drills.filter((x) => x.doneAt)) for (const a of d.attendance) attendance.push([d.no, d.date, drillTitle(d), a.name, a.rank ?? '', a.present ? 'present' : `absent${a.reason ? ` — ${a.reason}` : ''}`]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attendance), 'Attendance');
  const v = clean(vessel?.vessel_name ?? '');
  const name = `Drill register ${today}${v ? `-${v}` : ''}.xlsx`;
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
