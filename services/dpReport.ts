// ===================================
// DP files: a signed checklist as a PDF (the shared table report), and the
// confirmation letter — HTML through expo-print on a phone, jsPDF in a browser.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { share } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { ASOG_LABEL, Letter, answerText, checkOutcome, conditionsText, letterHtml, positionText } from './dp';
import { shipAndUtc } from '../utils/shipTime';
import { DpCheck } from '../types/dp';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { dpLetterPdfBlob } from '../utils/dpLetterPdf';

export async function exportDpCheckPdf(c: DpCheck, vessel: VesselInfo | null) {
  const o = checkOutcome(c);
  const facts = [
    `position ${positionText(c.position)}`,
    shipAndUtc(c.at, c.shipOffset).line,
    c.operation ? `field: ${c.operation}` : null,
    c.unit ? `offshore unit: ${c.unit}` : null,
    conditionsText(c.conditions) || null,
    c.asog ? `DP status ${ASOG_LABEL[c.asog]}` : null,
    `signed by ${c.by}${c.byRank ? ` (${c.byRank})` : ''}`,
    `${o.pass} yes · ${o.fail} no · ${o.na} n/a${o.open ? ` · ${o.open} not answered` : ''}`,
  ].filter(Boolean) as string[];
  // One table a section, as the paper checklist is laid out.
  const widths = { 0: 12, 1: 170, 2: 91 };
  const tables: { title: string; head: string[]; rows: string[][]; widths: Record<number, number> }[] = [];
  let n = 0;
  for (const l of c.lines) {
    if (l.head || !tables.length) tables.push({ title: l.head ? l.text : 'Checklist', head: ['#', 'Item', 'Answer'], rows: [], widths });
    if (!l.head) tables[tables.length - 1].rows.push([String(++n), l.text, answerText(l, c) || '—']);
  }
  if (c.remarks) tables.push({ title: 'Remarks', head: ['', 'Remarks', ''], rows: [['', c.remarks, '']], widths });
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
