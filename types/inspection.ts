// ===================================
// Inspection record — the audit trail.
//
// One record = one crew member, at one moment, working through one checklist
// against one item. This is the thing a PSC officer or an ISM auditor asks to
// see, and the reason the register alone was never enough: the register says
// what the equipment IS, an inspection says what somebody DID and when.
//
// **Records are append-only and never edited.** Not a simplification — it is
// the point. A signed statement that can be quietly rewritten afterwards is
// worth nothing at an audit, so a mistake is corrected by recording a new
// inspection, and both stay on file. Two useful properties fall out of that:
//   - Sync is trivial. Every record carries a globally unique id and is never
//     mutated, so merging two devices is a set union — there is no conflict to
//     resolve, no last-writer-wins, nothing to lose. (Contrast the register
//     itself, where two devices editing one item genuinely do collide.)
//   - `at` is the moment of the inspection, not of the save. It is stamped once,
//     when the crew member signs, and never touched again.
//
// The signature is stored as a NAME SNAPSHOT (`by`), not only a crew id: crew
// sign off, leave the vessel and get deleted from the crew list, and a two-year
// old inspection must still say who carried it out. `byId` is kept alongside for
// linking while the person is still aboard, and is allowed to dangle.
// ===================================

import { Attachment, CategoryKey } from './equipment';

/** Result of one checklist line. `na` = genuinely not applicable to this item. */
export type CheckResult = 'pass' | 'fail' | 'na';

/** How often the check is required. Drives the report periods and the "due" logic. */
export type InspectionPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export const PERIOD_LABEL: Record<InspectionPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

/** Nominal length of each period, in days — used to work out what is due. */
export const PERIOD_DAYS: Record<InspectionPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

/**
 * Outcome of the whole inspection. Derived from the line results at save time
 * (see `outcomeOf`) and then FROZEN onto the record, so a later change to a
 * checklist template can never retro-actively turn a pass into a fail.
 */
export type InspectionOutcome = 'pass' | 'fail';

export interface Inspection {
  id: string;
  /** The item inspected. Kept as a plain id — the category is stored beside it
   *  so a report can be built without walking the whole register. */
  itemId: string;
  category: CategoryKey;

  /** Epoch ms — exact date AND time the crew member signed. Never re-stamped. */
  at: number;

  /** Signature: the name as it stood at the time (see the header). */
  by: string;
  /** Rank/role at the time, if known. Also a snapshot. */
  byRank?: string;
  /** Crew id, for linking while that person is still on the crew list. May dangle. */
  byId?: string;

  period: InspectionPeriod;
  /** Which checklist was used, and its version, so an old record can be read
   *  back against the questions that were actually asked. */
  templateId: string;
  templateVersion: number;

  /** checklist line id -> result. Lines the template no longer has are kept. */
  results: Record<string, CheckResult>;
  /** Frozen at save time — never recomputed. */
  outcome: InspectionOutcome;

  /** Free text: what was found, what was done. */
  comment?: string;
  /** Photos taken as evidence for THIS inspection (not the item's general photos). */
  photos?: Attachment[];

  /**
   * A defect raised by this inspection. Present whenever the crew member failed
   * a line or wrote one up by hand. Cleared by a later rectification rather than
   * by editing (the clearing is stamped and signed in its turn), which is why it
   * is the one part of the record allowed to change — and only from open to
   * closed, once.
   */
  defect?: InspectionDefect;

  /** Which device recorded it — useful when reconciling a messy sync. */
  deviceId?: string;

  /** Set once, at creation. Present so the record shape matches the rest of the
   *  app's stored types; it never diverges from `at` except when a defect closes. */
  updatedAt: number;
}

export interface InspectionDefect {
  /** What is wrong. Defaults to the failed lines when the crew member adds nothing. */
  note: string;
  open: boolean;
  /** Rectification, when it happens — stamped and signed like everything else. */
  closedAt?: number;
  closedBy?: string;
  closedNote?: string;
}

/** A fail on any line fails the inspection. `na` never fails. */
export function outcomeOf(results: Record<string, CheckResult>): InspectionOutcome {
  return Object.values(results).some((r) => r === 'fail') ? 'fail' : 'pass';
}

/** True when this record still carries something the vessel owes work on. */
export function hasOpenDefect(insp: Inspection): boolean {
  return !!insp.defect && insp.defect.open;
}
