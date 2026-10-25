// ===================================
// Who opened and who exported a record book (25 Oct 2026, MEPC.312(74) §4.3.2:
// the audit log names who entered, opened and changed the records — stage 1 had
// "entered" and "changed"). Written once, synced (`book_access`), never edited.
//
// An OPEN is noted once per book and month per device every 30 minutes — a
// Master scrolling the month should not write a line a second. Every export
// (PDF, Excel, the Master's signed copy) is noted each time.
// ===================================

export type BookKey = 'orb' | 'grb' | 'sewage' | 'ballast';
export type AccessWhat = 'open' | 'pdf' | 'xlsx' | 'copy';

export interface BookAccess {
  id: string;
  book: BookKey;
  month: string;
  what: AccessWhat;
  /** Who: the device's account, or the name picked on a shared device (may be blank). */
  by?: string;
  byId?: string;
  deviceId?: string;
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

const WHAT: Record<AccessWhat, string> = { open: 'opened', pdf: 'printed (PDF)', xlsx: 'exported (Excel)', copy: "exported the Master's signed copy" };

/** `25.10.2026 14:05 UTC — 2/O J. Smith opened` — English, for paper. */
export function accessLine(a: BookAccess, stamp: (ms: number) => string): string {
  return `${stamp(a.at)} — ${a.by || 'unnamed user'}${a.byId ? ` (ID ${a.byId})` : ''}${a.deviceId ? `, device ${a.deviceId.slice(0, 8)}` : ''} ${WHAT[a.what]}`;
}
