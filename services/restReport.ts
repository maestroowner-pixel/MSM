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

/**
 * One-line codes for the Breach column; the full wording is in the numbered
 * list under the table. The long labels wrapped letter by letter in a narrow
 * column and stretched their rows three times over (9 Oct 2026).
 */
const RULE_CODE: Record<string, string> = { '24h': '10h/24h', '7d': '77h/7d', split: 'periods', gap: '14h gap' };

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
        <td class="b">${[...new Set(s.violations.map((v) => RULE_CODE[v.rule] ?? v.rule))].map(esc).join(' ')}</td>
        <td class="note">${rec?.note ? esc(rec.note) : ''}</td></tr>`;
    })
    .join('');

  const breachList = breaches.length
    ? `<ol>${breaches.map((b) => `<li><b>${esc(b.date)}</b> — ${esc(RULE_LABEL[b.rule])}: ${esc(b.detail)}</li>`).join('')}</ol>`
    : '<p>No breach of the rest-hour rules is shown by this record.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    /* Page margin 0 and the margin on the body instead: with any @page margin the
       browser prints its own header and footer in it — the date, the tab title
       and the localhost address were on the saved record. */
    @page { size: A4 landscape; margin: 0; }
    body { margin: 9mm 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 15px; margin: 0 0 2px; } .sub { color: #5b6b7e; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    td, th { border: 0.5px solid #c8d0db; padding: 0; height: 14px; overflow: hidden; }
    th { font-size: 7px; font-weight: 600; background: #eef2f7; line-height: 1.1; }
    td.d { text-align: center; font-weight: 600; }
    td.w { background: #0B2545; } td.r { background: #fff; } td.h { border-left: 0.8px solid #8a96a8; }
    td.nr { color: #9aa6b5; text-align: center; font-style: italic; }
    td.n { text-align: center; }
    td.b { padding: 0 2px; font-size: 7px; white-space: nowrap; text-align: center; }
    td.note { padding: 1px 3px; font-size: 7px; line-height: 1.15; }
    tr.bad td.d, tr.bad td.b { color: #c0392b; font-weight: 700; }
    .rules { margin-top: 8px; color: #5b6b7e; } .sig { display: flex; gap: 40px; margin-top: 22px; }
    .sig div { flex: 1; border-top: 0.8px solid #0B2545; padding-top: 3px; }
    ol { margin: 4px 0 0 16px; padding: 0; }
  </style></head><body>
    <h1>Record of hours of rest — ${esc(label)}</h1>
    <div class="sub">${esc(vesselHeader(input.vessel))}<br>
      Seafarer: <b>${esc(input.holderName)}</b>${input.rank ? ` · ${esc(input.rank)}` : ''} · Ship's time · Shaded = work</div>
    <table>
      <colgroup>
        <col style="width:20px">${'<col>'.repeat(SLOTS_PER_DAY)}
        <col style="width:28px"><col style="width:28px"><col style="width:34px"><col style="width:52px"><col style="width:150px">
      </colgroup>
      <thead><tr><th class="d">Day</th>${hourHead}<th>Work<br>h</th><th>Rest<br>h</th><th>Min rest<br>24 h</th><th>Breach</th><th>Note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rules">Rules applied (MLC 2006 Reg. 2.3, STCW A-VIII/1): at least ${RULES.minRest24h} h rest in any 24 h and ${RULES.minRest7d} h in any 7 days;
      rest in no more than two periods, one of at least ${RULES.longestPeriod} h; no more than ${RULES.maxWorkStretch} h between periods of rest.
      Indicative — exceptions permitted by the flag State (drills, emergencies, agreements) are judged by the Master.</div>
    <div class="rules"><b>Breaches shown by this record</b>${breachList}</div>
    <div class="sig"><div>Seafarer — name, signature, date</div><div>Master or authorised person — name, signature, date</div></div>
  </body></html>`;
}

/**
 * "Jez Dodd-1026-MY Alpha_Hours of rest report.pdf" — Name-mmyy-vessel, as
 * asked (9 Oct 2026): a month's records for a whole crew sort by person, then by
 * month, and say which vessel they are from. Characters a file system refuses
 * are dropped; the vessel part is left out when the vessel has no name or IMO.
 */
export function restReportFileName(input: Pick<RestReportInput, 'holderName' | 'month' | 'vessel'>): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = clean(input.holderName) || 'Crew';
  const mmyy = `${input.month.slice(5, 7)}${input.month.slice(2, 4)}`;
  const v = input.vessel?.vessel_name?.trim() || (input.vessel?.imo ? `IMO ${input.vessel.imo}` : '');
  return `${name}-${mmyy}${v ? `-${clean(v)}` : ''}_Hours of rest report.pdf`;
}

export async function exportRestPdf(input: RestReportInput): Promise<void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const html = buildRestHtml(input);
  const fileName = restReportFileName(input);
  if (onWeb) {
    printHtmlWeb(html, fileName);
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
