// ===================================
// Drills — emergency drills on board, planned and recorded by the officer who
// runs them (13 Oct 2026: "reports with the list of who took part — a separate
// attendance list too — the topic, the content, a scenario minute by minute,
// and the theory; the officer writes the scenario himself, the interface must
// make that easy").
//
//   Drill   one drill: type and topic, when and where, what it covers, the
//           scenario as timed steps (planned minute + the time it actually
//           happened), whether the theory briefing was given, who was there and
//           who was not (with why), the debrief. Planned → carried out → signed
//           by whoever conducted it; a signed drill is final.
//
// The theory and the practical checklists come from the Drill Trainer app
// (constants/drillTheory.ts). How often each drill is due is below.
// ===================================

import type { SignProof } from '../services/signature';
import type { Versioned } from '../services/versions';

/** One timed step of the scenario. */
export interface ScenarioStep {
  id: string;
  /** Minutes from the start of the drill (T+min). */
  min: number;
  text: string;
  /** Who acts — "Bridge", "Fire party", "2/O". */
  who?: string;
  /** hh:mm — when it actually happened, stamped during the drill. */
  at?: string;
}

export interface Attendee {
  name: string;
  rank?: string;
  present: boolean;
  /** Why not there — "On watch", "Ashore", "Sick". */
  reason?: string;
  /** Not on the crew list — a guest, contractor, cadet. */
  extra?: boolean;
}

export interface Drill extends Versioned {
  id: string;
  /** DR-YYYY-NNN, given when first saved. */
  no: string;
  /** DRILL_TYPES id, or 'other' — the vessel's own drill, described by the fields below. */
  type: string;
  /** Own drill ('other'): its name — "Lifeboat release gear", "Gas leak in the galley". */
  title?: string;
  /** Own drill: where it is required — "SMS 8.2", "Flag circular 12/2025". */
  reg?: string;
  /** Own drill: due every … days; none = not on a cycle. */
  everyDays?: number;
  /** Own drill: the theory briefing, written by the officer. */
  theoryText?: string;
  /** The topic as the crew hears it — "Fire in the galley". */
  topic: string;
  date: string;
  /** hh:mm — start. */
  time?: string;
  /** hh:mm — end. */
  endTime?: string;
  location?: string;
  /** What the drill covers — one point per line. */
  content?: string;
  scenario: ScenarioStep[];
  /** The theory briefing was given; the report carries it as an annex. */
  theory: boolean;
  attendance: Attendee[];
  /** What went well, what to improve, actions. */
  debrief?: string;
  plannedBy: string;
  plannedByRank?: string;
  /** Signed as carried out — final from then on. */
  doneAt?: number;
  doneBy?: string;
  doneByRank?: string;
  doneWith?: SignProof;
  /** A plan dropped before it was carried out. */
  deleted?: boolean;
  updatedAt: number;
}

export interface DrillType {
  id: string;
  title: string;
  /** Where the requirement comes from. */
  reg: string;
  /** Due every … days. */
  everyDays: number;
  /** Required by SOLAS / ISPS / MARPOL — always on the schedule; the others join it once held. */
  required?: boolean;
}

export const DRILL_TYPES: DrillType[] = [
  { id: 'general', title: 'General emergency & muster', reg: 'SOLAS III/19.3', everyDays: 30, required: true },
  { id: 'abandon', title: 'Abandon ship', reg: 'SOLAS III/19.3.2', everyDays: 30, required: true },
  { id: 'fire', title: 'Fire', reg: 'SOLAS III/19.3.2', everyDays: 30, required: true },
  { id: 'enclosed', title: 'Enclosed space entry & rescue', reg: 'SOLAS III/19.3.6', everyDays: 60, required: true },
  { id: 'steering', title: 'Emergency steering', reg: 'SOLAS V/26.4', everyDays: 90, required: true },
  { id: 'security', title: 'Security (ISPS)', reg: 'ISPS Code A/13.4', everyDays: 90, required: true },
  { id: 'oilspill', title: 'Oil / chemical spill (SOPEP)', reg: 'MARPOL I/37 · SOPEP', everyDays: 90, required: true },
  { id: 'mob', title: 'Man overboard', reg: 'SMS', everyDays: 90 },
  { id: 'flooding', title: 'Flooding / damage control', reg: 'SOLAS II-1/19-1 · SMS', everyDays: 90 },
  { id: 'blackout', title: 'Blackout', reg: 'SMS', everyDays: 90 },
  { id: 'medical', title: 'Medical emergency / mass casualty', reg: 'SMS', everyDays: 90 },
  { id: 'grounding', title: 'Grounding', reg: 'SMS', everyDays: 180 },
  { id: 'collision', title: 'Collision', reg: 'SMS', everyDays: 180 },
  { id: 'piracy', title: 'Piracy / armed attack', reg: 'BMP · SSP', everyDays: 180 },
  { id: 'helicopter', title: 'Helicopter operations', reg: 'SMS', everyDays: 365 },
  { id: 'draganchor', title: 'Dragging anchor', reg: 'SMS', everyDays: 365 },
  { id: 'sar', title: 'Search and rescue — assisting another vessel', reg: 'SMS', everyDays: 365 },
  { id: 'towing', title: 'Emergency towing', reg: 'SOLAS II-1/3-4', everyDays: 365 },
  { id: 'cargoshift', title: 'Cargo shift / securing failure', reg: 'SMS', everyDays: 365 },
  { id: 'holdfire', title: 'Cargo hold fire', reg: 'SMS', everyDays: 365 },
];

export const DRILL_TYPE_MAP: Record<string, DrillType> = Object.fromEntries(DRILL_TYPES.map((t) => [t.id, t]));

export const drillTypeTitle = (id: string) => DRILL_TYPE_MAP[id]?.title ?? 'Other drill';

/** The drill's name — the vessel's own name for an 'other' drill. */
export const drillTitle = (d: Pick<Drill, 'type' | 'title'>) => (d.type === 'other' ? d.title?.trim() || 'Other drill' : drillTypeTitle(d.type));

/** One drill kind on the schedule: a DRILL_TYPES id, or `other:<name>` for an own drill. */
export const drillKind = (d: Pick<Drill, 'type' | 'title'>) => (d.type === 'other' ? `other:${(d.title ?? '').trim().toLowerCase()}` : d.type);

/** Intervals offered for an own drill. */
export const OWN_INTERVALS: { days?: number; label: string }[] = [
  { days: 30, label: 'Monthly' },
  { days: 60, label: 'Every 2 months' },
  { days: 90, label: 'Every 3 months' },
  { days: 180, label: 'Every 6 months' },
  { days: 365, label: 'Yearly' },
  { label: 'Not on a cycle' },
];

/** Steps an officer adds with one tap — the bones most scenarios share. */
export const QUICK_STEPS: { text: string; who?: string }[] = [
  { text: 'Alarm sounded', who: 'Bridge' },
  { text: 'PA announcement: nature and location of the emergency', who: 'Bridge' },
  { text: 'Crew at muster stations, roll call', who: 'Muster leaders' },
  { text: 'Roll call reported to the bridge', who: 'Muster leaders' },
  { text: 'Teams dressed and equipment checked' },
  { text: 'Situation report to the bridge' },
  { text: 'Casualty found / recovered' },
  { text: 'Drill ends — all clear', who: 'Master' },
  { text: 'Equipment stowed, debrief', who: 'All' },
];

/** Why someone was not there — one tap. */
export const ABSENCE_REASONS = ['On watch', 'Ashore', 'Off duty / rest', 'Sick'];
