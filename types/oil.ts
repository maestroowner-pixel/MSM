// ===================================
// Oil analysis — condition monitoring of the oil in the machinery (27 Oct 2026;
// a row of the competitor matrix only one competitor had). The engineers take a
// sample, send it to the lab (Shell LubeAnalyst, Castrol Labcheck, Mobil Signum,
// Chevron LubeWatch, Wearcheck…), type or load the result, and an officer
// reviews it and says what was done.
//
//   OilPoint   one place oil is sampled from: the crankcase of the port main
//              engine, the reduction gear, the stabiliser hydraulics. On a
//              machine of the PMS (its running hours), with its oil, the lab,
//              how often it is sampled and the limits it is judged by.
//   OilSample  one sample: taken (date, machine hours, hours on the oil), sent,
//              the lab's result, and the officer's review. Changed as it goes
//              through those steps; once reviewed it is frozen (the rules say
//              the same) — the review is the signed statement.
//
// The verdict is the WORSE of the lab's and the vessel's limits (services/oil.ts):
// the lab knows the oil, the vessel knows the engine maker's figures.
// ===================================

import { Attachment } from './equipment';

export type Compartment = 'engine' | 'gear' | 'hydraulic' | 'thruster' | 'sterntube' | 'compressor' | 'other';
export const COMPARTMENTS: Compartment[] = ['engine', 'gear', 'hydraulic', 'thruster', 'sterntube', 'compressor', 'other'];

/** Reports stay English; screens use t('oil.cmp.<key>'). */
export const COMPARTMENT_LABEL: Record<Compartment, string> = {
  engine: 'Diesel engine',
  gear: 'Gearbox / reduction gear',
  hydraulic: 'Hydraulics (stabilisers, steering, cranes)',
  thruster: 'Thruster',
  sterntube: 'Stern tube',
  compressor: 'Compressor',
  other: 'Other',
};

export type ParamKey =
  | 'fe' | 'cu' | 'pb' | 'al' | 'cr' | 'sn' | 'ni'
  | 'si' | 'na' | 'k' | 'water' | 'fuel' | 'soot'
  | 'v40' | 'v100' | 'tbn' | 'tan' | 'oxi' | 'pq';

/**
 * How a parameter is judged:
 *   max   higher is worse — caution / action are the values themselves
 *   visc  change from the new oil, either way — caution / action in %
 *   tbn   what is left of the new oil's TBN — below caution / action %
 *   tan   rise over the new oil's TAN — caution / action in mg KOH/g
 *   info  printed, not judged
 */
export type LimitKind = 'max' | 'visc' | 'tbn' | 'tan' | 'info';

export interface ParamDef {
  key: ParamKey;
  label: string;
  unit: string;
  kind: LimitKind;
  group: 'wear' | 'contamination' | 'condition';
}

/** In the order a lab report prints them. Reports stay English; screens use t('oil.p.<key>'). */
export const PARAMS: ParamDef[] = [
  { key: 'fe', label: 'Iron (Fe)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'cu', label: 'Copper (Cu)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'pb', label: 'Lead (Pb)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'al', label: 'Aluminium (Al)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'cr', label: 'Chromium (Cr)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'sn', label: 'Tin (Sn)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'ni', label: 'Nickel (Ni)', unit: 'ppm', kind: 'max', group: 'wear' },
  { key: 'pq', label: 'PQ index', unit: '', kind: 'max', group: 'wear' },
  { key: 'si', label: 'Silicon (Si)', unit: 'ppm', kind: 'max', group: 'contamination' },
  { key: 'na', label: 'Sodium (Na)', unit: 'ppm', kind: 'max', group: 'contamination' },
  { key: 'k', label: 'Potassium (K)', unit: 'ppm', kind: 'max', group: 'contamination' },
  { key: 'water', label: 'Water', unit: '%', kind: 'max', group: 'contamination' },
  { key: 'fuel', label: 'Fuel dilution', unit: '%', kind: 'max', group: 'contamination' },
  { key: 'soot', label: 'Soot', unit: '%', kind: 'max', group: 'contamination' },
  { key: 'v40', label: 'Viscosity at 40 °C', unit: 'cSt', kind: 'visc', group: 'condition' },
  { key: 'v100', label: 'Viscosity at 100 °C', unit: 'cSt', kind: 'visc', group: 'condition' },
  { key: 'tbn', label: 'TBN', unit: 'mg KOH/g', kind: 'tbn', group: 'condition' },
  { key: 'tan', label: 'TAN', unit: 'mg KOH/g', kind: 'tan', group: 'condition' },
  { key: 'oxi', label: 'Oxidation', unit: 'Abs/cm', kind: 'max', group: 'condition' },
];

