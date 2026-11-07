// ===================================
// Rope and wire log (plan item 67, 7 Nov 2026 — UniSea's "Wire Manager"): what
// happened to one mooring line, crane wire, winch wire or hoist rope over its
// life — a look at its condition with the diameter measured and a photo of the
// damage, cut and slip, end for end, lubrication, a winch brake test, and the
// rope renewed. Each entry is one signed record, APPEND-ONLY like the GMDSS log:
// a mistake is a new entry, never an edit. The rope is the register item
// (Lifting & Mooring); its wear is read from the entries (services/wireLog.ts),
// nothing about it is stored.
// ===================================

import type { Attachment } from './equipment';
import type { SignProof } from '../services/signature';

/** Permanent: written onto every record. */
export const WIRE_KINDS = ['inspect', 'cutSlip', 'endForEnd', 'lube', 'brake', 'renewed'] as const;
export type WireKind = (typeof WIRE_KINDS)[number];

/** The keeper's word for what was seen, worst last. */
export const WIRE_RATINGS = ['good', 'fair', 'poor', 'discard'] as const;
export type WireRating = (typeof WIRE_RATINGS)[number];

/** What a look can find. Permanent ids. `brokenWires` and `birdcage` only mean anything on wire. */
export const WIRE_FINDINGS = ['abrasion', 'cuts', 'kinks', 'crushing', 'corrosion', 'birdcage', 'strands', 'heat', 'hardening', 'eye'] as const;
export type WireFinding = (typeof WIRE_FINDINGS)[number];

/** Where a length was cut off. */
export const WIRE_ENDS = ['outboard', 'drum'] as const;
export type WireEnd = (typeof WIRE_ENDS)[number];

export interface WireEntry {
  id: string;
  /** The register item (EquipmentItem.id) — the rope, the crane, the winch. */
  itemId: string;
  kind: WireKind;
  /** ISO day it was done. */
  date: string;

  // ---- inspect ----
  rating?: WireRating;
  /** Measured diameter, mm — the smallest reading along the worked length. */
  diameterMm?: number;
  /** Visible broken wires in the worst length (wire rope only). */
  brokenWires?: number;
  findings?: WireFinding[];
  /** Up to 4; they travel like an inspection's (services/photoQueue, path from this id). */
  photos?: Attachment[];

  // ---- cut and slip ----
  cutM?: number;
  end?: WireEnd;

  // ---- brake test ----
  brakeOk?: boolean;
  /** The load it held, as set or read ("60% MBL", "26 t"). */
  brakeLoad?: string;

  // ---- renewed ----
  /** Length of the new rope, m. */
  lengthM?: number;
  /** Diameter of the new rope, mm, as supplied. */
  diaNew?: number;
  /** The new rope's certificate number. */
  certNo?: string;

  note?: string;
  by: string;
  byRank?: string;
  signedWith?: SignProof;
  /** Exact time of the signature. */
  at: number;
  createdAt: number;
  updatedAt: number;
}

/** For the papers: English always. */
export const WIRE_KIND_EN: Record<WireKind, string> = {
  inspect: 'Condition',
  cutSlip: 'Cut and slip',
  endForEnd: 'End for end',
  lube: 'Lubricated',
  brake: 'Brake test',
  renewed: 'Renewed',
};
export const WIRE_FINDING_EN: Record<WireFinding, string> = {
  abrasion: 'abrasion / chafe',
  cuts: 'cuts',
  kinks: 'kinks',
  crushing: 'crushing / flattening',
  corrosion: 'corrosion',
  birdcage: 'birdcaging',
  strands: 'broken strand',
  heat: 'heat damage / glazing',
  hardening: 'hardening / UV',
  eye: 'eye or splice worn',
};
