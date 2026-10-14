// ===================================
// The crew list — the IMO FAL Form 5 a port, an agent and immigration ask for —
// and loading the crew from an Excel sheet (9 Oct 2026: "a full crew list:
// position, date and place of birth, date and port of embarkation, passport
// number and expiry — and load it from a template filled in on a computer, as
// in the other tabs").
//
// The data is the crew list (`crew`, read by every device) plus the personal
// details kept apart for Officers and the Master (`crew_private`). Only those
// on board go on the list.
//
// IMPORT MERGES BY NAME. A sheet filled in at a crew change brings back people
// already on the list: they are UPDATED (and signed on), not added twice. A
// cell left empty never wipes what the app already holds — a template filled in
// from the passport desk does not have the next of kin, and must not erase it.
// ===================================

import * as XLSX from 'xlsx';

import { CrewMember, CrewPrivate, isAboard } from '../types/crew';
import { parseDateCell } from '../utils/dates';
import { toCountryCode } from '../constants/countries';
import { uid } from '../utils/id';

/** Template columns, in order. ★ = needed. */
export const CREW_COLUMNS = [
  'Full name ★',
  'Rank / position',
  'Cabin No.',
  'Date of birth',
  'Place of birth',
  'Nationality (2 letters: GB, ES, UA…)',
  'Passport no.',
  'Passport expiry',
  "Seaman's book no.",
  'Date of embarkation',
  'Port of embarkation',
  'Phone',
  'Email',
  'Home address',
  'Next of kin — family name',
  'Next of kin — given names',
  'Next of kin — relationship',
  'Next of kin — phone',
  'Next of kin — email',
  'Next of kin — address',
] as const;

const EXAMPLE = ['Example — Jane Smith (delete this row)', 'Chief Officer', 'C2', '1988-05-14', 'Southampton, UK', 'GB', '123456789', '2031-02-28', 'SB-55821', '2026-10-01', 'Palma de Mallorca', '+44 7700 900000', 'jane@example.com', '1 High St, Southampton, UK', 'Smith', 'John', 'Husband', '+44 7700 900001', '', '1 High St, Southampton, UK'];

