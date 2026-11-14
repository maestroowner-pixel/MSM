// ===================================
// The Master's orders (types/orderBook.ts) — pure, so `npm run check:orders`
// can reach every rule: who is asked to sign, who has, where a night stands,
// the current revision and the Board.
// ===================================

import { CrewMember, isAboard, isOfficerRank } from '../types/crew';
import { NightOrder, OrderAck, OrderReader, OrderReaders, StandingKind, StandingOrder } from '../types/orderBook';
import { isMasterRank } from './appraisals';

const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const ENGINE = /engineer|\beto\b|electro|c\/e|[234]\/e|\bmotorman|oiler/i;
const DPO = /\b[sj]?dpo\b|\bdp\s*operator/i;

/** A watchkeeper on the bridge by rank: mates, deck officers, DPOs — not the Master, not the engine room. */
export function isBridgeRank(rank?: string): boolean {
  if (isMasterRank(rank)) return false;
  if (DPO.test(rank ?? '')) return true;
  return isOfficerRank(rank) && !ENGINE.test(rank ?? '');
}

const asReader = (c: CrewMember): OrderReader => ({ key: c.id, name: c.name, ...(c.rank ? { rank: c.rank } : {}) });

/** Tonight's watchkeepers as a new night order offers them: the bridge officers aboard. */
export function defaultWatch(crew: CrewMember[]): OrderReader[] {
  return crew.filter((c) => isAboard(c) && isBridgeRank(c.rank)).map(asReader);
}

/** Who must sign a standing order now: the bridge, or every officer — never the Master, who issues them. */
export function standingReaders(crew: CrewMember[], readers: OrderReaders): OrderReader[] {
  return crew
    .filter((c) => isAboard(c) && !isMasterRank(c.rank) && (readers === 'officers' ? isOfficerRank(c.rank) || DPO.test(c.rank ?? '') : isBridgeRank(c.rank)))
    .map(asReader);
}

/** Has this person signed this night or revision? By crew id or device key, else by name. */
export function hasSigned(orderId: string, acks: OrderAck[], person: { key: string; name: string }): OrderAck | undefined {
  const n = norm(person.name);
  return acks.find((a) => a.orderId === orderId && (a.personKey === person.key || (!!n && norm(a.by) === n)));
}

export interface SignStatus {
  signed: { reader: OrderReader; ack: OrderAck }[];
  unsigned: OrderReader[];
  /** Signatures from people not asked — a relief, the Master himself. */
  others: OrderAck[];
}

export function signStatus(orderId: string, readers: OrderReader[], acks: OrderAck[]): SignStatus {
  const signed: SignStatus['signed'] = [];
  const unsigned: OrderReader[] = [];
  const used = new Set<string>();
  for (const r of readers) {
    const a = hasSigned(orderId, acks, r);
    if (a) {
      signed.push({ reader: r, ack: a });
      used.add(a.id);
    } else unsigned.push(r);
  }
  const others = acks.filter((a) => a.orderId === orderId && !used.has(a.id)).sort((a, b) => a.at - b.at);
  return { signed, unsigned, others };
}

// ---- night orders --------------------------------------------------------------

/**
 * Where a night stands:
 *   cancelled  written in error
 *   closed     the Master closed it in the morning
 *   tonight    open, and the night is not over: it runs to noon the day after
 *              its date, so at 0200 the orders of the evening before still hold
 *   toClose    the night is over and the Master has not closed it yet
 * `now` is the ship's local time, yyyy-mm-ddTHH:mm.
 */
export type NightState = 'cancelled' | 'closed' | 'tonight' | 'toClose';
export const NIGHT_ENDS = '12:00';

export function nightState(o: NightOrder, now: string): NightState {
  if (o.cancelled) return 'cancelled';
  if (o.closed) return 'closed';
  return now < `${addDays(o.date, 1)}T${NIGHT_ENDS}` ? 'tonight' : 'toClose';
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Newest night first; nights of the same date newest written first. */
export function sortNights(list: NightOrder[]): NightOrder[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** The Master may still put it right: not closed, not cancelled, and nobody has signed it. */
export function nightEditable(o: NightOrder, acks: OrderAck[]): boolean {
  return !o.closed && !o.cancelled && !acks.some((a) => a.orderId === o.id);
}

export function nightProblem(o: Pick<NightOrder, 'date' | 'text'>): 'date' | 'text' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return 'date';
  if (o.text.trim().length < 3) return 'text';
  return null;
}

// ---- standing orders -----------------------------------------------------------

/** The revision in force: the highest of its kind. */
export function currentStanding(list: StandingOrder[], kind: StandingKind): StandingOrder | undefined {
  return list.filter((s) => s.kind === kind).reduce<StandingOrder | undefined>((m, s) => (!m || s.rev > m.rev ? s : m), undefined);
}

export const nextRev = (list: StandingOrder[], kind: StandingKind) => (currentStanding(list, kind)?.rev ?? 0) + 1;

export function standingProblem(s: Pick<StandingOrder, 'issued' | 'text'>): 'date' | 'text' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.issued)) return 'date';
  if (s.text.trim().length < 3) return 'text';
  return null;
}

// ---- the Board -----------------------------------------------------------------

export interface OrderBoardInput {
  nights: NightOrder[];
  standing: StandingOrder[];
  acks: OrderAck[];
  crew: CrewMember[];
  /** The ship's local time, yyyy-mm-ddTHH:mm. */
  now: string;
  /** The person on this device, if known. */
  me?: { key: string; name: string } | null;
  /** DP standing orders count only with the DP module on. */
  dp: boolean;
}

export interface OrderBoard {
  /** This person: nights they keep a watch in and have not signed. */
  mineNight: NightOrder[];
  /** This person: standing orders in force they are asked to sign and have not. */
  mineStanding: StandingOrder[];
  /** The Master: nights still running with watchkeepers who have not signed. */
  unsignedNight: { order: NightOrder; who: OrderReader[] }[];
  /** The Master: earlier nights not closed. */
  toClose: NightOrder[];
  /** The Master: standing orders in force not yet signed by everyone asked. */
  unsignedStanding: { order: StandingOrder; who: OrderReader[] }[];
}

export function orderBoard(x: OrderBoardInput): OrderBoard {
  const b: OrderBoard = { mineNight: [], mineStanding: [], unsignedNight: [], toClose: [], unsignedStanding: [] };
  const me = x.me;
  const isMe = (r: OrderReader) => !!me && (r.key === me.key || (!!norm(me.name) && norm(r.name) === norm(me.name)));
  for (const o of sortNights(x.nights)) {
    const s = nightState(o, x.now);
    if (s === 'toClose') b.toClose.push(o);
    // Asking to sign is for a night still running; once it is over, the book shows who never did.
    if (s !== 'tonight') continue;
    const st = signStatus(o.id, o.watch, x.acks);
    if (st.unsigned.length) b.unsignedNight.push({ order: o, who: st.unsigned });
    if (me && st.unsigned.some(isMe)) b.mineNight.push(o);
  }
  for (const kind of x.dp ? (['master', 'dp'] as const) : (['master'] as const)) {
    const cur = currentStanding(x.standing, kind);
    if (!cur) continue;
    const st = signStatus(cur.id, standingReaders(x.crew, cur.readers), x.acks);
    if (st.unsigned.length) b.unsignedStanding.push({ order: cur, who: st.unsigned });
    if (me && st.unsigned.some(isMe)) b.mineStanding.push(cur);
  }
  return b;
}
