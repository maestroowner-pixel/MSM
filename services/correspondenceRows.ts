// ===================================
// The correspondence register's rows on paper (services/correspondenceReport.ts)
// — pure, so `npm run check:letters` can read them. English always.
// ===================================

import { letterState, repliesTo } from './correspondence';
import { Letter, PARTY_EN, VIA_EN } from '../types/correspondence';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const dmyAt = (ms: number) => dmy(new Date(ms).toISOString().slice(0, 10));
const who = (s: { by: string; byRank?: string }) => (s.byRank ? `${s.by} (${s.byRank})` : s.by || '—');

/** What became of a letter: the answer's number, a closing note, or what is still owed. */
function outcome(l: Letter, all: Letter[], today: string): string {
  if (l.cancelled) return `CANCELLED ${dmyAt(l.cancelled.at)}: ${l.cancelled.note ?? ''}`.trim();
  const to = l.replyTo ? all.find((x) => x.id === l.replyTo) : undefined;
  const by = repliesTo(l, all);
  if (l.dir === 'out') return [to ? `Answers ${to.no}` : '', by.length ? `Answered by ${by.map((r) => `${r.no} ${dmy(r.date)}`).join(', ')}` : ''].filter(Boolean).join('; ');
  const prefix = to ? `Answers ${to.no}; ` : '';
  const s = letterState(l, all, today);
  if (s === 'answered') return `${prefix}Answered by ${by.map((r) => `${r.no} ${dmy(r.date)}`).join(', ')}`;
  if (s === 'closed') return `${prefix}Closed ${dmyAt(l.closed!.at)}${l.closed!.by ? ` by ${who(l.closed!)}` : ''}${l.closed!.note ? `: ${l.closed!.note}` : ''}`;
  if (s === 'overdue') return `${prefix}ANSWER OVERDUE since ${dmy(l.replyBy)}`;
  if (s === 'soon' || s === 'waiting') return `${prefix}${l.replyBy ? `Answer by ${dmy(l.replyBy)}` : 'Answer expected'}`;
  return to ? `Answers ${to.no}` : '';
}

/** One row per letter, oldest first within the period — the same for the PDF and the sheet. */
export function letterRows(list: Letter[], all: Letter[], today: string): string[][] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no)).map((l) => [
    l.no,
    dmy(l.date),
    `${l.party}${l.kind !== 'other' ? ` — ${PARTY_EN[l.kind]}` : ''}`,
    l.subject,
    l.ref ?? '',
    l.via ? VIA_EN[l.via] : '',
    l.actionBy ?? '',
    outcome(l, all, today),
    l.file ? 'Yes' : '',
    who(l),
  ]);
}

/** Letters dated within [from, to] (yyyy-mm-dd, either may be empty). */
export const inPeriod = (list: Letter[], from: string, to: string) => list.filter((l) => (!from || l.date >= from) && (!to || l.date <= to));

/** One letter on its own page — what "Share PDF" sends: the entry, how it stands, and the letters on either side of it. */
export function letterSheet(l: Letter, all: Letter[], today: string): { title: string; facts: string[]; tables: { title: string; head: string[]; rows: string[][]; widths: Record<number, number> }[] } {
  const rows: string[][] = [
    ['Status', outcome(l, all, today) || (l.dir === 'in' ? 'For information' : 'Sent')],
    ...(l.dir === 'in' && l.needsReply && l.replyBy ? [['Answer by', dmy(l.replyBy)]] : []),
    ...(l.actionBy ? [['Action by', l.actionBy]] : []),
    ...(l.notes ? [['Notes', l.notes]] : []),
  ];
  const linked = [...(l.replyTo ? all.filter((x) => x.id === l.replyTo) : []), ...repliesTo(l, all)];
  return {
    title: `${l.no} — ${l.subject}`,
    facts: [
      l.dir === 'in' ? `Incoming, received ${dmy(l.date)}` : `Outgoing, sent ${dmy(l.date)}`,
      `${l.dir === 'in' ? 'From' : 'To'} ${l.party}${l.kind !== 'other' ? ` (${PARTY_EN[l.kind]})` : ''}`,
      ...(l.ref ? [`Their ref. ${l.ref}`] : []),
      ...(l.via ? [VIA_EN[l.via]] : []),
      ...(l.file ? [`File: ${l.file.name}`] : []),
      ...(l.by ? [`Entered by ${who(l)}`] : []),
      `Printed ${dmy(today)}`,
    ],
    tables: [
      { title: 'Entry', head: ['', ''], rows, widths: { 0: 40, 1: 237 } },
      ...(linked.length ? [{ title: 'Correspondence on it', head: ['No.', 'Date', 'From / to', 'Subject'], rows: linked.map((x) => [x.no, dmy(x.date), x.party, x.subject]), widths: { 0: 32, 1: 24, 2: 70, 3: 151 } }] : []),
    ],
  };
}
