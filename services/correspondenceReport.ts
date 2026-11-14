// ===================================
// The correspondence register on paper — what an ISM auditor asks to see:
// every letter in and out for a period, numbered, with from / to, subject,
// their reference, what was expected and how it was answered. PDF and Excel.
// English always.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory, sharePmsHistory } from './pmsHistoryReport';
import { MachineHistory } from './pmsHistory';
import { letterState } from './correspondence';
import { inPeriod, letterRows, letterSheet } from './correspondenceRows';
import { Letter } from '../types/correspondence';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const HEAD = ['No.', 'Date', 'From / to', 'Subject', 'Their ref.', 'Via', 'Action by', 'Answer / status', 'File', 'Entered by'];
export const letterFile = 'Correspondence register';

function history(all: Letter[], from: string, to: string, today: string): MachineHistory {
  const list = inPeriod(all, from, to);
  const ins = list.filter((l) => l.dir === 'in');
  const outs = list.filter((l) => l.dir === 'out');
  const overdue = ins.filter((l) => letterState(l, all, today) === 'overdue').length;
  const period = from || to ? `${from ? dmy(from) : '…'} – ${to ? dmy(to) : '…'}` : 'All dates';
  return {
    title: 'Correspondence register',
    facts: [period, `${ins.length} in`, `${outs.length} out`, ...(overdue ? [`${overdue} answers overdue`] : []), `Printed ${dmy(today)}`],
    tables: [
      { title: 'Incoming', head: HEAD, rows: letterRows(ins, all, today), widths: { 0: 22, 1: 18, 2: 38, 3: 62, 4: 22, 5: 16, 6: 20, 7: 40, 8: 9, 9: 30 } },
      { title: 'Outgoing', head: HEAD, rows: letterRows(outs, all, today), widths: { 0: 22, 1: 18, 2: 38, 3: 62, 4: 22, 5: 16, 6: 20, 7: 40, 8: 9, 9: 30 } },
    ],
  };
}

export async function exportLettersPdf(all: Letter[], vessel: VesselInfo | null, from: string, to: string, today: string) {
  return exportPmsHistory('Correspondence register', letterFile, vessel, [history(all, from, to, today)]);
}

/** The register for the period through the share sheet (the browser's, where it takes files). */
export async function shareLettersPdf(all: Letter[], vessel: VesselInfo | null, from: string, to: string, today: string) {
  return sharePmsHistory('Correspondence register', letterFile, vessel, [history(all, from, to, today)]);
}

/** One letter's page through the share sheet. */
export async function shareLetterPdf(l: Letter, all: Letter[], vessel: VesselInfo | null, today: string) {
  return sharePmsHistory(`${l.no} — ${l.subject}`, l.no, vessel, [letterSheet(l, all, today)]);
}

export async function exportLettersExcel(all: Letter[], vessel: VesselInfo | null, from: string, to: string, today: string): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const list = inPeriod(all, from, to);
  for (const [dir, name] of [['in', 'Incoming'], ['out', 'Outgoing']] as const) {
    const ws = XLSX.utils.aoa_to_sheet([[`${name} correspondence — ${vesselHeader(vessel)}`, `Printed ${dmy(today)}`], [], HEAD, ...letterRows(list.filter((l) => l.dir === dir), all, today)]);
    ws['!cols'] = [14, 11, 34, 44, 18, 14, 16, 40, 6, 26].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = `${letterFile}${vName ? `-${vName}` : ''}.xlsx`;
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
