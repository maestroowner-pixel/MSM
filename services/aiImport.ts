// ===================================
// Smart import (14 Oct 2026, AI no. 1 — "a new vessel on board in minutes").
// Two ways the AI helps the importers the app already has:
//
//   headings   a spreadsheet whose columns are named the vessel's own way: the
//              AI is shown the headings and a few MASKED sample rows ("A…e",
//              digits kept) and says which column is which of ours. The sheet is
//              renamed here, on the device, and the usual importer reads it —
//              so the list itself never goes to the AI. Crew and guests too.
//   document   a photo or PDF of a paper list (equipment register, stores,
//              medicine chest): the AI reads it into rows under our headings,
//              which become a sheet for the usual importer and its preview.
//              Never for crew, passengers or patients.
// ===================================

import * as XLSX from 'xlsx';

import { aiCall, maskCell } from './ai';
import { CREW_COLUMNS } from './crewList';
import { PAX_HEAD } from './passengerList';
import { STORE_HEAD } from './stores';
import { SHEET_HEAD } from './hospital';

export type ImportTarget = 'equipment' | 'crew' | 'passengers' | 'provisions' | 'ppe' | 'medicine';

const MEANING: Record<string, string> = {
  'Full name ★': 'the person\'s full name', 'Full name': 'the person\'s full name', 'Rank / position': 'rank or job on board', 'Cabin No.': 'cabin',
  'Date of birth': 'date of birth', 'Place of birth': 'place of birth', 'Nationality (2 letters: GB, ES, UA…)': 'nationality / citizenship', Nationality: 'nationality / citizenship',
  'Passport no.': 'passport number', 'Passport expiry': 'passport expiry date', "Seaman's book no.": 'seaman\'s book / discharge book number', 'Date of embarkation': 'date joined', 'Port of embarkation': 'port joined',
  Phone: 'phone', Email: 'email', 'Home address': 'home address', 'Next of kin — family name': 'next of kin family name', 'Next of kin — given names': 'next of kin given names', 'Next of kin — relationship': 'next of kin relationship', 'Next of kin — phone': 'next of kin phone', 'Next of kin — email': 'next of kin email', 'Next of kin — address': 'next of kin address',
  Group: 'owner / guest / charter guest', 'ID type': 'identity document type', 'ID No.': 'identity document / passport number', 'ID expiry': 'document expiry', Embarked: 'date embarked / arrival', 'Port embarked': 'port embarked', Disembarked: 'date disembarked / departure', 'Port disembarked': 'port disembarked', 'Contact ashore': 'emergency contact', Notes: 'notes, diet, allergies, remarks',
  'Name ★': 'the item\'s name / description', Category: 'section, category, type', Size: 'size (S, M, L, 42…)', Unit: 'unit of measure', Min: 'minimum stock / par level', Location: 'where it is kept', Quantity: 'quantity on hand', Expiry: 'expiry / best before date',
  'List No.': 'number on the official list (WHO / flag)', Name: 'medicine or item name', 'Strength / form': 'strength and form (tablet 500 mg)', Required: 'quantity required by the scale', Kind: 'medicine / equipment / consumable', Cabinet: 'cabinet', Cell: 'cell / shelf', Controlled: 'controlled drug yes/no', Batch: 'batch / lot number',
  Description: 'what the item is — e.g. Fire extinguisher CO2 5 kg, Liferaft 12 persons, Lifejacket adult', No: 'item number on board', Make: 'make / manufacturer', 'Serial number': 'serial number', Deck: 'deck', 'Persons': 'persons (liferafts, boats)', 'Manufacture date': 'date of manufacture', 'Next inspection': 'next service / inspection / test date', 'Expiry date': 'expiry date', Remarks: 'remarks',
};

const EQUIPMENT_HEAD = ['Description', 'No', 'Make', 'Size', 'Serial number', 'Deck', 'Location', 'Persons', 'Quantity', 'Manufacture date', 'Next inspection', 'Expiry date', 'Remarks'];

