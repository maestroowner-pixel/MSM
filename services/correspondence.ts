// ===================================
// The correspondence register (types/correspondence.ts) — pure, so
// `npm run check:letters` can reach every rule: the numbers, what an incoming
// letter is waiting for, the Board, the list's order and the search.
// ===================================

import { Letter, LetterDir } from '../types/correspondence';

/** The next number for a direction in the year of `date`: IN-2026-001, OUT-2026-001. Cancelled ones stay counted. */
export function nextLetterNo(list: Pick<Letter, 'no'>[], dir: LetterDir, date: string): string {
  const p = `${dir === 'in' ? 'IN' : 'OUT'}-${date.slice(0, 4)}-`;
  const top = list.reduce((m, l) => (l.no.startsWith(p) ? Math.max(m, Number(l.no.slice(p.length)) || 0) : m), 0);
  return `${p}${String(top + 1).padStart(3, '0')}`;
}

/** Letters of the other direction that answer this one (cancelled ones do not). */
export function repliesTo(l: Pick<Letter, 'id' | 'dir'>, list: Letter[]): Letter[] {
  return list.filter((x) => x.dir !== l.dir && x.replyTo === l.id && !x.cancelled).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Where an incoming letter stands:
 *   info      nothing expected
 *   answered  a letter of ours answers it
 *   closed    an officer closed it without a letter
 *   overdue   expected, past `replyBy`
 *   soon      expected within SOON_DAYS
 *   waiting   expected, no date or a later one
 * An outgoing or cancelled letter is `info`.
 */
export type LetterState = 'info' | 'answered' | 'closed' | 'overdue' | 'soon' | 'waiting';
export const SOON_DAYS = 3;

export function letterState(l: Letter, list: Letter[], today: string): LetterState {
  if (l.dir !== 'in' || l.cancelled) return 'info';
  if (repliesTo(l, list).length) return 'answered';
  if (l.closed) return 'closed';
  if (!l.needsReply) return 'info';
  if (!l.replyBy) return 'waiting';
  if (l.replyBy < today) return 'overdue';
  return l.replyBy <= addDays(today, SOON_DAYS) ? 'soon' : 'waiting';
}

export const isOpen = (s: LetterState) => s === 'overdue' || s === 'soon' || s === 'waiting';

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface LetterBoard {
  overdue: Letter[];
  soon: Letter[];
  waiting: Letter[];
}

/** The Board's three lines: answers late (red), due within three days (amber), waiting (blue). */
export function letterBoard(list: Letter[], today: string): LetterBoard {
  const b: LetterBoard = { overdue: [], soon: [], waiting: [] };
  for (const l of list) {
    const s = letterState(l, list, today);
    if (s === 'overdue' || s === 'soon' || s === 'waiting') b[s].push(l);
  }
  const by = (a: Letter, c: Letter) => (a.replyBy ?? '9').localeCompare(c.replyBy ?? '9') || a.date.localeCompare(c.date);
  b.overdue.sort(by);
  b.soon.sort(by);
  b.waiting.sort(by);
  return b;
}

/** Waiting for an answer first (the most urgent on top), then everything else newest first. */
export function sortLetters(list: Letter[], today: string): Letter[] {
  const w: Record<LetterState, number> = { overdue: 0, soon: 1, waiting: 2, info: 3, answered: 3, closed: 3 };
  return [...list].sort((a, b) => {
    const sa = w[letterState(a, list, today)];
    const sb = w[letterState(b, list, today)];
    if (sa !== sb) return sa - sb;
    if (sa < 3) return (a.replyBy ?? '9').localeCompare(b.replyBy ?? '9') || a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date) || b.no.localeCompare(a.no);
  });
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Search by number, from / to, subject, their reference or the notes. */
export function letterMatches(l: Letter, q: string): boolean {
  const s = fold(q.trim());
  if (!s) return true;
  return [l.no, l.party, l.subject, l.ref, l.notes, l.actionBy].some((v) => v && fold(v).includes(s));
}

/** What is wrong with a draft before it is saved, or null. */
export function letterProblem(l: Letter): 'party' | 'subject' | 'date' | 'replyBy' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return 'date';
  if (!l.party.trim()) return 'party';
  if (!l.subject.trim()) return 'subject';
  if (l.dir === 'in' && l.replyBy && (!/^\d{4}-\d{2}-\d{2}$/.test(l.replyBy) || l.replyBy < l.date)) return 'replyBy';
  return null;
}

/** An answer to an incoming letter, ready to fill in: to whom it came from, "Re:" its subject, today. */
export function replyDraft(to: Letter, id: string, today: string, by: string, byRank?: string): Letter {
  const subject = /^re:/i.test(to.subject) ? to.subject : `Re: ${to.subject}`;
  return {
    id, dir: 'out', no: '', date: today, party: to.party, kind: to.kind, subject, replyTo: to.id,
    ...(to.via ? { via: to.via } : {}), by, ...(byRank ? { byRank } : {}), createdAt: Date.now(), updatedAt: 0,
  };
}