/** A blank template as base64 .xlsx, with one example row to delete. */
export function crewTemplateBase64(): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...CREW_COLUMNS], EXAMPLE]);
  ws['!cols'] = CREW_COLUMNS.map((c) => ({ wch: Math.max(14, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Crew list');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

/**
 * The crew as it stands, in the template's columns — sent out, corrected, it
 * comes back in as it is (14 Oct 2026: "convenient import and export of the
 * crew and the passengers").
 */
export function crewSheetBase64(crew: CrewMember[], privates: CrewPrivate[]): string {
  const rows = crew.filter((c) => !c.deleted && c.active).map((c) => {
    const p = privates.find((x) => x.id === c.id);
    const k = p?.nextOfKin;
    return [c.name, c.rank ?? '', c.cabin ?? '', p?.dateOfBirth ?? '', p?.placeOfBirth ?? '', p?.nationality ?? '', p?.passportNo ?? '', p?.passportExpiry ?? '', p?.seamansBookNo ?? '', c.signOn ?? '', c.signOnPort ?? '', p?.phone ?? '', p?.email ?? '', p?.homeAddress ?? '', k?.lastName ?? k?.name ?? '', k?.firstName ?? '', k?.relationship ?? '', k?.phone ?? '', k?.email ?? '', k?.address ?? ''];
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...CREW_COLUMNS], ...rows]);
  ws['!cols'] = CREW_COLUMNS.map((c) => ({ wch: Math.max(14, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Crew list');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export interface CrewRow {
  name: string;
  rank?: string;
  cabin?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  passportNo?: string;
  passportExpiry?: string;
  seamansBookNo?: string;
  signOn?: string;
  signOnPort?: string;
  phone?: string;
  email?: string;
  homeAddress?: string;
  kinName?: string;
  kinLast?: string;
  kinFirst?: string;
  kinRelationship?: string;
  kinPhone?: string;
  kinEmail?: string;
  kinAddress?: string;
  /** What the sheet said for nationality when it could not be turned into a code. */
  nationalityUnknown?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const text = (v: any) => {
  const s = v == null ? '' : String(v).trim();
  return s || undefined;
};

/** Read the first sheet; columns are found by their heading, so a re-ordered sheet still reads. */
export function parseCrewWorkbook(data: ArrayBuffer | Uint8Array | string): CrewRow[] {
  const wb = typeof data === 'string' ? XLSX.read(data, { type: 'base64', cellDates: true }) : XLSX.read(data, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const headAt = rows.findIndex((r) => r.some((c) => /full name|^name$|family name, given names|^surname$|^family name$/i.test(String(c).trim())));
  if (headAt < 0) throw new Error('No "Full name" column — use the crew list template.');
  const head = rows[headAt].map((h) => norm(String(h)).replace('★', '').trim());
  const col = (label: string) => head.findIndex((h) => h.startsWith(norm(label).replace('★', '').trim()));
  const at = {
    name: col('Full name') >= 0 ? col('Full name') : col('Family name, given names') >= 0 ? col('Family name, given names') : head.findIndex((h) => h === 'name'),
    family: head.findIndex((h) => h === 'surname' || h === 'family name' || h === 'last name'),
    given: head.findIndex((h) => h === 'given names' || h === 'given name' || h === 'first name'),
    rank: col('Rank'),
    cabin: head.findIndex((h) => h.startsWith('cabin') || h === 'stateroom'),
    dob: col('Date of birth'),
    pob: col('Place of birth'),
    nat: col('Nationality'),
    pass: col('Passport no'),
    passExp: col('Passport expiry'),
    book: col("Seaman's book"),
    on: col('Date of embarkation'),
    port: col('Port of embarkation'),
    phone: col('Phone'),
    email: col('Email'),
    home: col('Home address'),
    kin: col('Next of kin — name'),
    kinLast: col('Next of kin — family name'),
    kinFirst: col('Next of kin — given name'),
    kinRel: col('Next of kin — relationship'),
    kinPhone: col('Next of kin — phone'),
    kinEmail: col('Next of kin — email'),
    kinAddr: col('Next of kin — address'),
  };
  const get = (r: any[], i: number) => (i >= 0 ? r[i] : undefined);
  const out: CrewRow[] = [];
  for (const r of rows.slice(headAt + 1)) {
    const name = text(get(r, at.name)) ?? ([text(get(r, at.given)), text(get(r, at.family))].filter(Boolean).join(' ') || undefined);
    if (!name || /^example\b/i.test(name)) continue;
    out.push({
      name: name.replace(/\s+/g, ' '),
      rank: text(get(r, at.rank)),
      cabin: text(get(r, at.cabin)),
      dateOfBirth: parseDateCell(get(r, at.dob)),
      placeOfBirth: text(get(r, at.pob)),
      ...(() => {
        const raw = text(get(r, at.nat));
        const code = toCountryCode(raw);
        return code ? { nationality: code } : raw ? { nationalityUnknown: raw } : {};
      })(),
      passportNo: text(get(r, at.pass)),
      passportExpiry: parseDateCell(get(r, at.passExp)),
      seamansBookNo: text(get(r, at.book)),
      signOn: parseDateCell(get(r, at.on)),
      signOnPort: text(get(r, at.port)),
      phone: text(get(r, at.phone)),
      email: text(get(r, at.email)),
      homeAddress: text(get(r, at.home)),
      kinName: text(get(r, at.kin)),
      kinLast: text(get(r, at.kinLast)),
      kinFirst: text(get(r, at.kinFirst)),
      kinRelationship: text(get(r, at.kinRel)),
      kinPhone: text(get(r, at.kinPhone)),
      kinEmail: text(get(r, at.kinEmail)),
      kinAddress: text(get(r, at.kinAddr)),
    });
  }
  return out;
}

/** Only the keys that have a value — an empty cell never wipes what is there. */
function filled<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

export interface CrewImportPlan {
  members: CrewMember[];
  privates: CrewPrivate[];
  added: string[];
  updated: string[];
}

/** What the sheet changes: matched by name to the crew list, everyone in it signed on. */
export function planCrewImport(rows: CrewRow[], crew: CrewMember[], privates: CrewPrivate[], now = Date.now()): CrewImportPlan {
  const byName = new Map(crew.filter((c) => !c.deleted).map((c) => [norm(c.name), c]));
  const privById = new Map(privates.map((p) => [p.id, p]));
  const plan: CrewImportPlan = { members: [], privates: [], added: [], updated: [] };
  for (const r of rows) {
    const had = byName.get(norm(r.name));
    const id = had?.id ?? uid('crew');
    const member: CrewMember = {
      ...(had ?? { id, name: r.name, addedAt: now, updatedAt: now, active: true }),
      ...filled({ rank: r.rank, cabin: r.cabin, signOn: r.signOn, signOnPort: r.signOnPort }),
      name: had?.name ?? r.name,
      active: true,
      onBoard: true,
      updatedAt: now,
    };
    if (member.onBoard) delete (member as any).signOff;
    const prev = privById.get(id) ?? { id, updatedAt: now };
    const kin = filled({ name: r.kinName, lastName: r.kinLast, firstName: r.kinFirst, relationship: r.kinRelationship, phone: r.kinPhone, email: r.kinEmail, address: r.kinAddress });
    const priv: CrewPrivate = {
      ...prev,
      ...filled({
        dateOfBirth: r.dateOfBirth,
        placeOfBirth: r.placeOfBirth,
        nationality: r.nationality,
        passportNo: r.passportNo,
        passportExpiry: r.passportExpiry,
        seamansBookNo: r.seamansBookNo,
        phone: r.phone,
        email: r.email,
        homeAddress: r.homeAddress,
      }),
      ...(Object.keys(kin).length ? { nextOfKin: { ...(prev.nextOfKin ?? {}), ...kin } } : {}),
      id,
      updatedAt: now,
    };
    plan.members.push(member);
    plan.privates.push(priv);
    (had ? plan.updated : plan.added).push(member.name);
    byName.set(norm(member.name), member);
  }
  return plan;
}

// ---- the list itself --------------------------------------------------------------

export interface CrewListRow {
  no: number;
  name: string;
  rank: string;
  nationality: string;
  birth: string;
  passport: string;
  embarked: string;
}

/** Rough seniority, so the list reads Master first as a port expects. */
function seniority(rank?: string): number {
  const r = (rank ?? '').toLowerCase();
  const order = [/master|captain/, /chief officer|chief mate|1st officer|first officer/, /second officer|2nd officer|2\/o/, /third officer|3rd officer|3\/o/, /officer|mate/, /chief engineer|c\/e/, /second engineer|2nd engineer|2\/e/, /third engineer|3rd engineer|3\/e/, /engineer|eto|electric/, /bosun|boatswain/, /deck|ab\b|os\b|sailor|deckhand/, /purser|chief stew/, /stew|interior/, /chef|cook/];
  const i = order.findIndex((re) => re.test(r));
  return i < 0 ? order.length : i;
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

export function crewListRows(crew: CrewMember[], privates: CrewPrivate[]): CrewListRow[] {
  const priv = new Map(privates.map((p) => [p.id, p]));
  return crew
    .filter(isAboard)
    .sort((a, b) => seniority(a.rank) - seniority(b.rank) || a.name.localeCompare(b.name))
    .map((c, i) => {
      const p = priv.get(c.id);
      return {
        no: i + 1,
        name: c.name,
        rank: c.rank ?? '',
        nationality: p?.nationality ?? '',
        birth: [dmy(p?.dateOfBirth), p?.placeOfBirth].filter(Boolean).join(', '),
        passport: [p?.passportNo, p?.passportExpiry ? `exp. ${dmy(p.passportExpiry)}` : ''].filter(Boolean).join(', '),
        embarked: [dmy(c.signOn), c.signOnPort].filter(Boolean).join(', '),
      };
    });
}

/** What is missing from the list, so the officer fills it before the port does the asking. */
export function crewListGaps(rows: CrewListRow[]): string[] {
  return rows.flatMap((r) => {
    const miss = [!r.rank && 'rank', !/^[A-Z]{2}$/.test(r.nationality) && 'nationality (2-letter code)', !r.birth && 'date/place of birth', !r.passport && 'passport', !r.embarked && 'embarkation'].filter(Boolean);
    return miss.length ? [`${r.name}: ${miss.join(', ')}`] : [];
  });
}

export function crewListFileName(vesselName: string | undefined, date: string): string {
  const v = (vesselName ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Crew list-${dmy(date).replace(/\./g, '')}${v ? `-${v}` : ''}.pdf`;
}
