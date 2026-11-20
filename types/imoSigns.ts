// ===================================
// IMO signs (20 Nov 2026) — which signs are posted where, the round that looks
// at them, and what goes to the order. The catalogue: services/imoSignCatalogue.
//
//   From the register  every LSA/FFE item whose category carries a sign — an
//                 extinguisher, a lifebuoy, a liferaft, an EEBD — needs that
//                 sign at its deck and position. Worked out, never stored, so a
//                 moved extinguisher takes its sign along (services/imoSigns).
//   SignPlace     what the register cannot know: escape route arrows, muster
//                 stations, the release station, no smoking — added by the
//                 vessel; and `hides` takes a worked-out place off the list
//                 (a sign the vessel does not post there).
//   SignCheck     one signed round: each place looked at — fine, faded or
//                 missing. Written once, never changed; the latest look at a
//                 place is its state.
// ===================================

import type { SignProof } from '../services/signature';

export type SignState = 'ok' | 'poor' | 'missing';
export const SIGN_STATES: SignState[] = ['ok', 'poor', 'missing'];

export interface SignPlace {
  id: string;
  /** The catalogue id (services/imoSignCatalogue). Absent on a `hides` row. */
  sign?: string;
  deck?: string;
  position?: string;
  /** How many of this sign at this place — escape arrows along a corridor. */
  qty?: number;
  /** A worked-out place's key (services/imoSigns placeKey) that the vessel takes off the list. */
  hides?: string;
  removed?: boolean;
  updatedAt: number;
}

export interface SignLook {
  /** services/imoSigns placeKey — the same place on every phone. */
  key: string;
  sign: string;
  deck?: string;
  position?: string;
  qty: number;
  state: SignState;
  /** Faded or missing: how many of the place's signs. */
  bad?: number;
  note?: string;
}

export interface SignCheck {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  by: string;
  byRank?: string;
  signedWith?: SignProof;
  /** Only the places looked at — a round may cover one deck. */
  looks: SignLook[];
  /** After a replacement: the places fitted from stock, not a round. */
  fitted?: boolean;
  at: number;
  updatedAt: number;
}
