// ===================================
// DP files: a signed checklist as a PDF (the shared table report), and the
// confirmation letter — HTML through expo-print on a phone, jsPDF in a browser.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { share } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { ASOG_LABEL, Letter, answerText, checkOutcome, conditionsText, letterHtml, positionText, rowCells } from './dp';
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
    `${o.pass} yes · ${o.fail} no · ${o.na} n/a${o.open ? ` · ${o.open} not answered` : ''}`,
  ].filter(Boolean) as string[];
  // As the paper checklist: a heading with columns is a table with those
  // columns; the other sections list item and answer. 273 mm across.
  type T = { title: string; head: string[]; rows: string[][]; widths: Record<number, number> };
  const tables: T[] = [];
  let n = 0;
  for (const l of c.lines) {
    if (l.head || !tables.length) {
      const cols = l.head ? l.cols : undefined;
      const each = cols?.length ? Math.min(45, Math.floor((273 - 12 - 70) / cols.length)) : 0;
      tables.push(
        cols?.length
          ? { title: l.text, head: ['#', 'Item', ...cols.map((x) => (x.options ? `${x.name} (${x.options.join(' / ')})` : x.name))], rows: [], widths: { 0: 12, 1: 70, ...Object.fromEntries(cols.map((_, i) => [i + 2, each])) } }
          : { title: l.head ? l.text : 'Checklist', head: ['#', 'Item', 'Answer'], rows: [], widths: { 0: 12, 1: 170, 2: 91 } }
      );
      (tables[tables.length - 1] as any).cols = cols;
    }
    if (l.head) continue;
    const t = tables[tables.length - 1] as T & { cols?: typeof l.cols };
    t.rows.push([String(++n), l.text, ...(t.cols?.length ? rowCells(l, t.cols, c).map((x) => x || '—') : [answerText(l, c) || '—'])]);
  }
  for (const t of tables) delete (t as any).cols;
  if (c.remarks) tables.push({ title: 'Remarks', head: ['', 'Remarks', ''], rows: [['', c.remarks, '']], widths: { 0: 12, 1: 170, 2: 91 } });
  tables.push({
    title: 'Signatures',
    head: ['', 'Name', 'Position', 'Signature'],
    rows: [
      ['Handing over', c.by, c.byRank ?? '', `signed in ISMpilot ${shipAndUtc(c.at, c.shipOffset).ship} LT`],
      ['Taking over', c.by2 ?? '', c.by2Rank ?? '', c.by2 ? `signed in ISMpilot ${shipAndUtc(c.at, c.shipOffset).ship} LT` : ''],
    ],
    widths: { 0: 40, 1: 80, 2: 70, 3: 83 },
  });
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
