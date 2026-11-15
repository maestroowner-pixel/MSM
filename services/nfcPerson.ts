// ===================================
// The person a wristband names, as a tap anywhere in the app shows them
// (screens/NfcPersonSc, components/NfcListener — 15 Nov 2026: "once tied to the app, a
// wristband is recognised when held to it: the card opens with quick actions — gangway,
// untie the wristband, the documents, and sign what is waiting unsigned").
//
// Pure: no storage, no React Native — scripts/check-nfc.ts runs it.
// ===================================

import { CrewMember, isAboard } from '../types/crew';
import { Passenger, passengerAboard } from '../types/passengers';
import { CrewMove } from '../types/security';
import { DocAck, IsmDoc } from '../types/docs';
import { NightOrder, OrderAck, StandingOrder } from '../types/orderBook';
import { isAshore, lastMoves } from './gangway';
import { toRead } from './docs';
import { orderBoard } from './orderBook';

export interface BandPerson {
  id: string;
  name: string;
  rank?: string;
  who: 'crew' | 'pax';
  /** Signed on (crew) or embarked today (guest): the gangway counts them. */
  onList: boolean;
  /** The last crossing took them ashore. */
  ashore: boolean;
  last?: CrewMove;
}

/** The crew member or guest a person tag names; null when they are on neither list any more. */
export function bandPerson(ref: string, crew: CrewMember[], passengers: Passenger[], moves: CrewMove[], today: string): BandPerson | null {
  const last = lastMoves(moves);
  const c = crew.find((x) => x.id === ref && !x.deleted);
  if (c) return { id: c.id, name: c.name, ...(c.rank ? { rank: c.rank } : {}), who: 'crew', onList: isAboard(c), ashore: isAshore(c.id, last), last: last.get(c.id) };
  const p = passengers.find((x) => x.id === ref && !x.deleted);
  if (p) return { id: p.id, name: p.name, who: 'pax', onList: passengerAboard(p, today), ashore: isAshore(p.id, last), last: last.get(p.id) };
  return null;
}

export type BandPending =
  | { kind: 'night'; id: string; date: string }
  | { kind: 'standing'; id: string; book: StandingOrder['kind']; rev: number }
  | { kind: 'doc'; id: string; title: string };

export interface PendingInput {
  nights: NightOrder[];
  standing: StandingOrder[];
  orderAcks: OrderAck[];
  docs: IsmDoc[];
  docAcks: DocAck[];
  crew: CrewMember[];
  /** The ship's local time, yyyy-mm-ddTHH:mm. */
  now: string;
  orders: boolean;
  dp: boolean;
  docsOn: boolean;
}

/**
 * What waits for this person's signature: tonight's night orders they are on, standing
 * orders in force they have not signed, ISM documents to read. Keyed by the crew id —
 * the key their signature on this device carries — and matched by name like the Board.
 * A guest signs nothing.
 */
export function bandPending(p: Pick<BandPerson, 'id' | 'name' | 'who'>, x: PendingInput): BandPending[] {
  if (p.who !== 'crew') return [];
  const me = { key: p.id, name: p.name };
  const out: BandPending[] = [];
  if (x.orders) {
    const b = orderBoard({ nights: x.nights, standing: x.standing, acks: x.orderAcks, crew: x.crew, now: x.now, me, dp: x.dp });
    for (const o of b.mineNight) out.push({ kind: 'night', id: o.id, date: o.date });
    for (const s of b.mineStanding) out.push({ kind: 'standing', id: s.id, book: s.kind, rev: s.rev });
  }
  if (x.docsOn) for (const d of toRead(x.docs, x.docAcks, me.key, me.name)) out.push({ kind: 'doc', id: d.id, title: d.docNo ? `${d.docNo} ${d.title}` : d.title });
  return out;
}
