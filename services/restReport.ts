// ===================================
// Hours of rest — the monthly record for one seafarer, as PDF.
//
// The layout follows the record flags ask for (the ILO/IMO "Guidelines for the
// development of tables of seafarers' shipboard working arrangements and of
// formats of records of seafarers' hours of work or hours of rest"): one row
// per day, the 24 hours across, work shaded, then the day's totals and the
// rolling figures the rules are judged on, and signature lines for the
// seafarer and the Master at the foot — a copy is given to the seafarer.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { RestDay, SLOTS_PER_DAY } from '../types/rest';
import { analyseRest, RULE_LABEL, RULES } from './restHours';
import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { onWeb, onWindows } from '../utils/fileShare';
import { printHtmlWeb } from '../utils/webFile';

export interface RestReportInput {
  holderName: string;
  rank?: string;
  /** yyyy-mm */
  month: string;
  days: RestDay[];
  vessel: VesselInfo | null;
}

function monthRange(month: string): { from: string; to: string; label: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, label };
}

export function buildRestHtml(input: RestReportInput): string {
  const { from, to, label } = monthRange(input.month);
  const summary = analyseRest(input.days, from, to);
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const breaches = summary.flatMap((s) => s.violations);

  const hourHead = Array.from({ length: 24 }, (_, h) => `<th colspan="2" class="hh">${String(h).padStart(2, '0')}</th>`).join('');
  const rows = summary
    .map((s) => {
      const rec = byDate.get(s.date);
      const cells = rec
        ? Array.from({ length: SLOTS_PER_DAY }, (_, i) => `<td class="${rec.work[i] === '1' ? 'w' : 'r'}${i % 2 ? '' : ' h'}"></td>`).join('')
        : `<td colspan="${SLOTS_PER_DAY}" class="nr">not recorded</td>`;
      const bad = s.violations.length ? ' class="bad"' : '';
      return `<tr${bad}><td class="d">${s.date.slice(8)}</td>${cells}
        <td class="n">${rec ? s.workHours : ''}</td><td class="n">${rec ? s.restHours : ''}</td>
        <td class="n">${s.minRest24h ?? ''}</td>
        <td class="v">${s.violations.map((v) => esc(RULE_LABEL[v.rule])).join('<br>')}</td>
        <td class="v">${rec?.note ? esc(rec.note) : ''}</td></tr>`;
    })
    .join('');

  const breachList = breaches.length
    ? `<ol>${breaches.map((b) => `<li><b>${esc(b.date)}</b> — ${esc(RULE_LABEL[b.rule])}: ${esc(b.detail)}</li>`).join('')}</ol>`
    : '<p>No breach of the rest-hour rules is shown by this record.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0 0 2px; } .sub { color: #5b6b7e; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    td, th { border: 0.5px solid #c8d0db; padding: 0; height: 13px; }
    th { font-size: 7.5px; font-weight: 600; background: #eef2f7; }
    th.hh { width: auto; }
    td.d { width: 18px; text-align: center; font-weight: 600; }
    td.w { background: #0B2545; } td.r { background: #fff; } td.h { border-left: 0.8px solid #8a96a8; }
    td.nr { color: #9aa6b5; text-align: center; font-style: italic; }
    td.n { width: 30px; text-align: center; } td.v { width: 90px; padding: 0 3px; font-size: 7.5px; }
    tr.bad td.d, tr.bad td.v { color: #c0392b; font-weight: 700; }
    .rules { margin-top: 8px; color: #5b6b7e; } .sig { display: flex; gap: 40px; margin-top: 22px; }
    .sig div { flex: 1; border-top: 0.8px solid #0B2545; padding-top: 3px; }
    ol { margin: 4px 0 0 16px; padding: 0; }
  </style></head><body>
    <h1>Record of hours of rest — ${esc(label)}</h1>
    <div class="sub">${esc(vesselHeader(input.vessel))}<br>
      Seafarer: <b>${esc(input.holderName)}</b>${input.rank ? ` · ${esc(input.rank)}` : ''} · Ship's time · Shaded = work</div>
    <table>
      <thead><tr><th class="d">Day</th>${hourHead}<th>Work h</th><th>Rest h</th><th>Min rest in 24 h</th><th>Breach</th><th>Note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rules">Rules applied (MLC 2006 Reg. 2.3, STCW A-VIII/1): at least ${RULES.minRest24h} h rest in any 24 h and ${RULES.minRest7d} h in any 7 days;
      rest in no more than two periods, one of at least ${RULES.longestPeriod} h; no more than ${RULES.maxWorkStretch} h between periods of rest.
      Indicative — exceptions permitted by the flag State (drills, emergencies, agreements) are judged by the Master.</div>
    <div class="rules"><b>Breaches shown by this record</b>${breachList}</div>
    <div class="sig"><div>Seafarer — name, signature, date</div><div>Master or authorised person — name, signature, date</div></div>
  </body></html>`;
}

export async function exportRestPdf(input: RestReportInput): Promise<void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const html = buildRestHtml(input);
  const safe = input.holderName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'crew';
  const fileName = `Hours_of_rest_${safe}_${input.month}.pdf`;
  if (onWeb) {
    printHtmlWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}
