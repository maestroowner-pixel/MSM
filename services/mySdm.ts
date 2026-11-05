// ===================================
// A seafarer's own SDM file on their own device (services/myDocs.ts, 5 Nov 2026).
// Their passport and next of kin live in `crew_private`, which the rules keep from
// crew devices; the .sdm file they already hold has them. Read here and kept in
// this device's storage only: not synced, not in the .msm backup.
//
// The file is the whole SDM state as plain JSON. What is not for this page is
// dropped on reading and never stored: biometrics and blood type, the day rate,
// photo, notes, DP days. Pure, so check:mydocs can hold it.
// ===================================

import { Certificate } from '../types/certificate';
import { SdmFile, sdmDate } from './sdmImport';

export interface MySdmDoc { id: string; category: string; name: string; number?: string; issueDate?: string; expiryDate?: string; noExpiry?: boolean; issuePlace?: string }
export interface MySdmService { vessel: string; type?: string; flag?: string; position?: string; company?: string; signOn?: string; signOff?: string }

export interface MySdm {
  loadedAt: number;
  fileName: string;
  name: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  visas: { label: string; value: string }[];
  kin?: { name: string; relationship?: string; phone?: string; email?: string };
  documents: MySdmDoc[];
  service: MySdmService[];
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const opt = (v: unknown) => s(v) || undefined;
const optDate = (v: unknown) => sdmDate(v) || undefined;

export function toMySdm(file: SdmFile & { seaService?: Array<Record<string, any>> }, fileName: string, now: number): MySdm {
  const p = file.personal ?? {};
  const k = file.nextOfKin ?? {};
  const visas = [['USA', p.visaUSA], ['Schengen', p.visaSchengen], ['Australia', p.visaAustralia]].filter(([, v]) => s(v)).map(([label, v]) => ({ label: String(label), value: s(v) }));
  return {
    loadedAt: now,
    fileName,
    name: [s(p.firstName), s(p.middleName), s(p.lastName)].filter(Boolean).join(' '),
    birthDate: optDate(p.birthDate),
    birthPlace: opt(p.birthPlace),
    nationality: opt(p.nationality),
    phone: opt(p.phone),
    email: opt(p.email),
    visas,
    kin: s(k.name) ? { name: s(k.name), relationship: opt(k.relationship), phone: opt(k.phone), email: opt(k.email) } : undefined,
    documents: (file.documents ?? []).filter((d) => s(d.name)).map((d, i) => ({
      id: s(d.id) || `d${i}`, category: s(d.category), name: s(d.name), number: opt(d.number), issueDate: optDate(d.issueDate),
      expiryDate: d.noExpiryDate ? undefined : optDate(d.expiryDate), noExpiry: !!d.noExpiryDate, issuePlace: opt(d.issuePlace),
    })),
    service: (file.seaService ?? []).filter((v) => s(v.vesselName)).map((v) => ({
      vessel: s(v.vesselName), type: opt(v.customVesselType) ?? opt(v.vesselType), flag: opt(v.flag), position: opt(v.customPosition) ?? opt(v.position),
      company: opt(v.company), signOn: optDate(v.signOn), signOff: optDate(v.signOff),
    })).sort((a, b) => (b.signOn ?? '').localeCompare(a.signOn ?? '')),
  };
}

const norm = (x?: string) => (x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export type SdmDiff = { kind: 'missing' | 'date'; doc: MySdmDoc; vesselExpiry?: string };

/**
 * Their papers against what the vessel holds, for them to raise with an officer: nothing is
 * changed from here. By number where both have one, else by name. The passport and seaman's
 * book numbers are kept in `crew_private`, so those are compared by name alone or not at all.
 */
export function sdmDiffs(docs: MySdmDoc[], vesselCerts: Certificate[]): SdmDiff[] {
  const out: SdmDiff[] = [];
  for (const d of docs) {
    if (/seaman/i.test(`${d.category} ${d.name}`)) continue;
    const passport = /passport/i.test(`${d.category} ${d.name}`);
    const c = vesselCerts.find((x) => (passport ? /passport/i.test(x.name) : (d.number && x.number ? norm(d.number) === norm(x.number) : norm(d.name) === norm(x.name))));
    if (!c) out.push({ kind: 'missing', doc: d });
    else if (d.expiryDate && c.expiryDate && d.expiryDate !== c.expiryDate) out.push({ kind: 'date', doc: d, vesselExpiry: c.expiryDate });
  }
  return out;
}
