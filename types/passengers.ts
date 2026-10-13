// ===================================
// Passengers — the guests aboard a yacht, apart from the crew (13 Oct 2026:
// "besides the crew a yacht has passengers — a list, control at the gangway").
//
// The list (name, cabin, nationality, embarked / disembarked) is everyone's —
// the gangway watch needs it. Identity documents, date of birth and the
// contact ashore are the officers' and the Master's only (PassengerPrivate,
// as crew_private). At the gangway a passenger moves like a crew member: the
// card's QR (msm://crew/<passenger id>) or the watch's tap writes a CrewMove.
// ===================================

import { isMasked, maskName } from '../utils/privacy';

export interface Passenger {
  id: string;
  name: string;
  cabin?: string;
  nationality?: string;
  /** yyyy-mm-dd and port — joined the yacht. */
  embarked?: string;
  embarkPort?: string;
  /** yyyy-mm-dd and port — left; from then on not on board. */
  disembarked?: string;
  disembarkPort?: string;
  /** Owner, charter guest, owner's guest… */
  group?: string;
  notes?: string;
  deleted?: boolean;
  addedAt: number;
  updatedAt: number;
}

export interface PassengerPrivate {
  id: string;
  dateOfBirth?: string;
  idType?: string;
  idNo?: string;
  /** yyyy-mm-dd */
  idExpiry?: string;
  phone?: string;
  /** Who to call ashore. */
  emergencyContact?: string;
  updatedAt: number;
}

/** Joined and not yet left, as of `today`. */
export function passengerAboard(p: Pick<Passenger, 'deleted' | 'embarked' | 'disembarked'>, today: string): boolean {
  return !p.deleted && (!p.embarked || p.embarked <= today) && (!p.disembarked || p.disembarked > today);
}

// ---- confidentiality: the guest list does not leave the vessel (13 Oct 2026) ----
// On the cloud a passenger is the first and last letter of the name, the cabin,
// the group and the dates — enough for another device to count who is aboard;
// nationality and notes stay on board, and the documents (PassengerPrivate) are
// never sent at all. A pull puts this device's own copy back together.

const LOCAL_ONLY: (keyof Passenger)[] = ['nationality', 'notes'];

export function passengerToCloud(p: Passenger): Passenger {
  const out: any = { ...p, name: isMasked(p.name) ? p.name : maskName(p.name) };
  for (const k of LOCAL_ONLY) delete out[k];
  return out;
}

export function passengerFromCloud(local: Passenger | undefined, remote: Passenger): Passenger {
  if (!local || isMasked(local.name) || maskName(local.name) !== remote.name) return remote;
  const keep: any = { name: local.name };
  for (const k of LOCAL_ONLY) if (local[k] !== undefined) keep[k] = local[k];
  return { ...remote, ...keep };
}

/** A gangway crossing of a passenger carries the masked name; a crew member's, the name. */
export const isPassengerId = (id: string) => id.startsWith('pax');

export const PASSENGER_GROUPS = ['Owner', "Owner's guest", 'Charter guest', 'Other'];
