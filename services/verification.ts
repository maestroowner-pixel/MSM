// ===================================
// The Master's verification of a record book (25 Oct 2026, for flag approval
// of the electronic books — MEPC.312(74) §4.3.6–4.3.10).
//
// The Master used to sign a MONTH: one signature, written once, and an entry
// amended a week later still sat under it. The guidelines want every entry to
// carry its own stage — "awaiting verification" until the Master verifies it,
// "verified" after, and back to "re-verification" the moment it is amended.
//
// So a verification now names the entry VERSIONS it covers (`covers`). A new
// version (services/versions — an amendment or a deletion) has a new id, so no
// signature covers it until the Master signs again; signatures are still
// written once and never changed (firestore.rules), a month simply gets more
// than one. Signatures from before 2.68 carry no `covers`: they verified every
// version of their month written before them, which is what they meant then.
// ===================================

import type { SignProof } from './signature';
import { Integrity, bookIntegrity, checkRecord, registeredKeys, sealLine, sealOf } from './seal';

/** A Master's signature over entries of one month of one book. */
export interface MonthVerification {
  /** `<book>_<yyyy-mm>` for the month's first, `<book>_<yyyy-mm>_<ms>` after. */
  id: string;
  month: string;
  by: string;
  byRank?: string;
  /** The Master's id (crew id or `device:<id>`), since 2.69 — the key register is checked against it. */
  byId?: string;
  at: number;
  signedWith?: SignProof;
  /** The entry versions verified. Absent before 2.68 (see the header). */
  covers?: string[];
  /** contentHash of each covered version, in order — sealed with the verification (services/seal), since 2.69. */
  coverHashes?: string[];
  updatedAt: number;
}

/** What `entryStatus` needs of an entry — every book's entry has it. */
export interface VerifiableEntry {
  id: string;
  date: string;
  at: number;
  supersedes?: string;
  cancelled?: boolean;
  /** The hash of the book's entry before this one (services/seal chainHead), since 2.69. */
  prev?: string;
}

export type EntryStatus = 'verified' | 'pending' | 'reverify';

/** Every entry version some signature verified. */
export function verifiedIds(all: VerifiableEntry[], signs: MonthVerification[]): Set<string> {
  const out = new Set<string>();
  for (const s of signs) {
    if (s.covers) s.covers.forEach((id) => out.add(id));
    else for (const r of all) if (r.date.startsWith(s.month) && r.at <= s.at) out.add(r.id);
  }
  return out;
}

/**
 * `verified` — this very version was verified; `reverify` — an earlier version
 * was, so the change has not been; `pending` — never verified.
 */
export function entryStatus(r: VerifiableEntry, all: VerifiableEntry[], verified: Set<string>): EntryStatus {
  if (verified.has(r.id)) return 'verified';
  const byId = new Map(all.map((x) => [x.id, x]));
  let id = r.supersedes;
  for (let n = 0; id && n < 50; n++) {
    if (verified.has(id)) return 'reverify';
    id = byId.get(id)?.supersedes;
  }
  return 'pending';
}

/** The entries of `book` (the current versions on the page) still to be verified. */
export function awaiting<T extends VerifiableEntry>(book: T[], verified: Set<string>): T[] {
  return book.filter((r) => !verified.has(r.id));
}

/** The id of a new verification — the old `<book>_<month>` for the first, so pre-2.68 devices still see the month signed. */
export function verificationId(prefix: string, month: string, signs: MonthVerification[], at: number): string {
  return signs.some((s) => s.month === month) ? `${prefix}_${month}_${at}` : `${prefix}_${month}`;
}

/** The month's signatures, oldest first. */
export function monthSigns<S extends MonthVerification>(signs: S[], month: string): S[] {
  return signs.filter((s) => s.month === month).sort((a, b) => a.at - b.at);
}

/** How the stage reads on a printed page (English — official paper). */
export function statusLine(st: EntryStatus, sign?: MonthVerification): string {
  if (st === 'verified') return sign ? `Verified by the Master ${utcStamp(sign.at)}` : 'Verified by the Master';
  return st === 'reverify' ? 'Amended — awaiting re-verification' : 'Awaiting verification';
}

/** The signature that verified this version (the first that covers it). */
export function verifiedBy(r: VerifiableEntry, signs: MonthVerification[]): MonthVerification | undefined {
  return [...signs].sort((a, b) => a.at - b.at).find((s) => (s.covers ? s.covers.includes(r.id) : r.date.startsWith(s.month) && r.at <= s.at));
}

