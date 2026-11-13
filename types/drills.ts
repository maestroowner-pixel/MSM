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
import type { AsogStatus } from './dp';

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
  /**
   * Signed in person on the attendance list — PIN, fingerprint (own phone) or by
   * hand. Taking the tick off takes the signature with it.
   */
  signedAt?: number;
  signedWith?: SignProof;
}

/**
 * How the drill was run (IMCA M273, Jan 2026): live — on the equipment; desktop —
 * the scenario talked through on the bridge and in the ECR; touch — hands on the
 * controls, nothing switched off. On DP most drills are desktop: with operations
 * running a live one is seldom possible, and the company counts a desktop drill.
 */
export type DrillMode = 'live' | 'desktop' | 'touch';
export const DRILL_MODES: DrillMode[] = ['desktop', 'touch', 'live'];
export const DRILL_MODE_EN: Record<DrillMode, string> = { live: 'Live drill', desktop: 'Desktop exercise', touch: 'Touch drill' };

/** The Master put a due drill off — DP operations would not allow it. Kept on the plan, printed on the report. */
export interface Postponement {
  reason: string;
  by: string;
  byRank?: string;
  at: number;
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
  /** Own drill: due every … days; none = not on a cycle. A DP drill: the company's interval (DPOM) when it differs from the default. */
  everyDays?: number;
  /** A DP drill: live / desktop / touch. */
  mode?: DrillMode;
  /** A DP drill: the ASOG status the vessel was in. */
  asog?: AsogStatus;
  /** Put off while DP operations ran — the plan stays, amber, until it is held. */
  postponed?: Postponement[];
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
  /** A DP drill — offered only with the DP module; its interval is the company's (DPOM), this is the start. */
  dp?: boolean;
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
  // DP drills (13 Nov 2026): the standard topics are IMCA's DP drill scenarios (DP Event
  // Bulletins, M273 Appendix A). Not required by SOLAS: they join the schedule once held
  // or planned, at the interval the company set on the last one. **Ids permanent.**
  { id: 'dpUps', title: 'Loss of main DP system UPS', reg: 'IMCA DPE 03/23 · M273 App. A', everyDays: 90, dp: true },
  { id: 'dpAutoManual', title: 'Auto / manual — human intervention', reg: 'IMCA DPE 01/22', everyDays: 90, dp: true },
  { id: 'dpDriftOff', title: 'Consequence analysis — drift-off (DP2 / DP3)', reg: 'IMCA DPE 02/25', everyDays: 90, dp: true },
  { id: 'dpBlackout', title: 'Recovery from a full blackout', reg: 'IMCA DPE 03/21', everyDays: 90, dp: true },
  { id: 'dpRefLoss', title: 'Loss of all position references', reg: 'IMCA DPE 02/23', everyDays: 90, dp: true },
  { id: 'dpRedGroup', title: 'Loss of one redundant group', reg: 'IMCA DPE 02/20', everyDays: 90, dp: true },
  { id: 'dpCooling', title: 'Loss of seawater cooling pump redundancy', reg: 'IMCA DPE 01/21', everyDays: 90, dp: true },
  { id: 'dpDriveOff', title: 'Drive-off from position', reg: 'IMCA DPE 02/21', everyDays: 90, dp: true },
  { id: 'dpThrustFull', title: 'Thruster failure to full thrust', reg: 'IMCA DPE 03/24', everyDays: 90, dp: true },
];

export const isDpDrill = (type: string): boolean => !!DRILL_TYPES.find((t) => t.id === type)?.dp;

/**
 * The bones of each DP drill's scenario, filled into a new one (13 Nov 2026), after the
 * IMCA drill scenario of the same name, in our words. Said and shown on a desktop drill;
 * on a live one the officer strikes what is not safe. The vessel's ASOG decides.
 */
