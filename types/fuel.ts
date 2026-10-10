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

export interface FuelTank {
  id: string;
  name: string;
  /** Litres, optional — shows how full a tank is. */
  capacity?: number;
  /** Position in lists. */
  order: number;
  deleted?: boolean;
  updatedAt: number;
}

/** The day's soundings: litres remaining on board, tank by tank. */
export interface FuelReading {
  /** `rob_<yyyy-mm-dd>` — one per day. */
  id: string;
  date: string;
  /** Local time of the sounding, "08:00". */
  time?: string;
  /** Litres by tank id. */
  tanks: Record<string, number>;
  by: string;
  byRank?: string;
  note?: string;
  updatedAt: number;
}

export interface FuelBunker {
  id: string;
  date: string;
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
  /** Bunker delivery note number. */
  bdnNo?: string;
  /** Litres into each tank. */
  into: Record<string, number>;
  by: string;
  byRank?: string;
  note?: string;
  updatedAt: number;
}

export interface FuelTransfer {
  id: string;
  date: string;
  time?: string;
  fromTankId: string;
  toTankId: string;
  litres: number;
  by: string;
  byRank?: string;
  note?: string;
  updatedAt: number;
}

export const DEFAULT_TANKS: Omit<FuelTank, 'id' | 'updatedAt'>[] = [
  { name: 'Port diesel tank', order: 0 },
  { name: 'Starboard diesel tank', order: 1 },
];
