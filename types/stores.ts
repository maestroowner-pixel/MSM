// ===================================
// Stores (14 Oct 2026: "the PPE store, the provision store") — two storerooms
// kept the same way: items with a minimum to keep, stock moved in and out and
// counted, batch by batch.
//
//   PPE store     coveralls, boots, gloves, glasses… in sizes; issued to a crew
//                 member, who signs for it (ISM: PPE issued and its use
//                 recorded). Each person's card lists what they hold.
//   Provisions    dry store, chilled, frozen, beverages — with best-before
//                 dates; issued to the galley, out-of-date thrown away and
//                 recorded, counted.
//
// Stock is worked out batch by batch exactly as the medicine chest's
// (services/hospital stockByItem): a batch is its expiry (and lot), moves are
// append-only.
// ===================================

import type { SignProof } from '../services/signature';

export type StoreKind = 'ppe' | 'provisions';
export const STORE_LABEL: Record<StoreKind, string> = { ppe: 'PPE store', provisions: 'Provisions' };

export interface StoreItem {
  id: string;
  store: StoreKind;
  name: string;
  /** PPE: Hands, Feet, Body…; provisions: Dry store, Chilled, Frozen, Beverages. */
  category?: string;
  /** PPE size — S, M, L, 42, 10 — one item per size. */
  size?: string;
  unit: string;
  /** Keep at least this many; below it the item goes on the list to order. */
  min: number;
  location?: string;
  notes?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

export type StoreMoveKind = 'received' | 'issued' | 'returned' | 'disposed' | 'count';

export interface StoreMove {
  id: string;
  itemId: string;
  kind: StoreMoveKind;
  /** Units moved; for a count, the quantity counted in that batch. */
  qty: number;
  batchNo?: string;
  /** yyyy-mm-dd — best before (provisions), or the PPE's own expiry (harness, helmet). */
  expiry?: string;
  date: string;
  /** PPE issued to (or returned by) this crew member — name and crew id. */
  to?: string;
  toId?: string;
  /** The crew member's signature for what they received. */
  toWith?: SignProof;
  note?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export const PPE_CATEGORIES = ['Body', 'Feet', 'Hands', 'Eyes & face', 'Head', 'Hearing', 'Breathing', 'Fall protection', 'Water'];
export const PROVISION_CATEGORIES = ['Dry store', 'Chilled', 'Frozen', 'Beverages', 'Bakery', 'Fresh fruit & veg', 'Cleaning & galley'];

/** A typical yacht PPE store — a starting list the vessel edits. Sized items are one line per size. */
export const PPE_STARTER: { name: string; category: string; sizes?: string[]; unit: string; min: number }[] = [
  { name: 'Coveralls', category: 'Body', sizes: ['S', 'M', 'L', 'XL', 'XXL'], unit: 'pcs', min: 2 },
  { name: 'Safety boots', category: 'Feet', sizes: ['39', '40', '41', '42', '43', '44', '45'], unit: 'pairs', min: 1 },
  { name: 'Work gloves', category: 'Hands', sizes: ['M', 'L', 'XL'], unit: 'pairs', min: 10 },
  { name: 'Chemical-resistant gloves', category: 'Hands', sizes: ['M', 'L', 'XL'], unit: 'pairs', min: 4 },
  { name: 'Cut-resistant gloves', category: 'Hands', sizes: ['M', 'L'], unit: 'pairs', min: 2 },
  { name: 'Welding gloves', category: 'Hands', unit: 'pairs', min: 2 },
  { name: 'Safety glasses', category: 'Eyes & face', unit: 'pcs', min: 6 },
  { name: 'Goggles', category: 'Eyes & face', unit: 'pcs', min: 2 },
  { name: 'Face shield', category: 'Eyes & face', unit: 'pcs', min: 2 },
  { name: 'Hard hat', category: 'Head', unit: 'pcs', min: 4 },
  { name: 'Ear defenders', category: 'Hearing', unit: 'pcs', min: 4 },
  { name: 'Ear plugs', category: 'Hearing', unit: 'pairs', min: 100 },
  { name: 'Dust mask FFP2', category: 'Breathing', unit: 'pcs', min: 20 },
  { name: 'Half-mask respirator with filters', category: 'Breathing', unit: 'pcs', min: 2 },
  { name: 'Safety harness', category: 'Fall protection', unit: 'pcs', min: 2 },
  { name: 'Lanyard with shock absorber', category: 'Fall protection', unit: 'pcs', min: 2 },
  { name: 'Work vest / buoyancy aid (working over the side)', category: 'Water', unit: 'pcs', min: 2 },
  { name: 'High-visibility vest', category: 'Body', unit: 'pcs', min: 4 },
];

/** "Coveralls · L" */
export const storeItemTitle = (i: Pick<StoreItem, 'name' | 'size'>) => (i.size ? `${i.name} · ${i.size}` : i.name);
