// ===================================
// Spare parts — what is in the stores, and every movement in and out.
//
//   SparePart   one stocked line: "Raw-water impeller, Jabsco 1210-0001, 3 on
//               hand, keep at least 2, engine-room store shelf B".
//   SpareMove   one movement of stock: received, used, counted, adjusted.
//               Append-only, like a signed inspection.
//
// WHY THE QUANTITY IS NOT A FIELD. Stock is the SUM of its movements, never a
// number stored on the part. A stored number synced "newest wins" loses a
// movement whenever two devices touch the same part between syncs: the engineer
// takes an impeller in the engine room while the purser books a delivery on the
// bridge, and one of the two simply vanishes. Movements are separate records,
// so both arrive and both count. A stocktake is a movement too — the difference
// between what was counted and what the book said — so a count taken offline
// does not wipe out a delivery booked meanwhile.
//
// Parts are tombstoned (`deleted: true`), not deleted, for the same reason as
// machines: a record deleted outright comes back from a device that still has it.
// ===================================

export interface SparePart {
  id: string;
  name: string;
  /** Maker's part number — what is ordered by. */
  partNo?: string;
  maker?: string;
  /** Store, shelf, box: "ER store · B3". */
  location?: string;
  /** pcs, l, m, kg, set… Defaults to pcs. */
  unit?: string;
  /** Re-order level: at or below it the part is "low". */
  minQty?: number;
  /** Machines it fits (types/pms Machine ids). */
  machineIds?: string[];
  notes?: string;
  deleted?: boolean;
  updatedAt: number;
}

export type MoveKind = 'received' | 'used' | 'count' | 'adjust';

export interface SpareMove {
  id: string;
  partId: string;
  /** Snapshot, so the history reads after a rename or removal. */
  partName: string;
  kind: MoveKind;
  /** Signed change in stock: +5 received, −1 used, ±n from a count. */
  delta: number;
  /** For a count: what was physically counted. */
  counted?: number;
  /** The planned-maintenance completion that used it, if any. */
  doneId?: string;
  jobTitle?: string;
  machineName?: string;
  /** yyyy-mm-dd */
  date: string;
  by: string;
  byRank?: string;
  note?: string;
  /** Epoch ms when recorded. */
  at: number;
  /** How the signer confirmed — finger, face or signing PIN (services/signature.ts). Absent when not asked. */
  signedWith?: import('../services/signature').SignProof;
  updatedAt: number;
}

/** A part a planned-maintenance job uses each time it is done. */
export interface JobPart {
  partId: string;
  qty: number;
}
