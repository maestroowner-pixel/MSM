// ===================================
// Machine history and the survey pack as a PDF — one machine per page (see
// services/pmsHistory.ts for what is on it).
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { MachineHistory } from './pmsHistory';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { pmsHistoryPdfBlob } from '../utils/pmsHistoryPdf';

function html(title: string, vessel: VesselInfo | null, list: MachineHistory[]): string {
  const page = (h: MachineHistory) => `<section>
    <div class="top">${esc(title)} · ${esc(vesselHeader(vessel))}</div>
    <h1>${esc(h.title)}</h1><div class="facts">${h.facts.map(esc).join(' · ')}</div>
    ${h.tables.map((t) => `<h2>${esc(t.title)} (${t.rows.length})</h2><table><thead><tr>${t.head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.length ? t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.head.length}">None.</td></tr>`}</tbody></table>`).join('')}
  </section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; } body { margin: 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 8.5px; color: #0B2545; }
    section + section { page-break-before: always; } .top { color: #5b6b7e; font-size: 8px; } h1 { font-size: 16px; margin: 2px 0; } .facts { margin-bottom: 6px; }
    h2 { font-size: 9px; text-transform: uppercase; margin: 8px 0 3px; } table { border-collapse: collapse; width: 100%; }
    td, th { border: .5px solid #c8d0db; padding: 2px 4px; vertical-align: top; text-align: left; } th { background: #eef2f7; }
  </style></head><body>${list.map(page).join('')}</body></html>`;
}

export async function exportPmsHistory(title: string, fileStem: string, vessel: VesselInfo | null, list: MachineHistory[]): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const name = `${fileStem.replace(/[\\/:*?"<>|]+/g, ' ')}${v ? `-${v}` : ''}.pdf`;
  if (onWeb) return saveFileWeb(pmsHistoryPdfBlob(title, vesselHeader(vessel), list), name, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(title, vessel, list), width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}
