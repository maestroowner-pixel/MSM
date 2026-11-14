// ===================================
// The Master's orders on paper (services/orderBookReport.ts) — pure, so
// `npm run check:orders` can read them. English always.
// ===================================

import { nightState, signStatus, sortNights, standingReaders } from './orderBook';
import { CrewMember } from '../types/crew';
import { NightOrder, OrderAck, StandingOrder } from '../types/orderBook';
import type { MachineHistory } from './pmsHistory';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const hm = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const who = (s: { by: string; byRank?: string }) => (s.byRank ? `${s.by} (${s.byRank})` : s.by || '—');
const named = (r: { name: string; rank?: string }) => (r.rank ? `${r.name} (${r.rank})` : r.name);

export const KIND_EN = { master: "Master's Standing Orders", dp: 'DP Standing Orders' } as const;

/** What became of a night: closed, cancelled, still running or waiting to be closed. */
function nightOutcome(o: NightOrder, now: string): string {
  const s = nightState(o, now);
  if (s === 'cancelled') return `CANCELLED ${hm(o.cancelled!.at)}${o.cancelled!.by ? ` by ${who(o.cancelled!)}` : ''}${o.cancelled!.note ? `: ${o.cancelled!.note}` : ''}`;
  if (s === 'closed') return `Closed ${hm(o.closed!.at)}${o.closed!.by ? ` by ${who(o.closed!)}` : ''}${o.closed!.note ? `: ${o.closed!.note}` : ''}`;
  return s === 'tonight' ? 'In force' : 'NOT CLOSED';
}

/** One row per night, oldest first — the Night Order Book for a period. */
export function nightRows(list: NightOrder[], acks: OrderAck[], now: string): string[][] {
  return sortNights(list).reverse().map((o) => {
    const st = signStatus(o.id, o.watch, acks);
    return [
      dmy(o.date),
      o.where ?? '',
      o.text,
      o.callMe ?? '',
      [...st.signed.map((x) => `${named(x.reader)} ${hm(x.ack.at)}`), ...st.others.map((a) => `${who(a)} ${hm(a.at)}`)].join('\n'),
      st.unsigned.map(named).join('\n'),
      nightOutcome(o, now),
      who(o),
    ];
  });
}
export const NIGHT_HEAD = ['Night of', 'Position / passage', 'Orders', 'Call the Master', 'Read and signed', 'Not signed', 'Closed', 'Written by'];
export const NIGHT_WIDTHS = { 0: 18, 1: 30, 2: 80, 3: 40, 4: 35, 5: 25, 6: 25, 7: 24 };

/** Nights dated within [from, to] (yyyy-mm-dd, either may be empty). */
export const nightsIn = (list: NightOrder[], from: string, to: string) => list.filter((o) => (!from || o.date >= from) && (!to || o.date <= to));

export function nightBook(list: NightOrder[], acks: OrderAck[], from: string, to: string, now: string): MachineHistory {
  const nights = nightsIn(list, from, to);
  const open = nights.filter((o) => nightState(o, now) === 'toClose').length;
  return {
    title: 'Night Order Book',
    facts: [from || to ? `${from ? dmy(from) : '…'} – ${to ? dmy(to) : '…'}` : 'All dates', `${nights.length} nights`, ...(open ? [`${open} not closed`] : []), `Printed ${dmy(now.slice(0, 10))}`],
    tables: [{ title: 'Nights', head: NIGHT_HEAD, rows: nightRows(nights, acks, now), widths: NIGHT_WIDTHS }],
  };
}

/** One night on its own page — what "Share PDF" on a night sends. */
export function nightSheet(o: NightOrder, acks: OrderAck[], now: string): MachineHistory {
  const st = signStatus(o.id, o.watch, acks);
  return {
    title: `Night orders — ${dmy(o.date)}`,
    facts: [...(o.where ? [o.where] : []), `Written by ${who(o)} ${hm(o.createdAt)}`, nightOutcome(o, now), `Printed ${dmy(now.slice(0, 10))}`],
    tables: [
      { title: 'Orders', head: [''], rows: paragraphs(o.text), widths: { 0: 277 } },
      ...(o.callMe ? [{ title: 'Call the Master', head: [''], rows: paragraphs(o.callMe), widths: { 0: 277 } }] : []),
      signTable(st),
    ],
  };
}

function paragraphs(text: string): string[][] {
  return text.split(/\n\s*\n|\n(?=\s*(?:\d+[.)]|[-•*])\s)/).map((p) => p.trim()).filter(Boolean).map((p) => [p]);
}

function signTable(st: ReturnType<typeof signStatus>) {
  return {
    title: 'Read and signed',
    head: ['Name', 'Rank', 'Signed'],
    rows: [
      ...st.signed.map((x) => [x.reader.name, x.reader.rank ?? '', hm(x.ack.at)]),
      ...st.others.map((a) => [a.by, a.byRank ?? '', hm(a.at)]),
      ...st.unsigned.map((r) => [r.name, r.rank ?? '', 'NOT SIGNED']),
    ],
    widths: { 0: 110, 1: 100, 2: 67 },
  };
}

/** A revision of standing orders with its signatures and the revisions before it. */
export function standingSheet(s: StandingOrder, all: StandingOrder[], acks: OrderAck[], crew: CrewMember[], today: string, current: boolean): MachineHistory {
  const st = signStatus(s.id, current ? standingReaders(crew, s.readers) : [], acks);
  const revs = all.filter((x) => x.kind === s.kind).sort((a, b) => b.rev - a.rev);
  return {
    title: `${KIND_EN[s.kind]} — Revision ${s.rev}`,
    facts: [
      `In force from ${dmy(s.issued)}`,
      current ? 'Current revision' : 'SUPERSEDED',
      `Issued by ${who(s)}`,
      s.readers === 'officers' ? 'To be read by every officer' : 'To be read by the bridge officers',
      `Printed ${dmy(today)}`,
    ],
    tables: [
      ...(s.changeNote ? [{ title: 'What changed', head: [''], rows: paragraphs(s.changeNote), widths: { 0: 277 } }] : []),
      { title: 'Orders', head: [''], rows: paragraphs(s.text), widths: { 0: 277 } },
      signTable(st),
      { title: 'Revisions', head: ['Rev.', 'In force from', 'Issued by', 'What changed'], rows: revs.map((r) => [String(r.rev), dmy(r.issued), who(r), r.changeNote ?? '']), widths: { 0: 20, 1: 35, 2: 80, 3: 142 } },
    ],
  };
}
