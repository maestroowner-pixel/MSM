// ===================================
// The monthly safety meeting (13 Oct 2026: "add the monthly safety meeting" —
// beside the ISPS drills, in the Security menu). The safety committee on board
// meets every month (ISM Code 6 and 7, MLC 2006 Standard A4.3): the agenda, who
// took part — each signs his own line, as on a drill's attendance list — what
// was said, and the actions with who does them by when. Open actions of the last
// meeting come back on the next one until they are done. Signed by the Master
// (or who chaired it), the meeting is final.
// ===================================

import type { Attendee } from './drills';
import type { SignProof } from '../services/signature';

export interface AgendaItem {
  id: string;
  topic: string;
  notes?: string;
}

export interface MeetingAction {
  id: string;
  text: string;
  /** Who does it. */
  who?: string;
  /** yyyy-mm-dd */
  due?: string;
}

/** An action of an earlier meeting, looked at again: done, or still open. */
export interface CarriedAction extends MeetingAction {
  fromNo: string;
  done: boolean;
  note?: string;
}

export interface SafetyMeeting {
  id: string;
  /** SM-YYYY-NNN */
  no: string;
  date: string;
  /** hh:mm */
  time?: string;
  location?: string;
  agenda: AgendaItem[];
  attendance: Attendee[];
  carried: CarriedAction[];
  actions: MeetingAction[];
  /** Anything else said, in a few lines. */
  minutes?: string;
  plannedBy: string;
  plannedByRank?: string;
  /** Signed — the meeting is on the record and final. */
  doneAt?: number;
  doneBy?: string;
  doneByRank?: string;
  doneWith?: SignProof;
  deleted?: boolean;
  updatedAt: number;
}

/** The standing agenda — the points a shipboard safety committee goes through each month. */
export const MEETING_AGENDA: string[] = [
  'Minutes and open actions of the last meeting',
  'Accidents, injuries, near misses and observation cards since the last meeting',
  'Drills and exercises carried out — lessons learned',
  'Non-conformities, inspections, audits and port state control',
  'Work and rest hours, fatigue, workload',
  'Health, hygiene, the medicine chest and food / water',
  'PPE, safety equipment and maintenance affecting safety',
  'New procedures, circulars, safety flashes (IMCA)',
  'Risk assessments and permits for the coming work',
  'Security (ISPS) — gangway, visitors, drills',
  'Environment — garbage, oil, sewage, ballast',
  'Crew suggestions and concerns',
  'Any other business',
];
