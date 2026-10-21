// ===================================
// GMDSS Log PDF export.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { GmdssEntry } from '../types/gmdss';
import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { printHtmlWeb } from '../utils/webFile';
import { onWeb, onWindows } from '../utils/fileShare';
import { fileDateStamp, formatDate } from '../utils/dates';
import { GMDSS_EQUIPMENT } from './gmdssService';
import { monthName } from '../components/MonthPicker';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeLabel(type: GmdssEntry['type']): string {
  switch (type) {
    case 'daily':    return 'Daily check';
    case 'weekly':   return 'Weekly check';
    case 'monthly':  return 'Monthly';
    case 'radar_on': return 'Radar ON';
    case 'radar_off':return 'Radar OFF';
    case 'event':    return 'Event / note';
  }
}

function typeBadgeColor(type: GmdssEntry['type']): string {
  switch (type) {
    case 'daily':   return '#4CAF50';
    case 'weekly':  return '#2196F3';
    case 'monthly': return '#9C27B0';
    case 'radar_on':
    case 'radar_off': return '#FF9800';
    default:         return '#9E9E9E';
  }
}

function checkDetailRows(entry: GmdssEntry): string {
  if (!entry.check) return '';
  const defs = GMDSS_EQUIPMENT.filter((e) => e.periods.includes(entry.check!.period));
  const lines = defs.map((def) => {
    const item = entry.check!.items.find((i) => i.id === def.id);
    if (!item) return null;
    const tick = item.checked ? '✓' : '✗';
    let text = `${tick} ${def.label}`;
    if (item.value && def.hasValue) {
      text += ` · ${def.valueLabel ?? ''} ${item.value}`;
      if (item.value2 && def.hasValue2) text += ` "${item.value2}"`;
    }
    return `<li style="color:${item.checked ? '#2e7d32' : '#c62828'}">${esc(text)}</li>`;
  }).filter(Boolean);

  const batLines = (entry.check.batteries ?? []).map((bat) => {
    const v = bat.voltageRaw !== undefined
      ? ` · ${Math.floor(bat.voltageRaw / 10)}.${bat.voltageRaw % 10} V`
      : '';
    const st = bat.status === 'charging' ? 'charging' : bat.status === 'charged' ? 'charged' : 'OK';
    return `<li>${esc(bat.label)}: ${st}${v}</li>`;
  });

  const noteHtml = entry.check.note
    ? `<li style="color:#555"><em>Note: ${esc(entry.check.note)}</em></li>`
    : '';

  return `<ul class="chk">${lines.join('')}${batLines.join('')}${noteHtml}</ul>`;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(entries: GmdssEntry[], vessel: VesselInfo | null, period?: string): string {
  const sorted = [...entries].sort((a, b) => b.at - a.at);
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const header = esc(vesselHeader(vessel));
  const periodLabel = period ? esc(monthName(period)) : null;

  const rows = sorted.map((e) => {
    const color = typeBadgeColor(e.type);
    const badge = `<span class="badge" style="background:${color}">${esc(typeLabel(e.type))}</span>`;
    const rwc = e.radioWatchClosed
      ? '<span class="rwc">Radio watch closed</span>' : '';
    const detail = checkDetailRows(e);
    const by = e.byRank ? `${esc(e.by)} (${esc(e.byRank)})` : esc(e.by);
    return `<tr>
      <td class="dt">${esc(formatDate(e.date))}<br/><span class="tm">${esc(e.time)}</span></td>
      <td>${badge}</td>
      <td>${esc(e.text)}${rwc}${detail}</td>
      <td class="by">${by}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 10px; }
    h1 { color: #0B2545; font-size: 16px; margin: 0 0 2px; }
    .meta { color: #7f8c8d; font-size: 10px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #dce3ec; padding: 4px 6px; vertical-align: top; }
    th { background: #DAEEF7; color: #0B2545; text-align: left; font-size: 9px; white-space: nowrap; }
    td.dt { white-space: nowrap; font-size: 9px; }
    .tm { color: #7f8c8d; }
    .badge { display: inline-block; border-radius: 4px; padding: 1px 5px; color: #fff; font-size: 8px; font-weight: 700; white-space: nowrap; }
    .rwc { display: block; color: #c0392b; font-weight: 700; font-size: 9px; margin-top: 2px; }
    .by { white-space: nowrap; font-size: 9px; color: #555; }
    .chk { margin: 4px 0 0 0; padding-left: 16px; font-size: 9px; }
    .chk li { margin-bottom: 1px; }
    .empty { text-align: center; color: #aaa; padding: 20px; }
  </style>
  </head><body>
  <h1>GMDSS Log${periodLabel ? ` — ${periodLabel}` : ''}</h1>
  <div class="meta">${header} — generated ${today}</div>
  <table>
    <thead><tr>
      <th style="width:70px">Date / Time</th>
      <th style="width:90px">Type</th>
      <th>Entry</th>
      <th style="width:100px">Recorded by</th>
    </tr></thead>
    <tbody>
      ${rows || `<tr><td colspan="4" class="empty">No entries</td></tr>`}
    </tbody>
  </table>
  </body></html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function exportGmdssPdf(
  entries: GmdssEntry[],
  vessel: VesselInfo | null,
  /** YYYY-MM month to include in the file name and title. */
  month?: string
): Promise<void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const html = buildHtml(entries, vessel, month);
  const suffix = month ? month.replace('-', '_') : fileDateStamp();
  const fileName = `GMDSS_Log_${suffix}.pdf`;

  if (onWeb) {
    printHtmlWeb(html, fileName);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}
