// ===================================
// Permits to work and risk assessments (ISM Code 7: "key shipboard operations
// … concerning the safety of personnel"; SOLAS / COSWP chapters on hot work,
// enclosed spaces, work at height, isolation).
//
//   Permit          one job under control: what, where, when, which precautions
//                   are in place, the gas readings, the people, and every step
//                   signed — requested, approved, started, closed.
//   RiskAssessment  hazards × likelihood × severity, controls and the risk left;
//                   either a GENERIC one in the vessel's library, or a copy made
//                   for one job and attached to its permit.
//
// Both are edited as a whole and synced newest-wins (one document each); the
// signatures inside are append-only by convention — the app never removes one,
// and a permit once closed or cancelled cannot be changed again.
// ===================================

import type { SignProof } from '../services/signature';

export type PermitType = 'general' | 'hot' | 'enclosed' | 'height' | 'electrical' | 'cold' | 'diving';

export type PermitStatus = 'draft' | 'requested' | 'approved' | 'active' | 'closed' | 'cancelled';

export interface SignStamp {
  by: string;
  byRank?: string;
  /** Epoch ms. */
  at: number;
  signedWith?: SignProof;
  note?: string;
}

export interface GasTest {
  at: number;
  /** % vol */
  o2?: number;
  /** % LEL */
  lel?: number;
  /** ppm */
  h2s?: number;
  /** ppm */
  co?: number;
  by: string;
  instrument?: string;
}

export type Answer = 'yes' | 'no' | 'na';

export interface Permit {
  id: string;
  /** PTW-2026-001 — given when first requested. */
  no?: string;
  type: PermitType;
  /** What is to be done. */
  work: string;
  location: string;
  /** Planned window, yyyy-mm-ddThh:mm (ship's time). */
  from?: string;
  to?: string;
  /** Who does the work. */
  team: string[];
  /** Precaution checklist answers by item id (constants/permitTypes). */
  checks: Record<string, Answer>;
  gasTests?: GasTest[];
  /** The risk assessment for this job. */
  raId?: string;
  /** Isolations in place (electrical / mechanical), free text lines. */
  isolations?: string[];
  status: PermitStatus;
  requested?: SignStamp;
  approved?: SignStamp;
  started?: SignStamp;
  closed?: SignStamp;
  cancelled?: SignStamp;
  notes?: string;
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Hazard {
  id: string;
  hazard: string;
  /** Who may be harmed / how. */
  consequence?: string;
  /** 1–5 before controls. */
  likelihood: number;
  severity: number;
  controls?: string;
  /** 1–5 with the controls in place. */
  residualLikelihood?: number;
  residualSeverity?: number;
}

export interface RiskAssessment {
  id: string;
  /** RA-2026-014 */
  no?: string;
  title: string;
  /** The task assessed, in a sentence. */
  task?: string;
  location?: string;
  hazards: Hazard[];
  /** Kept in the vessel's library, to be copied for a job. */
  generic: boolean;
  /** The library assessment this one was copied from. */
  fromId?: string;
  team?: string[];
  approved?: SignStamp;
  reviewDue?: string;
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  draft: 'Draft',
  requested: 'Requested',
  approved: 'Approved',
  active: 'In progress',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
