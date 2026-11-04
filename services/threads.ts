// ===================================
// Discussion on a record (types/thread.ts, plan item 43) — the pure part: who a
// message mentions, what waits for the office, what this device has not read.
// Tested by `npm run check:threads`.
//
// Nothing is stored about who answered: the office's list is read from the
// messages (as officeInbox reads everything), so a reply takes a row off it.
// What this device has read is device-local (prefs.threadRead) — a shared tablet
// and a phone each keep their own.
// ===================================

import { ThreadMessage, ThreadRec, ThreadSide } from '../types/thread';
import { uid } from '../utils/id';

export const THREAD_MAX = 2000;
/** The same word in every language: it is what is typed. */
export const OFFICE_TAG = 'Office';

export const threadKey = (rec: ThreadRec, recId: string): string => `${rec}:${recId}`;
const keyOf = (m: ThreadMessage) => threadKey(m.rec, m.recId);
const byTime = (a: ThreadMessage, b: ThreadMessage) => a.at - b.at || a.id.localeCompare(b.id);

/** One record's messages, oldest first. */
export function threadOf(all: ThreadMessage[], rec: ThreadRec, recId: string): ThreadMessage[] {
  return all.filter((m) => m.rec === rec && m.recId === recId).sort(byTime);
}

function grouped(all: ThreadMessage[]): ThreadMessage[][] {
  const by = new Map<string, ThreadMessage[]>();
  for (const m of all) {
    const k = keyOf(m);
    const l = by.get(k);
    if (l) l.push(m);
    else by.set(k, [m]);
  }
  return [...by.values()].map((l) => l.sort(byTime));
}

const isWordChar = (c: string | undefined) => !!c && (c.toLowerCase() !== c.toUpperCase() || (c >= '0' && c <= '9'));

/**
 * Who `text` mentions: `@Name` for each of `people`, in any case, and `@Office`.
 * Longest name first, so "@Ann Lee" is Ann Lee and not Ann; "@Annabel" is neither.
 */
export function mentionsIn(text: string, people: string[]): { mentions: string[]; office: boolean } {
  let rest = text.toLowerCase();
  const take = (name: string): boolean => {
    const tag = `@${name.trim().toLowerCase()}`;
    if (tag.length < 2) return false;
    let from = 0;
    for (;;) {
      const at = rest.indexOf(tag, from);
      if (at < 0) return false;
      if (!isWordChar(rest[at + tag.length])) {
        rest = rest.slice(0, at) + ' '.repeat(tag.length) + rest.slice(at + tag.length);
        return true;
      }
      from = at + tag.length;
    }
  };
  const mentions = [...new Set(people)].sort((a, b) => b.length - a.length).filter(take);
  return { mentions, office: take(OFFICE_TAG) };
}

export interface NewMessage {
  rec: ThreadRec;
  recId: string;
  title: string;
  text: string;
  by: string;
  byRank?: string;
  side: ThreadSide;
}

export function makeMessage(x: NewMessage, people: string[], at: number): ThreadMessage {
  const text = x.text.trim();
  if (!text) throw new Error('Nothing to send');
  if (text.length > THREAD_MAX) throw new Error('Too long');
  const { mentions, office } = mentionsIn(text, people);
  return {
    id: uid(),
    rec: x.rec,
    recId: x.recId,
    title: x.title,
    text,
    by: x.by,
    ...(x.byRank ? { byRank: x.byRank } : {}),
    at,
    side: x.side,
    ...(mentions.length ? { mentions } : {}),
    ...(office ? { office: true } : {}),
  };
}

/**
 * Threads waiting for the office: the last word is the vessel's, and the vessel
 * called on the office since it last wrote — or the office is already in the
 * conversation, when a reply needs no `@Office`. Since = the first message it
 * has not answered.
 */
export function threadsToAnswer(all: ThreadMessage[]): { last: ThreadMessage; since: number }[] {
  const out: { last: ThreadMessage; since: number }[] = [];
  for (const l of grouped(all)) {
    const last = l[l.length - 1];
    if (last.side === 'office') continue;
    const lastOffice = l.map((m) => m.side).lastIndexOf('office');
    const after = l.slice(lastOffice + 1);
    const first = lastOffice >= 0 ? after[0] : after.find((m) => m.office);
    if (first) out.push({ last, since: first.at });
  }
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const unread = (m: ThreadMessage, read: Record<string, number>) => m.at > (read[keyOf(m)] ?? 0);

/** Messages naming this person that this device has not opened, newest first. Nobody's own. */
export function unreadMentions(all: ThreadMessage[], me: string | undefined, read: Record<string, number> = {}): ThreadMessage[] {
  if (!me) return [];
  return all.filter((m) => unread(m, read) && !same(m.by, me) && (m.mentions ?? []).some((n) => same(n, me))).sort((a, b) => byTime(b, a));
}

/** The office's latest unread message per thread — what the officers are told about. */
export function unreadFromOffice(all: ThreadMessage[], read: Record<string, number> = {}): ThreadMessage[] {
  return grouped(all)
    .map((l) => l.filter((m) => m.side === 'office').pop())
    .filter((m): m is ThreadMessage => !!m && unread(m, read))
    .sort((a, b) => byTime(b, a));
}

/** Mentions not yet notified on this device. */
export function mentionsToNotify(all: ThreadMessage[], me: string | undefined, read: Record<string, number> = {}, notifiedAt = 0): ThreadMessage[] {
  return unreadMentions(all, me, read).filter((m) => m.at > notifiedAt);
}

export interface ThreadRow {
  rec: ThreadRec;
  recId: string;
  title: string;
  last?: ThreadMessage;
  count: number;
}

/** Fleet's list: records with messages, latest first; then the open records nobody has discussed yet. */
export function threadRows(all: ThreadMessage[], open: { rec: ThreadRec; recId: string; title: string }[]): ThreadRow[] {
  const talked = grouped(all)
    .map((l) => ({ rec: l[0].rec, recId: l[0].recId, title: l[l.length - 1].title, last: l[l.length - 1], count: l.length }))
    .sort((a, b) => b.last.at - a.last.at);
  const seen = new Set(talked.map((r) => threadKey(r.rec, r.recId)));
  return [...talked, ...open.filter((r) => !seen.has(threadKey(r.rec, r.recId))).map((r) => ({ ...r, count: 0 }))];
}

/** How each kind of record is named in a thread. */
export const defectTitle = (d: { machineName: string; description: string }) => `${d.machineName} — ${d.description}`;
export const ncTitle = (n: { no: string; title: string }) => `${n.no} — ${n.title}`;
/** Where a record opens aboard. */
export const THREAD_ROUTE: Record<ThreadRec, string> = { defect: 'PmsDefect', nc: 'Nc', po: 'Order' };
