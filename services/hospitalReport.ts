// ===================================
// Hospital reports (types/hospital.ts):
//
//   Medicine chest      every item, batch by batch, with expiry and what is short
//                       — PDF; Excel in the same layout as the import sheet, so
//                       the file sent out comes back in as it is.
//   To order            what is short of the scale or expires within 90 days.
//   Controlled drugs    one page per drug: every move with the balance after it,
//                       who and the witness.
//   Medical log         every treatment (officers only) — PDF / Excel.
//   Treatment report    one treatment, for the doctor ashore or the agent.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { sheetRows } from './pmsImport';
import { batchLabel, listNoOf, comparePlace, placeText, ItemStatus, MOVE_LABEL, SHEET_HEAD, daysTo, expiryState, issuedText, receivedByLine, registerLines, sheetOf, sortTreatments, toOrder } from './hospital';
import { proofShort } from './signature';
import { LANDING_REASON_LABEL, MedCheck, MedItem, MedMove, MedOrder, MedTreatment, OUTCOME_LABEL } from '../types/hospital';
import type { SignProof } from './signature';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { saveFileWeb } from '../utils/webSave';
import { medPdfBlob } from '../utils/medPdf';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();
const stem = (name: string, vessel: VesselInfo | null) => {
  const v = clean(vessel?.vessel_name ?? '');
  return `${clean(name)}${v ? `-${v}` : ''}`;
};
const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
/** Ship's time, as on every other record — never UTC. */
const localStamp = (at: number) => {
  const d = new Date(at);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

async function saveXlsx(wb: XLSX.WorkBook, name: string): Promise<string | null | void> {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: MIME }), name, 'reports');
  }
  await deliverFile(name, b64, true, MIME);
}

// ---- the chest ----

const CHEST_HEAD = ['List No.', 'Item', 'Strength / form', 'Where', 'Required', 'In date', 'Short', 'Batch', 'Expiry', 'Qty', 'State'];
function chestRows(rows: ItemStatus[], today: string): string[][] {
  const out: string[][] = [];
  // As the chest is laid out: room, cabinet, cell — the list in hand finds the shelf.
  for (const r of [...rows].sort((a, b) => comparePlace(a.item, b.item) || a.item.name.localeCompare(b.item.name))) {
    const base = [listNoOf(r.item) ?? '', `${r.item.name}${r.item.controlled ? ' (CD)' : ''}`, r.item.strength ?? '', placeText(r.item), `${r.item.required} ${r.item.unit}`, String(r.usable), r.short ? String(r.short) : ''];
    if (!r.batches.length) out.push([...base, '', '', '0', 'NONE ABOARD']);
    r.batches.forEach((b, i) => {
      const st = expiryState(today, b.expiry);
      out.push([...(i ? ['', '', '', '', '', '', ''] : base), batchLabel(b), b.expiry ?? '', String(b.qty), st === 'expired' ? 'EXPIRED' : st === 'soon' ? `expires in ${daysTo(today, b.expiry!)} d` : st === 'later' ? 'within 90 d' : '']);
    });
  }
  return out;
}

const ORDER_HEAD = ['Item', 'Strength / form', 'Required', 'In date', 'Short', 'Expiring ≤ 90 d', 'Order', 'Unit'];
export function orderRows(rows: ItemStatus[], today: string): string[][] {
  const by = new Map(rows.map((r) => [r.item.id, r]));
  return toOrder(rows, today).map((x) => [x.item.name, x.item.strength ?? '', String(x.item.required), String(by.get(x.item.id)?.usable ?? 0), x.short ? String(x.short) : '', x.expiring ? String(x.expiring) : '', String(x.need), x.item.unit]);
}

export async function exportChestPdf(rows: ItemStatus[], today: string, vessel: VesselInfo | null) {
  const ex = rows.filter((r) => r.expired).length;
  const short = rows.filter((r) => r.short).length;
  return exportPmsHistory('Medicine chest', `Medicine chest ${today}`, vessel, [{
    title: 'Medicine chest — inventory and expiry',
    facts: [`${rows.length} items`, ex ? `${ex} with expired stock` : 'nothing expired', short ? `${short} below the scale` : 'all at the scale', `as of ${today}`],
    tables: [
      { title: 'Inventory', head: CHEST_HEAD, rows: chestRows(rows, today), widths: { 0: 18, 1: 44, 2: 34, 3: 40, 4: 22, 5: 14, 6: 12, 7: 20, 8: 20, 9: 12 } },
      { title: 'To order (short, or expiring within 90 days)', head: ORDER_HEAD, rows: orderRows(rows, today), widths: { 0: 60, 1: 40 } },
    ],
  }]);
}

