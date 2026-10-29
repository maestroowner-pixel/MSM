// ===================================
// External inspections on paper — one inspection (the answer to its findings,
// for the flag, class or the company) or the vessel's whole record, as a PDF
// (the A4 landscape tables of the PMS history) and as Excel. English always.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { inspReport } from './extInspections';
import { ExternalInspection } from '../types/extInspection';
import { NonConformity } from '../types/safety';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ');
const stem = (list: ExternalInspection[], today: string) =>
  list.length === 1 ? `${list[0].no} ${list[0].kind === 'psc' ? 'PSC' : 'Inspection'} ${list[0].date}` : `External inspections ${today}`;

export async function exportInspPdf(list: ExternalInspection[], ncs: NonConformity[], today: string, vessel: VesselInfo | null) {
  const title = list.length === 1 ? 'External inspection — findings and corrective actions' : 'External inspections';
  return exportPmsHistory(title, stem(list, today), vessel, list.map((x) => inspReport(x, ncs, today)));
}

export async function exportInspExcel(list: ExternalInspection[], ncs: NonConformity[], today: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const parts = list.map((x) => inspReport(x, ncs, today));
  const sum = [['External inspections'], [vesselHeader(vessel)], [], ['Inspection', 'Details']];
  for (const p of parts) sum.push([p.title, p.facts.join('\n')]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Inspections');
  const head = parts.find((p) => p.tables.length)?.tables[0].head;
  if (head) {
    const rows: string[][] = [['Inspection', ...head]];
    for (const p of parts) for (const r of p.tables[0]?.rows ?? []) rows.push([p.title, ...r]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Findings');
  }
  const v = clean(vessel?.vessel_name ?? '').trim();
  const name = `${clean(stem(list, today))}${v ? `-${v}` : ''}.xlsx`;
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