/** `25.10.2026 14:05 UTC` — the audit trail's time is UTC (MEPC.312 §3.2). */
export function utcStamp(ms: number): string {
  const d = new Date(ms).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)} ${d.slice(11, 16)} UTC`;
}

// ---- the printed page (utils/trueCopyPdf) — English, official paper ----------

/** The page in print order: each entry as it stands, its earlier versions under it, newest first (§4.3.4). */
export function withEarlier<T extends VerifiableEntry>(book: T[], all: T[]): { r: T; earlier: boolean }[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const out: { r: T; earlier: boolean }[] = [];
  for (const r of book) {
    out.push({ r, earlier: false });
    let id = r.supersedes;
    for (let n = 0; id && byId.has(id) && n < 50; n++) {
      const p = byId.get(id)!;
      out.push({ r: p, earlier: true });
      id = p.supersedes;
    }
  }
  return out;
}

interface Signed {
  by: string;
  byRank?: string;
  byId?: string;
  at: number;
  signedWith?: SignProof;
  /** A version made by services/versions: the original's signer stays, the amender is here. */
  editedBy?: string;
  editedByRank?: string;
  editedAt?: number;
  editedWith?: SignProof;
}

const how = (p?: SignProof) => (!p ? '' : p.method === 'biometric' ? 'biometric' : p.method === 'drawn' ? 'by hand' : 'PIN');

/** Who entered it: name (rank), their ID in the book, when and how it was signed (§6.3.1, §4.3.7), and its seal (§4.3.3). */
export function signerCell(r: Signed): string {
  const who = [r.byRank ? `${r.by} (${r.byRank})` : r.by, r.byId ? `ID ${r.byId}` : null];
  const seal = sealLine(checkRecord(r as any, registeredKeys()), sealOf(r as any));
  // An amendment keeps the officer who made the entry; the time and signature are the amender's.
  if (r.editedBy) return [...who, `changed ${utcStamp(r.editedAt ?? r.at)} by ${r.editedByRank ? `${r.editedBy} (${r.editedByRank})` : r.editedBy}${r.editedWith ? `, ${how(r.editedWith)}` : ''}`, seal].filter(Boolean).join('\n');
  return [...who, `entered ${utcStamp(r.at)}${r.signedWith ? `, ${how(r.signedWith)}` : ''}`, seal].filter(Boolean).join('\n');
}

/** The Master's column for one row. */
export function masterCell(r: VerifiableEntry, all: VerifiableEntry[], signs: MonthVerification[], earlier: boolean): string {
  const ids = verifiedIds(all, signs);
  const s = verifiedBy(r, signs);
  if (earlier) return s ? `Superseded · was verified ${utcStamp(s.at)}` : 'Superseded · not verified';
  return statusLine(entryStatus(r, all, ids), s);
}

/** One line per signature of the month. */
export function verificationLines(signs: MonthVerification[]): string[] {
  return [...signs]
    .sort((a, b) => a.at - b.at)
    .map((s) => `Verified by ${s.byRank ? `${s.by} (${s.byRank})` : s.by} on ${utcStamp(s.at)}${s.signedWith ? `, ${how(s.signedWith)}` : ''} — ${s.covers ? `${s.covers.length} ${s.covers.length === 1 ? 'entry' : 'entries'}` : 'all entries made before it'}${s.signedWith?.seal ? ` · ${sealLine(checkRecord(s, registeredKeys()), s.signedWith.seal)}` : ''}`);
}

/** The month's entries (with their earlier versions) and verifications checked against their seals and the chain. */
export function monthIntegrity<E extends VerifiableEntry>(book: E[], all: E[], signs: MonthVerification[], month: string): Integrity {
  const rows = withEarlier(book, all).map((x) => x.r);
  const it = bookIntegrity(rows as any, monthSigns(signs, month) as any, registeredKeys());
  // A gap is judged against the WHOLE book: the entry before may be last month's.
  const ids = new Set(rows.map((r) => r.id));
  return { ...it, gaps: bookIntegrity(all as any, [], undefined).gaps.filter((id) => ids.has(id)) };
}

/** The integrity paragraph of a printed copy (§4.3.3–4.3.4). English — official paper. */
export function integrityLines(it: Integrity): string[] {
  const n = it.sealed + it.unsealed;
  if (!n) return [];
  const out = [
    `Electronic seals (ECDSA P-256 over SHA-256 of each record): ${it.sealed} of ${n} ${n === 1 ? 'record' : 'records'} sealed${it.unsealed ? `, ${it.unsealed} made before seals were introduced or without a key` : ''}.`,
  ];
  if (it.bad.length) out.push(`WARNING: ${it.bad.length} ${it.bad.length === 1 ? 'record does' : 'records do'} not match their seal or key register — see the rows marked.`);
  else if (it.sealed) out.push('Every sealed record matches its seal.');
  if (it.badVerifications.length) out.push(`WARNING: ${it.badVerifications.length} Master's verification(s) no longer match the records they verified.`);
  if (it.gaps.length) out.push(`WARNING: the record before ${it.gaps.length} ${it.gaps.length === 1 ? 'entry is' : 'entries are'} missing from the book (chain of hashes broken).`);
  else if (it.sealed) out.push('Chain of hashes unbroken.');
  return out;
}

/**
 * A true copy's rows: `base` gives a record's own columns, `textCol` is the one
 * an earlier version is labelled in; the officer and the Master's stage follow.
 */
export function copyRows<E extends VerifiableEntry & Signed>(book: E[], all: E[], signs: MonthVerification[], base: (r: E) => string[], textCol: number): { rows: string[][]; struck: boolean[] } {
  const lines = withEarlier(book, all);
  return {
    rows: lines.map(({ r, earlier }) => {
      const row = base(r);
      if (earlier) row[textCol] = `[Earlier version] ${row[textCol]}`.trim();
      return [...row, signerCell(r), masterCell(r, all, signs, earlier)];
    }),
    struck: lines.map(({ r, earlier }) => earlier || !!r.cancelled),
  };
}
