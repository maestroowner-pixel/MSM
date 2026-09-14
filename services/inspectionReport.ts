// ===================================
// Inspection reports — the vessel's record of what was actually done.
//
// Distinct from the register export (services/export.ts), and the distinction is
// the whole point: the register answers "what is due?", this answers "what did
// we do, who did it, and when?". A surveyor asks for both, and only one of them
// existed before.
//
// Three sections, in the order somebody reading it needs them:
//   1. What was inspected in the period — the evidence.
//   2. What was NOT — the gap, which is the part a report is usually written to
//      hide. Printing it is deliberate: a monthly report that silently omits the
//      forty items nobody looked at is worse than no report, because it reads
//      like a clean sheet. It is also what makes the thing useful DURING the
//      month, as a worklist.
//   3. Outstanding defects — carried forward regardless of when they were raised,
//      because an open defect from March is still open in June.
//
// LSA and FFE separate because that is how the vessel is surveyed.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { EquipmentItem, Group } from '../types/equipment';
import { Inspection, InspectionPeriod, PERIOD_LABEL, verificationText } from '../types/inspection';
import { signatureLine } from '../types/crew';
import { CATEGORY_MAP } from '../constants/categories';
import { ChecklistTemplate, periodsFor } from '../constants/checklists';
import * as inspections from './inspections';
import { defectReason } from './inspections';
import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { printHtmlWeb } from '../utils/webFile';
import { fileDateStamp, formatDate } from '../utils/dates';
import { initialsOf, itemLocation, itemNumber } from '../utils/itemText';

export type ReportScope = Group | 'ALL';

export interface ReportOptions {
  scope: ReportScope;
  period: InspectionPeriod;
  /** Any date inside the window to report on. Defaults to now. */
  ref?: Date;
  /**
   * The vessel's own checklists. They decide which categories owe THIS period's
   * round, so a report built without them would leave out exactly the checks a
   * vessel added for itself — and the "not inspected" section, the one that makes
   * the report a worklist, would quietly under-report.
   */
  templates?: ChecklistTemplate[];
}

export interface ReportData {
  title: string;
  windowLabel: string;
  scope: ReportScope;
  period: InspectionPeriod;
  /** Items the period's round applies to. */
  inScope: EquipmentItem[];
  /** Signed in the window, newest first. */
  done: Inspection[];
  /** In scope, with nothing signed in the window. */
  missed: EquipmentItem[];
  /** Open defects on in-scope items, whenever they were raised. */
  defects: Inspection[];
  /** Whether every in-scope item was inspected in the window. */
  completed: boolean;
  /** Pass/fail of the round: each item judged by its LATEST record in the window,
   *  so an item that failed and was re-inspected clean is not held against it.
   *  null while nothing has been signed. */
  passed: boolean | null;
  /** "September 2026 Monthly Inspection – Completed – Passed": the line a vessel
   *  files as its evidence in the PMS, stated rather than left to be worked out. */
  headline: string;
  /** "September 2026" / "Week 37 · 07–13 Sep 2026" — English and locale-proof,
   *  because a report handed to a surveyor should not change language with the
   *  browser it was printed from. */
  periodName: string;
}

const SCOPE_LABEL: Record<ReportScope, string> = {
  // "All equipment", not "LSA & FFE": the ALL filter passes every group, Other
  // included, and a title that names two of the three misdescribes its own
  // contents — the one thing an inspection report may never do.
  ALL: 'All equipment',
  LSA: 'LSA',
  FFE: 'FFE',
  OTHER: 'Other equipment',
};

/**
 * Assemble the report. Pure — takes the register and the trail, returns the
 * three sections — so the same data drives PDF, XLSX and anything added later,
 * and so the numbers can never disagree between formats.
 */
