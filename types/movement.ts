import type { CategoryKey } from './equipment';
import type { SignProof } from '../services/signature';

// Direction of a physical movement.
export type MovementDir = 'ashore' | 'return' | 'condemned' | 'transfer';

export const MOVEMENT_DIR_LABEL: Record<MovementDir, string> = {
  ashore: 'Sent ashore',
  return: 'Returned aboard',
  condemned: 'Condemned',
  transfer: 'Transferred',
};

// One movement record for a single equipment item.
// Append-only: never edited after creation.
export interface ItemMovement {
  id: string;
  itemId: string;
  itemCategory: CategoryKey;
  /** Snapshot of item identification so the log reads after an edit. */
  itemSnap: string;
  dir: MovementDir;
  /** Which landing report this movement belongs to (ashore/return). */
  landingId?: string;
  /** ISO date of the movement. */
  date: string;
  /** Service station, port agent, or vessel name for a transfer. */
  to?: string;
  /** Reason: "Annual service", "Hydrostatic test", "Repair". */
  reason?: string;
  /** Service certificate reference number returned from the service station. */
  serviceRef?: string;
  by?: string;
  byRank?: string;
  notes?: string;
  updatedAt: number;
  deleted?: boolean;
}

// A landing report groups items sent ashore or returned in one batch.
export interface LandingReport {
  id: string;
  /** Sequential: LR-2026-01 */
  no: string;
  /** ISO date of the physical handover. */
  date: string;
  /** Port / anchorage where the transfer takes place. */
  port?: string;
  /** Service station or receiver name. */
  to?: string;
  /** 'out' = items leaving the vessel; 'in' = items returning aboard. */
  dir: 'out' | 'in';
  /** IDs of ItemMovements included in this report. */
  movementIds: string[];
  notes?: string;
  by?: string;
  byRank?: string;
  signedWith?: SignProof;
  updatedAt: number;
  deleted?: boolean;
}

export function nextLandingNo(existing: LandingReport[]): string {
  const year = new Date().getFullYear();
  const used = existing
    .filter((r) => !r.deleted && r.no?.startsWith(`LR-${year}-`))
    .map((r) => parseInt(r.no.split('-')[2] ?? '0', 10))
    .filter((n) => !isNaN(n));
  const seq = used.length > 0 ? Math.max(...used) + 1 : 1;
  return `LR-${year}-${String(seq).padStart(2, '0')}`;
}
