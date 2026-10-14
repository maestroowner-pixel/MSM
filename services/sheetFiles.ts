// Any list as an .xlsx file, and any picked .xlsx read into rows (first sheet) — the stores use it;
// the crew and the passengers have their own (services/crewListReport, services/passengerFiles).
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { deliverFile, onWeb } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { saveFileWeb } from '../utils/webSave';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function saveSheet(rows: unknown[][], sheetName: string, stem: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = ((rows[0] ?? []) as unknown[]).map((h) => ({ wch: Math.max(10, String(h ?? '').length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const name = `${stem.replace(/[\\/:*?"<>|]+/g, ' ')}${v ? `-${v}` : ''}.xlsx`;
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: MIME }), name, 'reports');
  }
  await deliverFile(name, b64, true, MIME);
}

export async function pickSheetRows(): Promise<{ name: string; rows: unknown[][] } | null> {
  const read = (wb: XLSX.WorkBook) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }) as unknown[][];
  if (onWeb) {
    const f = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    if (!f?.bytes) return null;
    return { name: f.name, rows: read(XLSX.read(f.bytes, { type: 'array', cellDates: true })) };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: [MIME, 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any });
  return { name: res.assets[0].name, rows: read(XLSX.read(b64, { type: 'base64', cellDates: true })) };
}
