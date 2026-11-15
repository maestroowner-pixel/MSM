// ===================================
// Muster stations and musters (plan item 70, 15 Nov 2026).
//
// At the alarm everyone goes to their muster station; the station's leader has to say
// who is there and who is missing against the persons on board. A MUSTER is that count:
// an officer starts it (a drill or a real alarm), the people on board at that moment are
// frozen into it, and each person is marked at a station — by tapping their wristband on
// the leader's phone, scanning their crew card, or by the leader ticking the name. The
// bridge sees every station fill in, and who is still missing, as the marks sync.
//
// THREE COLLECTIONS, because several phones write at once:
//   muster_stations  the places (officers keep them), with who is assigned to each.
//   musters          one per alarm: who was on board, started, closed — closing is the only change.
//   muster_marks     one per person per muster (`<musterId>_<personId>`), written once: the first
//                    mark stands, so two leaders marking the same person cannot overwrite each other.
//
// A guest's name goes up masked (A…e) like every guest name; screens read it from the
// passenger list on the device.
// ===================================

export interface MusterStation {
  id: string;
  /** Printed on its tag and sign — MS-1. */
  code: string;
  name: string;
  /** Where it is: "Boat deck stbd, lifeboat 1". */
  location?: string;
  order: number;
  /** Crew assigned to this station by the muster list (crew ids). Guests muster where they are told. */
  crewIds?: string[];
  removed?: boolean;
  updatedAt: number;
}

export type MusterKind = 'drill' | 'real';

/** One person on board when the alarm sounded. */
export interface MusterPerson {
  id: string;
  /** Masked for a guest. */
  name: string;
  /** Crew member, passenger (guest), or visitor at the gangway. */
  who: 'crew' | 'pax' | 'visitor';
  rank?: string;
}

export interface Muster {
  id: string;
  kind: MusterKind;
  startedAt: number;
  startedBy: string;
  /** Who was on board when it started — the list it is counted against. */
  pob: MusterPerson[];
  note?: string;
  closedAt?: number;
  closedBy?: string;
  /** What the closing officer says: all accounted for, or what happened to those missing. */
  closeNote?: string;
  updatedAt: number;
}

export type MarkVia = 'nfc' | 'qr' | 'manual';

export interface MusterMark {
  /** `<musterId>_<personId>` — one per person per muster. */
  id: string;
  musterId: string;
  personId: string;
  /** Masked for a guest. */
  name: string;
  stationId: string;
  at: number;
  via: MarkVia;
  by: string;
  updatedAt: number;
}
