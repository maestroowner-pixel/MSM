// ===================================
// Importing a seafarer's own SDM backup (.sdm) into the crew list.
//
// SDM (Seafarer Documents Manager) is the companion app a seafarer keeps their
// papers in. Its backup is one JSON file: `personal` (names, birth date and
// place, nationality, phone, email, address), `nextOfKin`, `documents` (each
// with category, name, number, issue and expiry dates, place of issue) and
// `seaService`. A new crew member hands over that file instead of a pile of
// photocopies, and the officer imports it (9 Oct 2026).
//
// What goes where:
//   personal + nextOfKin          → crew list entry and `crew_private`
//   documents, Passport           → passport number and expiry (the latest one),
//                                   and a "Passport" certificate (expiry only — the
//                                   number stays with the personal details)
//   documents, Seaman's Book      → seaman's book number
//   every other document          → a crew certificate, matched by name + number
//                                   so importing the same file twice adds nothing
// Sea service is not imported (yet): the vessel has no screen for it.
// ===================================

import { Certificate } from '../types/certificate';
import { CrewMember, CrewPrivate } from '../types/crew';
import { toCountryCode } from '../constants/countries';
import { uid } from '../utils/id';

export interface SdmFile {
  personal?: Record<string, any>;
  nextOfKin?: Record<string, any>;
  documents?: Array<Record<string, any>>;
}

export interface SdmPlan {
  member: CrewMember;
  priv: CrewPrivate;
  certificates: Certificate[];
  isNew: boolean;
  /** For the confirmation: what the file brought. */
  summary: string[];
  nationalityRaw?: string;
}

const s = (v: any) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** "1977-04.30", "30.04.1977", "1977/4/30" → "1977-04-30"; '' when unreadable. */
export function sdmDate(v: any): string {
  const t = s(v);
  if (!t) return '';
  let m = t.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
const isPassport = (cat: string, name: string) => /passport/i.test(cat) || /^passport/i.test(name);
const isBook = (cat: string, name: string) => /seaman|seafarer.?s? (book|discharge)|discharge book/i.test(`${cat} ${name}`);

export function parseSdm(text: string): SdmFile {
  let d: any;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('This is not an SDM backup — the file could not be read.');
  }
  if (!d || typeof d !== 'object' || (!d.personal && !Array.isArray(d.documents))) {
    throw new Error('This is not an SDM backup — no personal details or documents in it.');
  }
  return d;
}

/**
 * What importing this file would do. `targetId` imports into a chosen person;
 * otherwise the person is found by name (either order) or added, signed on.
 */