export const DP_SCENARIOS: Record<string, { min: number; text: string; who?: string }[]> = {
  dpUps: [
    { min: 0, text: 'Scenario given: main DP system UPS lost — all its outputs isolated at once', who: 'SDPO' },
    { min: 2, text: 'DPO: what is still powered — controllers, operator stations, references, sensors, network', who: 'DPO' },
    { min: 4, text: 'ASOG status stated; client / work site informed', who: 'DPO' },
    { min: 6, text: 'ETO / ECR: cause, supply restored, battery time on the other UPS', who: 'ETO' },
    { min: 10, text: 'Equipment back on line and checked before it is reselected', who: 'DPO' },
    { min: 14, text: 'End of drill — debrief: did the FMEA predict what was lost?', who: 'All' },
  ],
  dpAutoManual: [
    { min: 0, text: 'Scenario given: essential DP equipment switched to local / manual while in auto DP (thruster, engine, controller, SW pump)', who: 'SDPO' },
    { min: 2, text: 'DPO: which alarm shows it, what DP can still do with that equipment out of its control', who: 'DPO' },
    { min: 4, text: 'ECR / thruster room: who may switch to local, and who must tell the bridge first', who: 'ECR' },
    { min: 7, text: 'Equipment returned to remote / auto and reselected into DP', who: 'DPO' },
    { min: 10, text: 'End of drill — debrief: the permit / communication rule for local control on DP', who: 'All' },
  ],
  dpDriftOff: [
    { min: 0, text: 'Vessel on full auto DP, all thrusters and generators on line, consequence analysis active', who: 'SDPO' },
    { min: 2, text: 'Thrusters deselected by redundant group (or generators on one bus shut down) until the drift-off warning', who: 'DPO' },
    { min: 6, text: 'Wait several minutes between steps — the warning often comes with a delay', who: 'DPO' },
    { min: 10, text: 'Warning read: ASOG status, client / work site, what the remaining thrust can hold', who: 'DPO' },
    { min: 14, text: 'Thrusters / generators reselected; back to green', who: 'DPO' },
    { min: 18, text: 'End of drill — debrief', who: 'All' },
  ],
  dpBlackout: [
    { min: 0, text: 'Workshop (live only if a safe, manageable situation presents itself): a full blackout on DP', who: 'Chief Engineer' },
    { min: 3, text: 'First reaction on blackout; how could it be triggered on this vessel', who: 'SDPO' },
    { min: 6, text: 'Are people directly at risk? Is there a clear escape route?', who: 'Master' },
    { min: 9, text: 'Power restored: standby generator, bus restoration order', who: 'ECR' },
    { min: 12, text: 'Thrusters back into DP control — automatically or by hand', who: 'DPO' },
    { min: 16, text: 'Debrief: FMEA, ASOG and what to change', who: 'All' },
  ],
  dpRefLoss: [
    { min: 0, text: 'Scenario given: loss of all position reference data into the DP control system', who: 'SDPO' },
    { min: 1, text: 'DPO: DP on dead reckoning — how long can it be trusted, ASOG status red', who: 'DPO' },
    { min: 2, text: 'Client / work site told to stop and make safe', who: 'DPO' },
    { min: 4, text: 'Joystick / manual if position cannot be kept; references brought back one by one', who: 'DPO' },
    { min: 9, text: 'References checked against each other before auto DP again', who: 'DPO' },
    { min: 13, text: 'End of drill — debrief', who: 'All' },
  ],
  dpRedGroup: [
    { min: 0, text: 'Scenario given: loss of one redundant group (its thrusters, generators and auxiliaries)', who: 'SDPO' },
    { min: 2, text: 'DPO: position and heading held on the remaining group? ASOG status', who: 'DPO' },
    { min: 4, text: 'Client / work site informed; operation stopped or made safe per ASOG', who: 'DPO' },
    { min: 6, text: 'ECR: cause found, the group recovered', who: 'ECR' },
    { min: 12, text: 'Group reselected, back to green — end of drill', who: 'DPO' },
    { min: 15, text: 'Debrief: worst-case failure as the FMEA describes it', who: 'All' },
  ],
  dpCooling: [
    { min: 0, text: 'Scenario given: seawater cooling pump redundancy lost (standby pump not available)', who: 'Chief Engineer' },
    { min: 2, text: 'ECR: what the pump cools, which redundant group is exposed, temperature trend', who: 'ECR' },
    { min: 4, text: 'Bridge informed: ASOG status for loss of redundancy', who: 'DPO' },
    { min: 6, text: 'Client / work site informed; operation continued or stopped per ASOG', who: 'DPO' },
    { min: 9, text: 'Pump restored / standby lined up', who: 'ECR' },
    { min: 13, text: 'End of drill — debrief', who: 'All' },
  ],
  dpDriveOff: [
    { min: 0, text: 'Scenario given: the vessel is being driven off position by its own thrust', who: 'SDPO' },
    { min: 1, text: 'DPO detects it: position / heading error growing with high thrust', who: 'DPO' },
    { min: 2, text: 'Red declared per ASOG — how fast? Client / work site told to stop', who: 'DPO' },
    { min: 3, text: 'Faulty thruster identified; emergency stop shown and its use discussed', who: 'DPO' },
    { min: 5, text: 'Is the DP emergency drill procedure followed? Is equipment reacting as expected?', who: 'SDPO' },
    { min: 8, text: 'Option: thruster to local control in the thruster room', who: 'ECR' },
    { min: 12, text: 'End of drill — debrief', who: 'All' },
  ],
  dpThrustFull: [
    { min: 0, text: 'Safe open water only, no risk of excessive excursion. Scenario: a thruster fails to full thrust', who: 'SDPO' },
    { min: 1, text: 'DPO: recognise it — thrust feedback not following command', who: 'DPO' },
    { min: 2, text: 'Thruster deselected / stopped — emergency stop', who: 'DPO' },
    { min: 4, text: 'Back to a controllable condition on the remaining thrusters', who: 'DPO' },
    { min: 7, text: 'ECR checks the thruster locally; report to the bridge', who: 'ECR' },
    { min: 11, text: 'End of drill — debrief: time to recognise, time to stop', who: 'All' },
  ],
};

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
