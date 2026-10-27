// ===================================
// Yard periods, projects and warranty (27 Oct 2026; a row of the competitor
// matrix four of them had). Built on the PMS project (types/pms.ts PmsProject),
// which already collects the PMS jobs deferred to a yard period — this adds the
// rest of a refit:
//
//   YardJob         one line of the work list (the specification sent to the
//                   yards): what is to be done, on which machine, for which
//                   defect, by whom, the quoted and the final price. It goes
//                   planned → in progress → done → accepted; the acceptance is
//                   an officer's signature, after which only the final price
//                   and the invoice may change (the rules say the same).
//                   Cancelled instead of deleted.
//   WarrantyClaim   a fault under warranty, against the yard or the maker:
//                   found → submitted → answered → closed (signed). Never
//                   deleted. The warranty itself is the accepted job's
//                   `warrantyMonths`, or the claim's own `coverUntil` for a
//                   machine bought new.
// ===================================

import { Attachment } from './equipment';
import type { SignProof } from '../services/signature';

export type ProjectKind = 'yard' | 'drydock' | 'refit' | 'afloat';
export const PROJECT_KINDS: ProjectKind[] = ['yard', 'drydock', 'refit', 'afloat'];
/** Reports stay English; screens use t('yd.kind.<key>'). */
export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  yard: 'Yard period',
  drydock: 'Dry dock',
  refit: 'Refit',
  afloat: 'Work afloat',
};

export type YardDept = 'hull' | 'deck' | 'engine' | 'electrical' | 'interior' | 'safety' | 'other';
export const YARD_DEPTS: YardDept[] = ['hull', 'deck', 'engine', 'electrical', 'interior', 'safety', 'other'];
export const YARD_DEPT_LABEL: Record<YardDept, string> = {
  hull: 'Hull & paint',
  deck: 'Deck',
  engine: 'Engine',
  electrical: 'Electrical & AV/IT',
  interior: 'Interior',
  safety: 'Safety & LSA',
  other: 'Other',
};

/** Who does the work. */
export type YardBy = 'yard' | 'contractor' | 'maker' | 'crew';
export const YARD_BYS: YardBy[] = ['yard', 'contractor', 'maker', 'crew'];
export const YARD_BY_LABEL: Record<YardBy, string> = {
  yard: 'Yard',
  contractor: 'Contractor',
  maker: "Maker's service",
  crew: 'Crew',
};

export type YardStage = 'planned' | 'progress' | 'done' | 'accepted' | 'cancelled';
export const YARD_STAGES: YardStage[] = ['planned', 'progress', 'done', 'accepted', 'cancelled'];
export const YARD_STAGE_LABEL: Record<YardStage, string> = {
  planned: 'Planned',
  progress: 'In progress',
  done: 'Done',
  accepted: 'Accepted',
  cancelled: 'Cancelled',
};

export interface YardAcceptance {
  date: string;
  note: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  /** Photos of the finished work — queued under `<job id>-accepted`. */
  photos?: Attachment[];
  /** The job's defect was closed by this same signature. */
  defectClosed?: boolean;
}

export interface YardJob {
  id: string;
  projectId: string;
  /** Item number on the work list — 1, 2, 3… within the project, never re-used. */
  no: number;
  title: string;
  /** What exactly is to be done — the specification text the yard prices. */
  spec?: string;
  dept: YardDept;
  machineId?: string;
  /** Snapshot, so the list reads the same after the machine is renamed. */
  machineName?: string;
  /** The PMS defect (types/pms.ts PmsDefect) this job puts right. */
  defectId?: string;
  /** The PMS job deferred to this yard period that this line carries to the yard. */
  pmsJobId?: string;
  /** Class or flag must see it. */
  classItem?: boolean;
  by: YardBy;
  /** The contractor's or maker's name when not the yard. */
  contractor?: string;
  /** Prices in the project's currency. */
  quoted?: number;
  final?: number;
  /** The invoice number — may still be added after acceptance. */
  invoice?: string;
  /** Warranty from the acceptance date, in months. */
  warrantyMonths?: number;
  /** Before / during the work — queued under the job id. */
  photos?: Attachment[];
  notes?: string;
  startedOn?: string;
  doneOn?: string;
  cancelled?: { date: string; reason: string; by: string };
  accepted?: YardAcceptance;
  createdBy: string;
  at: number;
  updatedAt: number;
}

export type ClaimStage = 'draft' | 'submitted' | 'answered' | 'closed';
export type ClaimOutcome = 'accepted' | 'partial' | 'rejected';
export const CLAIM_OUTCOMES: ClaimOutcome[] = ['accepted', 'partial', 'rejected'];
export const CLAIM_OUTCOME_LABEL: Record<ClaimOutcome, string> = {
  accepted: 'Accepted',
  partial: 'Partly accepted',
  rejected: 'Rejected',
};
/** How it ended. */
export type ClaimSettlement = 'repaired' | 'replaced' | 'credited' | 'refused' | 'withdrawn';
export const CLAIM_SETTLEMENTS: ClaimSettlement[] = ['repaired', 'replaced', 'credited', 'refused', 'withdrawn'];
export const CLAIM_SETTLEMENT_LABEL: Record<ClaimSettlement, string> = {
  repaired: 'Repaired under warranty',
  replaced: 'Replaced under warranty',
  credited: 'Credited / refunded',
  refused: 'Refused — repaired at our cost',
  withdrawn: 'Withdrawn',
};

export interface WarrantyClaim {
  id: string;
  /** "WC-2026-003" — per year, never re-used. */
  no: string;
  title: string;
  machineId?: string;
  machineName?: string;
  /** The accepted yard job whose warranty this falls under. */
  yardJobId?: string;
  projectId?: string;
  /** Who the claim is against — the yard, the contractor, the maker. */
  against: string;
  /** Warranty period when it is not a yard job's (new equipment): yyyy-mm-dd. */
  coverFrom?: string;
  coverUntil?: string;
  /** yyyy-mm-dd — when the fault was found. */
  found: string;
  description: string;
  photos?: Attachment[];
  /** A PMS defect on the same fault. */
  defectId?: string;
  submitted?: { date: string; to?: string; by: string };
  answer?: { date: string; outcome: ClaimOutcome; note: string; theirRef?: string };
  closed?: { date: string; how: ClaimSettlement; note: string; cost?: number; by: string; byRank?: string; at: number; signedWith?: SignProof };
  createdBy: string;
  at: number;
  updatedAt: number;
}
