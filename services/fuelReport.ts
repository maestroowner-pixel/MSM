// ===================================
// The monthly fuel report — PDF and Excel. Opening ROB, received, consumed,
// closing ROB; the day-by-day soundings and consumption; the bunkerings written
// as Oil Record Book (Part I, code H) entries; transfers; a signature line.
// Web: drawn with jsPDF and saved into the remembered folder (utils/webSave);
// phones: HTML through expo-print and the share sheet.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { FuelMonth, orbBunkerLine, transferText } from './fuel';
import { FuelTank } from '../types/fuel';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { fuelPdfBlob } from '../utils/fuelPdf';
export { dmy, monthLabel, n, rows };

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const n = (x?: number) => (x == null ? '' : x.toLocaleString('en-GB', { maximumFractionDigits: 1 }));

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function fuelReportName(vessel: VesselInfo | null, month: string, ext: 'pdf' | 'xlsx'): string {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Fuel report-${month.slice(5, 7)}${month.slice(2, 4)}${v ? `-${v}` : ''}.${ext}`;
}

function rows(m: FuelMonth) {
  return m.days
    .filter((d) => d.rob != null || d.received)
    .map((d) => [dmy(d.date), n(d.rob), d.received ? n(d.received) : '', d.consumed == null ? '' : `${n(d.consumed)}${d.span && d.span > 1 ? ` (${d.span} d)` : ''}${d.suspect ? ' ⚠ check' : ''}`]);
}

function html(m: FuelMonth, tanks: FuelTank[], vessel: VesselInfo | null): string {
  const days = rows(m).map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('');
  const orb = m.bunkers.map((b) => `<div class="orb"><b>${dmy(b.date)}</b><pre>${esc(orbBunkerLine(b, tanks))}</pre></div>`).join('') || '<p>No bunkering this month.</p>';
  const tr = m.transfers.map((t) => `<li>${dmy(t.date)} — ${esc(transferText(t, tanks))} (${esc(t.by)})</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 10px; color: #0B2545; }
    h1 { font-size: 16px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 10px; }
    .sum { display: flex; gap: 8px; margin-bottom: 10px; } .sum div { flex: 1; border: 0.5px solid #c8d0db; border-radius: 6px; padding: 6px; }
    .sum b { display: block; font-size: 14px; } table { border-collapse: collapse; width: 100%; } td, th { border: 0.5px solid #c8d0db; padding: 3px 5px; }
    th { background: #eef2f7; text-align: left; } .r { text-align: right; } h2 { font-size: 12px; margin: 14px 0 4px; }
    pre { margin: 2px 0 0; font-family: inherit; white-space: pre-wrap; } .orb { margin-bottom: 6px; }
    .sig { margin-top: 30px; display: flex; gap: 40px; } .sig div { flex: 1; border-top: 0.8px solid #0B2545; padding-top: 3px; }
  </style></head><body>
    <h1>Fuel report — ${esc(monthLabel(m.month))}</h1><div class="sub">${esc(vesselHeader(vessel))} · Diesel (MGO), litres</div>
    <div class="sum"><div>Opening ROB<b>${n(m.opening)}</b></div><div>Received<b>${n(m.received)}</b></div><div>Consumed<b>${n(m.consumed)}</b></div><div>Closing ROB<b>${n(m.closing)}</b></div></div>
    <table><thead><tr><th>Date</th><th class="r">ROB, L</th><th class="r">Received, L</th><th class="r">Consumed, L</th></tr></thead><tbody>${days}</tbody></table>
    <h2>Bunkering — Oil Record Book Part I entries (code H)</h2>${orb}
    ${tr ? `<h2>Transfers</h2><ul>${tr}</ul>` : ''}
    <div class="sig"><div>Chief Engineer — name, signature, date</div><div>Master — name, signature, date</div></div>
  </body></html>`;
}

/** PDF of the month. Web: saved into the remembered folder (returns its name). */
export async function exportFuelPdf(m: FuelMonth, tanks: FuelTank[], vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const fileName = fuelReportName(vessel, m.month, 'pdf');
  if (onWeb) return saveFileWeb(fuelPdfBlob(m, tanks, vessel), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(m, tanks, vessel), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

/** Excel of the month: a Summary sheet, Daily, Bunkering and Transfers. */
export async function exportFuelExcel(m: FuelMonth, tanks: FuelTank[], vessel: VesselInfo | null): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const sheet = (name: string, aoa: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = (aoa[0] ?? []).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  sheet('Summary', [['Fuel report', monthLabel(m.month)], ['Vessel', vesselHeader(vessel)], ['Fuel', 'Diesel (MGO), litres'], [], ['Opening ROB', m.opening ?? ''], ['Received', m.received], ['Consumed', m.consumed], ['Closing ROB', m.closing ?? '']]);
  sheet('Daily', [['Date', 'ROB, L', 'Received, L', 'Consumed, L', 'Over days', 'Check'], ...m.days.filter((d) => d.rob != null || d.received).map((d) => [d.date, d.rob ?? '', d.received || '', d.consumed ?? '', d.span ?? '', d.suspect ? 'check figures' : ''])]);
  sheet('Bunkering', [['Date', 'Time', 'Port', 'Supplier', 'Litres', 'Density kg/L', 'Sulphur %', 'BDN No.', ...tanks.map((t) => `Into ${t.name}, L`), 'By'], ...m.bunkers.map((b) => [b.date, b.time ?? '', b.port, b.supplier ?? '', b.litres, b.density ?? '', b.sulphur ?? '', b.bdnNo ?? '', ...tanks.map((t) => b.into[t.id] ?? ''), b.by])]);
  sheet('Transfers', [['Date', 'From', 'To', 'Litres', 'By'], ...m.transfers.map((t) => [t.date, tanks.find((x) => x.id === t.fromTankId)?.name ?? '', tanks.find((x) => x.id === t.toTankId)?.name ?? '', t.litres, t.by])]);
  const fileName = fuelReportName(vessel, m.month, 'xlsx');
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
