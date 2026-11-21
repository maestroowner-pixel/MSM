// ===================================
// The muster list — revisions, the standard list, whose duties are what, and
// what the Master must put right (types/stationBill.ts). Pure: no React Native.
// ===================================

import { AlarmKind, BillDraft, BillDuty, BillRow, BillZone, DUTY_KEYS, DutyKey, StationBill } from '../types/stationBill';
import { CrewMember, isAboard } from '../types/crew';

const fold = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// ---- revisions --------------------------------------------------------------------

/** The revision in force now: the highest. */
export function currentBill(bills: StationBill[]): StationBill | undefined {
  return bills.reduce<StationBill | undefined>((a, b) => (!a || b.rev > a.rev ? b : a), undefined);
}

/** The revision in force at `ms` — what applied on the day of a drill or an inspection. */
export function billAt(bills: StationBill[], ms: number): StationBill | undefined {
  return currentBill(bills.filter((b) => b.issuedAt <= ms));
}

export const billId = (rev: number) => `sb_r${rev}`;

/** A draft to edit, from the revision in force (or the standard list when there is none). */
export function draftFrom(bill?: StationBill): BillDraft {
  if (!bill) return { ...standardBill(), from: 0 };
  return { rows: bill.rows.map((r) => ({ ...r, duties: { ...r.duties } })), zones: bill.zones.map((z) => ({ ...z })), signals: { ...bill.signals }, from: bill.rev };
}

/** What must be fixed before a draft is issued: null when it can be. */
export function draftProblem(d: BillDraft): string | null {
  const rows = d.rows;
  if (!rows.length) return 'sb.p.empty';
  if (rows.some((r) => !r.position.trim())) return 'sb.p.position';
  const nos = rows.map((r) => r.no);
  if (nos.some((n) => !Number.isInteger(n) || n <= 0) || new Set(nos).size !== nos.length) return 'sb.p.numbers';
  return null;
}

/** Duties with no text are dropped; a zone that is gone is not kept on a duty. */
function cleanDuties(duties: BillRow['duties'], zones: BillZone[]): BillRow['duties'] {
  const live = new Set(zones.filter((z) => !z.removed).map((z) => z.id));
  const out: BillRow['duties'] = {};
  for (const k of DUTY_KEYS) {
    const d = duties[k];
    if (!d || !d.duty.trim()) continue;
    out[k] = {
      duty: d.duty.trim(),
      ...(d.station?.trim() ? { station: d.station.trim() } : {}),
      ...(d.zoneId && live.has(d.zoneId) ? { zoneId: d.zoneId } : {}),
    };
  }
  return out;
}

/**
 * The draft issued as the next revision — rows in number order, each person's
 * name as the crew list has it now (the list keeps it if they leave).
 */
export function issueBill(d: BillDraft, bills: StationBill[], crew: CrewMember[], by: string, now: number): StationBill {
  const rev = Math.max(0, ...bills.map((b) => b.rev)) + 1;
  const byId = new Map(crew.map((c) => [c.id, c]));
  const zones = d.zones.filter((z) => !z.removed && z.name.trim()).map((z) => ({ ...z, name: z.name.trim() }));
  const rows = [...d.rows]
    .sort((a, b) => a.no - b.no)
    .map((r): BillRow => {
      const c = r.crewId ? byId.get(r.crewId) : undefined;
      const name = c?.name ?? r.name;
      return {
        id: r.id,
        no: r.no,
        position: r.position.trim(),
        ...(r.crewId ? { crewId: r.crewId } : {}),
        ...(r.crewId && name ? { name } : {}),
        ...(r.deputyNo && r.deputyNo !== r.no ? { deputyNo: r.deputyNo } : {}),
        duties: cleanDuties(r.duties, zones),
      };
    });
  const signals: StationBill['signals'] = {};
  for (const [k, v] of Object.entries(d.signals)) if (v?.trim()) signals[k as AlarmKind] = v.trim();
  return { id: billId(rev), rev, rows, zones, signals, ...(d.note?.trim() ? { note: d.note.trim() } : {}), issuedAt: now, issuedBy: by, updatedAt: now };
}

// ---- people --------------------------------------------------------------------------

/** The rows a person holds: by crew id, else by name (a device without the person's id). */
export function rowsOf(bill: StationBill | undefined, who: { id?: string; name?: string }): BillRow[] {
  if (!bill) return [];
  const byId = who.id ? bill.rows.filter((r) => r.crewId === who.id) : [];
  if (byId.length) return byId;
  const n = fold(who.name);
  return n ? bill.rows.filter((r) => fold(r.name) === n) : [];
}

