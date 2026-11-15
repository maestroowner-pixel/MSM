// ===================================
// A muster counted (types/muster.ts): who is at which station, who is missing.
//
// Pure: no storage, no React Native — scripts/check-nfc.ts runs it.
// ===================================

import { MarkVia, Muster, MusterKind, MusterMark, MusterPerson, MusterStation } from '../types/muster';
import { CrewMember, isAboard } from '../types/crew';
import { Passenger, isPassengerId, passengerAboard } from '../types/passengers';
import { CrewMove, Visitor } from '../types/security';
import { isAshore, lastMoves } from './gangway';
import { maskName } from '../utils/privacy';
import { uid } from '../utils/id';
import { shipHm, shipToday } from '../utils/shipTime';
import type { MachineHistory } from './pmsHistory';

export const liveStations = (list: MusterStation[]) => list.filter((s) => !s.removed).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));

/** MS-1, MS-2… — the next free number. */
export function nextStationCode(list: MusterStation[]): string {
  const used = list.map((s) => parseInt(s.code.replace(/^MS-?/i, ''), 10)).filter((n) => !isNaN(n));
  return `MS-${used.length ? Math.max(...used) + 1 : 1}`;
}

const cloudName = (id: string, name: string) => (isPassengerId(id) ? maskName(name) : name.trim());

/**
 * Who is on board now — the list a muster is counted against: signed-on crew not
 * ashore, guests embarked and not ashore, visitors not signed off. The same people as
 * the gangway's persons on board (services/gangway.personsOnBoard).
 */
export function pobList(crew: CrewMember[], moves: CrewMove[], visitors: Visitor[], passengers: Passenger[], today: string): MusterPerson[] {
  const last = lastMoves(moves);
  const people: MusterPerson[] = [];
  for (const c of crew.filter(isAboard)) if (!isAshore(c.id, last)) people.push({ id: c.id, name: c.name, who: 'crew', ...(c.rank ? { rank: c.rank } : {}) });
  for (const p of passengers.filter((x) => passengerAboard(x, today))) if (!isAshore(p.id, last)) people.push({ id: p.id, name: maskName(p.name), who: 'pax' });
  for (const v of visitors.filter((x) => !x.timeOut)) people.push({ id: v.id, name: v.name, who: 'visitor', ...(v.company ? { rank: v.company } : {}) });
  return people;
}

export function startMuster(kind: MusterKind, pob: MusterPerson[], by: string, now: number, note?: string): Muster {
  return { id: uid('mu'), kind, startedAt: now, startedBy: by, pob, ...(note?.trim() ? { note: note.trim() } : {}), updatedAt: now };
}

export function closeMuster(m: Muster, by: string, now: number, note?: string): Muster {
  return { ...m, closedAt: now, closedBy: by, ...(note?.trim() ? { closeNote: note.trim() } : {}), updatedAt: now };
}

