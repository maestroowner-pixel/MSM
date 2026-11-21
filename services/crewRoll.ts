// ===================================
// Crew roll — the record Panama asks of an electronic crew roll book (MMC-193
// rev. March 2026, §4.3.1; text in /Users/Oxford/MarineSafetyManager/regulatory/
// MMC-193-2026-03.txt), 21 Nov 2026, gap P4 of erb-approval/flags/PA.md:
//   i.   Onboard crew list — full name, position, CoC, place of birth, age, passport;
//   ii.  Crew details — the same, plus nationality, next of kin (name, address),
//        port, place and date of embarkation, and how long aboard;
//   iii. Historic crews — everyone who served, with port and date of embarkation
//        and place and date of landing, kept FIVE years, available as PDF.
// The users "with a username and a password" are the vessel's accounts
// (Settings → Accounts: a name, an eight-digit PIN, the device approved).
//
// A TRIP is one stay aboard. The current one lives on the crew member as it
// always has (`signOn`, `signOnPort`, `signOff`, `signOffPort`); signing on again
// after leaving moves the finished trip into `trips` first (`signOnAgain`),
// so the history is never overwritten by the next contract. Lists made before
// this hold only the latest trip — nothing earlier is guessed.
//
// Pure: no React Native, so check:crewroll can reach it.
// ===================================

import type { MachineHistory } from './pmsHistory';
import { CrewMember, CrewPrivate, CrewTrip } from '../types/crew';
import type { Certificate } from '../types/certificate';

/** How long the history is kept and printed: five years (MMC-193 §4.3.1 iii). */
export const HISTORY_YEARS = 5;

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

/**
 * What signing someone on changes. Someone who had left (a sign-off date, or
 * marked ashore) gets their finished trip kept in `trips`, then a new one starts
 * today; someone still aboard keeps their trip — only the date is set.
 */
export function signOnAgain(m: CrewMember, date: string): Partial<CrewMember> {
  const left = m.onBoard === false || !!m.signOff;
  const done: CrewTrip | null = left && (m.signOn || m.signOff)
    ? clean({ on: m.signOn, onPort: m.signOnPort, off: m.signOff ?? date, offPort: m.signOffPort, rank: m.rank })
    : null;
  return {
    onBoard: true,
    signOn: date,
    signOnPort: left ? undefined : m.signOnPort,
    signOff: undefined,
    signOffPort: undefined,
    contractEnd: undefined,
    ...(done ? { trips: [...(m.trips ?? []), done] } : {}),
  };
}

function clean(t: CrewTrip): CrewTrip {
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== '')) as CrewTrip;
}

/** Every trip of one person, oldest first: the kept ones, then the current (open while aboard). */
export function tripsOf(m: CrewMember): CrewTrip[] {
  const cur = m.signOn || m.signOff
    ? [clean({ on: m.signOn, onPort: m.signOnPort, off: m.onBoard === false ? m.signOff : undefined, offPort: m.onBoard === false ? m.signOffPort : undefined, rank: m.rank })]
    : [];
  return [...(m.trips ?? []), ...cur].sort((a, b) => (a.on ?? a.off ?? '').localeCompare(b.on ?? b.off ?? ''));
}

/** Left within the five years the history is kept (or never recorded leaving). */
export function recentlyLeft(m: CrewMember, today: string): boolean {
  const from = `${Number(today.slice(0, 4)) - HISTORY_YEARS}${today.slice(4, 10)}`;
  return !m.signOff || m.signOff >= from;
}

/** Whole years on `at` (yyyy-mm-dd), from a date of birth. */
export function ageOn(dob: string | undefined, at: string): string {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return '';
  let y = Number(at.slice(0, 4)) - Number(dob.slice(0, 4));
  if (at.slice(5, 10) < dob.slice(5, 10)) y--;
  return y >= 0 && y < 120 ? String(y) : '';
}