/** One line per alarm for a person: where and what, the zone named — what their card and "My documents" show. */
export interface MyDuty {
  key: DutyKey;
  row: BillRow;
  duty: BillDuty;
  zone?: BillZone;
}
export function dutiesOf(bill: StationBill | undefined, who: { id?: string; name?: string }): MyDuty[] {
  if (!bill) return [];
  const zones = new Map(bill.zones.map((z) => [z.id, z]));
  const out: MyDuty[] = [];
  for (const row of rowsOf(bill, who)) {
    for (const key of DUTY_KEYS) {
      const duty = row.duties[key];
      if (duty) out.push({ key, row, duty, ...(duty.zoneId && zones.get(duty.zoneId) ? { zone: zones.get(duty.zoneId) } : {}) });
    }
  }
  return out;
}

/**
 * Empty rows filled from the crew aboard by rank: the same words ("2nd Officer" =
 * "2nd officer"), else a rank the position begins with ("Deckhand" → "Deckhand 1").
 * Rows already filled and people already on the list are left alone.
 */
export function fillFromCrew(rows: BillRow[], crew: CrewMember[]): BillRow[] {
  const aboard = crew.filter((c) => isAboard(c) && c.rank);
  const taken = new Set(rows.map((r) => r.crewId).filter(Boolean) as string[]);
  const pick = (r: BillRow, exact: boolean) =>
    aboard.find((c) => !taken.has(c.id) && (exact ? fold(c.rank) === fold(r.position) : fold(r.position).startsWith(fold(c.rank))));
  const out = rows.map((r) => ({ ...r }));
  for (const exact of [true, false]) {
    for (const r of out) {
      if (r.crewId) continue;
      const c = pick(r, exact);
      if (c) {
        r.crewId = c.id;
        r.name = c.name;
        taken.add(c.id);
      }
    }
  }
  return out;
}

/** What the Master should put right: positions no one holds, people aboard not on the list, people gone still on it. */
export interface BillGaps {
  unfilled: BillRow[];
  notOnList: CrewMember[];
  gone: BillRow[];
  twice: CrewMember[];
}
export function billGaps(bill: StationBill | undefined, crew: CrewMember[]): BillGaps {
  if (!bill) return { unfilled: [], notOnList: [], gone: [], twice: [] };
  const aboard = crew.filter((c) => isAboard(c));
  const aboardIds = new Set(aboard.map((c) => c.id));
  const count = new Map<string, number>();
  for (const r of bill.rows) if (r.crewId) count.set(r.crewId, (count.get(r.crewId) ?? 0) + 1);
  return {
    unfilled: bill.rows.filter((r) => !r.crewId),
    notOnList: aboard.filter((c) => !count.has(c.id)),
    gone: bill.rows.filter((r) => r.crewId && !aboardIds.has(r.crewId)),
    twice: aboard.filter((c) => (count.get(c.id) ?? 0) > 1),
  };
}

// ---- the standard list -------------------------------------------------------------
//
// A motor yacht or a small vessel of about ten. A START, worded to be changed: the
// company's SMS and the vessel's own fire plan decide. Ids are permanent.

export const STANDARD_SIGNALS: Record<AlarmKind, string> = {
  fire: 'Fire alarm, or continuous ringing of the general alarm; "Fire, fire, fire" and the place on the PA',
  abandon: 'General emergency alarm: 7 or more short blasts + 1 long, then the Master’s order to abandon ship by voice',
  mob: '"Man overboard, port/starboard" on the PA and radio; 3 long blasts',
  sopep: '"Oil spill" and the place on the PA and radio',
  security: 'Security alert on the PA and radio, by the code word in the SSP',
};

const Z = (id: string, name: string, kind: BillZone['kind']): BillZone => ({ id, name, kind });
export const STANDARD_ZONES: BillZone[] = [
  Z('z_bridge', 'Bridge', 'space'),
  Z('z_er', 'Engine room', 'space'),
  Z('z_accom', 'Accommodation (guest and crew)', 'space'),
  Z('z_galley', 'Galley and laundry', 'space'),
  Z('z_decks', 'Open decks, tender garage', 'space'),
  Z('z_muster', 'Muster station', 'station'),
  Z('z_raft_ps', 'Liferaft PS', 'boat'),
  Z('z_raft_sb', 'Liferaft SB', 'boat'),
  Z('z_rescue', 'Rescue boat / tender', 'boat'),
  Z('z_gangway', 'Gangway and access points', 'space'),
];

const D = (duty: string, station?: string, zoneId?: string): BillDuty => ({ duty, ...(station ? { station } : {}), ...(zoneId ? { zoneId } : {}) });
const row = (no: number, position: string, duties: BillRow['duties'], deputyNo?: number): BillRow => ({ id: `sb_std_${no}`, no, position, ...(deputyNo ? { deputyNo } : {}), duties });