export async function exportChestExcel(rows: ItemStatus[], today: string, vessel: VesselInfo | null) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetOf(rows) as any[][]), 'Medicine chest');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ORDER_HEAD, ...orderRows(rows, today)]), 'To order');
  return saveXlsx(wb, `${stem(`Medicine chest ${today}`, vessel)}.xlsx`);
}

/** The list to fill in and load back — the chest as it is, or two example rows. */
export async function exportChestTemplate(rows: ItemStatus[]) {
  const data = rows.length ? (sheetOf(rows) as any[][]) : [SHEET_HEAD, ['Paracetamol', '500 mg tablets', 'tablets', 100, 'medicine', 'Hospital', '', 'AB123', '2028-03', 100], ['Morphine sulphate', '10 mg/1 ml ampoule', 'ampoules', 10, 'medicine', 'Hospital safe', 'yes', 'M4471', '2027-11', 10]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Medicine chest');
  return saveXlsx(wb, 'ISM_AI_Pilot_Medicine_Chest.xlsx');
}

/** Pick a filled-in list. Null when cancelled. */
export async function pickChestSheet(): Promise<{ name: string; rows: unknown[][] } | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    if (!f?.bytes) return null;
    return { name: f.name, rows: sheetRows(f.bytes) };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: [MIME, 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any });
  return { name: res.assets[0].name, rows: sheetRows(b64) };
}

// ---- an order, to send to the supplier and to check deliveries against ----

export async function exportOrderPdf(o: MedOrder, moves: MedMove[], vessel: VesselInfo | null) {
  const got = receivedByLine(o, moves);
  const deliveries = moves.filter((m) => m.orderId === o.id && m.kind === 'received').sort((a, b) => a.at - b.at);
  const line = (id?: string) => o.lines.find((l) => l.id === id);
  return exportPmsHistory('Medical order', `${o.no} Medical order`, vessel, [{
    title: `Medical order ${o.no}`,
    facts: [`ordered ${o.date} by ${who(o.by, o.byRank)}`, o.supplier ? `supplier ${o.supplier}` : '', o.ref ? `ref ${o.ref}` : '', o.port ? `deliver to ${o.port}` : '', o.due ? `expected ${o.due}` : '', o.closedAt ? `closed: ${o.closeNote ?? ''}` : ''].filter(Boolean),
    tables: [
      { title: 'Lines', head: ['#', 'Item', 'Strength / form', 'Ordered', 'Unit', 'Received', 'Still to come'], rows: o.lines.map((l, i) => [String(i + 1), l.name, l.strength ?? '', String(l.qty), l.unit, String(got.get(l.id) ?? 0), String(Math.max(0, l.qty - (got.get(l.id) ?? 0)))]), widths: { 0: 10, 1: 75, 2: 95, 3: 22, 4: 22, 5: 22 } },
      ...(deliveries.length ? [{ title: 'Deliveries', head: ['Date', 'Item', 'Qty', 'Batch', 'Expiry', 'Received by', 'Note'], rows: deliveries.map((m) => [m.date, line(m.lineId)?.name ?? '', String(m.qty), m.batchNo ?? '', m.expiry ?? '', who(m.by, m.byRank), m.note ?? '']) }] : []),
    ],
  }]);
}

// ---- an inventory ----