export function planSdmImport(
  f: SdmFile,
  crew: CrewMember[],
  privates: CrewPrivate[],
  certificates: Certificate[],
  targetId?: string,
  now = Date.now()
): SdmPlan {
  const p = f.personal ?? {};
  const first = [s(p.firstName), s(p.middleName)].filter(Boolean).join(' ');
  const last = s(p.lastName);
  const full = [first, last].filter(Boolean).join(' ');
  if (!full && !targetId) throw new Error('The SDM file has no name in it.');
  const live = crew.filter((c) => !c.deleted);
  const had =
    (targetId && live.find((c) => c.id === targetId)) ||
    live.find((c) => norm(c.name) === norm(full) || norm(c.name) === norm(`${last} ${first}`) || norm(c.name) === norm(`${s(p.firstName)} ${last}`));
  const id = had ? had.id : uid('crew');
  const member: CrewMember = had
    ? { ...had, ...(had.rank ? {} : s(p.appliedPosition) ? { rank: s(p.appliedPosition) } : {}), updatedAt: now }
    : { id, name: full, ...(s(p.appliedPosition) ? { rank: s(p.appliedPosition) } : {}), active: true, onBoard: true, addedAt: now, updatedAt: now };

  const prev = privates.find((x) => x.id === id) ?? { id, updatedAt: now };
  const docs = (f.documents ?? []).filter((d) => d && s(d.name || d.category));
  const passports = docs.filter((d) => isPassport(s(d.category), s(d.name))).sort((a, b) => s(b.expiryDate).localeCompare(s(a.expiryDate)));
  const book = docs.find((d) => isBook(s(d.category), s(d.name)));
  const pass = passports[0];
  const code = toCountryCode(s(p.nationality));
  const address = [s(p.address), [s(p.postalCode), s(p.city)].filter(Boolean).join(' '), s(p.country)].filter(Boolean).join(', ');
  const k = f.nextOfKin ?? {};
  const kinParts = s(k.name).split(/\s+/).filter(Boolean);
  const set = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null)) as Partial<T>;

  const priv: CrewPrivate = {
    ...prev,
    ...set({
      dateOfBirth: sdmDate(p.birthDate),
      placeOfBirth: s(p.birthPlace),
      nationality: code ?? '',
      phone: s(p.phone),
      email: s(p.email),
      homeAddress: address,
      passportNo: pass ? s(pass.number) : '',
      passportExpiry: pass ? sdmDate(pass.expiryDate) : '',
      seamansBookNo: book ? s(book.number) : '',
    }),
    ...(s(k.name) || s(k.phone)
      ? {
          nextOfKin: {
            ...(prev.nextOfKin ?? {}),
            ...set({
              firstName: kinParts.slice(0, -1).join(' ') || (kinParts.length === 1 ? kinParts[0] : ''),
              lastName: kinParts.length > 1 ? kinParts[kinParts.length - 1] : '',
              name: s(k.name),
              relationship: s(k.relationship),
              phone: s(k.phone),
              email: s(k.email),
              address: s(k.address),
            }),
          },
        }
      : {}),
    id,
    updatedAt: now,
  };

  // Certificates: everything but the seaman's book; the passport by expiry only.
  const mine = certificates.filter((c) => c.scope === 'crew' && c.crewId === id);
  const key = (name: string, number?: string) => `${norm(name)}|${norm(number ?? '')}`;
  const have = new Map(mine.map((c) => [key(c.name, c.number), c]));
  const certs: Certificate[] = [];
  for (const d of docs) {
    const cat = s(d.category);
    const name = s(d.name) || cat;
    if (isBook(cat, name)) continue;
    const passport = isPassport(cat, name);
    if (passport && d !== pass) continue;
    const certName = passport ? 'Passport' : name;
    const number = passport ? '' : s(d.number);
    const expiry = d.noExpiryDate ? '' : sdmDate(d.expiryDate);
    const existing = have.get(key(certName, number)) ?? (passport ? mine.find((c) => norm(c.name) === 'passport') : undefined);
    // Already held and not renewed in the file (a later expiry): leave it.
    if (existing && (!expiry || (existing.expiryDate ?? '') >= expiry)) continue;
    certs.push({
      ...(existing ?? { id: uid('cert'), itemIds: [], createdAt: now }),
      scope: 'crew',
      crewId: id,
      holderName: member.name,
      name: certName,
      ...(number ? { number } : {}),
      ...(s(d.issuePlace) ? { issuer: s(d.issuePlace) } : {}),
      ...(sdmDate(d.issueDate) ? { issueDate: sdmDate(d.issueDate) } : {}),
      ...(expiry ? { expiryDate: expiry } : {}),
      updatedAt: now,
    } as Certificate);
  }

  const summary = [
    had ? `${member.name} — already on the list, details updated` : `${member.name} — new, signed on`,
    `${certs.length} certificate${certs.length === 1 ? '' : 's'} to add or update`,
    pass ? `passport ${s(pass.number)}${priv.passportExpiry ? `, expires ${priv.passportExpiry}` : ''}` : 'no passport in the file',
    s(k.name) ? `next of kin: ${s(k.name)}` : 'no next of kin in the file',
  ];
  return { member, priv, certificates: certs, isNew: !had, summary, ...(code ? {} : s(p.nationality) ? { nationalityRaw: s(p.nationality) } : {}) };
}
