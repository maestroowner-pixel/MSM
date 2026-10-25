// ===================================
// Deck watch log (вахтенный журнал мостика).
//
// Each entry covers one watch period. Fixed fields: navigation (position,
// course, speed), weather (wind, sea, visibility, pressure), events/remarks,
// and the watch officer's signature. Entries are immutable once signed.
// ===================================

import type { SignProof } from '../services/signature';

export type WatchPeriod = '00-04' | '04-08' | '08-12' | '12-16' | '16-20' | '20-00' | 'noon' | 'other' | 'port';

export type WindDir = 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'SSE' | 'S' | 'SSW' | 'SW' | 'WSW' | 'W' | 'WNW' | 'NW' | 'NNW';

export type Visibility = 'good' | 'moderate' | 'poor' | 'fog';

export type LatHem = 'N' | 'S';
export type LonHem = 'E' | 'W';

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
  /** Legacy freeform — kept for old records. Prefer latDeg/latMin/latHem. */
  lat?: string;
  lon?: string;
  /** Legacy — kept for old records. Prefer courseGyro. */
  course?: number;

  latDeg?: number;
  latMin?: number;
  latHem?: LatHem;
  lonDeg?: number;
  lonMin?: number;
  lonHem?: LonHem;

  courseGyro?: number;
  courseMagnetic?: number;
  variation?: number;
  deviation?: number;

  /** Speed over ground, knots */
  speed?: number;
  /** Distance run since previous entry, nm */
  distanceRun?: number;
  /** Main engine RPM */
  rpm?: number;
  /** Engine load %, port (or single) */
  engLoadPort?: number;
  /** Engine load %, starboard */
  engLoadStbd?: number;

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

  // ─── Draft ───────────────────────────────────────────────────────────────
  /** True while the entry has not been signed yet — can still be edited. */
  draft?: boolean;

  // ─── Links / attachments ─────────────────────────────────────────────────
  /** Landing Report ID this entry was auto-generated from. */
  landingRef?: string;
  /** Landing Report display number, e.g. "LR-2026-01". */
  landingNo?: string;
  /** Free-form attachment URI (file or URL) attached by the watch officer. */
  attachmentUri?: string;
  /** Display name for the attachment. */
  attachmentName?: string;
  /** The clock change this entry records (utils/shipTime.ts) — written once per change. */
  clockRef?: string;

  // ─── Mode ────────────────────────────────────────────────────────────────
  /** 'sea' (default/undefined) — underway; 'port' — alongside/anchored. */
  mode?: 'sea' | 'port';
  /** Simple weather condition for port entries: Clear / Rain / Fog / etc. */
  wxCondition?: string;

  // ─── Signature ───────────────────────────────────────────────────────────
  by: string;
  byRank?: string;
  at: number;
  signedWith?: SignProof;
  updatedAt: number;

  // ─── Master review (captain endorsement) ─────────────────────────────────
  masterBy?: string;
  masterByRank?: string;
  masterAt?: number;
  masterSignedWith?: SignProof;
}
