// ===================================
// Chemicals aboard on paper — the register an auditor or a port asks for (the
// COSHH / hazardous substances list): every product, where it is and how much,
// its hazards and PPE, the SDS's date, whether the card was checked, and its
// risk assessment. PDF and Excel. English always.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { MachineHistory } from './pmsHistory';
import { chemIssues, ghsLine, raFor, sdsReviewBy, sortChems, stockLine } from './chemicals';
import { moduleOn } from '../constants/modules';
import { CHEM_USE_EN, Chemical } from '../types/chemicals';
import type { RiskAssessment } from '../types/permits';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const ISSUE_EN = { noSds: 'No SDS', oldSds: 'SDS over 5 years old', noRa: 'No approved risk assessment', unchecked: 'Card not checked against the SDS' };

/** One row per product, in the list's order — the same for the PDF and the sheet. */
export function chemRows(chems: Chemical[], risks: RiskAssessment[], today: string, ptwOn: boolean): string[][] {
  return sortChems(chems).map((c) => {
    const ra = raFor(c, risks);
    return [
      [c.name, c.maker].filter(Boolean).join(' / '),
      CHEM_USE_EN[c.use],
      c.stock.map(stockLine).filter(Boolean).join('; '),
      c.signal ? c.signal.toUpperCase() : '',
      ghsLine(c.ghs),
      (c.hazards ?? []).map((h) => h.split(' ')[0]).join(', '),
      c.ppe ?? '',
      c.sds ? `${dmy(c.sdsDate) || 'undated'}${c.sdsDate && sdsReviewBy(c.sdsDate) < today ? ' (review)' : ''}` : 'NONE',
      c.checked ? `${c.checked.by} ${dmy(new Date(c.checked.at).toISOString().slice(0, 10))}` : '',
      ra ? `${ra.no ?? ra.title}${ra.approved ? '' : ' (not approved)'}` : '',
      chemIssues(c, risks, today, ptwOn).map((i) => ISSUE_EN[i]).join('; '),
    ];
  });
}

const HEAD = ['Product / maker', 'Use', 'Where, how much', 'Signal', 'Pictograms', 'H statements', 'PPE', 'SDS dated', 'Checked', 'Risk assessment', 'Missing'];
export const chemFile = 'Chemicals aboard';

function history(chems: Chemical[], risks: RiskAssessment[], today: string): MachineHistory {
  const live = chems.filter((c) => !c.deleted);
  return {
    title: 'Chemicals aboard and safety data sheets',
    facts: [`${live.length} products`, `${live.filter((c) => c.signal === 'danger').length} DANGER`, `${live.filter((c) => !c.sds).length} without an SDS`, `Printed ${dmy(today)}`],
    tables: [{
      title: 'Register',
      head: HEAD,
      rows: chemRows(chems, risks, today, moduleOn('ptw')),
      widths: { 0: 34, 1: 18, 2: 30, 3: 18, 4: 26, 5: 24, 6: 37, 7: 18, 8: 22, 9: 22, 10: 28 },
    }],
  };
}

export async function exportChemicalsPdf(chems: Chemical[], risks: RiskAssessment[], vessel: VesselInfo | null, today: string) {
  return exportPmsHistory('Chemicals aboard', chemFile, vessel, [history(chems, risks, today)]);
}

export async function exportChemicalsExcel(chems: Chemical[], risks: RiskAssessment[], vessel: VesselInfo | null, today: string): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[`Chemicals aboard — ${vesselHeader(vessel)}`, `Printed ${dmy(today)}`], [], HEAD, ...chemRows(chems, risks, today, moduleOn('ptw'))]);
  ws['!cols'] = HEAD.map((_, i) => ({ wch: [32, 16, 30, 9, 26, 24, 40, 14, 22, 20, 30][i] }));
  XLSX.utils.book_append_sheet(wb, ws, 'Chemicals');
  // First aid, fire and spill per product, for the sheet kept by the locker.
  const aid = sortChems(chems).map((c) => [c.name, c.firstAid?.eyes ?? '', c.firstAid?.skin ?? '', c.firstAid?.inhaled ?? '', c.firstAid?.swallowed ?? '', c.fire ?? '', c.spill ?? '', c.storage ?? '', c.incompatible ?? '', c.un ? `UN ${c.un}` : '']);
  const ws2 = XLSX.utils.aoa_to_sheet([['Product', 'Eyes', 'Skin', 'Inhaled', 'Swallowed', 'Fire', 'Spill', 'Storage', 'Keep away from', 'UN'], ...aid]);
  ws2['!cols'] = [28, 30, 30, 30, 30, 30, 30, 30, 24, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws2, 'First aid, fire, spill');
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = `${chemFile}${vName ? `-${vName}` : ''}.xlsx`;
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
