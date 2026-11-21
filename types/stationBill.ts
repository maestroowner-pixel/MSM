// ===================================
// The muster list — the station bill (SOLAS III/8, III/37; ISPS A/9 for the
// security duties). 21 Nov 2026, the owner: "each crew member's actions at an
// alarm, by the muster list and the security list; edit the lists and the areas
// of responsibility in the app; print by the main emergencies".
//
// BY POSITION, not by person: a row is a billet ("3 — 2nd Officer") with its
// duties at every alarm; the person holding it is ASSIGNED, so a crew change
// moves a name and leaves the duties where they are.
//
// A REVISION is issued whole by the Master and never changed — a new list is a
// new revision (`station_bills`, id `sb_r<rev>`), as SOLAS III/37.2 asks the list
// to be revised when the crew changes. What was in force on the day of a drill or
// an inspection is the revision issued before it. The list being edited is a
// draft on the Master's device until it is issued.
//
// Duty keys are PERMANENT ids — they key every stored row.
// ===================================

/** The alarms of the list, in the order they print. Security is one alarm with a duty per ISPS level. */
export type AlarmKind = 'fire' | 'abandon' | 'mob' | 'sopep' | 'security';
export const ALARMS: AlarmKind[] = ['fire', 'abandon', 'mob', 'sopep', 'security'];

/** What a row holds per alarm — security once per ISPS level. */
export type DutyKey = 'fire' | 'abandon' | 'mob' | 'sopep' | 'sec1' | 'sec2' | 'sec3';
export const DUTY_KEYS: DutyKey[] = ['fire', 'abandon', 'mob', 'sopep', 'sec1', 'sec2', 'sec3'];

/** An area of responsibility: a space to search or keep, a boat or raft, a muster or embarkation station. */
export type ZoneKind = 'space' | 'boat' | 'station' | 'other';

export interface BillZone {
  id: string;
  name: string;
  kind: ZoneKind;
  /** A boat or raft in the register (EquipmentItem id), or a muster station (MusterStation id). May dangle. */
  ref?: string;
  removed?: boolean;
}

export interface BillDuty {
  /** Where to go: "Bridge", "Muster station A", "Fire station aft". */
  station?: string;
  /** What to do — the line the person reads. */
  duty: string;
  /** The area of responsibility (BillZone id). */
  zoneId?: string;
}

export interface BillRow {
  /** Permanent for the billet across revisions. */
  id: string;
  /** The billet's number on the list. */
  no: number;
  /** The position: "Master", "2nd Officer", "Deckhand 1". English, as printed. */
  position: string;
  /** The person holding it (CrewMember id) and their name at the time — none = not filled. */
  crewId?: string;
  name?: string;
  /** Who stands in when they are not aboard or not able (another row's no.). */
  deputyNo?: number;
  duties: Partial<Record<DutyKey, BillDuty>>;
}

export interface StationBill {
  /** `sb_r<rev>` */
  id: string;
  rev: number;
  rows: BillRow[];
  zones: BillZone[];
  /** How each alarm is given: "7 short + 1 long on the general alarm". */
  signals: Partial<Record<AlarmKind, string>>;
  /** What changed in this revision. */
  note?: string;
  /** Epoch ms */
  issuedAt: number;
  issuedBy: string;
  updatedAt: number;
}

/** The list being edited (the Master's device, never synced): the rows, zones and signals of a revision to come. */
export type BillDraft = Pick<StationBill, 'rows' | 'zones' | 'signals'> & { note?: string; from?: number };
