// ===================================
// Deck watch log (вахтенный журнал мостика).
//
// Each entry covers one watch period. Fixed fields: navigation (position,
// course, speed), weather (wind, sea, visibility, pressure), events/remarks,
// and the watch officer's signature. Entries are immutable once signed.
// ===================================

import type { SignProof } from '../services/signature';

export type WatchPeriod = '00-04' | '04-08' | '08-12' | '12-16' | '16-20' | '20-00' | 'noon' | 'other';

export type WindDir = 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'SSE' | 'S' | 'SSW' | 'SW' | 'WSW' | 'W' | 'WNW' | 'NW' | 'NNW';

export type Visibility = 'good' | 'moderate' | 'poor' | 'fog';

export const WATCH_PERIODS: WatchPeriod[] = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-00', 'noon', 'other'];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  good: 'Good (>5 nm)',
  moderate: 'Moderate (2–5 nm)',
  poor: 'Poor (<2 nm)',
  fog: 'Fog (<0.5 nm)',
};

/** One completed and signed watch entry — immutable once signed. */
export interface DeckEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM local */
  time: string;
  period: WatchPeriod;

  // ─── Navigation ──────────────────────────────────────────────────────────
  /** e.g. "55°30.5'N" */
  lat?: string;
  /** e.g. "012°30.5'E" */
  lon?: string;
  /** True course, 0–359 */
  course?: number;
  /** Speed over ground, knots */
  speed?: number;
  /** Distance run since previous entry, nm */
  distanceRun?: number;
  /** Main engine RPM */
  rpm?: number;

  // ─── Weather ─────────────────────────────────────────────────────────────
  windDir?: WindDir;
  /** Beaufort force 0–12 */
  windBft?: number;
  /** Douglas sea state 0–9 */
  seaState?: number;
  visibility?: Visibility;
  /** Barometric pressure, hPa */
  pressure?: number;
  /** Air temperature, °C */
  tempAir?: number;

  // ─── Events ──────────────────────────────────────────────────────────────
  remarks?: string;

  // ─── Signature ───────────────────────────────────────────────────────────
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;
}
