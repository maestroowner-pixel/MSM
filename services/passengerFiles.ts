// Passenger list files — pick a filled-in sheet, save the list or the template (services/passengerList.ts for the data).
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import { VesselInfo } from './storage';
import { PaxRow, paxWorkbookBase64, parsePaxWorkbook } from './passengerList';
import { deliverFile, onWeb } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { saveFileWeb } from '../utils/webSave';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function savePaxSheet(rows: unknown[][], stem: string, vessel: VesselInfo | null): Promise<string | null | void> {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const name = `${stem}${v ? `-${v}` : ''}.xlsx`;
  const b64 = paxWorkbookBase64(rows);
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: MIME }), name, 'reports');
  }
  await deliverFile(name, b64, true, MIME);
}

export async function pickPaxSheet(): Promise<{ name: string; rows: PaxRow[] } | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    if (!f?.bytes) return null;
    return { name: f.name, rows: parsePaxWorkbook(f.bytes) };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: [MIME, 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any });
  return { name: res.assets[0].name, rows: parsePaxWorkbook(b64) };
}
