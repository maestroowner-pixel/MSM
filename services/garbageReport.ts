// ===================================
// The Garbage Record Book, Part I, for a month — PDF (as the book's page) and
// Excel. Columns as in the MEPC.295(71) form: date/time, position or port,
// category, estimated amount (m³) into the sea / to a reception facility /
// incinerated / accidental, remarks, the officer's signature; the Master's
// signature for the month at the foot.
//
// Since 2.68 the PDF is a certified true copy (utils/trueCopyPdf, MEPC.312 §6.3)
// — earlier versions struck under their replacement, the officer's ID and entry
// time, each entry's verification stage, and the true-copy footer on every page.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { entryItems, garbageMonth, placeText } from './garbage';
import { GARBAGE_CATEGORY, GarbageEntry, GarbageMasterSign } from '../types/garbage';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { deliverTrueCopy } from '../utils/trueCopyPdf';
import { awaiting, copyRows, integrityLines, monthIntegrity, verificationLines, verifiedIds } from './verification';
import type { TrueCopy } from './trueCopy';

export const gDmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export function gMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** One row per entry, in the book's column order. */
export function grbRows(entries: GarbageEntry[]): string[][] {
  const v = (x: number) => String(Math.round(x * 1000) / 1000);
  return entries.map((e) => {
    // One operation on one line: every category with its amount, the total in the method's column.
    const items = entryItems(e);
    const sum = items.reduce((n, i) => n + i.volume, 0);
    return [
    `${gDmy(e.date)} ${e.time}`,
    placeText(e),
    items.map((i) => `${i.category} — ${GARBAGE_CATEGORY[i.category]}${items.length > 1 ? ` ${v(i.volume)}` : ''}`).join('\n'),
    e.method === 'sea' && !e.cancelled ? v(sum) : '',
    e.method === 'shore' && !e.cancelled ? v(sum) : '',
    e.method === 'incineration' && !e.cancelled ? v(sum) : '',
    e.method === 'accidental' && !e.cancelled ? v(sum) : '',
    [e.cancelled ? `CANCELLED — ${e.editReason ?? ''} (${e.by})` : e.supersedes ? `Amended — ${e.editReason ?? ''} (${e.by})` : '', e.containerNo ? `Container ${e.containerNo}` : '', e.receiptNo ? `Receipt ${e.receiptNo}` : '', e.comminuted ? 'comminuted' : '', e.remarks ?? ''].filter(Boolean).join('; '),
    e.byRank ? `${e.by} (${e.byRank})` : e.by,
  ];
  });
}

export const GRB_HEAD = ['Date / time', 'Position of the ship / port', 'Category', 'Into sea, m³', 'To reception facility, m³', 'Incinerated, m³', 'Accidental, m³', 'Remarks', 'Officer in charge'];

/** The true copy: the book's columns, the officer with ID and time, and the Master's verification. */
export const GRB_COPY_HEAD = [...GRB_HEAD.slice(0, -1), 'Officer in charge', "Master's verification"];
export const grbCopyRows = (book: GarbageEntry[], all: GarbageEntry[], signs: GarbageMasterSign[]) => copyRows(book, all, signs, (r) => grbRows([r])[0].slice(0, -1), 7);

export function grbFileName(vessel: VesselInfo | null, month: string, ext: 'pdf' | 'xlsx') {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Garbage record book-${month.slice(5, 7)}${month.slice(2, 4)}${v ? `-${v}` : ''}.${ext}`;
}

function html(entries: GarbageEntry[], month: string, vessel: VesselInfo | null, sign?: GarbageMasterSign): string {
  const rows = grbRows(entries).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; } body { margin: 10mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } .sub { color: #5b6b7e; margin: 2px 0 8px; } table { border-collapse: collapse; width: 100%; }
    td, th { border: 0.5px solid #c8d0db; padding: 3px 4px; vertical-align: top; } th { background: #eef2f7; font-size: 8px; text-align: left; }
    .sig { margin-top: 24px; width: 45%; margin-left: auto; border-top: 0.8px solid #0B2545; padding-top: 3px; }
  </style></head><body>
    <h1>Garbage Record Book — Part I · ${esc(gMonthLabel(month))}</h1>
    <div class="sub">${esc(vesselHeader(vessel))} · MARPOL Annex V · categories A–I</div>
    <table><thead><tr>${GRB_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="9">No entries this month.</td></tr>'}</tbody></table>
    <div class="sig">Master's signature: ${sign ? `${esc(sign.by)}${sign.byRank ? ` (${esc(sign.byRank)})` : ''}, ${gDmy(new Date(sign.at).toISOString().slice(0, 10))}` : ''}</div>
  </body></html>`;
}