/** The muster under way — the latest one not closed. */
export function runningMuster(list: Muster[]): Muster | undefined {
  return list.filter((m) => !m.closedAt).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export const markId = (musterId: string, personId: string) => `${musterId}_${personId}`;

export type MarkOutcome =
  | { ok: true; mark: MusterMark }
  /** Already marked (the first mark stands); not on board when the muster started; muster closed. */
  | { ok: false; why: 'already' | 'notOnBoard' | 'closed'; mark?: MusterMark; person?: MusterPerson };

/**
 * Marking a person at a station. The first mark stands — a second tap, at the same
 * station or another, says where they were marked and changes nothing. Someone who
 * was not on board when the alarm sounded is not counted (a crew member back from
 * shore after it is a matter for the bridge, not a silent extra line).
 */
export function markPerson(m: Muster, marks: MusterMark[], personId: string, stationId: string, via: MarkVia, by: string, now: number): MarkOutcome {
  if (m.closedAt) return { ok: false, why: 'closed' };
  const person = m.pob.find((p) => p.id === personId);
  if (!person) return { ok: false, why: 'notOnBoard' };
  const prev = marks.find((x) => x.id === markId(m.id, personId));
  if (prev) return { ok: false, why: 'already', mark: prev, person };
  return {
    ok: true,
    mark: { id: markId(m.id, personId), musterId: m.id, personId, name: cloudName(personId, person.name), stationId, at: now, via, by, updatedAt: now },
  };
}

export interface StationCount {
  station: MusterStation | null;
  /** Marked here. */
  here: { person: MusterPerson; mark: MusterMark }[];
  /** Assigned here by the muster list and not marked anywhere. */
  missing: MusterPerson[];
  /** Marked here though the muster list puts them at another station. */
  elsewhere: number;
}

export interface MusterCount {
  total: number;
  accounted: number;
  missing: MusterPerson[];
  stations: StationCount[];
  /** Seconds from the start to the last mark, when everyone is accounted for. */
  allInSec?: number;
}

/** The count: per station, and everyone not yet marked. Marks of people not in the list are ignored. */
export function countMuster(m: Muster, marks: MusterMark[], stations: MusterStation[]): MusterCount {
  const mine = marks.filter((x) => x.musterId === m.id);
  const byPerson = new Map(mine.map((x) => [x.personId, x]));
  const live = liveStations(stations);
  const assigned = new Map<string, string>();
  for (const s of live) for (const id of s.crewIds ?? []) if (!assigned.has(id)) assigned.set(id, s.id);
  const missing = m.pob.filter((p) => !byPerson.has(p.id));
  const known = new Set(live.map((s) => s.id));
  const rows: StationCount[] = live.map((s) => {
    const here = m.pob.flatMap((p) => {
      const mk = byPerson.get(p.id);
      return mk && mk.stationId === s.id ? [{ person: p, mark: mk }] : [];
    });
    return {
      station: s,
      here: here.sort((a, b) => a.mark.at - b.mark.at),
      missing: missing.filter((p) => assigned.get(p.id) === s.id),
      elsewhere: here.filter((h) => assigned.has(h.person.id) && assigned.get(h.person.id) !== s.id).length,
    };
  });
  // Marks at a station since removed, and the people assigned nowhere who are missing.
  const stray = m.pob.flatMap((p) => {
    const mk = byPerson.get(p.id);
    return mk && !known.has(mk.stationId) ? [{ person: p, mark: mk }] : [];
  });
  const unassigned = missing.filter((p) => !assigned.has(p.id));
  if (stray.length || unassigned.length) rows.push({ station: null, here: stray, missing: unassigned, elsewhere: 0 });
  const accounted = m.pob.length - missing.length;
  const last = Math.max(0, ...mine.filter((x) => m.pob.some((p) => p.id === x.personId)).map((x) => x.at));
  return {
    total: m.pob.length,
    accounted,
    missing,
    stations: rows,
    ...(m.pob.length && !missing.length && last ? { allInSec: Math.max(0, Math.round((last - m.startedAt) / 1000)) } : {}),
  };
}

/** "4 min 05 s" — how long the muster took. */
export function durationText(sec: number): string {
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min ? `${min} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

// ---- on paper (English always) -------------------------------------------------

const VIA_EN: Record<MarkVia, string> = { nfc: 'NFC wristband', qr: 'Crew card QR', manual: 'By name' };
const WHO_EN: Record<MusterPerson['who'], string> = { crew: 'Crew', pax: 'Guest', visitor: 'Visitor' };
const when = (ts: number) => `${shipToday(ts)} ${shipHm(ts)}`;

/**
 * The muster as a record: who was marked where, when and how, and who was missing.
 * `nameOf` gives the full name from the device's own lists (a guest is masked on the
 * cloud, not on this paper); without it the name the muster carries.
 */
export function musterSheet(m: Muster, marks: MusterMark[], stations: MusterStation[], nameOf: (id: string, fallback: string) => string = (_, f) => f): MachineHistory {
  const c = countMuster(m, marks, stations);
  const nm = (p: MusterPerson) => nameOf(p.id, p.name);
  const assignedTo = new Map<string, string>();
  for (const s of liveStations(stations)) for (const id of s.crewIds ?? []) if (!assignedTo.has(id)) assignedTo.set(id, s.code);
  return {
    title: `Muster — ${m.kind === 'real' ? 'alarm' : 'drill'} ${when(m.startedAt)}`,
    facts: [
      m.kind === 'real' ? 'Real alarm' : 'Drill',
      `Started ${when(m.startedAt)} by ${m.startedBy}`,
      m.closedAt ? `Closed ${when(m.closedAt)} by ${m.closedBy ?? ''}` : 'Not closed',
      `Accounted for ${c.accounted} of ${c.total}`,
      ...(c.allInSec != null ? [`All accounted for in ${durationText(c.allInSec)}`] : []),
      ...(m.note ? [m.note] : []),
      ...(m.closeNote ? [`On closing: ${m.closeNote}`] : []),
      'Times are ship\'s time',
    ],
    tables: [
      {
        title: 'Marked at the stations',
        head: ['Station', 'Person', 'Rank / role', 'Time', 'How', 'Marked by'],
        rows: c.stations.flatMap((s) =>
          s.here.map((h) => [s.station ? `${s.station.code} ${s.station.name}` : 'Station removed', nm(h.person), h.person.rank ?? WHO_EN[h.person.who], shipHm(h.mark.at), VIA_EN[h.mark.via], h.mark.by])
        ),
        widths: { 0: 50, 1: 55, 2: 45, 3: 20, 4: 35, 5: 45 },
      },
      {
        title: c.missing.length ? 'Not accounted for' : 'Not accounted for — none',
        head: ['Person', 'Rank / role', 'Muster station'],
        rows: c.missing.map((p) => [nm(p), p.rank ?? WHO_EN[p.who], assignedTo.get(p.id) ?? '—']),
        widths: { 0: 90, 1: 90, 2: 70 },
      },
    ],
  };
}
