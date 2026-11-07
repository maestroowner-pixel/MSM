// ===================================
// Ropes and wires on paper (plan item 67) — what a class surveyor, a terminal
// or an OCIMF inspector asks for: every rope with its wear, length and age, and
// each rope's log. PDF and Excel. English always. The rows: services/wireRows.ts.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { MachineHistory } from './pmsHistory';
import { CATEGORY_MAP } from '../constants/categories';
import type { EquipmentItem } from '../types/equipment';
import type { WireEntry } from '../types/wireLog';
import { HEAD, LOG_HEAD, dmy, logRows, ropeRows, ropesOf, statusText } from './wireRows';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

export const wireFile = 'Ropes and wires';

function history(items: EquipmentItem[], log: WireEntry[], today: string): MachineHistory[] {
  const ropes = ropesOf(items, log, today);
  const main: MachineHistory = {
    title: 'Ropes and wires — condition and wear',
    facts: [`${ropes.length} ropes`, `${ropes.filter((r) => r.state.level === 'red').length} to be discarded`, `${ropes.filter((r) => r.state.level === 'amber').length} close to a limit`, `Printed ${dmy(today)}`],
    tables: [{ title: 'Ropes', head: HEAD, rows: ropeRows(items, log, today), widths: { 0: 30, 1: 20, 2: 18, 3: 12, 4: 20, 5: 10, 6: 18, 7: 12, 8: 16, 9: 18, 10: 16, 11: 20, 12: 20, 13: 37 } }],
  };
  const each: MachineHistory[] = ropes.filter((r) => r.state.entries.length).map((r) => ({
    title: r.name,
    facts: [CATEGORY_MAP[r.item.category]?.label ?? '', r.item.diameter ?? '', r.item.material ?? '', statusText(r.state)].filter(Boolean),
    tables: [{ title: 'Log', head: LOG_HEAD, rows: logRows(r.state), widths: { 0: 20, 1: 26, 2: 160, 3: 40 } }],
  }));
  return [main, ...each];
}

export async function exportWirePdf(items: EquipmentItem[], log: WireEntry[], vessel: VesselInfo | null, today: string) {
  return exportPmsHistory('Ropes and wires', wireFile, vessel, history(items, log, today));
}

export async function exportWireExcel(items: EquipmentItem[], log: WireEntry[], vessel: VesselInfo | null, today: string): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[`Ropes and wires — ${vesselHeader(vessel)}`, `Printed ${dmy(today)}`], [], HEAD, ...ropeRows(items, log, today)]);
  ws['!cols'] = [30, 22, 18, 11, 18, 8, 18, 11, 12, 16, 14, 18, 18, 40].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'Ropes');
  const all = ropesOf(items, log, today).flatMap((r) => logRows(r.state).map((row) => [r.name, ...row]));
  const ws2 = XLSX.utils.aoa_to_sheet([['Rope / gear', ...LOG_HEAD], ...all]);
  ws2['!cols'] = [30, 12, 16, 70, 24].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Log');
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = `${wireFile}${vName ? `-${vName}` : ''}.xlsx`;
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
