// ===================================
// The report of one inspection round — what was done in it, by whom (name,
// rank, date, time), and what is still outstanding; per category totals and a
// signature key. PDF (print to PDF in a browser, a shared file on a phone) and
// Excel. Jez, 11 Oct 2026: "an inspection report for that specific round …
// showing the inspections carried out by each crew member".
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { RoundProgress } from './rounds';
import { InspectionRound } from '../types/round';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Inspection } from '../types/inspection';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { printHtmlWeb } from '../utils/webFile';
import { saveFileWeb } from '../utils/webSave';

const two = (n: number) => String(n).padStart(2, '0');
const dt = (t: number) => {
  const d = new Date(t);
  return { date: `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`, time: `${two(d.getHours())}:${two(d.getMinutes())}` };
};

export const DONE_HEAD = ['No.', 'Location', 'Category', 'Type', 'Serial', 'Result', 'Comments', 'Inspected by', 'Date', 'Time'];
export const OUT_HEAD = ['No.', 'Location', 'Category', 'Type', 'Serial'];

export function roundRows(p: RoundProgress, labelOf: (c: CategoryKey) => string) {
  const done = p.scope
    .filter((it) => p.done.has(it.id))
    .map((it) => {
      const i = p.done.get(it.id) as Inspection;
      const { date, time } = dt(i.at);
      const photos = (i.photos ?? []).filter((x) => x.kind === 'photo').length;
      return [
        itemNumber(it), itemLocation(it), labelOf(it.category), typeWithSize(it), it.serial ?? '',
        i.outcome === 'fail' ? 'FAIL' : 'PASS',
        [i.comment?.trim(), i.defect?.note ? `Defect: ${i.defect.note}` : '', photos ? `Photos: ${photos}` : ''].filter(Boolean).join(' — '),
        i.byRank ? `${i.by} (${i.byRank})` : i.by, date, time,
      ];
    });
  const out = p.outstanding.map((it: EquipmentItem) => [itemNumber(it), itemLocation(it), labelOf(it.category), typeWithSize(it), it.serial ?? '']);
  // Who did how many — the round is often shared.
  const people = new Map<string, number>();
  for (const i of p.done.values()) {
    const k = i.byRank ? `${i.by} (${i.byRank})` : i.by;
    people.set(k, (people.get(k) ?? 0) + 1);
  }
  const cats = [...p.byCategory.entries()].map(([c, n]) => [labelOf(c), `${n.done} / ${n.total}`]);
  return { done, out, people: [...people.entries()], cats };
}

function fileStem(round: InspectionRound, vessel: VesselInfo | null) {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Inspection round ${round.period} ${round.label}${v ? ` - ${v}` : ''}`.replace(/[·\\/:*?"<>|]+/g, '-');
}

function html(round: InspectionRound, title: string, p: RoundProgress, vessel: VesselInfo | null, labelOf: (c: CategoryKey) => string): string {
  const r = roundRows(p, labelOf);
  const total = p.scope.length;
  const done = p.done.size;
  const table = (head: string[], rows: string[][], empty: string) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}">${esc(empty)}</td></tr>`}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 10mm; } body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 6px; } h2 { font-size: 10px; text-transform: uppercase; margin: 10px 0 3px; }
    table { border-collapse: collapse; width: 100%; } td, th { border: .5px solid #c8d0db; padding: 2px 4px; text-align: left; vertical-align: top; } th { background: #eef2f7; }
    .big { font-size: 13px; font-weight: 700; margin: 4px 0; }
  </style></head><body>
    <h1>Inspection round — ${esc(title)}</h1>
    <div class="sub">${esc(vesselHeader(vessel))} · started ${esc(dt(round.startedAt).date)} by ${esc(round.startedByRank ? `${round.startedBy} (${round.startedByRank})` : round.startedBy)}${round.closedAt ? ` · closed ${esc(dt(round.closedAt).date)}${round.closedBy ? ` by ${esc(round.closedBy)}` : ''}` : ' · open'}</div>
    <div class="big">${done} of ${total} inspected · ${total - done} outstanding</div>
    ${table(['Category', 'Inspected'], r.cats, '—')}
    <h2>Inspected in this round (${r.done.length})</h2>
    ${table(DONE_HEAD, r.done, 'Nothing yet.')}
    <h2>Outstanding (${r.out.length})</h2>
    ${table(OUT_HEAD, r.out, 'Nothing outstanding — the round is complete.')}
    <h2>Carried out by</h2>
    ${table(['Name', 'Inspections'], r.people.map(([n, c]) => [n, String(c)]), '—')}
  </body></html>`;
}

export async function exportRoundPdf(round: InspectionRound, title: string, p: RoundProgress, vessel: VesselInfo | null, labelOf: (c: CategoryKey) => string): Promise<void> {
  if (onWindows) throw new Error('PDF export is not available on Windows — use Excel.');
  const h = html(round, title, p, vessel, labelOf);
  if (onWeb) return printHtmlWeb(h);
  const name = `${fileStem(round, vessel)}.pdf`;
  const { uri } = await Print.printToFileAsync({ html: h, width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export async function exportRoundExcel(round: InspectionRound, title: string, p: RoundProgress, vessel: VesselInfo | null, labelOf: (c: CategoryKey) => string): Promise<string | null | void> {
  const r = roundRows(p, labelOf);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    [`Inspection round — ${title}`], [vesselHeader(vessel)], [], [`${p.done.size} of ${p.scope.length} inspected`, `${p.outstanding.length} outstanding`], [],
    ['Category', 'Inspected'], ...r.cats, [], ['Carried out by', 'Inspections'], ...r.people.map(([n, c]) => [n, c]),
  ]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([DONE_HEAD, ...r.done]), 'Inspected');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([OUT_HEAD, ...r.out]), 'Outstanding');
  const name = `${fileStem(round, vessel)}.xlsx`;
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: mime }), name, 'reports');
  }
  await deliverFile(name, b64, true, mime);
}
