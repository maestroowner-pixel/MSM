// ===================================
// DP files: a signed checklist as a PDF (the shared table report), and the
// confirmation letter — HTML through expo-print on a phone, jsPDF in a browser.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { share } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { ASOG_LABEL, Letter, checkOutcome, letterHtml } from './dp';
import { DpCheck } from '../types/dp';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { dpLetterPdfBlob } from '../utils/dpLetterPdf';

const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

export async function exportDpCheckPdf(c: DpCheck, vessel: VesselInfo | null) {
  const o = checkOutcome(c);
  const RES = { pass: 'Yes', fail: 'NO', na: 'N/A' } as const;
  const facts = [
    c.operation ? `operation: ${c.operation}` : null,
    c.asog ? `DP status ${ASOG_LABEL[c.asog]}` : null,
    `signed by ${c.by}${c.byRank ? ` (${c.byRank})` : ''} · ${stamp(c.at)} UTC`,
    `${o.pass} yes · ${o.fail} no · ${o.na} n/a${o.open ? ` · ${o.open} not answered` : ''}`,
  ].filter(Boolean) as string[];
  const tables = [{ title: 'Checklist', head: ['#', 'Item', 'Result'], rows: c.lines.map((l, i) => [String(i + 1), l.text, c.results[l.id] ? RES[c.results[l.id]] : '—']), widths: { 0: 12, 1: 225, 2: 36 } }];
  if (c.remarks) tables.push({ title: 'Remarks', head: ['', 'Remarks', ''], rows: [['', c.remarks, '']], widths: { 0: 12, 1: 225, 2: 36 } });
  return exportPmsHistory('DP checklist', `DP ${c.title.split(' — ')[0]} ${new Date(c.at).toISOString().slice(0, 10)}`, vessel, [{ title: c.title, facts, tables }]);
}

export async function exportDpLetter(l: Letter): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  if (onWeb) return saveFileWeb(dpLetterPdfBlob(l), l.fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: letterHtml(l) });
  const dest = `${FileSystem.cacheDirectory}${l.fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', l.fileName);
  } catch {
    await share(uri, 'application/pdf', l.fileName);
  }
}
