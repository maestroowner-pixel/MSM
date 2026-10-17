// ===================================
// Key register (Jez, 17 Oct 2026: "keys with ID and description; signed out to a
// crew member, who has it, when issued and returned; what is out now; a report;
// QR on the key tags").
//
//   KeyItem   a key (or a set) on the board: ID (K-01), what it opens, where it
//             hangs, how many copies. Its tag's QR is msm://key/<id>.
//   KeyMove   one issue or return — written once, never changed. Where a key is
//             now is its last move.
// ===================================

export interface KeyItem {
  id: string;
  code: string;
  name: string;
  /** Where it is kept — key cabinet, hook 12. */
  location?: string;
  deleted?: boolean;
  updatedAt: number;
}

export interface KeyMove {
  id: string;
  keyId: string;
  code: string;
  name: string;
  dir: 'out' | 'in';
  /** Who holds it (out) / who brought it back (in). */
  person: string;
  personRank?: string;
  personKey?: string;
  /** How the person signed for it — the drawing kept when by hand (services/signature.ts). */
  personWith?: import('../services/signature').SignProof;
  /** Who recorded it — the officer or the watch at the key cabinet. */
  by: string;
  at: number;
  note?: string;
  /** Expected back by (out only). */
  dueBack?: string;
  updatedAt: number;
}
