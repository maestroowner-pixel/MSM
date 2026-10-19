// ===================================
// PDF export for one Deck Watch Log page (one day or one entry).
// Produces an A4 table page that can be shared or printed.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { DeckEntry, VISIBILITY_LABEL } from '../types/deckLog';
import {
  BEAUFORT_LABEL, PERIOD_LABEL, SEA_STATE_LABEL,
  positionStr,
} from './deckLog';
import { formatDateTime } from '../utils/dates';

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

function entryHtml(e: DeckEntry): string {
  const pos = positionStr(e);
  const period = PERIOD_LABEL[e.period] ?? e.period;
  const portMode = e.mode === 'port';

  const navRows = portMode ? '' : [
    pos ? `<tr><td>Position</td><td>${esc(pos)}</td></tr>` : '',
    e.distanceRun !== undefined ? `<tr><td>Distance run</td><td>${e.distanceRun} nm</td></tr>` : '',
    e.courseGyro !== undefined ? `<tr><td>Course (Gyro)</td><td>${e.courseGyro}°T</td></tr>` : '',
    e.courseMagnetic !== undefined ? `<tr><td>Course (Mag)</td><td>${e.courseMagnetic}°</td></tr>` : '',
    (e.speed !== undefined || e.rpm !== undefined) ? `<tr><td>Speed / RPM</td><td>${e.speed !== undefined ? `${e.speed} kn` : '—'} / ${e.rpm !== undefined ? `${e.rpm} rpm` : '—'}</td></tr>` : '',
  ].filter(Boolean).join('');

  const weatherRows = [
    (e.windDir || e.windBft !== undefined) ? `<tr><td>Wind</td><td>${e.windDir ?? ''} ${e.windBft !== undefined ? BEAUFORT_LABEL[e.windBft] : ''}</td></tr>` : '',
    (!portMode && e.seaState !== undefined) ? `<tr><td>Sea state</td><td>${SEA_STATE_LABEL[e.seaState]}</td></tr>` : '',
    (!portMode && e.visibility) ? `<tr><td>Visibility</td><td>${VISIBILITY_LABEL[e.visibility]}</td></tr>` : '',
    (portMode && e.wxCondition) ? `<tr><td>Conditions</td><td>${esc(e.wxCondition)}</td></tr>` : '',
    e.tempAir !== undefined ? `<tr><td>Air temp</td><td>${e.tempAir}°C</td></tr>` : '',
    (!portMode && e.pressure !== undefined) ? `<tr><td>Pressure</td><td>${e.pressure} hPa</td></tr>` : '',
  ].filter(Boolean).join('');

  const remarksRow = e.remarks ? `<tr><td colspan="2" class="rem">${esc(e.remarks)}</td></tr>` : '';

  const sigRow = `<tr class="sig-row"><td>Signed by</td><td>${esc(e.by)}${e.byRank ? ` (${esc(e.byRank)})` : ''}<br><small>${formatDateTime(e.at)}</small></td></tr>`;
  const masterRow = e.masterAt
    ? `<tr class="sig-row"><td>Master review</td><td>${esc(e.masterBy ?? '')}${e.masterByRank ? ` (${esc(e.masterByRank)})` : ''}<br><small>${formatDateTime(e.masterAt)}</small></td></tr>`
    : '';

  return `
    <table class="entry">
      <thead><tr><th colspan="2">${esc(period)} &ensp; ${dmy(e.date)} ${e.time}</th></tr></thead>
      <tbody>
        ${navRows}
        ${weatherRows}
        ${remarksRow}
        ${sigRow}
        ${masterRow}
      </tbody>
    </table>`;
}

function buildHtml(entries: DeckEntry[], date: string, vessel: VesselInfo | null): string {
  const title = `Deck Watch Log — ${dmy(date)}`;
  const sub = vesselHeader(vessel);
  const tables = entries.map(entryHtml).join('<div class="gap"></div>');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 14mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9.5px; color: #0B2545; }
    h1 { font-size: 14px; margin: 0; }
    .sub { color: #5b6b7e; font-size: 9px; margin: 2px 0 10px; }
    table.entry { border-collapse: collapse; width: 100%; margin-bottom: 0; }
    table.entry thead th { background: #0B2545; color: #fff; padding: 4px 6px; text-align: left; font-size: 10px; }
    table.entry tbody td { border: .5px solid #c8d0db; padding: 4px 6px; vertical-align: top; }
    table.entry tbody td:first-child { width: 28%; color: #5b6b7e; font-weight: 600; }
    .rem { font-style: italic; }
    .sig-row td { background: #f5f7fa; }
    .gap { height: 8px; }
    small { font-size: 8px; color: #8a97a8; }
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${esc(sub)}</div>
    ${tables || '<p>No entries for this date.</p>'}
  </body></html>`;
}

export async function shareDeckLogPage(
  entries: DeckEntry[],
  date: string,
  vessel: VesselInfo | null,
): Promise<void> {
  if (onWindows) throw new Error('PDF is not available on Windows.');
  const dStr = date.replace(/-/g, '');
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const name = `DeckLog_${dStr}${vName ? `_${vName}` : ''}.pdf`;
  const html = buildHtml(entries, date, vessel);
  if (onWeb) {
    const htmlName = name.replace(/\.pdf$/, '.html');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const saved = await saveFileWeb(blob, htmlName, 'reports');
    if (!saved) {
      // Fallback: open in new tab for printing
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

/** Print a single entry (share sheet). */
export async function shareDeckEntry(entry: DeckEntry, vessel: VesselInfo | null): Promise<void> {
  return shareDeckLogPage([entry], entry.date, vessel);
}
