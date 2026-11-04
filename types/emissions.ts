// ===================================
// Emissions (plan item 44, 4 Nov 2026): the figures IMO DCS (MARPOL Annex VI
// reg. 27), CII (reg. 28) and EU MRV (Regulation 2015/757) ask of a vessel,
// out of the fuel she already records. The app keeps the vessel's record for
// the verifier; the company submits it. It does not file anything.
//
//   EmVessel     — type, GT, DWT, commercial or not: what decides which rule applies.
//   EmPassage    — berth to berth, in UTC: four times, ROB at both ends, distance.
//                  Hours under way are FAOP to EOSP (MEPC.395(82)). A passage over
//                  the new year carries the ROB and distance at 31 Dec 24:00 UTC:
//                  each year reports its own part (the Commission's MRV FAQ).
//   EmStatement  — the year signed: fuel per consumer, under way or not (Appendix
//                  IX as amended by MEPC.385(81)) — a tank sounding cannot split
//                  that, so it is typed from the method in the SEEMP — and the
//                  figures frozen as they stood when signed. Written once; a
//                  correction is a new statement and the newest counts.
//
// Distance is typed on the passage, not added up from the deck log: a noon entry's
// `distanceRun` may be the total since departure, and watches would then count twice.
// Diesel only, as the fuel module is (types/fuel.ts); a ship burning HFO is not covered.
// ===================================

import type { SignProof } from '../services/signature';
import type { Versioned } from '../services/versions';

export type EmShipType =
  | 'yacht' | 'offshore' | 'bulk' | 'gas' | 'tanker' | 'container' | 'generalCargo' | 'reefer' | 'combination'
  | 'lng' | 'vehicle' | 'roroCargo' | 'roroPax' | 'roroPaxHsc' | 'cruise' | 'other';

export const EM_SHIP_TYPES: EmShipType[] = ['yacht', 'offshore', 'cruise', 'roroPax', 'roroPaxHsc', 'generalCargo', 'tanker', 'bulk', 'gas', 'lng', 'container', 'reefer', 'combination', 'vehicle', 'roroCargo', 'other'];

/** For reports — English always. */
export const EM_SHIP_TYPE_EN: Record<EmShipType, string> = {
  yacht: 'Yacht', offshore: 'Offshore ship', bulk: 'Bulk carrier', gas: 'Gas carrier', tanker: 'Tanker', container: 'Container ship',
  generalCargo: 'General cargo ship', reefer: 'Refrigerated cargo carrier', combination: 'Combination carrier', lng: 'LNG carrier',
  vehicle: 'Ro-ro cargo ship (vehicle carrier)', roroCargo: 'Ro-ro cargo ship', roroPax: 'Ro-ro passenger ship',
  roroPaxHsc: 'Ro-ro passenger ship (high-speed craft)', cruise: 'Cruise passenger ship', other: 'Other',
};

/** Carrying cargo or passengers for commercial purposes? MRV turns on it; for a yacht it depends on the charter. */
export type EmCommercial = 'yes' | 'no' | 'unsure';

export interface EmVessel {
  id: 'vessel';
  type: EmShipType;
  gt?: number;
  dwt?: number;
  commercial: EmCommercial;
  by?: string;
  updatedAt: number;
}

export interface EmPassage extends Versioned {
  id: string;
  fromPort: string;
  /** In the EU / EEA — the rule's own test of a voyage. */
  fromEu: boolean;
  toPort: string;
  toEu: boolean;
  /** UTC, "yyyy-mm-ddThh:mm": left the berth, full ahead on passage, end of sea passage, at the berth. */
  depAt: string;
  faopAt: string;
  eospAt: string;
  arrAt: string;
  /** Litres of diesel on board, at the berth on leaving and on arriving. */
  robDep: number;
  robArr: number;
  /** Nautical miles under way, FAOP to EOSP. */
  distanceNm: number;
  /** Tonnes of cargo or number of passengers carried; none = not laden. */
  carried?: number;
  /** Only when the passage crosses the new year: ROB and miles run at 31 Dec 24:00 UTC. */
  yearEndRob?: number;
  yearEndNm?: number;
  note?: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}

export type EmConsumer = 'main' | 'aux' | 'boiler' | 'other';
export const EM_CONSUMERS: EmConsumer[] = ['main', 'aux', 'boiler', 'other'];
export const EM_CONSUMER_EN: Record<EmConsumer, string> = { main: 'Main engines', aux: 'Auxiliary engines', boiler: 'Boilers', other: 'Other' };

/** Section 7 of the SEEMP guidelines (MEPC.395(82)): the first two are primary; the last needs the Administration's prior approval. */
export type EmMethod = 'flow' | 'tank' | 'subtraction' | 'estimate';
export const EM_METHODS: EmMethod[] = ['flow', 'tank', 'subtraction', 'estimate'];
export const EM_METHOD_EN: Record<EmMethod, string> = { flow: 'Flow meters', tank: 'Bunker fuel oil tank monitoring', subtraction: 'Subtraction', estimate: 'Estimation (approved by the Administration)' };

/** Tonnes: under way and not under way. */
export type EmSplit = Record<EmConsumer, { u: number; n: number }>;

/** The figures as they stood at the signature. */
export interface EmFrozen {
  litres: number;
  tonnes?: number;
  co2?: number;
  distance: number;
  hours: number;
}

export interface EmStatement {
  id: string;
  year: number;
  method: EmMethod;
  split: EmSplit;
  /** kWh of shore power taken in the year. */
  shoreKwh?: number;
  /** Innovative technologies installed, in words. */
  innovative?: string;
  note?: string;
  frozen: EmFrozen;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}
