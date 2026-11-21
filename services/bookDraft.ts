// ===================================
// A record book entry being typed but not yet signed — kept on THIS device as a
// draft, one per book, saved half a second after every change and offered back
// the next time "New entry" is opened (21 Nov 2026: ISO 21745 as read by
// BG Verkehr — "data entered have to be saved automatically, as a minimum every
// 15 minutes"; before this an ORB form closed by accident lost what was typed).
//
// Deliberately NOT a record: the books are append-only and sealed, an older
// build would read any draft row as signed, and an unsigned form is nobody's
// statement. So it never syncs, is not in the .msm backup and is erased with the
// device (resetAllData drops every `msm:book_draft:` key). The signer and the
// signature are never part of it — whoever signs chooses their name then.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export const BOOK_DRAFT_PREFIX = 'msm:book_draft:';

export interface BookDraft<F> {
  at: number;
  f: F;
}

/** Date and time are filled in by themselves on a new form, so they alone are not worth keeping. */
const IGNORED = new Set(['date', 'time']);

/** Empty strings, nulls and empty maps read the same as a field left alone. */
function norm(v: unknown): unknown {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.length ? v.map(norm) : null;
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = norm((v as Record<string, unknown>)[k]);
      if (x != null) o[k] = x;
    }
    return Object.keys(o).length ? o : null;
  }
  return v;
}

/** Something was typed or chosen beyond what a new form starts with. */
export function draftWorth<F extends object>(f: F, blank: F): boolean {
  const keys = new Set([...Object.keys(f), ...Object.keys(blank)]);
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    if (JSON.stringify(norm((f as any)[k])) !== JSON.stringify(norm((blank as any)[k]))) return true;
  }
  return false;
}

const key = (book: string) => `${BOOK_DRAFT_PREFIX}${book}`;

export async function loadBookDraft<F extends object>(book: string, blank: F): Promise<BookDraft<F> | null> {
  try {
    const raw = await AsyncStorage.getItem(key(book));
    const d = raw ? (JSON.parse(raw) as BookDraft<F>) : null;
    // A field added to the form since the draft was kept takes its blank value.
    return d && d.f && draftWorth(d.f, blank) ? { at: d.at, f: { ...blank, ...d.f } } : null;
  } catch {
    return null;
  }
}

/** Keeps the form, or forgets the draft when nothing is in it. Returns whether a draft is kept. */
export async function saveBookDraft<F extends object>(book: string, f: F, blank: F): Promise<boolean> {
  try {
    if (!draftWorth(f, blank)) {
      await AsyncStorage.removeItem(key(book));
      return false;
    }
    await AsyncStorage.setItem(key(book), JSON.stringify({ at: Date.now(), f }));
    return true;
  } catch {
    // A draft is a convenience; a full disk must not stop the entry being signed.
    return false;
  }
}

export const clearBookDraft = (book: string) => AsyncStorage.removeItem(key(book)).catch(() => undefined);