export function buildReport(
  flat: EquipmentItem[],
  trail: Inspection[],
  opts: ReportOptions
): ReportData {
  const ref = opts.ref ?? new Date();
  const window = inspections.windowFor(opts.period, ref);

  // In scope = right group, and the category actually has this period's round.
  const inScope = flat.filter((it) => {
    const meta = CATEGORY_MAP[it.category];
    if (!meta) return false;
    if (opts.scope !== 'ALL' && meta.group !== opts.scope) return false;
    return periodsFor(it.category, opts.templates ?? []).includes(opts.period);
  });

  const scopeIds = new Set(inScope.map((i) => i.id));
  const done = inspections
    .inRange(trail, window.from, window.to)
    .filter((i) => i.period === opts.period && scopeIds.has(i.itemId));

  const inspectedIds = new Set(done.map((i) => i.itemId));
  const missed = inScope.filter((it) => !inspectedIds.has(it.id));

  const defects = inspections.openDefects(trail).filter((i) => scopeIds.has(i.itemId));

  // `done` is newest first, so the first record seen per item is its latest.
  const latest = new Map<string, Inspection>();
  for (const i of done) if (!latest.has(i.itemId)) latest.set(i.itemId, i);
  const passed = latest.size ? ![...latest.values()].some((i) => i.outcome === 'fail') : null;
  const completed = inScope.length > 0 && missed.length === 0;

  const periodName = periodNameFor(opts.period, window.from, window.to);
  const headline = [
    `${periodName} ${PERIOD_LABEL[opts.period]} Inspection`,
    !inScope.length
      ? 'Nothing in scope'
      : completed
        ? 'Completed'
        : `Incomplete (${inScope.length - missed.length} of ${inScope.length} inspected)`,
    passed == null ? null : passed ? 'Passed' : 'Failed',
  ]
    .filter(Boolean)
    .join(' – ');

  return {
    title: `${SCOPE_LABEL[opts.scope]} ${PERIOD_LABEL[opts.period]} Inspection Report`,
    windowLabel: window.label,
    scope: opts.scope,
    period: opts.period,
    inScope,
    done,
    missed,
    defects,
    completed,
    passed,
    headline,
    periodName,
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MON = MONTH_NAMES.map((m) => m.slice(0, 3));

/** ISO-8601 week number of a local date. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function periodNameFor(period: InspectionPeriod, from: number, to: number): string {
  const a = new Date(from);
  if (period !== 'weekly') return `${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
  const b = new Date(to - 1);
  const dd = (x: Date) => String(x.getDate()).padStart(2, '0');
  const range =
    a.getMonth() === b.getMonth()
      ? `${dd(a)}–${dd(b)} ${MON[b.getMonth()]} ${b.getFullYear()}`
      : `${dd(a)} ${MON[a.getMonth()]} – ${dd(b)} ${MON[b.getMonth()]} ${b.getFullYear()}`;
  return `Week ${isoWeek(a)} · ${range}`;
}

/** "13 Sep 2026" and "14:05" as separate cells — the vessel's own sheet has a Date column. */
function dateOnly(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
function timeOnly(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---- Row shaping (shared by both formats) ----------------------------------

function itemName(it?: EquipmentItem): string {
  if (!it) return 'Item no longer in register';
  return it.type || (it.serial ? `S/N ${it.serial}` : '') || (it.no != null ? `No. ${it.no}` : '') || '—';
}

/** The item columns every section shares, in the order the vessel's own list uses. */
function itemCells(it?: EquipmentItem) {
  return {
    no: itemNumber(it),
    location: itemLocation(it),
    item: itemName(it),
    size: it?.size ?? '',
    serial: it?.serial ?? '',
  };
}

/** The inspection's comment and, after it, what failed — one "Comments" cell, so
 *  a defect written up on deck reaches the filed report in the crew's own words. */
function commentsOf(insp: Inspection): string {
  const defect = insp.defect || insp.outcome === 'fail' ? defectReason(insp) : '';
  // A Master signing without a scan says why, and the why belongs where an
  // auditor reads — not only in a column that says "No scan".
  const override = insp.verification?.method === 'override' ? verificationText(insp.verification, timeOnly) : '';
  return [insp.comment?.trim(), defect && `Defect: ${defect}`, override].filter(Boolean).join(' — ');
}

/** The short "Scan" cell: QR when the label was scanned, "No scan" for a Master's override. */
function scanCell(insp: Inspection): string {
  const v = insp.verification;
  if (!v) return '';
  return v.method === 'override' ? 'No scan' : 'QR';
}

function doneRows(data: ReportData, flat: EquipmentItem[]) {
  return data.done.map((insp) => {
    const it = flat.find((e) => e.id === insp.itemId);
    const b = inspections.resultBreakdown(insp);
    return {
      ...itemCells(it),
      date: dateOnly(insp.at),
      time: timeOnly(insp.at),
      category: CATEGORY_MAP[insp.category]?.label ?? insp.category,
      initials: initialsOf(insp.by),
      by: signatureLine(insp.by, insp.byRank),
      result: insp.outcome === 'fail' ? 'FAIL' : 'PASS',
      detail: `${b.passed}/${b.passed + b.failed + b.na}`,
      defect: defectReason(insp),
      comment: insp.comment ?? '',
      comments: commentsOf(insp),
      scan: scanCell(insp),
      scanFull: verificationText(insp.verification, timeOnly),
    };
  });
}

function missedRows(data: ReportData, trail: Inspection[]) {
  return data.missed.map((it) => {
    const last = inspections.lastForItem(trail, it.id, data.period);
    return {
      ...itemCells(it),
      category: CATEGORY_MAP[it.category]?.label ?? it.category,
      last: last ? `${dateOnly(last.at)} ${timeOnly(last.at)}` : 'Never',
      lastBy: last ? initialsOf(last.by) : '',
      lastByFull: last ? signatureLine(last.by, last.byRank) : '',
    };
  });
}

function defectRows(data: ReportData, flat: EquipmentItem[]) {
  return data.defects.map((insp) => {
    const it = flat.find((e) => e.id === insp.itemId);
    const days = Math.floor((Date.now() - insp.at) / 86_400_000);
    return {
      ...itemCells(it),
      raised: `${dateOnly(insp.at)} ${timeOnly(insp.at)}`,
      age: `${days}d`,
      category: CATEGORY_MAP[insp.category]?.label ?? insp.category,
      defect: defectReason(insp),
      comments: insp.comment?.trim() ?? '',
      initials: initialsOf(insp.by),
      by: signatureLine(insp.by, insp.byRank),
    };
  });
}

/** Initials are what fit in a column; an audit still needs the names behind them. */
function signatureKey(data: ReportData, trail: Inspection[]): Array<{ initials: string; name: string }> {
  const seen = new Map<string, string>();
  const note = (i?: Inspection | null) => {
    if (!i) return;
    const name = signatureLine(i.by, i.byRank);
    if (!seen.has(name)) seen.set(name, initialsOf(i.by));
  };
  data.done.forEach(note);
  data.defects.forEach(note);
  data.missed.forEach((it) => note(inspections.lastForItem(trail, it.id, data.period)));
  return [...seen.entries()].map(([name, initials]) => ({ initials, name }));
}

// ---- PDF -------------------------------------------------------------------

function buildHtml(data: ReportData, flat: EquipmentItem[], trail: Inspection[], vessel: VesselInfo | null): string {
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const pct = data.inScope.length
    ? Math.round((data.done.length / data.inScope.length) * 100)
    : 0;

  const done = doneRows(data, flat)
    .map(
      (r) => `<tr>
        <td class="nw">${esc(r.no)}</td>
        <td>${esc(r.location)}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.item)}</td>
        <td class="nw">${esc(r.size)}</td>
        <td class="nw">${esc(r.serial)}</td>
        <td class="c ${r.result === 'FAIL' ? 'fail' : 'pass'}">${r.result}</td>
        <td class="wr">${esc(r.comments)}</td>
        <td class="c">${esc(r.initials)}</td>
        <td class="nw">${esc(r.date)}</td>
        <td class="nw">${esc(r.time)}</td>
        <td class="c ${r.scan === 'No scan' ? 'fail' : ''}">${esc(r.scan)}</td>
      </tr>`
    )
    .join('');

  const missed = missedRows(data, trail)
    .map(
      (r) => `<tr>
        <td class="nw">${esc(r.no)}</td>
        <td>${esc(r.location)}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.item)}</td>
        <td class="nw">${esc(r.size)}</td>
        <td class="nw">${esc(r.serial)}</td>
        <td class="nw">${esc(r.last)}</td>
        <td class="c">${esc(r.lastBy)}</td>
      </tr>`
    )
    .join('');

  const defects = defectRows(data, flat)
    .map(
      (r) => `<tr>
        <td class="nw">${esc(r.raised)}</td>
        <td class="c">${esc(r.age)}</td>
        <td class="nw">${esc(r.no)}</td>
        <td>${esc(r.location)}</td>
        <td>${esc(r.item)}</td>
        <td class="nw">${esc(r.serial)}</td>
        <td class="wr">${esc([r.defect, r.comments].filter(Boolean).join(' — '))}</td>
        <td class="c">${esc(r.initials)}</td>
      </tr>`
    )
    .join('');

  const key = signatureKey(data, trail);
  const verdictClass = data.passed === false ? 'fail' : data.completed && data.passed ? 'pass' : 'open';

  const section = (title: string, count: number, head: string, body: string, emptyText: string) =>
    `<h2>${esc(title)} <span class="count">(${count})</span></h2>` +
    (count
      ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
      : `<p class="empty">${esc(emptyText)}</p>`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <meta name="color-scheme" content="light" />
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      /* Paper is white whatever theme the browser is in — a dark-mode browser
         otherwise renders this document grey-on-black in its preview. */
      :root { color-scheme: light; }
      html, body { background: #fff; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2C3E50; }
      h1 { color: #1F5670; margin-bottom: 2px; font-size: 18px; }
      .meta { color: #7F8C8D; font-size: 11px; margin-bottom: 10px; }
      .summary {
        display: flex; gap: 8px; margin: 10px 0 4px;
      }
      .stat {
        border: 1px solid #E0E6ED; border-radius: 4px; padding: 6px 10px; min-width: 90px;
      }
      .stat .v { font-size: 16px; font-weight: bold; color: #1F5670; }
      .stat .k { font-size: 9px; color: #7F8C8D; text-transform: uppercase; letter-spacing: .4px; }
      .stat.bad .v { color: #E74C3C; }
      h2 { color: #2E7D99; font-size: 13px; margin: 16px 0 5px; }
      .count { color: #7F8C8D; font-weight: normal; }
      .empty { color: #7F8C8D; font-size: 10px; font-style: italic; margin: 2px 0 0; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; }
      th, td {
        border: 1px solid #E0E6ED; padding: 3px 5px; text-align: left; vertical-align: top;
      }
      th { background: #DAEEF7; }
      td.nw, th.nw { white-space: nowrap; }
      td.c, th.c { text-align: center; }
      td.wr { word-break: break-word; }
      .pass { color: #27AE60; font-weight: bold; }
      .fail { color: #E74C3C; font-weight: bold; }
      .verdict {
        margin: 8px 0 4px; padding: 7px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;
        border: 1.5px solid #E0E6ED;
      }
      .verdict.pass { color: #1E8449; border-color: #27AE60; background: #EAF7EE; }
      .verdict.fail { color: #C0392B; border-color: #E74C3C; background: #FDEDEC; }
      .verdict.open { color: #9A6A00; border-color: #F39C12; background: #FEF5E7; }
      .key { margin-top: 10px; font-size: 9px; color: #7F8C8D; }
      .sign { margin-top: 22px; font-size: 10px; color: #2C3E50; }
      .sign .line { display: inline-block; border-bottom: 1px solid #2C3E50; width: 220px; margin: 0 24px 0 6px; }
    </style></head>
    <body>
      <h1>${esc(data.title)}</h1>
      <div class="meta">${esc(vesselHeader(vessel))} — ${esc(data.periodName)} — generated ${today}</div>
      <div class="verdict ${verdictClass}">${esc(data.headline)}</div>

      <div class="summary">
        <div class="stat"><div class="v">${data.inScope.length}</div><div class="k">In scope</div></div>
        <div class="stat"><div class="v">${data.done.length}</div><div class="k">Inspected</div></div>
        <div class="stat${data.missed.length ? ' bad' : ''}"><div class="v">${data.missed.length}</div><div class="k">Outstanding</div></div>
        <div class="stat${data.defects.length ? ' bad' : ''}"><div class="v">${data.defects.length}</div><div class="k">Open defects</div></div>
        <div class="stat"><div class="v">${pct}%</div><div class="k">Complete</div></div>
      </div>

      ${section(
        'Inspections carried out',
        data.done.length,
        '<th class="nw">No.</th><th>Location</th><th>Category</th><th>Type</th><th>Size</th><th>Serial</th><th class="c">Result</th><th>Comments</th><th class="c">Initials</th><th>Date</th><th>Time</th><th class="c">Scan</th>',
        done,
        'No inspections were recorded in this period.'
      )}

      ${section(
        'Not inspected in this period',
        data.missed.length,
        '<th class="nw">No.</th><th>Location</th><th>Category</th><th>Type</th><th>Size</th><th>Serial</th><th class="nw">Last inspected</th><th class="c">By</th>',
        missed,
        'Every item in scope was inspected.'
      )}

      ${section(
        'Outstanding defects',
        data.defects.length,
        '<th class="nw">Raised</th><th class="c">Age</th><th class="nw">No.</th><th>Location</th><th>Type</th><th>Serial</th><th>What failed / comments</th><th class="c">By</th>',
        defects,
        'No outstanding defects.'
      )}

      ${key.length
        ? `<div class="key">Initials: ${key.map((k) => `${esc(k.initials)} = ${esc(k.name)}`).join(' · ')}</div>`
        : ''}

      <div class="sign">
        Checked by:<span class="line"></span>Rank:<span class="line"></span>Date:<span class="line"></span>
      </div>
    </body></html>`;
}

/** Report title used for the file name — no spaces, no punctuation surprises. */
function fileStem(data: ReportData): string {
  // Matches SCOPE_LABEL: the file is named after what it actually contains, so
  // a folder of exports can be read without opening them.
  const scope = data.scope === 'ALL' ? 'ALL' : data.scope;
  // The period REPORTED ON, not the day it was printed: September's report run on
  // 2 October must not file as October's.
  const w = data.periodName.replace(/^Week (\d+).*?(\d{4})$/, 'W$1_$2').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
  return `MSM_${scope}_${data.period}_${w || fileDateStamp()}`;
}

export async function exportReportPdf(
  flat: EquipmentItem[],
  trail: Inspection[],
  vessel: VesselInfo | null,
  opts: ReportOptions
): Promise<ReportData> {
  if (onWindows) {
    throw new Error('PDF export is not available on Windows — use XLSX.');
  }
  const data = buildReport(flat, trail, opts);
  const html = buildHtml(data, flat, trail, vessel);
  const fileName = `${fileStem(data)}.pdf`;

  if (onWeb) {
    // No jsPDF path for this layout yet — the browser's own print-to-PDF keeps
    // the table styling, which is the part that matters here.
    printHtmlWeb(html);
    return data;
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
  return data;
}

export async function printReport(
  flat: EquipmentItem[],
  trail: Inspection[],
  vessel: VesselInfo | null,
  opts: ReportOptions
): Promise<ReportData> {
  if (onWindows) throw new Error('Printing is not available on Windows.');
  const data = buildReport(flat, trail, opts);
  const html = buildHtml(data, flat, trail, vessel);
  if (onWeb) printHtmlWeb(html);
  else await Print.printAsync({ html });
  return data;
}

// ---- XLSX ------------------------------------------------------------------

export async function exportReportXlsx(
  flat: EquipmentItem[],
  trail: Inspection[],
  vessel: VesselInfo | null,
  opts: ReportOptions
): Promise<ReportData> {
  const data = buildReport(flat, trail, opts);
  const header = vesselHeader(vessel);
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const wb = XLSX.utils.book_new();

  const summary = [
    [header],
    [data.title],
    [data.headline],
    [`Generated ${today}`],
    [],
    ['Period', data.periodName],
    ['Status', data.completed ? 'Completed' : 'Incomplete'],
    ['Result', data.passed == null ? '—' : data.passed ? 'Passed' : 'Failed'],
    ['In scope', data.inScope.length],
    ['Inspected', data.done.length],
    ['Outstanding', data.missed.length],
    ['Open defects', data.defects.length],
    [],
    ['Initials', 'Signed by'],
    ...signatureKey(data, trail).map((k) => [k.initials, k.name]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  const done = [
    ['No.', 'Location', 'Category', 'Type', 'Size', 'Serial', 'Result', 'Lines passed', 'Comments', 'Initials', 'Date', 'Time', 'Inspected by', 'Scan'],
    ...doneRows(data, flat).map((r) => [
      r.no, r.location, r.category, r.item, r.size, r.serial, r.result, r.detail, r.comments, r.initials, r.date, r.time, r.by, r.scanFull,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(done), 'Inspections');

  const missed = [
    ['No.', 'Location', 'Category', 'Type', 'Size', 'Serial', 'Last inspected', 'By'],
    ...missedRows(data, trail).map((r) => [r.no, r.location, r.category, r.item, r.size, r.serial, r.last, r.lastByFull]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(missed), 'Not inspected');

  const defects = [
    ['Raised', 'Age', 'No.', 'Location', 'Category', 'Type', 'Serial', 'What failed', 'Comments', 'Raised by'],
    ...defectRows(data, flat).map((r) => [r.raised, r.age, r.no, r.location, r.category, r.item, r.serial, r.defect, r.comments, r.by]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(defects), 'Open defects');

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await deliverFile(
    `${fileStem(data)}.xlsx`,
    b64,
    true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  return data;
}
