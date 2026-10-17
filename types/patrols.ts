// ===================================
// Security rounds (Jez, 17 Oct 2026: "daily deck / security rounds — QR codes at
// specific locations; morning opening, daytime, evening closing; who, when,
// which locations; a daily / monthly report").
//
//   Checkpoint   a place aboard with a QR label (msm://checkpoint/<id>) — the
//                watch scans it to show they were there.
//   PatrolPlan   one kind of round: when it is due (times of day), which
//                checkpoints, and the duties shown at its top.
//   Patrol       one round done: who, when, each checkpoint scanned with its time,
//                the ones missed. Written once, at the end, and never changed.
// ===================================

export interface Checkpoint {
  id: string;
  /** Printed on the label and typed to find it — CP-01. */
  code: string;
  name: string;
  location?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

export type PatrolKind = 'opening' | 'daytime' | 'closing';

export interface PatrolPlan {
  id: string;
  name: string;
  kind: PatrolKind;
  /** Due at these ship's-time times of day ("07:00"). */
  times: string[];
  checkpointIds: string[];
  /** The duties and reminders shown at the top of the round, and printed. */
  duties: string[];
  off?: boolean;
  updatedAt: number;
}

export interface PatrolVisit {
  checkpointId: string;
  code: string;
  name: string;
  at: number;
  /** Scanned with the camera, or the ID typed (the label unreadable). */
  how: 'scan' | 'typed';
}

export interface Patrol {
  id: string;
  planId: string;
  planName: string;
  kind: PatrolKind;
  /** The due time it was done for ("07:00"), if it was a scheduled one. */
  slot?: string;
  /** Ship's date of the slot (yyyy-mm-dd). */
  date: string;
  startedAt: number;
  finishedAt: number;
  duties: string[];
  dutiesDone: boolean;
  visits: PatrolVisit[];
  missed: { checkpointId: string; code: string; name: string }[];
  remarks?: string;
  by: string;
  byRank?: string;
  byKey?: string;
  /** How it was signed — PIN, by hand (with the drawing) or fingerprint (services/signature.ts). */
  byWith?: import('../services/signature').SignProof;
  updatedAt: number;
}

export const KIND_LABEL: Record<PatrolKind, string> = { opening: 'Morning opening round', daytime: 'Daytime round', closing: 'Evening closing round' };
