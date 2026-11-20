// ===================================
// Who opened and who exported a record book (25 Oct 2026, MEPC.312(74) §4.3.2:
// the audit log names who entered, opened and changed the records — stage 1 had
// "entered" and "changed"). Written once, synced (`book_access`), never edited.
//
// An OPEN is noted once per book and month per device every 30 minutes — a
// Master scrolling the month should not write a line a second. Every export
// (PDF, Excel, the Master's signed copy) is noted each time.
//
// An INTEGRITY line (20 Nov 2026, MEPC.312 §4.1.2: "the system should
// automatically record any attempts to manipulate or falsify any data"): the
// first device that finds a month's seals or chain broken writes what it found,
// once per finding — the screen showing it red was not a record of it.
// ===================================

export type BookKey = 'orb' | 'grb' | 'sewage' | 'ballast' | 'fuelChange' | 'ods';
export type AccessWhat = 'open' | 'pdf' | 'xlsx' | 'copy' | 'integrity';

export interface BookAccess {
  id: string;
  book: BookKey;
  month: string;
  what: AccessWhat;
  /** Who: the device's account, or the name picked on a shared device (may be blank). */
  by?: string;
  byId?: string;
  deviceId?: string;
  /** `integrity` only: what was found (English, `integrityDetail`) — the same finding is never written twice. */
  detail?: string;
  at: number;
  updatedAt: number;
}

export const OPEN_EVERY_MS = 30 * 60_000;

/** A new open is worth a line: none by this device for this book and month in the last 30 minutes. */
export function openIsNew(log: BookAccess[], book: BookKey, month: string, deviceId: string | undefined, now: number): boolean {
  return !log.some((a) => a.what === 'open' && a.book === book && a.month === month && a.deviceId === deviceId && now - a.at < OPEN_EVERY_MS);
}

/** The month's lines, newest first. */
export function accessFor(log: BookAccess[], book: BookKey, month: string): BookAccess[] {
  return log.filter((a) => a.book === book && a.month === month).sort((a, b) => b.at - a.at);
}

const WHAT: Record<AccessWhat, string> = { open: 'opened', pdf: 'printed (PDF)', xlsx: 'exported (Excel)', copy: "exported the Master's signed copy", integrity: 'found the records altered' };

/** `25.10.2026 14:05 UTC — 2/O J. Smith opened` — English, for paper. */
export function accessLine(a: BookAccess, stamp: (ms: number) => string): string {
  return `${stamp(a.at)} — ${a.by || 'unnamed user'}${a.byId ? ` (ID ${a.byId})` : ''}${a.deviceId ? `, device ${a.deviceId.slice(0, 8)}` : ''} ${WHAT[a.what]}${a.detail ? `: ${a.detail}` : ''}`;
}

/** What a month's check found, in a fixed order so the same finding reads the same on every device; null when nothing. */
export function integrityDetail(it: { bad: string[]; gaps: string[]; badVerifications: string[] }): string | null {
  const ids = (xs: string[]) => [...xs].sort().join(', ');
  const parts = [
    it.bad.length ? `${it.bad.length} ${it.bad.length === 1 ? 'record does' : 'records do'} not match the seal (${ids(it.bad)})` : null,
    it.gaps.length ? `the record before ${ids(it.gaps)} is missing` : null,
    it.badVerifications.length ? `Master's verification ${ids(it.badVerifications)} no longer matches` : null,
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

/** Not written yet by any device: the same finding for the same book and month is one line. */
export function integrityIsNew(log: BookAccess[], book: BookKey, month: string, detail: string): boolean {
  return !log.some((a) => a.what === 'integrity' && a.book === book && a.month === month && a.detail === detail);
}
