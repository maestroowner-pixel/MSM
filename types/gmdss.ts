// ===================================
// GMDSS Log — radio watch and equipment checks.
//
// Everything lands as a TEXT ENTRY in the journal (date · time · text · signed).
// The check card (GmdssCheck) is the UI for filling daily/weekly/monthly checks;
// it serialises to the `text` field so the journal is readable without the card.
//
// Three layers:
//   Entries   — append-only signed rows, each is one line in the journal.
//   Checks    — structured card data attached to periodic check entries.
//   Events    — radar on/off, distress, DSC test, free note.
// ===================================

import type { SignProof } from '../services/signature';

// ─── Entry types ─────────────────────────────────────────────────────────────

export type GmdssEntryType =
  | 'daily'        // daily equipment check
  | 'weekly'       // weekly DSC test + EPIRB self-test
  | 'monthly'      // monthly inspection
  | 'radar_on'     // X-band or S-band radar switched on
  | 'radar_off'    // radar switched off; if in port → "Radio watch closed"
  | 'event';       // free note: distress received, NAVTEX msg, test call, etc.

export type RadarBand = 'xband' | 'sband';

// ─── Battery box (embedded in daily check) ──────────────────────────────────

export interface GmdssBattery {
  id: string;          // e.g. 'bat1', 'bat2'
  label: string;       // e.g. 'Main GMDSS battery', 'Reserve battery'
  status: 'charging' | 'charged' | 'ok';
  /** Voltage in tenths-of-a-volt stored as integer, e.g. 130 = 13.0 V.
   *  Input: user types "130" → stored as 130 → displayed as "13.0 V". */
  voltageRaw?: number;
}

// ─── Check line (one equipment row in the check card) ───────────────────────

export interface GmdssCheckItem {
  id: string;
  checked: boolean;
  /** Primary value — MMSI, channel, frequency. */
  value?: string;
  /** Secondary value — station name or other free text. */
  value2?: string;
  note?: string;
}

// ─── Check card (attached to daily / weekly / monthly entries) ──────────────

export interface GmdssCheck {
  period: 'daily' | 'weekly' | 'monthly';
  items: GmdssCheckItem[];
  batteries?: GmdssBattery[];
  note?: string;
}

// ─── Journal entry (the atomic stored unit) ──────────────────────────────────

export interface GmdssEntry {
  id: string;
  type: GmdssEntryType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM local ship time */
  time: string;
  /** Unix timestamp (ms) when the entry was created / signed. */
  at: number;
  updatedAt: number;

  // Text logged to the journal — generated from the check card or typed directly.
  text: string;

  // For radar entries
  band?: RadarBand;
  /** True when radar_off and vessel was in port at the time. */
  radioWatchClosed?: boolean;

  // Structured data for check entries — for re-displaying the card.
  check?: GmdssCheck;

  // Signature
  by: string;
  byRank?: string;
  signedWith?: SignProof;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export type GmdssCheckPeriod = 'daily' | 'weekly' | 'monthly';

/** Latest entry per check period, for the dashboard / header. */
export interface GmdssCheckStatus {
  lastDate: string | null;
  overdue: boolean;      // check is due today or past
  dueSoon: boolean;      // check is due within 1 day
}
