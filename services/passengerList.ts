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

export const PAX_HEAD = ['Full name ★', 'Group', 'Cabin No.', 'Nationality', 'Date of birth', 'ID type', 'ID No.', 'ID expiry', 'Embarked', 'Port embarked', 'Disembarked', 'Port disembarked', 'Phone', 'Contact ashore', 'Notes'];

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

// Headings as other people write them — an agent's guest list, a charter manifest,
// a FAL Form 6 — so a sheet from outside reads without retyping (14 Oct 2026:
// "so it is not typed by hand — load the xlsx, convenient import and export").
const ALIASES: Record<string, string[]> = {
  name: ['full name', 'name', 'family name, given names', 'passenger name', 'guest name', 'guest', 'passenger', 'name of passenger', 'surname, given names'],
  family: ['family name', 'surname', 'last name'],
  given: ['given names', 'given name', 'first name', 'first names', 'forename'],
  group: ['group', 'category', 'type', 'role'],
  cabin: ['cabin no', 'cabin number', 'cabin', 'stateroom', 'room', 'berth'],
  nat: ['nationality', 'citizenship', 'country'],
  dob: ['date of birth', 'dob', 'birth date', 'born', 'date and place of birth'],
  idType: ['id type', 'document type', 'type of identity document', 'nature of identity document'],
  idNo: ['id no', 'id number', 'passport no', 'passport number', 'passport', 'document no', 'document number', 'nature and no', 'serial number of identity document', 'identity document'],
  idExp: ['id expiry', 'passport expiry', 'expiry', 'expires', 'valid until', 'expiry date', 'date of expiry'],
  on: ['embarked', 'embarkation date', 'date of embarkation', 'arrival', 'arrival date', 'joins', 'join date'],
  onPort: ['port embarked', 'port of embarkation', 'embarkation port'],
  off: ['disembarked', 'disembarkation date', 'date of disembarkation', 'departure', 'departure date', 'leaves'],
  offPort: ['port disembarked', 'port of disembarkation', 'disembarkation port'],
  phone: ['phone', 'mobile', 'telephone', 'tel'],
  contact: ['contact ashore', 'emergency contact', 'next of kin', 'contact'],
  notes: ['notes', 'remarks', 'comments', 'diet', 'dietary', 'allergies'],
};

/** Which column is which: an exact heading first, then one that starts with it — the longer alias wins over the shorter. */
function columns(head: string[]): Record<string, number> {
  const used = new Set<number>();
  const at: Record<string, number> = {};
  const order = Object.entries(ALIASES).flatMap(([k, list]) => list.map((a) => ({ k, a }))).sort((x, y) => y.a.length - x.a.length);
  for (const pass of ['exact', 'start'] as const) {
    for (const { k, a } of order) {
      if (at[k] !== undefined) continue;
      const i = head.findIndex((h, j) => !used.has(j) && (pass === 'exact' ? h === a : h.startsWith(a)));
      if (i >= 0) { at[k] = i; used.add(i); }
    }
  }
  return at;
}

/** The sheet's rows (first sheet) → passengers. Rows without a name, or starting "Example", are skipped. */
export function readPaxRows(rows: any[][]): PaxRow[] {
  // The heading row: a name column and at least one more — a title above it ("Guest manifest — MY Aurora") is not one.
  const isHead = (r: any[]) => { const c = columns(r.map((h) => norm(String(h)))); return (c.name !== undefined || (c.family !== undefined && c.given !== undefined)) && Object.keys(c).length >= 2; };
  const headAt = rows.findIndex(isHead);
  if (headAt < 0) throw new Error('No name column found — a "Full name" (or "Surname" and "Given names") heading. Use the passenger list template.');
  const at = columns(rows[headAt].map((h) => norm(String(h))));
  const get = (r: any[], k: string) => (at[k] !== undefined ? r[at[k]] : undefined);
  const out: PaxRow[] = [];
  for (const r of rows.slice(headAt + 1)) {
    const whole = text(get(r, 'name'));
    const split = [text(get(r, 'given')), text(get(r, 'family'))].filter(Boolean).join(' ');
    const name = whole || split || undefined;
    if (!name || [whole, text(get(r, 'family')), text(get(r, 'given'))].some((v) => v && /^example\b/i.test(v))) continue;
    const row: PaxRow = {
      name: name.replace(/\s+/g, ' '), group: text(get(r, 'group')), cabin: text(get(r, 'cabin')), nationality: text(get(r, 'nat')), dateOfBirth: parseDateCell(get(r, 'dob')),
      idType: text(get(r, 'idType')), idNo: text(get(r, 'idNo')), idExpiry: parseDateCell(get(r, 'idExp')), embarked: parseDateCell(get(r, 'on')), embarkPort: text(get(r, 'onPort')),
      disembarked: parseDateCell(get(r, 'off')), disembarkPort: text(get(r, 'offPort')), phone: text(get(r, 'phone')), emergencyContact: text(get(r, 'contact')), notes: text(get(r, 'notes')),
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
    const all: Record<string, unknown> = { 'Full name ★': p.name, Group: p.group ?? '', 'Cabin No.': p.cabin ?? '', Nationality: p.nationality ?? '', 'Date of birth': x?.dateOfBirth ?? '', 'ID type': x?.idType ?? '', 'ID No.': x?.idNo ?? '', 'ID expiry': x?.idExpiry ?? '', Embarked: p.embarked ?? '', 'Port embarked': p.embarkPort ?? '', Disembarked: p.disembarked ?? '', 'Port disembarked': p.disembarkPort ?? '', Phone: x?.phone ?? '', 'Contact ashore': x?.emergencyContact ?? '', Notes: p.notes ?? '' };
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
