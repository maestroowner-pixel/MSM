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

export interface Visitor {
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
  /** Gangway watch who signed the visitor on. */
  inBy: string;
  outBy?: string;
  remarks?: string;
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

export const LEVEL_TEXT: Record<1 | 2 | 3, string> = {
  1: 'Normal — minimum protective measures at all times',
  2: 'Heightened — additional measures for a period of heightened risk',
  3: 'Exceptional — further specific measures when an incident is probable or imminent',
};
