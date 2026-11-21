// ===================================
// Where an entry in a record book came from: a LATE entry (its operation is
// earlier than an entry already in the book) and an entry ENTERED FROM THE
// PAPER RECORD BOOK after a failure (doc. 03 §6). ISO 21745 as read by the
// flags: entries in chronological order, a late one marked with the reason
// for the delay; paper entries carried over marked as such.
//
// Both are fields on the entry, written BEFORE withSeal (never added after
// signing — it breaks the seal). Pure: check:entryorigin drives it.
// ===================================

import { shipInstant } from '../utils/shipTime';

/** What an entry says about its origin. `late` = the reason; `fromPaper` + `paperPage`. */
export interface EntryOrigin {
  late?: string;
  fromPaper?: boolean;
  paperPage?: string;
}

type Timed = { id: string; date: string; time?: string; shipOffset?: string; cancelled?: boolean };

/** The moment of an entry's operation. With no time, the end of its day for the new one (benefit of the doubt), the start for the book's. */
function moment(e: { date: string; time?: string; shipOffset?: string }, side: 'new' | 'book'): number {
  const hm = /^\d{1,2}:\d{2}$/.test(e.time ?? '') ? e.time! : side === 'new' ? '23:59' : '00:00';
  return shipInstant(e.date, hm, e.shipOffset);
}

/**
 * The latest standing entry in the book whose operation is LATER than the new one's —
 * i.e. the new entry would be out of order. `standing` = current versions (services/versions
 * current); cancelled ones do not count. Undefined = in order.
 */
export function laterEntry<T extends Timed>(draft: { date: string; time?: string; shipOffset?: string }, standing: T[]): T | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return undefined;
  const at = moment(draft, 'new');
  let best: T | undefined;
  let bestAt = -Infinity;
  for (const e of standing) {
    if (e.cancelled) continue;
    const m = moment(e, 'book');
    if (m > at && m > bestAt) { best = e; bestAt = m; }
  }
  return best;
}

/** The fields to write onto the new entry (only what applies — Firestore refuses undefined). */
export function originFields(late: boolean, reason: string, fromPaper: boolean, page: string): EntryOrigin {
  const out: EntryOrigin = {};
  if (fromPaper) {
    out.fromPaper = true;
    if (page.trim()) out.paperPage = page.trim();
  }
  if (late && reason.trim()) out.late = reason.trim();
  return out;
}

/** Why the entry cannot be signed yet, or null. A paper entry is its own reason for being late. */
export function originProblem(late: boolean, reason: string, fromPaper: boolean): string | null {
  if (late && !fromPaper && reason.trim().length < 3) return 'late';
  return null;
}

/** The line the true copy prints (English — papers are never translated). Empty when neither. */
export function originNote(e: EntryOrigin): string {
  const parts: string[] = [];
  if (e.fromPaper) parts.push(`Entered from the paper record book${e.paperPage ? `, page ${e.paperPage}` : ''}`);
  if (e.late) parts.push(`LATE ENTRY — ${e.late}`);
  return parts.join('; ');
}