export async function exportCheckPdf(c: MedCheck, vessel: VesselInfo | null) {
  const diff = c.lines.filter((l) => l.counted !== l.expected);
  const row = (l: MedCheck['lines'][number]) => [l.name, l.place ?? '', batchLabel(l), l.expiry ?? '', String(l.expected), String(l.counted), l.counted === l.expected ? '' : `${l.counted > l.expected ? '+' : ''}${l.counted - l.expected}`];
  const head = ['Item', 'Where', 'Batch', 'Expiry', 'Books', 'Counted', 'Difference'];
  const kind = c.kind ?? 'inventory';
  const title = kind === 'handover' ? 'Controlled drugs — handover' : kind === 'cd' ? 'Controlled drugs — monthly count' : 'Medicine chest inventory';
  const sig = (s?: any) => (s ? ` · ${proofShort(s)}` : '');
  const people = kind === 'handover'
    ? [`Handed over by ${who(c.by, c.byRank)}${sig(c.signedWith)}`, `Taken over by ${who(c.witness, c.witnessRank)}${sig(c.witnessWith)}`]
    : [`counted by ${who(c.by, c.byRank)}${sig(c.signedWith)}`, c.witness ? `witness ${who(c.witness, c.witnessRank)}${sig(c.witnessWith)}` : ''];
  return exportPmsHistory(title, `${c.no} ${kind === 'handover' ? 'CD handover' : kind === 'cd' ? 'CD count' : 'Inventory'}`, vessel, [{
    title: `${title} ${c.no} — ${localStamp(c.at)}`,
    facts: [`${c.lines.length} lines`, diff.length ? `${diff.length} differences` : 'as the books', ...people, c.note ?? ''].filter(Boolean),
    tables: [...(diff.length ? [{ title: 'Differences', head, rows: diff.map(row), widths: { 0: 80, 1: 60 } }] : []), { title: kind === 'handover' ? 'Handed over' : 'Counted', head, rows: c.lines.map(row), widths: { 0: 80, 1: 60 } }],
  }]);
}

// ---- controlled drugs ----

const CD_HEAD = ['Date', 'Entry', 'Batch', 'Expiry', 'In', 'Out', 'Balance', 'By', 'Witness', 'Note'];
export async function exportControlledPdf(items: MedItem[], moves: MedMove[], today: string, vessel: VesselInfo | null) {
  const cds = items.filter((i) => i.controlled && !i.deleted);
  return exportPmsHistory('Controlled drugs register', `Controlled drugs ${today}`, vessel, cds.map((i) => {
    const lines = registerLines(i.id, moves);
    return {
      title: `${i.name}${i.strength ? ` ${i.strength}` : ''}`,
      facts: [`Balance ${lines.length ? lines[lines.length - 1].balance : 0} ${i.unit}`, `Required ${i.required}`, listNoOf(i) ? `List No. ${listNoOf(i)}` : '', placeText(i)].filter(Boolean),
      tables: [{ title: 'Register', head: CD_HEAD, rows: lines.map((l) => [l.move.date, `${MOVE_LABEL[l.move.kind]}${l.move.treatmentId ? ' (treatment)' : ''}`, batchLabel(l.move), l.move.expiry ?? '', l.in ? String(l.in) : '', l.out ? String(l.out) : '', String(l.balance), `${who(l.move.by, l.move.byRank)}${l.move.signedWith ? ` · ${proofShort(l.move.signedWith)}` : ''}`, l.move.witness ? `${who(l.move.witness, l.move.witnessRank)}${l.move.witnessWith ? ` · ${proofShort(l.move.witnessWith)}` : ''}` : '', l.move.note ?? '']), widths: { 0: 20, 1: 26, 2: 20, 3: 20, 4: 12, 5: 12, 6: 16, 7: 44, 8: 44 } }],
    };
  }));
}

// ---- the medical log ----

const LOG_HEAD = ['No.', 'Date', 'Patient', 'Complaint', 'Diagnosis', 'Treatment', 'Medicines', 'Radio advice', 'Outcome', 'By'];
const logRows = (list: MedTreatment[]) => sortTreatments(list).map((t) => [t.no, `${t.date}${t.time ? ` ${t.time}` : ''}`, who(t.patient, t.patientRank), t.complaint, t.diagnosis ?? '', t.treatment ?? '', t.issued.map(issuedText).join('; '), t.tmas ? [t.tmas.centre, t.tmas.ref].filter(Boolean).join(' ') || 'yes' : '', OUTCOME_LABEL[t.outcome], who(t.by, t.byRank)]);

export async function exportMedLogPdf(list: MedTreatment[], today: string, vessel: VesselInfo | null) {
  return exportPmsHistory('Medical log', `Medical log ${today}`, vessel, [{ title: 'Medical log — CONFIDENTIAL', facts: [`${list.length} entries`, 'Personal health data — Master and officers only'], tables: [{ title: 'Treatments', head: LOG_HEAD, rows: logRows(list), widths: { 0: 20, 1: 20, 2: 28, 3: 36, 4: 30, 5: 40, 6: 40, 7: 20, 8: 22 } }] }]);
}

