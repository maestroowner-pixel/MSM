// ===================================
// QHSE registers — the non-conformity register and the observation cards, as a
// PDF (the same A4 landscape tables as the PMS history) and as Excel.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { NC_HEAD, OBS_HEAD, ncRows, ncState, obsRows } from './safety';
import { NonConformity, SafetyObservation } from '../types/safety';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ');

function sheets(ncs: NonConformity[], obs: SafetyObservation[], today: string) {
  const open = ncs.filter((n) => ncState(n, today) !== 'closed').length;
  return {
    facts: [`${ncs.length} non-conformities · ${open} open`, `${obs.length} observation cards · ${obs.filter((o) => !o.reviewedAt).length} not reviewed`],
    nc: { title: 'Non-conformities', head: NC_HEAD, rows: ncRows(ncs, today), widths: { 0: 20, 1: 16, 2: 18, 4: 55, 7: 60, 9: 30 } },
    obs: { title: 'Safety observation cards', head: OBS_HEAD, rows: obsRows(obs, ncs), widths: { 0: 16, 1: 22, 4: 60, 5: 40, 6: 12 } },
  };
}

export async function exportSafetyPdf(ncs: NonConformity[], obs: SafetyObservation[], today: string, vessel: VesselInfo | null) {
  const s = sheets(ncs, obs, today);
  return exportPmsHistory('QHSE register', `QHSE register ${today}`, vessel, [{ title: 'QHSE register', facts: s.facts, tables: [s.nc, s.obs] }]);
}

export async function exportSafetyExcel(ncs: NonConformity[], obs: SafetyObservation[], today: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const s = sheets(ncs, obs, today);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['QHSE register'], [vesselHeader(vessel)], s.facts, [], s.nc.head, ...s.nc.rows]), 'Non-conformities');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.obs.head, ...s.obs.rows]), 'Observation cards');
  const v = clean(vessel?.vessel_name ?? '').trim();
  const name = `QHSE register ${today}${v ? `-${v}` : ''}.xlsx`;
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