/** The month's certified true copy and its file name — the PDF, and the Master's signed copy (services/signedCopy). */
export function grbCopy(all: GarbageEntry[], month: string, vessel: VesselInfo | null, signs: GarbageMasterSign[]): { copy: TrueCopy; fileName: string } {
  const entries = garbageMonth(all, month).entries;
  const fileName = grbFileName(vessel, month, 'pdf');
  const { rows, struck } = grbCopyRows(entries, all, signs);
  const copy = {
    title: `Garbage Record Book — Part I · ${gMonthLabel(month)}`,
    subtitle: `${vesselHeader(vessel)} · MARPOL Annex V · categories A–I`,
    vessel: [vessel?.vessel_name, vessel?.imo ? `IMO ${vessel.imo}` : null].filter(Boolean).join(' · ') || 'Vessel',
    orientation: 'landscape' as const,
    head: GRB_COPY_HEAD,
    rows,
    struck,
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 36 }, 2: { cellWidth: 32 }, 3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 18, halign: 'right' }, 5: { cellWidth: 16, halign: 'right' }, 6: { cellWidth: 16, halign: 'right' }, 8: { cellWidth: 38 }, 9: { cellWidth: 32 } },
    verifications: verificationLines(signs.filter((s) => s.month === month)),
    integrity: integrityLines(monthIntegrity(entries, all, signs, month)),
    awaiting: awaiting(entries, verifiedIds(all, signs)).length,
  };
  return { copy, fileName };
}

export async function exportGarbagePdf(all: GarbageEntry[], month: string, vessel: VesselInfo | null, signs: GarbageMasterSign[]): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const { copy, fileName } = grbCopy(all, month, vessel, signs);
  const entries = garbageMonth(all, month).entries;
  if (onWeb) return deliverTrueCopy(copy, fileName);
  try {
    return await deliverTrueCopy(copy, fileName);
  } catch {
    // jsPDF failed on this phone: the plain page, without the true-copy footer.
  }
  const { uri } = await Print.printToFileAsync({ html: html(entries, month, vessel, signs[signs.length - 1]), width: 842, height: 595 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

export async function exportGarbageExcel(all: GarbageEntry[], month: string, vessel: VesselInfo | null, signs: GarbageMasterSign[] = []): Promise<string | null | void> {
  const m = garbageMonth(all, month);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[`Garbage Record Book — Part I · ${gMonthLabel(month)}`], [vesselHeader(vessel)], [], GRB_COPY_HEAD, ...grbCopyRows(m.entries, all, signs).rows, [], ...verificationLines(signs.filter((s) => s.month === month)).map((l) => [l])]);
  ws['!cols'] = GRB_COPY_HEAD.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Part I');
  const sum = XLSX.utils.aoa_to_sheet([['Category', 'Into sea, m³', 'To reception facility, m³', 'Incinerated, m³', 'Accidental, m³'], ...(Object.keys(m.totals) as (keyof typeof m.totals)[]).map((c) => [`${c} — ${GARBAGE_CATEGORY[c]}`, m.totals[c].sea, m.totals[c].shore, m.totals[c].incineration, m.totals[c].accidental])]);
  sum['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, sum, 'Totals');
  const fileName = grbFileName(vessel, month, 'xlsx');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: mime }), fileName, 'reports');
  }
  await deliverFile(fileName, b64, true, mime);
}
