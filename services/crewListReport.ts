// ===================================
// Crew list — files in and out: the PDF (FAL Form 5), the Excel template, and
// reading a filled-in template back. The data side is services/crewList.ts.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import { VesselInfo } from './storage';
import { esc, share } from './export';
import { CrewListRow, CrewRow, crewListFileName, crewTemplateBase64, parseCrewWorkbook } from './crewList';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { pickBinaryFileWeb, pickTextFileWeb } from '../utils/webFile';
import { crewListPdfBlob } from '../utils/crewListPdf';
import { saveFileWeb } from '../utils/webSave';

export interface CrewListInput {
  vessel: VesselInfo | null;
  arrival: boolean;
  port: string;
  /** yyyy-mm-dd */
  date: string;
  rows: CrewListRow[];
}

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

function html(i: CrewListInput): string {
  const v = i.vessel ?? {};
  const box = (label: string, value?: string) => `<td><div class="l">${esc(label)}</div><div class="v">${esc(value ?? '')}</div></td>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    body { margin: 9mm 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0 0 6px; display: flex; justify-content: space-between; } h1 span { font-size: 9px; font-weight: 400; }
    table { border-collapse: collapse; width: 100%; } td, th { border: 0.5px solid #c8d0db; padding: 3px 4px; vertical-align: top; }
    .hdr td { width: 25%; } .l { font-size: 7px; color: #5b6b7e; } .v { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .crew { margin-top: 8px; } .crew th { background: #eef2f7; font-size: 7.5px; text-align: left; }
    .sig { margin: 26px 0 0 auto; width: 40%; border-top: 0.8px solid #0B2545; padding-top: 3px; }
  </style></head><body>
    <h1>CREW LIST <span>IMO FAL Form 5</span></h1>
    <table class="hdr"><tr>${box('1.1 Name of ship', v.vessel_name)}${box('1.2 IMO number', v.imo)}${box('1.3 Call sign', v.call_sign)}${box('4. Flag State of ship', v.flag)}</tr>
      <tr>${box(`2. Port of ${i.arrival ? 'arrival' : 'departure'}`, i.port)}${box(`3. Date of ${i.arrival ? 'arrival' : 'departure'}`, dmy(i.date))}<td></td><td></td></tr></table>
    <table class="crew"><thead><tr><th>5. No.</th><th>6. Family name, given names</th><th>7. Rank or rating</th><th>8. Nationality</th>
      <th>9. Date and place of birth</th><th>10. Nature and No. of identity document (passport, expiry)</th><th>Date and port of embarkation</th></tr></thead>
      <tbody>${i.rows.map((r) => `<tr><td>${r.no}</td><td>${esc(r.name)}</td><td>${esc(r.rank)}</td><td>${esc(r.nationality)}</td><td>${esc(r.birth)}</td><td>${esc(r.passport)}</td><td>${esc(r.embarked)}</td></tr>`).join('')}</tbody></table>
    <div class="sig">11. Date and signature by master, authorized agent or officer</div>
  </body></html>`;
}

/** Make the crew list PDF. Web: saved into the remembered folder (returns its name). */
export async function exportCrewListPdf(i: CrewListInput): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const fileName = crewListFileName(i.vessel?.vessel_name, i.date);
  if (onWeb) {
    const v = i.vessel ?? {};
    const blob = crewListPdfBlob({
      vessel: { name: v.vessel_name, imo: v.imo, flag: v.flag, callSign: v.call_sign },
      arrival: i.arrival,
      port: i.port,
      date: dmy(i.date),
      rows: i.rows,
    });
    return saveFileWeb(blob, fileName, 'reports');
  }
  const { uri } = await Print.printToFileAsync({ html: html(i), width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

export async function exportCrewTemplate(): Promise<void> {
  await deliverFile('ISMpilot_Crew_List_Template.xlsx', crewTemplateBase64(), true, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Pick a filled-in template and read it. Null when cancelled. */
export async function pickCrewSheet(): Promise<{ name: string; rows: CrewRow[] } | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    if (!f?.bytes) return null;
    return { name: f.name, rows: parseCrewWorkbook(f.bytes) };
  }
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any });
  return { name: res.assets[0].name, rows: parseCrewWorkbook(b64) };
}

/** Pick a seafarer's SDM backup (.sdm, JSON) and return its text. Null when cancelled. */
export async function pickSdmFile(): Promise<{ name: string; text: string } | null> {
  if (onWeb) {
    const f = await pickTextFileWeb('.sdm,.json,application/json');
    return f ? { name: f.name, text: f.text } : null;
  }
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return { name: res.assets[0].name, text: await FileSystem.readAsStringAsync(res.assets[0].uri) };
}