export async function exportMedLogExcel(list: MedTreatment[], today: string, vessel: VesselInfo | null) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Medical log — CONFIDENTIAL'], [vesselHeader(vessel)], [], LOG_HEAD, ...logRows(list)]), 'Medical log');
  return saveXlsx(wb, `${stem(`Medical log ${today}`, vessel)}.xlsx`);
}

// ---- one treatment ----

export interface MedDoc {
  title: string;
  vesselLine: string;
  sections: { title: string; rows?: [string, string][]; text?: string; table?: { head: string[]; rows: string[][] }; signatures?: SigBox[] }[];
}

/** A signature box on a printed record: the role, the name, how and when, and the hand-drawn signature when there is one. */
export interface SigBox {
  role: string;
  name: string;
  detail: string;
  drawing?: string;
}

const sigBox = (role: string, name: string, p?: SignProof, at?: number, extra?: string): SigBox => ({
  role, name, detail: [extra, p ? proofShort(p) : '', at ? localStamp(at) : ''].filter(Boolean).join(' · '), ...(p?.drawing ? { drawing: p.drawing } : {}),
});

// ---- landing: out-of-date stock handed ashore ----

export function landingDoc(c: MedCheck, vessel: VesselInfo | null): MedDoc {
  const cd = c.kind === 'landing-cd';
  const total = c.lines.reduce((n, l) => n + l.counted, 0);
  return {
    title: `${cd ? 'Landing report — controlled drugs' : 'Landing report — expired medicines and medical stores'} ${c.no}`,
    vesselLine: vesselHeader(vessel),
    sections: [
      { title: 'Handed ashore', rows: [['Date', c.date], ['Port', c.port || '—'], ['Received by', [c.receiver, c.receiverRole, c.receiverOrg].filter(Boolean).join(', ') || '—'], ['Lines / units', `${c.lines.length} lines · ${total} units`], ...(c.note ? [['Remarks', c.note] as [string, string]] : [])] },
      {
        title: cd ? 'Controlled drugs landed' : 'Items landed',
        table: {
          head: ['#', 'List No.', 'Item', 'Strength / form', 'Batch', 'Expiry', 'Qty', 'Unit', 'Reason'],
          rows: c.lines.map((l, i) => [String(i + 1), l.listNo ?? '', l.name, l.strength ?? '', batchLabel(l), l.expiry ?? '', String(l.counted), l.unit ?? '', LANDING_REASON_LABEL[l.reason ?? 'expired']]),
        },
      },
      {
        title: 'Signatures',
        text: cd
          ? 'The controlled drugs listed above were counted and handed over in the presence of the witness, and received ashore for destruction. The quantities have been entered as disposed of in the controlled drugs register.'
          : 'The items listed above were handed over and received ashore for destruction. The quantities have been entered as disposed of in the medicine chest register.',
        signatures: [
          sigBox('Handed over by (vessel)', who(c.by, c.byRank), c.signedWith, c.at),
          ...(c.witness ? [sigBox('Witness (vessel)', who(c.witness, c.witnessRank), c.witnessWith)] : []),
          sigBox('Received by (ashore)', [c.receiver, c.receiverRole].filter(Boolean).join(', '), c.receivedWith, undefined, c.receiverOrg),
        ],
      },
    ],
  };
}

