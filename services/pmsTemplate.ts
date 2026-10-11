// ===================================
// The maintenance plan template — download it (with the plan already in it),
// and pick a filled-in one to load. The reading is in pmsImport.ts.
// ===================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { Machine, PmsJob } from '../types/pms';
import { planWorkbook, sheetRows } from './pmsImport';
import { deliverFile, onWeb } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { saveFileWeb } from '../utils/webSave';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportPlanTemplate(machines: Machine[], jobs: PmsJob[]): Promise<string | null | void> {
  const name = 'ISMpilot_Maintenance_Plan.xlsx';
  const b64 = XLSX.write(planWorkbook(machines, jobs), { type: 'base64', bookType: 'xlsx' });
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: MIME }), name, 'reports');
  }
  await deliverFile(name, b64, true, MIME);
}

/** Pick a filled-in plan and return its rows. Null when cancelled. */
export async function pickPlanSheet(): Promise<{ name: string; rows: unknown[][] } | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    if (!f?.bytes) return null;
    return { name: f.name, rows: sheetRows(f.bytes) };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: [MIME, 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any });
  return { name: res.assets[0].name, rows: sheetRows(b64) };
}
