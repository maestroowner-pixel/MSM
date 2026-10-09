// ===================================
// Hours of rest — one person, one calendar day.
//
// The day is 48 half-hour slots written as a string of '0' (rest) and '1'
// (work), midnight to midnight in the ship's time. Half an hour is the unit
// every paper record and every flag's form uses, and a string keeps a year of
// a twenty-person crew to a few hundred kilobytes.
//
// WHY ONE DOCUMENT PER PERSON PER DAY. A crew member fills in their own day on
// their own phone while the Master reviews the month on the bridge; two people
// never edit the same day at the same moment in practice, and when they do the
// later `updatedAt` wins, the same rule as the register. The id is
// `<crewId>_<date>`, so the same day written on two devices is the same record
// rather than two that both claim it.
//
// A day with no record is UNKNOWN, not rest: the rules below never treat a
// missing day as compliant time off.
// ===================================

export const SLOTS_PER_DAY = 48;

export interface RestDay {
  /** `${crewId}_${date}` */
  id: string;
  crewId: string;
  /** The person's name when saved — the crew list can lose them later. */
  holderName: string;
  /** yyyy-mm-dd, ship's time. */
  date: string;
  /** 48 characters: '1' = work, '0' = rest. */
  work: string;
  note?: string;
  /** Who last saved it, as written on their device's account or picked name. */
  updatedBy?: string;
  updatedAt: number;
}

export function restDayId(crewId: string, date: string): string {
  return `${crewId}_${date}`;
}

export function emptyDay(): string {
  return '0'.repeat(SLOTS_PER_DAY);
}

/** "06:30" for slot 13. */
export function slotLabel(slot: number): string {
  const h = Math.floor(slot / 2);
  return `${String(h).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`;
}
