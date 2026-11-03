// ===================================
// Watch plan — the hours of rest a person is GOING to have (plan item 41).
//
// Hours of rest records what happened; by then a breach is a fact to explain to
// an inspector. The plan is what the Master or the Chief Officer means to set:
// the person's standing watch, and the days that differ from it (arrival at
// 0200, a drill, a day off). The same rules (services/restHours) are run over
// the days to come, so a watch bill that will break 10 h / 77 h shows the day it
// is written, not the day after it was worked.
//
// ONE DOCUMENT PER PERSON, id = crewId. A plan is edited by the officers, rarely
// and from one place; two editing at once resolve by the later `updatedAt`,
// as the register does. Days are wall-clock strings like a RestDay's `work` (48
// slots; 46/50 on a day the clocks change — services/restHours fitDay fits
// either). Days already past are dropped on save: the record is in `rest`, the
// plan only ever looks forward.
// ===================================

export interface RestPlanDay {
  /** '1' = work, '0' = rest, one character per half hour. */
  work: string;
  note?: string;
}

export interface RestPlan {
  /** = crewId */
  id: string;
  crewId: string;
  /** The person's name when saved. */
  holderName: string;
  /** The standing watch, every day from `from`: 48 characters, or '' for none. */
  pattern: string;
  /** yyyy-mm-dd — the first day the standing watch applies. */
  from: string;
  /** Days that differ from the standing watch, by yyyy-mm-dd. */
  days: Record<string, RestPlanDay>;
  updatedBy?: string;
  updatedAt: number;
}

/** How far ahead the plan is checked and shown. */
export const PLAN_DAYS = 14;
