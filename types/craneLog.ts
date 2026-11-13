// ===================================
// Crane operator's log (13 Nov 2026): who worked which crane, on which day,
// for how long and on what kind of work — so a crane operator leaves the
// vessel with an experience statement for the CV and the next certificate,
// naming each crane by its make, type and safe working load. One entry is one
// operator on one crane on one day, signed by the officer who confirms it.
// APPEND-ONLY like the rope log: a mistake is a new entry that `voids` it.
//
// The crane is the register item (Lifting & Mooring → cranes); what it was on
// the day — make, type, SWL — is copied onto the entry, so the statement still
// reads right after the crane is renamed or replaced on the register.
// ===================================

import type { SignProof } from '../services/signature';

/** Permanent: written onto every record. */
export const CRANE_OPS = ['cargo', 'stores', 'offshore', 'subsea', 'personnel', 'boat', 'other'] as const;
export type CraneOp = (typeof CRANE_OPS)[number];

/** For the papers: English always. */
export const CRANE_OP_EN: Record<CraneOp, string> = {
  cargo: 'Cargo, deck',
  stores: 'Stores and provisions',
  offshore: 'Offshore — ship to ship or installation',
  subsea: 'Subsea — A-frame, LARS, ROV',
  personnel: 'Personnel transfer',
  boat: 'Tender or rescue boat',
  other: 'Other',
};

/** The crane as it was on the day. */
export interface CraneSnap {
  /** "Knuckle-boom crane No. 2" — the register's name for it. */
  label: string;
  make?: string;
  type?: string;
  /** As marked: "12 t", "5 t @ 20 m". */
  swl?: string;
}

export interface CraneEntry {
  id: string;
  /** The register item (EquipmentItem.id). */
  itemId: string;
  crane: CraneSnap;
  /** The operator — CrewMember.id, and the name and rank at the time. */
  crewId: string;
  name: string;
  rank?: string;
  /** ISO day worked. */
  date: string;
  /** Hours at the controls, in half hours. */
  hours: number;
  /** Lifts made, when counted. */
  lifts?: number;
  ops: CraneOp[];
  /** The heaviest lift, as weighed or marked: "8.5 t". */
  heaviest?: string;
  note?: string;
  /** This entry cancels an earlier one (a mistake); the earlier stays on record. */
  voids?: string;
  by: string;
  byRank?: string;
  signedWith?: SignProof;
  at: number;
  createdAt: number;
  updatedAt: number;
}

// ---- Load tests and examinations (13 Nov 2026) --------------------------------
// A test of the crane itself — proof load, function, limits, brake — with who did
// it, the result and the certificate. Signed by an officer, APPEND-ONLY. When an
// operator worked the crane during the test, it also counts in their statement.

/** Permanent: written onto every record. */
export const CRANE_TEST_KINDS = ['annual', 'fiveYear', 'afterRepair', 'function', 'limits', 'brake'] as const;
export type CraneTestKind = (typeof CRANE_TEST_KINDS)[number];

export const CRANE_TEST_EN: Record<CraneTestKind, string> = {
  annual: 'Annual thorough examination and load test',
  fiveYear: 'Five-yearly proof load test',
  afterRepair: 'Load test after repair or alteration',
  function: 'Function test',
  limits: 'Limit switches and overload protection',
  brake: 'Brake test',
};

export interface CraneTest {
  id: string;
  itemId: string;
  crane: CraneSnap;
  kind: CraneTestKind;
  /** ISO day of the test. */
  date: string;
  /** The test load as applied: "15 t". */
  testLoad?: string;
  /** Per cent of SWL, when stated: 110, 125. */
  pctSwl?: number;
  /** Radius / outreach at which it was applied: "18 m". */
  radius?: string;
  result: 'pass' | 'fail';
  /** The competent person or company — class surveyor, service firm. */
  examiner?: string;
  certNo?: string;
  /** Next test of this kind is due. */
  nextDue?: string;
  /** The operator at the controls, when there was one — it counts in their statement. */
  crewId?: string;
  name?: string;
  rank?: string;
  note?: string;
  by: string;
  byRank?: string;
  signedWith?: SignProof;
  at: number;
  createdAt: number;
  updatedAt: number;
}
