// ===================================
// The daily report as a document — PDF (A4 landscape, like the other registers)
// and Excel: where the vessel was, the fuel, and every section of the day on
// board (services/dailyActivity.ts).
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { DaySection } from './dailyActivity';
import { FuelDailyReport } from './fuelDaily';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const L = (n: number) => `${Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ')} L`;
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

export interface DailyDoc {
  date: string;
  /** The report's moment — noon or midnight — in ship's time and UTC. */
  stamp: string;
  kind: 'noon' | 'midnight';
  place: string;
  fuel: FuelDailyReport;
  sections: DaySection[];
  remarks?: string;
  by?: string;
}

function fuelRows(f: FuelDailyReport): string[][] {
  if (!f.reading) return [['Sounding', 'not taken for the day']];
  return [
    ...(f.consumed != null ? [['Consumed', `${L(f.consumed)}${f.span && f.span > 1 ? ` over ${f.span} days` : ''}`]] : []),
    ...(f.received ? [['Received', L(f.received)]] : []),
    ...(f.rob != null ? [['ROB', `${L(f.rob)}${f.byTank.length > 1 ? ` (${f.byTank.map((t) => `${t.name} ${L(t.litres)}`).join(' / ')})` : ''}`]] : []),
    ...(f.avg7 != null ? [['Average, 7 days', `${L(f.avg7)}/day${f.daysLeft != null ? ` · about ${f.daysLeft} days` : ''}`]] : []),
    ...(f.monthToDate != null ? [['Month to date', L(f.monthToDate)]] : []),
  ];
}

const facts = (d: DailyDoc) => [d.kind === 'noon' ? 'Covers noon to noon' : 'Covers 00:00 to 24:00 ship\'s time', d.place ? `${d.kind === 'noon' ? 'Noon' : 'Midnight'} position / port: ${d.place}` : 'Position not given', `${d.sections.reduce((n, s) => n + s.rows.length, 0)} entries in ${d.sections.length} logs`, d.by ? `by ${d.by}` : '', d.remarks ? `Remarks: ${d.remarks}` : ''].filter(Boolean);

export async function exportDailyPdf(d: DailyDoc, vessel: VesselInfo | null) {
  const name = d.kind === 'noon' ? 'Noon report' : 'Midnight report';
  return exportPmsHistory(name, `${name} ${d.date}`, vessel, [{
    title: `${name} — ${d.stamp}`,
    facts: facts(d),
    tables: [
      { title: 'Fuel', head: ['Fuel', 'Figure'], rows: fuelRows(d.fuel), widths: { 0: 50 } },
      ...d.sections.map((s) => ({ title: s.title, head: s.head, rows: s.rows, widths: { 0: 16 } })),
    ],
  }]);
}

export async function exportDailyExcel(d: DailyDoc, vessel: VesselInfo | null): Promise<string | null | void> {
  const title = `${d.kind === 'noon' ? 'Noon report' : 'Midnight report'} — ${d.stamp}`;
  const aoa: unknown[][] = [[title], [vesselHeader(vessel)], ...facts(d).map((f) => [f]), [], ['FUEL'], ...fuelRows(d.fuel)];
  for (const s of d.sections) aoa.push([], [s.title.toUpperCase()], s.head, ...s.rows);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 50 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Daily report');
  const v = clean(vessel?.vessel_name ?? '');
  const name = `${d.kind === 'noon' ? 'Noon report' : 'Midnight report'} ${d.date}${v ? `-${v}` : ''}.xlsx`;
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