export const STANDARD_ROWS: BillRow[] = [
  row(1, 'Master', {
    fire: D('In overall command; communications with the shore and other vessels', 'Bridge', 'z_bridge'),
    abandon: D('Gives the order to abandon ship; EPIRB, SART and GMDSS distress; ship’s papers', 'Bridge', 'z_bridge'),
    mob: D('Manoeuvres (Williamson turn); MOB on the plotter; Mayday relay / Pan-Pan', 'Bridge', 'z_bridge'),
    sopep: D('In command; reports to the coastal State and the company (SOPEP)', 'Bridge', 'z_bridge'),
    sec1: D('Ship Security Officer’s duties delegated as the SSP; keeps the security level', 'Bridge'),
    sec2: D('Reviews access control and the restricted areas; liaison with the port facility', 'Bridge'),
    sec3: D('In command; follows the instructions of the authorities; liaison with the PFSO', 'Bridge'),
  }, 2),
  row(2, 'Chief Officer', {
    fire: D('Leads the fire party: finds the fire, decides how to fight it, reports to the bridge', 'Scene of the fire', 'z_decks'),
    abandon: D('In charge of the embarkation; counts persons; launches the liferafts', 'Muster station', 'z_raft_ps'),
    mob: D('Leads the rescue: rescue boat or recovery from the deck', 'Rescue boat', 'z_rescue'),
    sopep: D('Leads the response on deck: stops the source, contains the spill (SOPEP locker)', 'Scene of the spill', 'z_decks'),
    sec1: D('Ship Security Officer: access control, searches as the SSP', 'Gangway', 'z_gangway'),
    sec2: D('Ship Security Officer: one access point, searches of baggage and stores', 'Gangway', 'z_gangway'),
    sec3: D('Ship Security Officer: access closed except as the authorities say; restricted areas locked', 'Bridge', 'z_gangway'),
  }, 3),
  row(3, '2nd Officer', {
    fire: D('Takes the watch on the bridge; fire alarm panel; boundary cooling ordered', 'Bridge', 'z_bridge'),
    abandon: D('Brings the handheld VHFs, SART and EPIRB to the muster station', 'Bridge → muster station', 'z_muster'),
    mob: D('Takes the watch; keeps the person in sight from the bridge wing; lifebuoy with light and smoke', 'Bridge', 'z_bridge'),
    sopep: D('Takes the watch; keeps the log of the spill (times, position, actions)', 'Bridge', 'z_bridge'),
    sec1: D('Security rounds as the SSP', 'Bridge', 'z_bridge'),
    sec2: D('Security rounds doubled; watches the deck at night', 'Bridge', 'z_bridge'),
    sec3: D('Bridge security watch; communications', 'Bridge', 'z_bridge'),
  }),
  row(4, 'Bosun', {
    fire: D('Fire party: hoses and the fire main; puts on the fire suit and breathing apparatus', 'Fire station', 'z_decks'),
    abandon: D('Prepares the liferafts for launching; painter made fast', 'Embarkation station', 'z_raft_sb'),
    mob: D('Rescue boat crew: launches and drives the boat', 'Rescue boat', 'z_rescue'),
    sopep: D('Booms and absorbents from the SOPEP locker; scuppers plugged', 'SOPEP locker', 'z_decks'),
    sec1: D('Gangway watch', 'Gangway', 'z_gangway'),
    sec2: D('Gangway watch; searches as told', 'Gangway', 'z_gangway'),
    sec3: D('Guards the gangway with the Chief Officer', 'Gangway', 'z_gangway'),
  }),
  row(5, 'Deckhand 1', {
    fire: D('Fire party: breathing apparatus team; boundary cooling', 'Fire station', 'z_decks'),
    abandon: D('Brings extra blankets and water; helps guests into the liferafts', 'Embarkation station', 'z_raft_ps'),
    mob: D('Rescue boat crew: recovers the person', 'Rescue boat', 'z_rescue'),
    sopep: D('Spreads absorbents; keeps the waste in bags', 'Scene of the spill', 'z_decks'),
    sec1: D('Deck watch as the duty roster', 'Open decks', 'z_decks'),
    sec2: D('Watches the waterline and the tender garage', 'Open decks', 'z_decks'),
    sec3: D('Watches the deck as told', 'Open decks', 'z_decks'),
  }),
  row(6, 'Deckhand 2', {
    fire: D('Fire party: closes doors, vents and fire flaps as told', 'Fire station', 'z_decks'),
    abandon: D('Launches the liferaft SB with the Bosun', 'Embarkation station', 'z_raft_sb'),
    mob: D('Points at the person and never takes the eyes off; throws the lifebuoy', 'Open decks', 'z_decks'),
    sopep: D('Helps with booms; pumps as the Chief Engineer says', 'Scene of the spill', 'z_decks'),
    sec1: D('Deck watch as the duty roster', 'Open decks', 'z_decks'),
    sec2: D('Watches the bow and the anchor', 'Open decks', 'z_decks'),
    sec3: D('Watches the deck as told', 'Open decks', 'z_decks'),
  }),
  row(7, 'Chief Engineer', {
    fire: D('Engine room: stops ventilation and fuel; fire pump; fixed system on the Master’s order', 'Engine room control', 'z_er'),
    abandon: D('Stops the engines on order; emergency generator; joins the muster station', 'Engine room → muster station', 'z_er'),
    mob: D('Engines ready for manoeuvring; stands by the rescue boat davit', 'Engine room', 'z_er'),
    sopep: D('Stops transfers and pumps; checks tanks and soundings; source found', 'Engine room', 'z_er'),
    sec1: D('Engine room locked when unmanned', 'Engine room', 'z_er'),
    sec2: D('Engine room and steering gear locked; rounds', 'Engine room', 'z_er'),
    sec3: D('Engine room as the authorities say', 'Engine room', 'z_er'),
  }, 8),
  row(8, '2nd Engineer', {
    fire: D('Fire pump and emergency fire pump; isolates electrics as told', 'Engine room', 'z_er'),
    abandon: D('Emergency lighting; closes fuel quick-closing valves', 'Engine room → muster station', 'z_er'),
    mob: D('Rescue boat engine; stands by the davit', 'Rescue boat', 'z_rescue'),
    sopep: D('Transfers oil from the leaking tank as the Chief Engineer says', 'Engine room', 'z_er'),
    sec1: D('Engine room rounds', 'Engine room', 'z_er'),
    sec2: D('Engine room rounds doubled', 'Engine room', 'z_er'),
    sec3: D('Engine room watch', 'Engine room', 'z_er'),
  }),
  row(9, 'Chief Stewardess', {
    fire: D('Guests: accounts for them and leads them to the muster station; checks cabins on the way', 'Guest areas → muster station', 'z_accom'),
    abandon: D('Guests: lifejackets on, counted, led to the embarkation station', 'Muster station', 'z_muster'),
    mob: D('Counts who is aboard and tells the bridge who is missing', 'Muster station', 'z_muster'),
    sopep: D('Guests kept inside, away from fumes', 'Guest areas', 'z_accom'),
    sec1: D('Guest and visitor list kept up to date', 'Accommodation', 'z_accom'),
    sec2: D('Visitors escorted; guest areas checked', 'Accommodation', 'z_accom'),
    sec3: D('Guests kept together inside', 'Accommodation', 'z_accom'),
  }, 10),
  row(10, 'Stewardess', {
    fire: D('Clears the crew area; first aid kit and stretcher to the muster station', 'Crew area → muster station', 'z_accom'),
    abandon: D('Brings the grab bag and the first aid kit; helps guests', 'Muster station', 'z_muster'),
    mob: D('First aid kit, blankets and the stretcher to the recovery point', 'Recovery point', 'z_decks'),
    sopep: D('Stands by with protective gloves and bags', 'Scene of the spill', 'z_decks'),
    sec1: D('Accommodation doors as the SSP', 'Accommodation', 'z_accom'),
    sec2: D('Accommodation checked for strangers', 'Accommodation', 'z_accom'),
    sec3: D('Stays with the guests', 'Accommodation', 'z_accom'),
  }),
  row(11, 'Chef', {
    fire: D('Galley: gas and power off, extraction stopped; then the fire party as told', 'Galley', 'z_galley'),
    abandon: D('Water and food for the liferafts; helps the embarkation', 'Galley → muster station', 'z_galley'),
    mob: D('Hot drinks and blankets to the recovery point', 'Galley', 'z_galley'),
    sopep: D('Galley vents closed', 'Galley', 'z_galley'),
    sec1: D('Stores received only from the listed suppliers', 'Galley', 'z_galley'),
    sec2: D('Stores checked before they come aboard', 'Galley', 'z_galley'),
    sec3: D('No stores aboard unless the authorities allow', 'Galley', 'z_galley'),
  }),
];

/** The standard list as a draft — a deep copy, so editing it never edits the template. */
export function standardBill(): BillDraft {
  return {
    rows: STANDARD_ROWS.map((r) => ({ ...r, duties: Object.fromEntries(Object.entries(r.duties).map(([k, d]) => [k, { ...d }])) as Record<DutyKey, BillDuty> })),
    zones: STANDARD_ZONES.map((z) => ({ ...z })),
    signals: { ...STANDARD_SIGNALS },
  };
}

/** The next free number on the list. */
export const nextNo = (rows: BillRow[]) => Math.max(0, ...rows.map((r) => r.no)) + 1;
