// ===================================
// Security — ISPS Code: the gangway / visitor log and the ship's security level
// (10 Oct 2026: "a Security tab — ISPS Code, gangway, gangway visitor log book").
//
//   Visitor        one visit: who, from where, why, which identity document was
//                  checked, the pass, who escorts, in and out with the watch
//                  that let them on and off. Edited only to sign out.
//   SecurityLevel  the level the vessel is at (1 / 2 / 3), set by the Master or
//                  the Ship Security Officer, with when and why it changed.
// ===================================

import type { SignProof } from '../services/signature';

import type { Versioned } from '../services/versions';
export interface Visitor extends Versioned {
  id: string;
  date: string;
  /** hh:mm */
  timeIn: string;
  timeOut?: string;
  /** Date out when it is not the day in (overnight contractors). */
  dateOut?: string;
  name: string;
  company?: string;
  purpose: string;
  /** "Passport", "ID card", "Driving licence", "Seaman's book"… */
  idType?: string;
  idNo?: string;
  passNo?: string;
  /** Crew member who receives / escorts the visitor. */
  host?: string;
  /** Port and berth the vessel lay at when the visitor came aboard. */
  port?: string;
  berth?: string;
  /** Gangway watch who signed the visitor on. */
  inBy: string;
  outBy?: string;
  remarks?: string;
  /** The visitor's own signature, drawn on the screen (SVG path, 300 × 100). */
  signature?: string;
  updatedAt: number;
}

/**
 * A crew member crossing the gangway — scanned from their QR crew card or
 * marked by the watch. Append-only; where a person is now is their last move.
 */
export interface CrewMove {
  id: string;
  crewId: string;
  name: string;
  dir: 'ashore' | 'aboard';
  date: string;
  /** hh:mm */
  time: string;
  at: number;
  /** Gangway watch / device that recorded it. */
  by: string;
  via: 'qr' | 'manual';
  updatedAt: number;
}

export interface SecurityLevelRec {
  /** `level_<epoch>` — one per change, kept as history. */
  id: string;
  level: 1 | 2 | 3;
  since: number;
  reason?: string;
  by: string;
  byRank?: string;
  updatedAt: number;
}

/** A security drill (ISPS Code A/13.4, B/13.6: at least every three months). */
export interface SecurityDrill extends Versioned {
  id: string;
  date: string;
  time?: string;
  scenario: string;
  participants: string[];
  minutes?: number;
  /** Areas searched / what was found, what to improve. */
  findings?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export const SECURITY_SCENARIOS = [
  'Stowaway search',
  'Bomb threat — search for a suspicious device',
  'Unauthorised boarding / intruder',
  'Piracy / armed robbery attack',
  'Suspicious package or delivery',
  'Restricted area breach',
  'Change of security level',
  'Ship Security Alert System (SSAS) test',
];

/** Drills at least every three months. */
export const SECURITY_DRILL_DAYS = 90;

export const LEVEL_TEXT: Record<1 | 2 | 3, string> = {
  1: 'Normal — minimum protective measures at all times',
  2: 'Heightened — additional measures for a period of heightened risk',
  3: 'Exceptional — further specific measures when an incident is probable or imminent',
};
