// ===================================
// PDF export for one Engine Room Log page (one day or one round).
// The paper layout: a reading per row, a round per column, out-of-range
// figures in bold red, then each round's remarks and signature.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { WatchEntry, WatchParam } from '../types/watchLog';
import { PERIOD_LABEL } from './deckLog';
import { fmtValue, normalStatus, rangeText, sameParam } from './watchLog';
import { formatDateTime } from '../utils/dates';

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Every reading the day's rounds recorded, in the order the rounds list them. */
function rowsOf(entries: WatchEntry[]): WatchParam[] {
  const rows: WatchParam[] = [];
  for (const e of entries) for (const q of e.params) if (!sameParam(q, rows)) rows.push(q);
  return rows;
}

export function buildWatchLogHtml(entries: WatchEntry[], date: string, vessel: VesselInfo | null): string {
  const rounds = [...entries].sort((a, b) => a.at - b.at);
  const rows = rowsOf(rounds);
  const head = rounds.map((e) =>
    `<th>${e.time}${e.period && e.period !== 'other' ? `<br><small>${esc(PERIOD_LABEL[e.period] ?? e.period)}</small>` : ''}</th>`).join('');
  const body = rows.map((q) => {
    const cells = rounds.map((e) => {
      const own = sameParam(q, e.params);
      const raw = own ? e.values[own.id] ?? '' : '';
      const warn = own && normalStatus(own, raw) === 'warn';
      return `<td class="v${warn ? ' warn' : ''}">${esc(own ? fmtValue({ ...own, unit: '' }, raw) : '')}</td>`;
    }).join('');
    const range = rangeText(q);
    return `<tr><td>${esc(q.name)}${range ? `<br><small>normal ${esc(range)}</small>` : ''}</td><td class="u">${esc(q.unit)}</td>${cells}</tr>`;
  }).join('');
  const notes = rounds.map((e) => `
    <tr><td class="t">${e.time}</td><td>${e.remarks ? esc(e.remarks) : '<span class="none">—</span>'}</td>
    <td class="s">${esc(e.by)}${e.byRank ? ` (${esc(e.byRank)})` : ''}<br><small>${formatDateTime(e.at)}</small></td></tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 ${rounds.length > 6 ? 'landscape' : 'portrait'}; margin: 0; }
    body { margin: 14mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9.5px; color: #0B2545; }
    h1 { font-size: 14px; margin: 0; }
    h2 { font-size: 11px; margin: 14px 0 4px; }
    .sub { color: #5b6b7e; font-size: 9px; margin: 2px 0 10px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #0B2545; color: #fff; padding: 4px 6px; text-align: center; font-size: 9.5px; }
    th:first-child { text-align: left; }
    td { border: .5px solid #c8d0db; padding: 3px 6px; vertical-align: top; }
    td.v { text-align: center; white-space: nowrap; }
    td.u { color: #5b6b7e; white-space: nowrap; }
    td.warn { color: #b3261e; font-weight: 700; }
    td.t { width: 12%; white-space: nowrap; font-weight: 600; }
    td.s { width: 30%; background: #f5f7fa; }
    .none { color: #8a97a8; }
    small { font-size: 8px; color: #8a97a8; }
    th small { color: #c9d3e0; }
  </style></head><body>
    <h1>${esc(`Engine Room Log — ${dmy(date)}`)}</h1>
    <div class="sub">${esc(vesselHeader(vessel))}</div>
    ${rounds.length ? `
    <table><thead><tr><th>Reading</th><th>Unit</th>${head}</tr></thead><tbody>${body}</tbody></table>
    <h2>Remarks and signatures</h2>
    <table><thead><tr><th>Time</th><th>Remarks</th><th>Signed by</th></tr></thead><tbody>${notes}</tbody></table>
    ` : '<p>No rounds for this date.</p>'}
  </body></html>`;
}

export async function shareWatchLogPage(
  entries: WatchEntry[],
  date: string,
  vessel: VesselInfo | null,
): Promise<void> {
  if (onWindows) throw new Error('PDF is not available on Windows.');
  const dStr = date.replace(/-/g, '');
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const name = `EngineLog_${dStr}${vName ? `_${vName}` : ''}.pdf`;
  const html = buildWatchLogHtml(entries, date, vessel);
  const landscape = entries.length > 6;
  if (onWeb) {
    const htmlName = name.replace(/\.pdf$/, '.html');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const saved = await saveFileWeb(blob, htmlName, 'reports');
    if (!saved) {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: landscape ? 842 : 595, height: landscape ? 595 : 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}
