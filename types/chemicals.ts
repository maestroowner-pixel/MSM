// ===================================
// Chemicals aboard and their safety data sheets (plan item 65, 7 Nov 2026 —
// UniSea sells it as "Safe Chemistry"; on a yacht the chemicals are everywhere:
// the interior's cleaning, the pool and spa, the tenders, paint, the engine room,
// the laundry, the galley, and nowhere in the app until now).
//
//   Chemical   one product: what it is, where it is kept and how much, its SDS
//              file, and what the SDS says matters at the moment of use —
//              signal word, GHS pictograms, hazard statements, PPE, first aid,
//              fire, spill, storage. Read off the SDS by hand or by the AI;
//              an officer signs the card as checked against the sheet.
//
// One document per product, edited as a whole, newest wins; never deleted —
// `deleted` (taken off the vessel) keeps it in the history. Officers and the
// Master write, everyone aboard reads: the card is for whoever uses the product.
// A risk assessment made from the card is an ordinary one (types/permits.ts,
// `chemId`); a permit names the chemicals its work uses (`Permit.chemIds`).
// ===================================

import type { SignStamp } from './permits';

export type ChemUse = 'cleaning' | 'pool' | 'paint' | 'engine' | 'deck' | 'tender' | 'galley' | 'laundry' | 'water' | 'gas' | 'other';
export const CHEM_USES: ChemUse[] = ['cleaning', 'pool', 'paint', 'engine', 'deck', 'tender', 'galley', 'laundry', 'water', 'gas', 'other'];
export const CHEM_USE_EN: Record<ChemUse, string> = {
  cleaning: 'Cleaning', pool: 'Pool and spa', paint: 'Paint and solvents', engine: 'Engine room', deck: 'Deck', tender: 'Tenders and toys',
  galley: 'Galley', laundry: 'Laundry', water: 'Water treatment', gas: 'Gases', other: 'Other',
};

/** The nine GHS pictograms. */
export type Ghs = 'GHS01' | 'GHS02' | 'GHS03' | 'GHS04' | 'GHS05' | 'GHS06' | 'GHS07' | 'GHS08' | 'GHS09';
export const GHS: Ghs[] = ['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09'];
export const GHS_EN: Record<Ghs, string> = {
  GHS01: 'Explosive', GHS02: 'Flammable', GHS03: 'Oxidising', GHS04: 'Gas under pressure', GHS05: 'Corrosive',
  GHS06: 'Toxic', GHS07: 'Harmful / irritant', GHS08: 'Health hazard', GHS09: 'Environment',
};

export interface ChemStock {
  place: string;
  qty?: number;
  /** L, kg, cans… free text. */
  unit?: string;
}

export interface FirstAid {
  eyes?: string;
  skin?: string;
  inhaled?: string;
  swallowed?: string;
}

export interface Chemical {
  id: string;
  name: string;
  maker?: string;
  use: ChemUse;
  /** Where it is kept and how much. */
  stock: ChemStock[];
  /** The safety data sheet: a link (Cloud Storage), or the file itself on a device on its own. */
  sds?: { url: string; name: string; addedAt: number; by?: string };
  /** Revision / issue date printed on the SDS, yyyy-mm-dd. */
  sdsDate?: string;
  /** Language the SDS is written in, in English ("Spanish"). */
  sdsLang?: string;
  signal?: 'danger' | 'warning';
  ghs?: Ghs[];
  /** Hazard statements, a line each: "H225 Highly flammable liquid and vapour". */
  hazards?: string[];
  ppe?: string;
  firstAid?: FirstAid;
  fire?: string;
  spill?: string;
  storage?: string;
  /** Keep away from — the SDS's incompatible materials. */
  incompatible?: string;
  /** UN number, when transported as dangerous goods. */
  un?: string;
  /** An officer read the card against the SDS. Cleared when what the SDS gave changes. */
  checked?: SignStamp;
  /** The card was filled by the AI and not yet checked. */
  byAi?: boolean;
  notes?: string;
  /** Taken off the vessel. */
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}
