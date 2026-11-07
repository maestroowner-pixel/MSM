// ===================================
// The photo check (plan item 66, 7 Nov 2026 — after Kaiko, which UniSea bought):
// on an inspection, the AI looks at the evidence photo and says whether it shows
// THIS item — the kind of equipment, its place, the serial or date on its label
// against the register, the same unit as the last photograph of it — and what it
// can see wrong: corrosion, damage, something missing. A hint for the inspector;
// the answers and the signature stay theirs, and nothing of the check is stored
// unless they put it into the remark or the defect.
//
// The reference is the item's last evidence photo (from the newest earlier
// inspection that has one), else the item's own photo in the register.
// ===================================

import type { Attachment, EquipmentItem } from '../types/equipment';
import type { CheckResult, Inspection } from '../types/inspection';

export interface PhotoRef {
  photo: Attachment;
  /** The inspection it was taken on; absent for the item's own photo. */
  inspectionId?: string;
  at: number;
}

/** The photo to compare with: the newest earlier evidence photo of the item, else its register photo. */
export function referenceOf(item: Pick<EquipmentItem, 'id' | 'attachments'>, list: Inspection[]): PhotoRef | null {
  let best: PhotoRef | null = null;
  for (const i of list) {
    if (i.itemId !== item.id || (best && i.at <= best.at)) continue;
    const p = [...(i.photos ?? [])].reverse().find((x) => x.kind === 'photo');
    if (p) best = { photo: p, inspectionId: i.id, at: i.at };
  }
  if (best) return best;
  const own = (item.attachments ?? []).find((x) => x.kind === 'photo');
  return own ? { photo: own, at: own.addedAt ?? 0 } : null;
}

export type Match = 'yes' | 'unsure' | 'no';
export type Same = 'same' | 'other' | 'unsure' | 'samePhoto';
export type FindingKind = 'corrosion' | 'damage' | 'missing' | 'leak' | 'dirty' | 'label' | 'other';
export interface Finding {
  kind: FindingKind;
  where: string;
  major: boolean;
}
export interface PhotoCheck {
  match: Match;
  why: string;
  /** Against the reference photo; absent when there was none. */
  same?: Same;
  /** What the label says where it differs from the register: "serial 12345 (register 12346)". */
  differs: string[];
  findings: Finding[];
}

export interface PhotoCheckReply {
  match?: unknown;
  why?: unknown;
  same?: unknown;
  serial?: unknown;
  expiry?: unknown;
  findings?: unknown;
}

const KINDS: FindingKind[] = ['corrosion', 'damage', 'missing', 'leak', 'dirty', 'label', 'other'];
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const bare = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A label date as a month: "2027-03-31", "03/2027", "3.27", "MAR 2027" → "2027-03"; else ''. */
export function monthOf(s: string): string {
  const v = s.trim().toUpperCase();
  let m = v.match(/^(\d{4})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = v.match(/(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/) ?? v.match(/(?:^|\D)()(\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${y}-${m[2].padStart(2, '0')}` : '';
  }
  const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  m = v.match(/([A-Z]{3})[A-Z]*\.?\s*(\d{4})/);
  if (m && names.includes(m[1])) return `${m[2]}-${String(names.indexOf(m[1]) + 1).padStart(2, '0')}`;
  return '';
}

/**
 * The reply as the screen shows it. A serial is compared letters-and-digits only;
 * a date by month against the item's expiry, then its next inspection — a label
 * that names a different month is shown, one that cannot be read is not.
 */
export function readPhotoCheck(r: PhotoCheckReply | null | undefined, item: Pick<EquipmentItem, 'serial' | 'expiry' | 'nextInspection'>, hadRef: boolean): PhotoCheck | null {
  if (!r || typeof r !== 'object') return null;
  const match: Match = r.match === 'yes' || r.match === 'no' ? r.match : 'unsure';
  const same = hadRef ? ((['same', 'other', 'samePhoto'] as const).find((s) => s === r.same) ?? 'unsure') : undefined;
  const differs: string[] = [];
  const serial = text(r.serial, 60);
  if (serial && item.serial?.trim() && bare(serial) && bare(serial) !== bare(item.serial)) differs.push(`serial ${serial} (register ${item.serial.trim()})`);
  const exp = text(r.expiry, 40);
  const month = monthOf(exp);
  const known = [item.expiry, item.nextInspection].filter(Boolean).map((d) => String(d).slice(0, 7));
  if (month && known.length && !known.includes(month)) differs.push(`date ${exp} (register ${known[0]})`);
  const findings: Finding[] = (Array.isArray(r.findings) ? r.findings : [])
    .slice(0, 8)
    .map((f: any) => ({ kind: (KINDS.includes(f?.kind) ? f.kind : 'other') as FindingKind, where: text(f?.where, 160), major: f?.major === true }))
    .filter((f) => f.where);
  return { match, why: text(r.why, 300), same, differs, findings };
}

/** Anything the inspector should look at before signing: the check is not plain good news. */
export function needsLook(c: PhotoCheck): boolean {
  return c.match !== 'yes' || c.same === 'other' || c.same === 'samePhoto' || c.differs.length > 0 || c.findings.length > 0;
}

/**
 * Before a signature: what the check saw that the answers do not say. Major
 * findings or a photo that is not this item, signed with no line failed — the
 * inspector may well be right, but is asked once, by name of what was seen.
 */
export function signWarning(c: PhotoCheck | null, results: Record<string, CheckResult | undefined>): { major: string[]; notItem: boolean; samePhoto: boolean } | null {
  if (!c) return null;
  const failed = Object.values(results).some((v) => v === 'fail');
  const major = failed ? [] : c.findings.filter((f) => f.major).map((f) => f.where);
  const notItem = c.match === 'no' || c.same === 'other' || c.differs.length > 0;
  const samePhoto = c.same === 'samePhoto';
  return major.length || notItem || samePhoto ? { major, notItem, samePhoto } : null;
}

/** The check in English, for the remark (the record and its report stay English). */
export function checkRemark(c: PhotoCheck): string {
  const parts: string[] = [];
  if (c.findings.length) parts.push(c.findings.map((f) => `${f.major ? 'Major' : 'Minor'} ${f.kind}: ${f.where}`).join('; '));
  else parts.push('No corrosion or damage seen');
  if (c.differs.length) parts.push(`label differs from the register — ${c.differs.join(', ')}`);
  if (c.match === 'no') parts.push('photo may not show this item');
  if (c.same === 'other') parts.push('may not be the unit photographed before');
  if (c.same === 'samePhoto') parts.push('looks like the earlier photo');
  return `${parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('. ')}. (AI photo check)`;
}

/** The defect line from the major findings, or '' when there are none. */
export function checkDefect(c: PhotoCheck): string {
  return c.findings.filter((f) => f.major).map((f) => `${f.kind[0].toUpperCase()}${f.kind.slice(1)}: ${f.where}`).join('; ');
}