export async function exportLandingPdf(c: MedCheck, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const d = landingDoc(c, vessel);
  const name = `${stem(`${c.no} Landing report${c.kind === 'landing-cd' ? ' CD' : ''}`, vessel)}.pdf`;
  if (onWeb) return saveFileWeb(medPdfBlob(d), name, 'reports');
  const { uri } = await Print.printToFileAsync({ html: medHtml(d), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export function treatmentDoc(t: MedTreatment, vessel: VesselInfo | null): MedDoc {
  const v = t.vitals ?? {};
  const vit: [string, string][] = ([['Temperature', v.temp ? `${v.temp} °C` : ''], ['Pulse', v.pulse ? `${v.pulse} /min` : ''], ['Blood pressure', v.bp ? `${v.bp} mmHg` : ''], ['Respiration', v.rr ? `${v.rr} /min` : ''], ['SpO2', v.spo2 ? `${v.spo2} %` : '']] as [string, string][]).filter(([, x]) => x);
  const sig = (s: string, by?: string, rank?: string, p?: any, at?: number) => [s, `${who(by, rank)}${p ? ` · ${proofShort(p)}` : ''}${at ? ` · ${localStamp(at)}` : ''}`] as [string, string];
  return {
    title: `Medical report — ${t.no}`,
    vesselLine: `${vesselHeader(vessel)} · CONFIDENTIAL — medical`,
    sections: [
      { title: 'Patient', rows: [['Name', t.patient], ['Rank', t.patientRank ?? '—'], ['Date', `${t.date}${t.time ? ` ${t.time}` : ''}`]] },
      { title: 'Complaint and history', rows: [['Complaint', t.complaint], ['History', t.history ?? '—']] },
      ...(vit.length ? [{ title: 'Vital signs', rows: vit }] : []),
      { title: 'Examination and diagnosis', rows: [['Findings', t.findings ?? '—'], ['Diagnosis', t.diagnosis ?? '—']] },
      { title: 'Treatment', rows: [['Treatment given', t.treatment ?? '—']] },
      ...(t.issued.length ? [{ title: 'Medicines given', table: { head: ['Medicine', 'Qty', 'Dose', 'Batch', 'Expiry'], rows: t.issued.map((x) => [x.name, `${x.qty} ${x.unit}`, x.dose ?? '', x.batchNo ?? '', x.expiry ?? '']) } }] : []),
      ...(t.tmas ? [{ title: 'Radio medical advice', rows: [['Centre', t.tmas.centre ?? '—'], ['Reference', t.tmas.ref ?? '—'], ['Advice', t.tmas.advice ?? '—']] as [string, string][] }] : []),
      { title: 'Outcome', rows: [['Outcome', OUTCOME_LABEL[t.outcome]], ['Follow-up', t.followUp ?? '—']] },
      { title: 'Signed', rows: [sig('Treated by', t.by, t.byRank, t.signedWith, t.at), ...(t.witness ? [sig('Witness (controlled drug)', t.witness, t.witnessRank, t.witnessWith)] : [])] },
    ],
  };
}

function medHtml(d: MedDoc): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 14mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 10px; color: #0B2545; }
    h1 { font-size: 16px; margin: 0; } h2 { font-size: 11px; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: .5px; } .sub { color: #5b6b7e; margin: 2px 0 8px; }
    table { border-collapse: collapse; width: 100%; } td, th { border: .5px solid #c8d0db; padding: 4px 5px; vertical-align: top; text-align: left; } th { background: #eef2f7; } td.k { width: 30%; color: #5b6b7e; } .sigs td { width: 33%; } .sigs .k { color: #5b6b7e; } .sigs .box { height: 52px; border-bottom: .5px solid #0B2545; margin: 4px 0; }
  </style></head><body><h1>${esc(d.title)}</h1><div class="sub">${esc(d.vesselLine)}</div>
  ${d.sections.map((s) => `<h2>${esc(s.title)}</h2>${s.rows ? `<table>${s.rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>` : ''}${s.table ? `<table><thead><tr>${s.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}${s.text ? `<p>${esc(s.text)}</p>` : ''}${s.signatures ? `<table class="sigs"><tr>${s.signatures.map((g) => `<td><div class="k">${esc(g.role)}</div><div class="box">${g.drawing ? `<svg viewBox="0 0 300 100" width="150" height="50"><path d="${esc(g.drawing)}" stroke="#0B2545" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` : ''}</div><b>${esc(g.name)}</b><div class="k">${esc(g.detail)}</div></td>`).join('')}</tr></table>` : ''}`).join('')}
  </body></html>`;
}

/** Any record laid out as a MedDoc (sections, tables, signature boxes) — PDF, A4 portrait. Used by the safety meeting too. */
export async function exportDocPdf(d: MedDoc, fileStem: string, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const name = `${stem(fileStem, vessel)}.pdf`;
  if (onWeb) return saveFileWeb(medPdfBlob(d), name, 'reports');
  const { uri } = await Print.printToFileAsync({ html: medHtml(d), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}

export async function exportTreatmentPdf(t: MedTreatment, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const d = treatmentDoc(t, vessel);
  const name = `${stem(`${t.no} Medical report`, vessel)}.pdf`;
  if (onWeb) return saveFileWeb(medPdfBlob(d), name, 'reports');
  const { uri } = await Print.printToFileAsync({ html: medHtml(d), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${name}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', name);
  } catch {
    await share(uri, 'application/pdf', name);
  }
}
