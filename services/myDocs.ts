// ===================================
// "My documents" (plan item 47, 5 Nov 2026): one person's own certificates and
// dates, the drills they attended, their hours of rest, and what an officer or
// the office has changed since they last looked. Pure. Everything here is
// already on the device: the crew list, the crew certificates, the drills and
// hours of rest reach every member. `crew_private` (passport, next of kin) does
// not, by the rules, so a crew device cannot show them and this does not ask.
// ===================================

import { Certificate, scopeOf } from '../types/certificate';
import { CrewMember, liveCrew } from '../types/crew';
import { Drill } from '../types/drills';
import { RestDay } from '../types/rest';
import { analyseRest } from './restHours';
import { addDays } from './restPlan';
import { statusFromDate } from '../utils/dates';
import type { ShipClockInfo } from '../utils/shipTime';

const sameName = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

/** The person on this device: by name for an enrolled device, else the crew member it last signed as. */
export function findMe(crew: CrewMember[], me?: { key: string; name: string } | null): CrewMember | undefined {
  if (!me) return undefined;
  const live = liveCrew(crew);
  return live.find((c) => c.id === me.key) ?? live.find((c) => sameName(c.name, me.name));
}

const RANK = { expired: 0, due: 1, ok: 2, none: 3 } as Record<string, number>;

/** Their certificates, what needs doing first. A certificate without a crew link goes by the name it carries. */
export function myCerts(certificates: Certificate[], m: CrewMember): Certificate[] {
  return certificates
    .filter((c) => scopeOf(c) === 'crew' && (c.crewId ? c.crewId === m.id : sameName(c.holderName, m.name)))
    .sort((a, b) => (RANK[statusFromDate(a.expiryDate)] ?? 9) - (RANK[statusFromDate(b.expiryDate)] ?? 9) || (a.expiryDate ?? '9').localeCompare(b.expiryDate ?? '9'));
}

/** Drills carried out in the last year that they were present at, newest first. A planned one has not happened. */
export function myDrills(drills: Drill[], m: CrewMember, today: string): Drill[] {
  const from = addDays(today, -365);
  return drills
    .filter((d) => !d.deleted && d.doneAt && d.date >= from && d.date <= today && d.attendance.some((a) => a.present && sameName(a.name, m.name)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface MyRest { recorded: number; restHours: number; violations: number }

/** The last seven days. Only days recorded count towards the hours. */
export function myRest(rest: RestDay[], m: CrewMember, today: string, ship?: ShipClockInfo | null): MyRest {
  const days = analyseRest(rest.filter((r) => r.crewId === m.id), addDays(today, -6), today, ship).filter((d) => d.recorded);
  return { recorded: days.length, restHours: days.reduce((n, d) => n + d.restHours, 0), violations: days.reduce((n, d) => n + d.violations.length, 0) };
}

export interface MyChange { kind: 'cert' | 'details'; id: string; title: string; at: number }

/** What changed since they looked. Never looked: nothing, or the first day would call everything new. */
export function myChanges(certs: Certificate[], m: CrewMember, seenAt?: number): MyChange[] {
  if (seenAt == null) return [];
  const out: MyChange[] = certs.filter((c) => c.updatedAt > seenAt).map((c) => ({ kind: 'cert' as const, id: c.id, title: c.name, at: c.updatedAt }));
  if (m.updatedAt > seenAt) out.push({ kind: 'details', id: m.id, title: m.name, at: m.updatedAt });
  return out.sort((a, b) => b.at - a.at);
}
