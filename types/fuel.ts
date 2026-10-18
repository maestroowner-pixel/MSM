// ===================================
// Fuel — the yacht's diesel: tanks, daily soundings, bunkerings and transfers.
//
// One fuel (diesel, litres) by the owner's decision (10 Oct 2026); petrol for the
// tenders and toys comes later as its own tanks. Consumption is never typed — it
// is what the soundings and the bunkerings say: yesterday's remaining on board,
// plus what was received, minus today's (services/fuel.ts). Transfers move fuel
// between tanks and change no total.
//
// Every record is signed by name; soundings are one per day (editable that day),
// bunkerings and transfers are entries like those in the Oil Record Book.
// ===================================

import type { SignProof } from '../services/signature';

import type { Versioned } from '../services/versions';

export type FuelKind = 'diesel' | 'petrol' | 'freshwater' | 'lube_oil';

export const FUEL_KIND_LABEL: Record<FuelKind, string> = {
  diesel: 'MGO / Diesel',
  petrol: 'Petrol (FRC / Tenders)',
  freshwater: 'Fresh Water',
  lube_oil: 'Lubricating Oils',
};

export interface FuelTank {
  id: string;
  name: string;
  /** Fluid type — absent means 'diesel' (legacy tanks). */
  kind?: FuelKind;
  /** Litres, optional — shows how full a tank is. */
  capacity?: number;
  /** Position in lists. */
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

/** The day's soundings: litres remaining on board, tank by tank. */
export interface FuelReading extends Versioned {
  /** `rob_<yyyy-mm-dd>` — one per day. */
  id: string;
  date: string;
  /** Local time of the sounding, "08:00". */
  time?: string;
  /** Litres by tank id. */
  tanks: Record<string, number>;
  by: string;
  byRank?: string;
  /** How it was signed (PIN / fingerprint / by hand). */
  signedWith?: SignProof;
  note?: string;
  updatedAt: number;
}

export interface FuelBunker extends Versioned {
  id: string;
  date: string;
  /** Fluid type — absent means 'diesel' (legacy bunkers). */
  kind?: FuelKind;
  /** Local time, "14:30". */
  time?: string;
  port: string;
  supplier?: string;
  /** Litres received (at the stated temperature / as per the BDN). */
  litres: number;
  /** kg/L at 15 °C, from the BDN. */
  density?: number;
  /** Sulphur content % m/m, from the BDN. */
  sulphur?: number;
  /** Bunker delivery note number (diesel). */
  bdnNo?: string;
  /** For petrol: which craft was fuelled (FRC, Tender 1, Scooter…). */
  craft?: string;
  /** For lubricating oils: grade (SAE 40, HV 46, …). */
  grade?: string;
  /** Litres into each tank. */
  into: Record<string, number>;
  by: string;
  byRank?: string;
  /** How it was signed (PIN / fingerprint / by hand). */
  signedWith?: SignProof;
  note?: string;
  updatedAt: number;
}

export interface FuelTransfer extends Versioned {
  id: string;
  date: string;
  time?: string;
  fromTankId: string;
  toTankId: string;
  litres: number;
  by: string;
  byRank?: string;
  /** How it was signed (PIN / fingerprint / by hand). */
  signedWith?: SignProof;
  note?: string;
  updatedAt: number;
}

/**
 * A daily (noon) report as it went out — the figures and the text frozen at
 * the moment of sending, so the log shows what the office was told even if a
 * sounding is corrected later. Append-only.
 */
export interface FuelDailySent {
  id: string;
  /** The report day. */
  date: string;
  sentAt: number;
  by: string;
  byRank?: string;
  /** How it was signed (PIN / fingerprint / by hand). */
  signedWith?: SignProof;
  /** Addressees for an e-mail. */
  to?: string;
  /** How it left: the mail app opened, the share sheet, or copied. */
  channel: 'email' | 'share' | 'copy';
  consumed?: number;
  rob?: number;
  avg7?: number;
  daysLeft?: number;
  remarks?: string;
  /** Noon or midnight report (absent: noon — reports sent before 13 Oct 2026). */
  kind?: 'noon' | 'midnight';
  /** Position at the report's time (38°45.2'N 002°10.6'E) or the port. */
  position?: string;
  port?: string;
  text: string;
  updatedAt: number;
}

export const DEFAULT_TANKS: Omit<FuelTank, 'id' | 'updatedAt'>[] = [
  { name: 'Port diesel tank', order: 0 },
  { name: 'Starboard diesel tank', order: 1 },
];