export function headingsOf(target: ImportTarget): string[] {
  return target === 'crew' ? [...CREW_COLUMNS] : target === 'passengers' ? PAX_HEAD : target === 'medicine' ? SHEET_HEAD : target === 'equipment' ? EQUIPMENT_HEAD : STORE_HEAD;
}
const describe = (h: string) => `${h.replace(' ★', '')} — ${MEANING[h] ?? h}`;
const canon = (target: ImportTarget, said: string) => {
  const s = String(said ?? '').replace(/ ★/, '').split(' — ')[0].trim().toLowerCase();
  return headingsOf(target).find((h) => h.replace(' ★', '').toLowerCase() === s) ?? headingsOf(target).find((h) => h.replace(' ★', '').toLowerCase().startsWith(s) || s.startsWith(h.replace(' ★', '').toLowerCase()));
};

/** The heading row: among the first rows, the one with the most text cells. */
export function headingRow(rows: unknown[][]): number {
  let best = 0;
  let score = -1;
  rows.slice(0, 20).forEach((r, i) => {
    const n = (r ?? []).filter((c) => typeof c === 'string' && /[A-Za-zА-яЁё]/.test(c) && !/^\d/.test(c.trim())).length;
    if (n > score) { best = i; score = n; }
  });
  return best;
}

export interface Renamed { rows: unknown[][]; mapped: { from: string; to: string }[] }

/** The sheet with our headings over its columns — the AI saw the headings and masked samples only. */
export async function aiRenameHeadings(rows: unknown[][], target: ImportTarget): Promise<Renamed> {
  const h = headingRow(rows);
  const headers = (rows[h] ?? []).map((c) => String(c ?? '').trim());
  const samples = rows.slice(h + 1).filter((r) => (r ?? []).filter((c) => String(c ?? '').trim()).length >= 2).slice(0, 4).map((r) => headers.map((_, i) => maskCell((r ?? [])[i])));
  const res = await aiCall<{ mapping?: Record<string, string | null>; nameParts?: { given?: number | null; family?: number | null } }>('map', { target, fields: headingsOf(target).map(describe), headers, samples });
  const head: string[] = headers.map(() => '');
  const mapped: { from: string; to: string }[] = [];
  for (const [idx, field] of Object.entries(res.mapping ?? {})) {
    const i = Number(idx);
    const to = field ? canon(target, field) : undefined;
    if (!to || !(i >= 0 && i < headers.length) || head.includes(to)) continue;
    head[i] = to;
    mapped.push({ from: headers[i] || `column ${i + 1}`, to: to.replace(' ★', '') });
  }
  let body = rows.slice(h + 1).map((r) => [...(r ?? [])]);
  const nameHead = headingsOf(target)[0];
  const g = res.nameParts?.given;
  const f = res.nameParts?.family;
  if ((g != null || f != null) && !head.includes(nameHead)) {
    head.push(nameHead);
    body = body.map((r) => [...r, [g != null ? r[g] : '', f != null ? r[f] : ''].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')]);
    mapped.push({ from: [g != null ? headers[g] : null, f != null ? headers[f] : null].filter(Boolean).join(' + '), to: nameHead.replace(' ★', '') });
  }
  if (!head.includes(nameHead)) throw new Error('The AI could not find the name column — check the file, or use the template.');
  return { rows: [head, ...body], mapped };
}

/** A photo or PDF of a paper list → rows under our headings (equipment, stores, medicine chest only). */
export async function aiReadDocument(dataUri: string, target: ImportTarget): Promise<{ rows: unknown[][]; unreadable?: string }> {
  if (target === 'crew' || target === 'passengers') throw new Error('Personal lists are not sent to the AI — use the Excel template.');
  const comma = dataUri.indexOf(',');
  const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
  const heads = headingsOf(target);
  const res = await aiCall<{ rows?: Record<string, unknown>[]; unreadable?: string }>('table', { target, fields: heads.map(describe), mediaType, data: dataUri.slice(comma + 1) });
  const pick = (o: Record<string, unknown>, h: string) => {
    const k = Object.keys(o).find((x) => canon(target, x) === h);
    return k ? o[k] : '';
  };
  const rows = (res.rows ?? []).map((o) => heads.map((h) => pick(o, h) ?? ''));
  return { rows: [heads, ...rows], ...(res.unreadable ? { unreadable: res.unreadable } : {}) };
}

/** Rows as .xlsx bytes — for the equipment importer, which reads a workbook. */
export function rowsToWorkbook(rows: unknown[][], sheet = 'Imported list'): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
