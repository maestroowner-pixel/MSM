// ===================================
// Passenger list — Excel in and out (types/passengers.ts), as the crew list
// (services/crewList.ts): a template, the list exported, a filled-in sheet read
// back. Columns are found by their heading, so a re-ordered sheet still reads.
// Pure: no storage, no React.
// ===================================

import * as XLSX from 'xlsx';

import { Passenger, PassengerPrivate } from '../types/passengers';
import { parseDateCell } from '../utils/dates';
import { uid } from '../utils/id';

export const PAX_HEAD = ['Full name ★', 'Group', 'Cabin', 'Nationality', 'Date of birth', 'ID type', 'ID No.', 'ID expiry', 'Embarked', 'Port embarked', 'Disembarked', 'Port disembarked', 'Phone', 'Contact ashore', 'Notes'];

export interface PaxRow {
  name: string;
  group?: string;
  cabin?: string;
  nationality?: string;
  dateOfBirth?: string;
  idType?: string;
  idNo?: string;
  idExpiry?: string;
  embarked?: string;
  embarkPort?: string;
  disembarked?: string;
  disembarkPort?: string;
  phone?: string;
  emergencyContact?: string;
  notes?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace('★', '').trim();
const text = (v: any) => {
  const s = v == null ? '' : v instanceof Date ? '' : String(v).trim();
  return s || undefined;
};

/** The sheet's rows (first sheet) → passengers. Rows without a name, or starting "Example", are skipped. */
export function readPaxRows(rows: any[][]): PaxRow[] {
  const headAt = rows.findIndex((r) => r.some((c) => /full name|^name$/i.test(String(c).trim())));
  if (headAt < 0) throw new Error('No "Full name" column — use the passenger list template.');
  const head = rows[headAt].map((h) => norm(String(h)));
  const col = (label: string) => head.findIndex((h) => h.startsWith(norm(label)));
  const at = {
    name: col('Full name') >= 0 ? col('Full name') : head.findIndex((h) => h === 'name'),
    group: col('Group'), cabin: col('Cabin'), nat: col('Nationality'), dob: col('Date of birth'), idType: col('ID type'), idNo: col('ID No'), idExp: col('ID expiry'),
    on: col('Embarked'), onPort: col('Port embarked'), off: col('Disembarked'), offPort: col('Port disembarked'), phone: col('Phone'), contact: col('Contact ashore'), notes: col('Notes'),
  };
  const get = (r: any[], i: number) => (i >= 0 ? r[i] : undefined);
  const out: PaxRow[] = [];
  for (const r of rows.slice(headAt + 1)) {
    const name = text(get(r, at.name));
    if (!name || /^example\b/i.test(name)) continue;
    const row: PaxRow = {
      name: name.replace(/\s+/g, ' '), group: text(get(r, at.group)), cabin: text(get(r, at.cabin)), nationality: text(get(r, at.nat)), dateOfBirth: parseDateCell(get(r, at.dob)),
      idType: text(get(r, at.idType)), idNo: text(get(r, at.idNo)), idExpiry: parseDateCell(get(r, at.idExp)), embarked: parseDateCell(get(r, at.on)), embarkPort: text(get(r, at.onPort)),
      disembarked: parseDateCell(get(r, at.off)), disembarkPort: text(get(r, at.offPort)), phone: text(get(r, at.phone)), emergencyContact: text(get(r, at.contact)), notes: text(get(r, at.notes)),
    };
    out.push(Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as unknown as PaxRow);
  }
  return out;
}

export function parsePaxWorkbook(data: ArrayBuffer | Uint8Array | string): PaxRow[] {
  const wb = typeof data === 'string' ? XLSX.read(data, { type: 'base64', cellDates: true }) : XLSX.read(data, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return readPaxRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
}

/**
 * What a sheet does to the list: a passenger matched by name (case and spacing
 * aside) is updated — an empty cell leaves what is there; anyone else is added.
 */
export function planPaxImport(rows: PaxRow[], list: Passenger[], privs: PassengerPrivate[], today: string) {
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const passengers: Passenger[] = [];
  const privates: PassengerPrivate[] = [];
  const added: string[] = [];
  const updated: string[] = [];
  const now = Date.now();
  for (const r of rows) {
    const have = list.find((p) => !p.deleted && key(p.name) === key(r.name));
    const id = have?.id ?? uid('pax');
    const pub = { group: r.group, cabin: r.cabin, nationality: r.nationality, embarked: r.embarked, embarkPort: r.embarkPort, disembarked: r.disembarked, disembarkPort: r.disembarkPort, notes: r.notes };
    const p: Passenger = { ...(have ?? { id, name: r.name, embarked: today, addedAt: now }), ...Object.fromEntries(Object.entries(pub).filter(([, v]) => v)), name: r.name, updatedAt: now } as Passenger;
    passengers.push(p);
    (have ? updated : added).push(r.name);
    const priv = { dateOfBirth: r.dateOfBirth, idType: r.idType ?? (r.idNo ? 'Passport' : undefined), idNo: r.idNo, idExpiry: r.idExpiry, phone: r.phone, emergencyContact: r.emergencyContact };
    const filled = Object.fromEntries(Object.entries(priv).filter(([, v]) => v));
    if (Object.keys(filled).length) privates.push({ ...(privs.find((x) => x.id === id) ?? { id }), ...filled, id, updatedAt: now } as PassengerPrivate);
  }
  return { passengers, privates, added, updated };
}

/** The list as a sheet in the template's layout — sent out, it comes back in as it is. Documents only for the officers. */
export function paxSheet(list: Passenger[], privs: PassengerPrivate[], withDocs: boolean): unknown[][] {
  const head = withDocs ? PAX_HEAD : PAX_HEAD.filter((h) => !['Date of birth', 'ID type', 'ID No.', 'ID expiry', 'Phone', 'Contact ashore'].includes(h));
  const rows = list.filter((p) => !p.deleted).map((p) => {
    const x = privs.find((v) => v.id === p.id);
    const all: Record<string, unknown> = { 'Full name ★': p.name, Group: p.group ?? '', Cabin: p.cabin ?? '', Nationality: p.nationality ?? '', 'Date of birth': x?.dateOfBirth ?? '', 'ID type': x?.idType ?? '', 'ID No.': x?.idNo ?? '', 'ID expiry': x?.idExpiry ?? '', Embarked: p.embarked ?? '', 'Port embarked': p.embarkPort ?? '', Disembarked: p.disembarked ?? '', 'Port disembarked': p.disembarkPort ?? '', Phone: x?.phone ?? '', 'Contact ashore': x?.emergencyContact ?? '', Notes: p.notes ?? '' };
    return head.map((h) => all[h]);
  });
  return [head, ...rows];
}

export function paxWorkbookBase64(rows: unknown[][]): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = (rows[0] as string[]).map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Passengers');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export const paxTemplateRows = (): unknown[][] => [PAX_HEAD, ['Example: Sophie Martin', "Owner's guest", 'VIP', 'France', '1985-04-12', 'Passport', '18AB23456', '2031-06-30', '2026-10-13', 'Palma', '', '', '+33 6 12 34 56 78', 'Paul Martin +33 6 98 76 54 32', 'Vegetarian']];
