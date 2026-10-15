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
//   General       any other storeroom the vessel adds — bosun's store, engine
//                 store, cleaning locker: items, minimums, issued and counted.
//
// The storerooms themselves (15 Oct 2026, as InventoryLens keeps its lockers):
// the two above are always there; the vessel adds its own from the gear on the
// Stores menu entry — each named, placed, given a short ID printed on its QR
// label (msm://store/<id> — the id only, so a renamed or moved store keeps its
// label), and filled from an Excel list.
//
// Stock is worked out batch by batch exactly as the medicine chest's
// (services/hospital stockByItem): a batch is its expiry (and lot), moves are
// append-only.
// ===================================

import type { SignProof } from '../services/signature';

export type StoreKind = 'ppe' | 'provisions' | 'general';
export const STORE_LABEL: Record<StoreKind, string> = { ppe: 'PPE store', provisions: 'Provisions', general: 'General stores' };
export const STORE_KIND_SUB: Record<StoreKind, string> = {
  ppe: 'Issued to a crew member, who signs for it',
  provisions: 'Best-before dates; issued to the galley',
  general: "Bosun's, engine, cleaning — issued and counted",
};

/** A storeroom (see the head of this file). */
export interface StoreRoom {
  id: string;
  /** The short ID on its label and typed to open it — PPE, PROV, ST-03. */
  code: string;
  name: string;
  kind: StoreKind;
  location?: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

/** The two stores every vessel has — their ids are their kinds, so items saved before rooms existed belong to them. */
export const BUILTIN_ROOMS: StoreRoom[] = [
  { id: 'ppe', code: 'PPE', name: 'PPE store', kind: 'ppe', order: 0, updatedAt: 0 },
  { id: 'provisions', code: 'PROV', name: 'Provisions', kind: 'provisions', order: 1, updatedAt: 0 },
];
export const isBuiltinRoom = (id: string) => BUILTIN_ROOMS.some((r) => r.id === id);

/** The vessel's stores in order: the two built-in ones (as renamed or placed), then its own. */
export function storeRooms(list: StoreRoom[]): StoreRoom[] {
  const builtin = BUILTIN_ROOMS.map((b) => ({ ...b, ...(list.find((x) => x.id === b.id) ?? {}), kind: b.kind, deleted: undefined }));
  const own = list.filter((x) => !x.deleted && !isBuiltinRoom(x.id));
  return [...builtin, ...own].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** The store an item is in: its room, or the built-in one of its kind. */
export const roomOf = (i: Pick<StoreItem, 'roomId' | 'store'>) => i.roomId || i.store;

/** Letters, digits, - and _ — what a label printer and a typed search both keep intact (InventoryLens LOCKER_ID_RE). */
export const STORE_CODE_RE = /^[A-Za-z0-9_-]{1,16}$/;

/** The next free ID — ST-03 after ST-01 and ST-02. */
export function nextRoomCode(rooms: Pick<StoreRoom, 'code'>[]): string {
  const taken = new Set(rooms.map((r) => r.code.toUpperCase()));
  for (let n = 1; ; n++) {
    const c = `ST-${String(n).padStart(2, '0')}`;
    if (!taken.has(c)) return c;
  }
}

/** A typed ID to its store — case does not matter. */
export const roomByCode = (rooms: StoreRoom[], code: string) => rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());

export interface StoreItem {
  id: string;
  /** How the item is kept — its store's kind. */
  store: StoreKind;
  /** Which store (StoreRoom id); absent = the built-in store of its kind. */
  roomId?: string;
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
export const GENERAL_CATEGORIES = ['Deck', 'Ropes & rigging', 'Paint', 'Engine', 'Electrical', 'Tools', 'Cleaning', 'Chemicals', 'Other'];
export const STORE_CATEGORIES: Record<StoreKind, string[]> = { ppe: PPE_CATEGORIES, provisions: PROVISION_CATEGORIES, general: GENERAL_CATEGORIES };

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
