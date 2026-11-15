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
//   Flag locker   signal flags (letters, numeral pennants, substitutes), courtesy
//                 flags of the countries visited, the company's house flag — each
//                 counted by its wear: new, good, poor (15 Nov 2026). Poor is not
//                 serviceable: it does not count towards the minimum.
//   Charts & publications  the bridge's paper IMO publications, nautical
//                 publications, charts and stationery — by edition and by wear,
//                 like the flags (15 Nov 2026).
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

export type StoreKind = 'ppe' | 'provisions' | 'general' | 'flags' | 'bridge';
export const STORE_LABEL: Record<StoreKind, string> = { ppe: 'PPE store', provisions: 'Provisions', general: 'General stores', flags: 'Flag locker', bridge: 'Charts & publications' };
export const STORE_KIND_SUB: Record<StoreKind, string> = {
  ppe: 'Issued to a crew member, who signs for it',
  provisions: 'Best-before dates; issued to the galley',
  general: "Bosun's, engine, cleaning — issued and counted",
  flags: 'Signal, courtesy and company flags — counted new, good or poor',
  bridge: 'IMO publications, charts, stationery — by edition and wear',
};

/**
 * Wear, counted per piece: what is on hand is split by it as by a batch (a batch
 * is its expiry, lot and wear). **Ids permanent** — they are on every move.
 * Poor = not serviceable: kept apart, not counted towards the minimum, to replace.
 */
export type Wear = 'new' | 'good' | 'poor';
export const WEARS: Wear[] = ['new', 'good', 'poor'];
export const WEAR_LABEL: Record<Wear, string> = { new: 'New', good: 'Good', poor: 'Poor' };
/** The stores counted by wear. */
export const wearKept = (kind: StoreKind) => kind === 'flags' || kind === 'bridge';
/** "poor", "Poor", "P", "worn" → the wear; anything else → undefined. */
export function toWear(v: unknown): Wear | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'n' || s.startsWith('new')) return 'new';
  if (s === 'g' || s.startsWith('good') || s === 'ok' || s === 'fair') return 'good';
  if (s === 'p' || s.startsWith('poor') || s.startsWith('worn') || s.startsWith('bad') || s.startsWith('unserv')) return 'poor';
  return undefined;
}

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
  /** Flag locker: the wear of what moved — part of the batch. */
  wear?: Wear;
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
export const GENERAL_CATEGORIES = ['Deck', 'Ropes & rigging', 'Paint', 'Engine', 'Electrical', 'Tools', 'Cleaning', 'Chemicals', 'Stationery', 'Other'];
export const FLAG_CATEGORIES = ['Letters', 'Numerals', 'Special', 'Countries', 'Company'];
export const BRIDGE_CATEGORIES = ['IMO publications', 'Nautical publications', 'Charts', 'Stationery'];
export const STORE_CATEGORIES: Record<StoreKind, string[]> = { ppe: PPE_CATEGORIES, provisions: PROVISION_CATEGORIES, general: GENERAL_CATEGORIES, flags: FLAG_CATEGORIES, bridge: BRIDGE_CATEGORIES };

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

/**
 * A flag locker as the International Code of Signals has it: 26 letter flags, 10
 * numeral pennants, three substitutes and the answering pennant, plus the house
 * flag. Courtesy flags are the vessel's own to add, country by country.
 */
const PHONETIC = 'Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu'.split(' ');
export const FLAGS_STARTER: { name: string; category: string; unit: string; min: number }[] = [
  ...PHONETIC.map((w) => ({ name: `${w[0]} — ${w}`, category: 'Letters', unit: 'pcs', min: 1 })),
  ...'1234567890'.split('').map((d) => ({ name: `Numeral pennant ${d}`, category: 'Numerals', unit: 'pcs', min: 1 })),
  ...['First', 'Second', 'Third'].map((n) => ({ name: `${n} substitute`, category: 'Special', unit: 'pcs', min: 1 })),
  { name: 'Answering pennant (code)', category: 'Special', unit: 'pcs', min: 1 },
  { name: 'House flag', category: 'Company', unit: 'pcs', min: 1 },
];

/**
 * The paper IMO publications most bridges keep, and the chart table's stationery.
 * The edition goes in the item's size field ("2020 ed."); charts are the vessel's
 * own folio, added by number.
 */
export const BRIDGE_STARTER: { name: string; category: string; unit: string; min: number }[] = [
  ...[
    'SOLAS, Consolidated Edition', 'MARPOL, Consolidated Edition', 'COLREG', 'STCW Convention and Code', 'Load Lines, Consolidated Edition',
    'ISM Code', 'ISPS Code', 'LSA Code', 'FSS Code', 'FTP Code', 'International Code of Signals', 'IAMSAR Manual, Volume III',
    'Standard Marine Communication Phrases', "Ships' Routeing",
  ].map((name) => ({ name, category: 'IMO publications', unit: 'copy', min: 1 })),
  { name: 'Chart pencils 2B', category: 'Stationery', unit: 'pcs', min: 12 },
  { name: 'Erasers', category: 'Stationery', unit: 'pcs', min: 6 },
  { name: 'Ballpoint pens', category: 'Stationery', unit: 'pcs', min: 20 },
  { name: 'Highlighters', category: 'Stationery', unit: 'pcs', min: 6 },
  { name: 'Printer paper A4', category: 'Stationery', unit: 'reams', min: 5 },
  { name: 'Printer toner / ink', category: 'Stationery', unit: 'pcs', min: 2 },
  { name: 'Notebooks', category: 'Stationery', unit: 'pcs', min: 6 },
];

/** "Coveralls · L" */
export const storeItemTitle = (i: Pick<StoreItem, 'name' | 'size'>) => (i.size ? `${i.name} · ${i.size}` : i.name);