/** Days aboard from `on` to `off` (or `at`), counting both ends. */
export function daysAboard(on: string | undefined, off: string | undefined, at: string): number | null {
  if (!on) return null;
  const a = Date.parse(`${on.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${(off ?? at).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

const COC = /\bcoc\b|competen|licen[cs]e|stcw\s*(ii|iii|iv|vii)\b|watchkeep|master\b.*\b(gt|yacht)|officer of the watch|\boow\b|\beoow\b|y\d\b|\bdeck officer|engineer.*certificate/i;

/**
 * The person's Certificate of Competency: their crew certificate named like one
 * (CoC, competency, licence, STCW II/III/IV, OOW…), latest expiry first; the name
 * and, on a device that holds it, the number.
 */
export function cocOf(certs: Certificate[], crewId: string): string {
  const mine = certs
    .filter((c) => c.scope === 'crew' && c.crewId === crewId && COC.test(c.name ?? ''))
    .sort((a, b) => (b.expiryDate ?? '').localeCompare(a.expiryDate ?? ''));
  return mine.map((c) => [c.name, c.number ? `No. ${c.number}` : '', c.expiryDate ? `exp. ${dmy(c.expiryDate)}` : ''].filter(Boolean).join(', ')).join('; ');
}

function seniority(rank?: string): number {
  const r = (rank ?? '').toLowerCase();
  const order = [/master|captain/, /chief officer|chief mate|1st officer|first officer/, /second officer|2nd officer|2\/o/, /third officer|3rd officer|3\/o/, /officer|mate/, /chief engineer|c\/e/, /second engineer|2nd engineer|2\/e/, /third engineer|3rd engineer|3\/e/, /engineer|eto|electric/, /bosun|boatswain/, /deck|ab\b|os\b|sailor|deckhand/, /purser|chief stew/, /stew|interior/, /chef|cook/];
  const i = order.findIndex((re) => re.test(r));
  return i < 0 ? order.length : i;
}

export interface RollInput {
  crew: CrewMember[];
  privates: CrewPrivate[];
  certs: Certificate[];
  /** yyyy-mm-dd — the day printed; ages and days aboard are counted to it. */
  today: string;
}

const aboard = (c: CrewMember) => c.active && !c.deleted && c.onBoard !== false;
const passport = (p?: CrewPrivate) => [p?.passportNo, p?.passportExpiry ? `exp. ${dmy(p.passportExpiry)}` : ''].filter(Boolean).join(', ');
const kinName = (p?: CrewPrivate) => {
  const k = p?.nextOfKin;
  return k ? ([k.firstName, k.lastName].filter(Boolean).join(' ') || k.name || '') : '';
};

function sortedAboard(i: RollInput): CrewMember[] {
  return i.crew.filter(aboard).sort((a, b) => seniority(a.rank) - seniority(b.rank) || a.name.localeCompare(b.name));
}

function facts(i: RollInput, what: string): string[] {
  return [what, `Printed ${dmy(i.today)}`];
}

const signTable = () => ({
  title: 'Master',
  head: ['Name', 'Signature', 'Date', 'Ship’s stamp'],
  rows: [['', '', '', '']],
  widths: { 0: 70, 1: 90, 2: 40, 3: 77 },
});

/** i. Onboard crew list. */
export function onboardSheet(i: RollInput): MachineHistory {
  const priv = new Map(i.privates.map((p) => [p.id, p]));
  const rows = sortedAboard(i).map((c, n) => {
    const p = priv.get(c.id);
    return [String(n + 1), c.name, c.rank ?? '', cocOf(i.certs, c.id), p?.placeOfBirth ?? '', ageOn(p?.dateOfBirth, i.today), p?.nationality ?? '', passport(p)];
  });
  return {
    title: 'Crew roll — onboard crew list',
    facts: facts(i, `${rows.length} on board`),
    tables: [
      { title: 'On board', head: ['No.', 'Full name', 'Position on board', 'Certificate of Competency', 'Place of birth', 'Age', 'Nationality', 'Passport No.'], rows, widths: { 0: 9, 1: 42, 2: 32, 3: 64, 4: 34, 5: 12, 6: 20, 7: 64 } },
      signTable(),
    ],
  };
}

/** ii. Crew details — one page per person on board. */
export function detailsSheets(i: RollInput): MachineHistory[] {
  const priv = new Map(i.privates.map((p) => [p.id, p]));
  const list = sortedAboard(i);
  if (!list.length) return [{ title: 'Crew roll — crew details', facts: facts(i, 'Nobody on board'), tables: [] }];
  return list.map((c) => {
    const p = priv.get(c.id);
    const days = daysAboard(c.signOn, undefined, i.today);
    const row = (k: string, v: string) => [k, v];
    return {
      title: `Crew details — ${c.name}`,
      facts: facts(i, c.rank ?? 'No rank set'),
      tables: [
        {
          title: 'Details',
          head: ['Item', 'Entry'],
          rows: [
            row('Full name', c.name),
            row('Position on board', c.rank ?? ''),
            row('Certificate of Competency', cocOf(i.certs, c.id)),
            row('Place of birth', p?.placeOfBirth ?? ''),
            row('Date of birth / age', [dmy(p?.dateOfBirth), ageOn(p?.dateOfBirth, i.today) ? `${ageOn(p?.dateOfBirth, i.today)} years` : ''].filter(Boolean).join(' — ')),
            row('Nationality', p?.nationality ?? ''),
            row('Passport No.', passport(p)),
            row('Seaman’s book No.', p?.seamansBookNo ?? ''),
            row('Next of kin — name', [kinName(p), p?.nextOfKin?.relationship ? `(${p.nextOfKin.relationship})` : ''].filter(Boolean).join(' ')),
            row('Next of kin — address', p?.nextOfKin?.address ?? ''),
            row('Next of kin — phone', p?.nextOfKin?.phone ?? ''),
            row('Port / place of embarkation', c.signOnPort ?? ''),
            row('Date of embarkation', dmy(c.signOn)),
            row('Time on board', days == null ? '' : `${days} day${days === 1 ? '' : 's'}`),
          ],
          widths: { 0: 70, 1: 207 },
        },
      ],
    };
  });
}

export interface HistoryRow {
  crewId: string;
  name: string;
  trip: CrewTrip;
}

/** Every trip that touches the last five years (to `today`), oldest first. */
export function historyRows(i: RollInput): HistoryRow[] {
  const from = `${Number(i.today.slice(0, 4)) - HISTORY_YEARS}${i.today.slice(4, 10)}`;
  return i.crew
    .filter((c) => !c.deleted)
    .flatMap((c) => tripsOf(c).map((trip) => ({ crewId: c.id, name: c.name, trip })))
    .filter((r) => (r.trip.off ?? '9999') >= from)
    .sort((a, b) => (a.trip.on ?? a.trip.off ?? '').localeCompare(b.trip.on ?? b.trip.off ?? '') || a.name.localeCompare(b.name));
}

/** iii. Historic crews report — five years. */
export function historySheet(i: RollInput): MachineHistory {
  const priv = new Map(i.privates.map((p) => [p.id, p]));
  const rows = historyRows(i).map((r, n) => {
    const p = priv.get(r.crewId);
    return [
      String(n + 1),
      r.name,
      r.trip.rank ?? '',
      cocOf(i.certs, r.crewId),
      p?.placeOfBirth ?? '',
      ageOn(p?.dateOfBirth, r.trip.on ?? i.today),
      p?.nationality ?? '',
      passport(p),
      [dmy(r.trip.on), r.trip.onPort].filter(Boolean).join(', '),
      r.trip.off ? [dmy(r.trip.off), r.trip.offPort].filter(Boolean).join(', ') : 'On board',
    ];
  });
  return {
    title: 'Crew roll — historic crews',
    facts: [...facts(i, `Five years to ${dmy(i.today)} · ${rows.length} trip${rows.length === 1 ? '' : 's'}`), 'Age at embarkation'],
    tables: [
      {
        title: 'Crews',
        head: ['No.', 'Full name', 'Position on board', 'Certificate of Competency', 'Place of birth', 'Age', 'Nationality', 'Passport No.', 'Port and date of embarkation', 'Place and date of landing'],
        rows,
        widths: { 0: 8, 1: 34, 2: 26, 3: 44, 4: 26, 5: 14, 6: 16, 7: 37, 8: 36, 9: 36 },
      },
      signTable(),
    ],
  };
}
