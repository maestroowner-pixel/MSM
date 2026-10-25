// ===================================
// The gangway: who of the crew is ashore, who is on board, persons on board.
//
// A crew member's place is their last CrewMove (types/security.ts) — a QR
// scan of their crew card or the watch's tap. No move yet = on board, as long
// as the crew list has them signed on.
// ===================================

import { CrewMember, isAboard } from '../types/crew';
import { CrewMove, Visitor } from '../types/security';
import { Passenger, passengerAboard } from '../types/passengers';
import { uid } from '../utils/id';
import { shipHm, shipToday } from '../utils/shipTime';

/** Last move of each crew member, by crew id. */
export function lastMoves(moves: CrewMove[]): Map<string, CrewMove> {
  const m = new Map<string, CrewMove>();
  for (const x of moves) {
    const prev = m.get(x.crewId);
    if (!prev || x.at > prev.at) m.set(x.crewId, x);
  }
  return m;
}

export function isAshore(crewId: string, last: Map<string, CrewMove>): boolean {
  return last.get(crewId)?.dir === 'ashore';
}

/** Persons on board now: signed-on crew not ashore, and visitors not signed off. */
export function personsOnBoard(crew: CrewMember[], moves: CrewMove[], visitors: Visitor[], passengers: Passenger[] = [], today = localToday()) {
  const last = lastMoves(moves);
  const signedOn = crew.filter(isAboard);
  const ashore = signedOn.filter((c) => isAshore(c.id, last));
  const crewAboard = signedOn.length - ashore.length;
  const guests = visitors.filter((v) => !v.timeOut).length;
  // Passengers (types/passengers.ts) — embarked and not yet left; ashore by their last crossing.
  const joined = passengers.filter((p) => passengerAboard(p, today));
  const paxAshore = joined.filter((p) => isAshore(p.id, last));
  const paxAboard = joined.length - paxAshore.length;
  return { crewAboard, crewTotal: signedOn.length, ashore, visitors: guests, paxAboard, paxTotal: joined.length, paxAshore, total: crewAboard + guests + paxAboard };
}

function localToday(): string {
  return shipToday();
}

/** The move a scan or a tap makes: the opposite of where the person is now. */
export function nextMove(c: Pick<CrewMember, 'id' | 'name'>, moves: CrewMove[], by: string, via: 'qr' | 'manual', now = new Date()): CrewMove {
  const ashore = isAshore(c.id, lastMoves(moves));
  const date = shipToday(now.getTime());
  return {
    id: uid('mv'),
    crewId: c.id,
    name: c.name,
    dir: ashore ? 'aboard' : 'ashore',
    date,
    time: shipHm(now.getTime()),
    at: now.getTime(),
    by,
    via,
    updatedAt: now.getTime(),
  };
}

/** A second scan of the same card within this many ms is the same crossing. */
export const DOUBLE_SCAN_MS = 60_000;

export function isDoubleScan(crewId: string, moves: CrewMove[], now = Date.now()): boolean {
  const last = lastMoves(moves).get(crewId);
  return !!last && now - last.at < DOUBLE_SCAN_MS;
}

/** How long a visitor's photograph is kept after the visit. */
export const VISITOR_PHOTO_DAYS = 90;

/** Visits whose photograph is due to be removed: signed off, and the day they left is VISITOR_PHOTO_DAYS behind. */
export function photosToRemove(visitors: Visitor[], today: string): Visitor[] {
  const limit = Date.parse(`${today}T00:00:00Z`) - VISITOR_PHOTO_DAYS * 86400000;
  return visitors.filter((v) => v.photo && v.timeOut && Date.parse(`${v.dateOut ?? v.date}T00:00:00Z`) < limit);
}
