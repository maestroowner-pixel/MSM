// ===================================
// Hospital — the medicine chest, the medical log and the controlled drugs
// register (13 Oct 2026: "hospital — the next module"; announced to Jez as "the
// medical store and its expiry dates, and treatment records").
//
//   MedItem       one line of the chest: what, strength / form, how many must be
//                 aboard, where it is kept; controlled drugs marked.
//   MedMove       stock, kept as moves — received, issued, disposed, counted —
//                 each by batch and expiry, signed; a controlled drug's move also
//                 by a witness. Append-only. What is aboard is the sum of moves.
//   MedOrder      an order to the supplier (13 Oct 2026: "an order register —
//                 not everything comes on time, nor all at once"): lines with
//                 the quantity ordered; each delivery is received against its
//                 line (a `received` move with the batch and expiry), so a
//                 line shows 6 of 10 until the rest comes. Complete, or closed
//                 with what was not delivered, it goes to the archive.
//   MedCheck      an inventory: every batch counted against the books, signed
//                 (with a witness where controlled drugs are counted); each line
//                 also writes a `count` move, so the stock follows the count.
//   MedTreatment  one entry of the medical log: patient, complaint, vital signs,
//                 diagnosis, what was given (taken from the chest), radio
//                 medical advice, outcome, signed. Seen by the Master and the
//                 officers only (owner, 13 Oct 2026) — never by the crew, never
//                 by the shore.
//
// The chest starts from the vessel's own Excel list, or from the WHO IMGS scale
// for its hospital category (constants/medScale.ts, from Marine Hospital
// Manager), edited to the flag's scale.
// ===================================

import type { SignProof } from '../services/signature';

export type MedKind = 'medicine' | 'equipment' | 'consumable';

export interface MedItem {
  id: string;
  name: string;
  /** Strength and form — "500 mg tablets", "10 mg/1 ml ampoule". */
  strength?: string;
  /** What it is counted in — tablets, ampoules, pcs. */
  unit: string;
  /** How many the scale requires aboard. */
  required: number;
  kind: MedKind;
  /** The number in the list the chest is kept to — WHO IMGS ("W.H.O. 1.3.1", "II.2.21") or the flag's ("MSN 1768 A-12"). */
  listNo?: string;
  /** Where it is kept — the room: Hospital, bridge first-aid bag, rescue boat… */
  location?: string;
  /** In the room: cabinet, locker, cupboard — "A", "CD safe". */
  cabinet?: string;
  /** In the cabinet: shelf, drawer, cell, box — "3", "Shelf 2 / box 4". */
  cell?: string;
  /** Therapeutic group or equipment section — "Cardiovascular", "Bandages & Sutures". */
  group?: string;
  /** ATC code (medicines) or IMGS code (equipment, "II.2.21"). */
  code?: string;
  /** Morphine and the like — every move witnessed, counted by the Master monthly. */
  controlled?: boolean;
  notes?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

export type MedMoveKind = 'received' | 'issued' | 'disposed' | 'count';

export interface MedMove {
  id: string;
  itemId: string;
  kind: MedMoveKind;
  /** Units moved; for a count, the quantity counted in that batch. */
  qty: number;
  batchNo?: string;
  /** YYYY-MM-DD (a month alone is stored as its last day). */
  expiry?: string;
  date: string;
  /** Received from / disposed how / why; never a patient's name. */
  note?: string;
  /** Issued for this entry of the medical log. */
  treatmentId?: string;
  /** Received against this order line. */
  orderId?: string;
  lineId?: string;
  /** Counted in this inventory. */
  checkId?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  /** Controlled drugs: the second person present. */
  witness?: string;
  witnessRank?: string;
  witnessWith?: SignProof;
  updatedAt: number;
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  strength?: string;
  unit: string;
  qty: number;
}

export interface MedOrder {
  id: string;
  /** MO-YYYY-NNN */
  no: string;
  date: string;
  supplier?: string;
  /** Supplier's / agent's reference, PO number. */
  ref?: string;
  /** Expected — where and when. */
  port?: string;
  due?: string;
  lines: OrderLine[];
  note?: string;
  by: string;
  byRank?: string;
  at: number;
  /** Closed with lines still short — what was not delivered and why. */
  closedAt?: number;
  closedBy?: string;
  closedByRank?: string;
  closeNote?: string;
  updatedAt: number;
}

export interface CheckLine {
  itemId: string;
  name: string;
  batchNo?: string;
  expiry?: string;
  /** Where it is kept, as written at the count — "Hospital · cabinet A · cell 3". */
  place?: string;
  /** What the books said. */
  expected: number;
  counted: number;
}

export interface MedCheck {
  id: string;
  /** INV-YYYY-NNN */
  no: string;
  /**
   * inventory — the whole chest; cd — the Master's monthly count of the
   * controlled drugs, with a witness; handover — the controlled drugs handed
   * from one responsible officer to the next (13 Oct 2026: "narcotic list
   * handover"): `by` hands over, `witness` takes over, both sign. Absent: inventory.
   */
  kind?: 'inventory' | 'cd' | 'handover';
  date: string;
  lines: CheckLine[];
  note?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  witness?: string;
  witnessRank?: string;
  witnessWith?: SignProof;
  updatedAt: number;
}

/** A file kept with a medical log entry — the written radio medical advice. */
export interface MedFile {
  id: string;
  name: string;
  /** Download URL (synced vessels) or a data: URI (a device on its own). */
  url: string;
  bytes: number;
  addedBy: string;
  addedAt: number;
}

export interface Vitals {
  /** °C */
  temp?: string;
  /** beats / min */
  pulse?: string;
  /** "120/80" */
  bp?: string;
  /** breaths / min */
  rr?: string;
  /** % */
  spo2?: string;
}

export interface Issued {
  itemId: string;
  name: string;
  qty: number;
  unit: string;
  batchNo?: string;
  expiry?: string;
  /** Dose and how given — "1 g orally every 6 h". */
  dose?: string;
}

export type MedOutcome = 'fit' | 'light' | 'unfit' | 'landed' | 'evacuated';
export const OUTCOME_LABEL: Record<MedOutcome, string> = {
  fit: 'Fit for duty',
  light: 'Light duties',
  unfit: 'Unfit for duty — rest aboard',
  landed: 'Sent to a doctor ashore',
  evacuated: 'Evacuated (medevac)',
};

export interface MedTreatment {
  id: string;
  /** MED-YYYY-NNN */
  no: string;
  date: string;
  time?: string;
  patient: string;
  patientRank?: string;
  complaint: string;
  /** How it happened, history, allergies. */
  history?: string;
  vitals?: Vitals;
  findings?: string;
  diagnosis?: string;
  treatment?: string;
  issued: Issued[];
  /** Radio medical advice (TMAS / CIRM / MRCC). */
  tmas?: { centre?: string; ref?: string; advice?: string };
  outcome: MedOutcome;
  followUp?: string;
  /** A follow-up of an earlier entry. */
  followUpOf?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  witness?: string;
  witnessRank?: string;
  witnessWith?: SignProof;
  /** Written medical advice and the like — added later too; the entry itself never changes. */
  files?: MedFile[];
  updatedAt: number;
}

export const MED_KIND_LABEL: Record<MedKind, string> = { medicine: 'Medicine', equipment: 'Equipment', consumable: 'Dressings & consumables' };
