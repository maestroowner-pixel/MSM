// ===================================
// The Master's orders (14 Nov 2026 — "night watch orders, master standing
// orders, dp standing orders"): the bridge's order book, kept the way a ship
// keeps it on paper.
//
//   NightOrder     the Master's orders for one night — what to do, where the
//                  ship is going, when to call the Master. Each officer keeping
//                  a watch that night signs that they have read them; in the
//                  morning the Master closes the night. Written once: until the
//                  first signature the Master may still put it right, after
//                  that only close it, or cancel it with a reason and write the
//                  night again.
//   StandingOrder  one revision of the Master's Standing Orders, or of the DP
//                  Standing Orders (with the DP module). Never changed — a new
//                  text is a new revision, and every officer signs it again.
//   OrderAck       "I have read them" — one person, one night or revision.
//                  Append-only, a document of its own, so two officers signing
//                  on two phones never overwrite each other.
//
// Officers and the Master only (synced to officers' devices; the office reads).
// ===================================

export type OrderKind = 'night' | 'master' | 'dp';
export type StandingKind = 'master' | 'dp';
export const STANDING_KINDS: StandingKind[] = ['master', 'dp'];

export interface OrderStamp {
  by: string;
  byRank?: string;
  at: number;
  note?: string;
}

/** Someone expected to sign: a crew id, or a name when the device keeps no crew list. */
export interface OrderReader {
  key: string;
  name: string;
  rank?: string;
}

export interface NightOrder {
  id: string;
  /** The night it is for — the evening's date, yyyy-mm-dd. */
  date: string;
  /** The orders themselves. */
  text: string;
  /** "Call me if…" — when the officer of the watch calls the Master. */
  callMe?: string;
  /** Where the ship is and where she goes tonight: at anchor off…, passage to… */
  where?: string;
  /** Who keeps a watch tonight — they are asked to sign. */
  watch: OrderReader[];
  by: string;
  byRank?: string;
  /** The Master closed the night in the morning. */
  closed?: OrderStamp;
  /** Written in error — stays in the book, struck, with why. */
  cancelled?: OrderStamp;
  createdAt: number;
  updatedAt: number;
}

/** Who signs a standing order: the bridge (deck officers and DPOs), or every officer, engineers too. */
export type OrderReaders = 'bridge' | 'officers';

export interface StandingOrder {
  /** `so_<kind>_r<rev>` — two Masters cannot issue the same revision twice. */
  id: string;
  kind: StandingKind;
  rev: number;
  /** In force from, yyyy-mm-dd. */
  issued: string;
  text: string;
  /** What changed from the revision before. */
  changeNote?: string;
  readers: OrderReaders;
  by: string;
  byRank?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrderAck {
  /** `<orderId>_<personKey>` — one signature per person per night or revision. */
  id: string;
  orderId: string;
  kind: OrderKind;
  /** Standing orders: the revision signed. */
  rev?: number;
  /** Crew id, or `device:<id>` when signed as a device's account. */
  personKey: string;
  by: string;
  byRank?: string;
  at: number;
  updatedAt: number;
}

export const standingId = (kind: StandingKind, rev: number) => `so_${kind}_r${rev}`;
export const orderAckId = (orderId: string, personKey: string) => `${orderId}_${personKey}`.replace(/[^A-Za-z0-9_.:-]/g, '_');