export const PARAM: Record<ParamKey, ParamDef> = Object.fromEntries(PARAMS.map((p) => [p.key, p])) as Record<ParamKey, ParamDef>;

/** Caution (amber) and action (red). Either may be absent: then that level is not judged. */
export interface Limit {
  c?: number;
  a?: number;
}

/** 0 normal · 1 caution · 2 action — the lab's three colours. */
export type Level = 0 | 1 | 2;
export type Verdict = 'normal' | 'caution' | 'action';
export const VERDICTS: Verdict[] = ['normal', 'caution', 'action'];

export interface NewOil {
  v40?: number;
  v100?: number;
  tbn?: number;
  tan?: number;
}

export interface OilPoint {
  id: string;
  /** The PMS machine (types/pms.ts) — its running hours. */
  machineId?: string;
  /** Snapshot, so the history reads the same after the machine is renamed or scrapped. */
  machineName?: string;
  /** "Crankcase", "Reduction gear", "Stabiliser HPU". */
  name: string;
  compartment: Compartment;
  /** "Shell Gadinia S3 40". */
  oil?: string;
  /** Litres in the system. */
  capacity?: number;
  lab?: string;
  /** The lab's id for this unit / its bottle prefix. */
  labRef?: string;
  /** Sample every N days and / or every N running hours, whichever first. */
  intervalDays?: number;
  intervalHours?: number;
  /** The fresh oil's figures — what viscosity, TBN and TAN are measured against. */
  newOil?: NewOil;
  /** This point's own limits, over the compartment's guide values. */
  limits?: Partial<Record<ParamKey, Limit>>;
  /** ISO 4406 target, e.g. "18/16/13" — hydraulics and gears. */
  isoTarget?: string;
  notes?: string;
  deleted?: boolean;
  updatedAt: number;
}

export interface OilResult {
  /** yyyy-mm-dd of the lab's report. */
  date: string;
  labNo?: string;
  values: Partial<Record<ParamKey, number>>;
  /** ISO 4406 code as reported, "19/17/14". */
  iso?: string;
  labVerdict?: Verdict;
  labComment?: string;
  /** Typed in, or read from the lab's Excel / CSV. */
  from?: 'typed' | 'sheet';
  by: string;
  at: number;
}

export interface OilReview {
  date: string;
  verdict: Verdict;
  /** What was done or decided: "Oil changed, filters renewed, resample in 100 h". */
  action: string;
  oilChanged?: boolean;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: import('../services/signature').SignProof;
}

export interface OilSample {
  id: string;
  pointId: string;
  machineId?: string;
  /** yyyy-mm-dd taken. */
  date: string;
  /** The machine's running hours when taken. */
  machineHours?: number;
  /** Hours on this oil (since the last change). */
  oilHours?: number;
  /** Litres topped up since the last sample. */
  topUp?: number;
  /** Bottle label / the lab's sample number. */
  bottle?: string;
  takenBy: string;
  takenByRank?: string;
  at: number;
  sent?: { date: string; by: string };
  result?: OilResult;
  /** Photographs of the lab's report. */
  photos?: Attachment[];
  review?: OilReview;
  updatedAt: number;
}
