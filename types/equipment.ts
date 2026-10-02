// ===================================
// Equipment data model
// One unified item type with category-specific extras,
// instead of 25 rigid per-sheet schemas.
// ===================================

export type BuiltInCategoryKey =
  | 'liferafts'
  | 'lifebuoys'
  | 'lifejackets'
  | 'immersion_suits'
  | 'inflatable_lifejackets'
  | 'mob'
  | 'plb'
  | 'harnesses'
  | 'gmdss_pyro'
  | 'emergency_escapes'
  | 'fire_extinguishers'
  | 'fire_dampers'
  | 'fire_vents'
  | 'hydrants_fireboxes'
  | 'fixed_co2'
  | 'fifi_ba'
  | 'bottle_pressure'
  | 'eebd'
  | 'fire_detectors'
  | 'eye_wash'
  | 'first_aid'
  | 'chemical_suits'
  | 'gas_detection'
  | 'sopep'
  | 'other_safety';

/** A built-in key, or one a vessel invented (`v_…`). */
export type CategoryKey = BuiltInCategoryKey | (string & {});

export type Group = 'LSA' | 'FFE' | 'OTHER' | 'LIFTING';

/** A photo or document attached directly to a single equipment item. */
export interface Attachment {
  id: string;
  kind: 'photo' | 'document';
  uri: string; // persisted file path in the app's document directory
  name?: string;
  addedAt: number;
}

export interface EquipmentItem {
  id: string;
  category: CategoryKey;
  no?: number | string; // sheet "No." column
  type?: string; // type / description / make+model
  make?: string; // manufacturer (Viking, Dräger …)
  size?: string; // free text on purpose: "5kg", "9L", "XL", "150N" — units differ per item
  serial?: string; // serial / ID number
  deck?: string; // deck the item is on ("Sun Deck") — read together with `position`
  position?: string; // location on vessel
  quantity?: number;
  persons?: number; // liferaft capacity
  manufactureDate?: string; // ISO yyyy-mm-dd
  nextInspection?: string; // ISO — primary compliance date
  expiry?: string; // ISO — battery/light/pyro/bottle expiry
  remarks?: string; // shown as "Comments" — the stored key is kept so no data migrates

  // ---- Lifting & Mooring ---------------------------------------------------
  //
  // Typed rather than left in `extra{}`, because a vessel asked for exactly that
  // (29 Sep 2026) and was right to: a register kept in free-text columns cannot
  // drive a reminder, cannot be printed on a label and cannot be searched. They
  // are optional and mean nothing to a lifejacket, which costs a lifejacket
  // nothing — the item model has always been one shape for every category
  // rather than twenty-five rigid ones.
  //
  // Loads are STRINGS, deliberately. The vessel's own register reads "22 kN",
  // "140kg", "9.9 t", "2200kg", "3 T" and "31 -37 KN" in one column, because
  // that is how the gear is marked. Normalising to newtons would print a figure
  // that is not on the sling, and an inspector compares the label with the
  // marking, not with our arithmetic.

  /** Safe working load, as marked: "22 kN", "9.9 t", "2200kg". */
  swl?: string;
  /** Minimum breaking load, as marked. Often the same as `swl` on rope. */
  mbl?: string;
  /** Rope or wire diameter, as marked: "11mm", "44". */
  diameter?: string;
  /** "Polyester / nylon", "Galvanised steel". */
  material?: string;
  /** Colour code, whipping or tag by which the crew identifies it on deck. */
  marking?: string;
  /** The maker's test certificate number. */
  mfrCertNo?: string;
  /** The current annual / periodic test certificate number. */
  testCertNo?: string;
  /** ISO — put into service or renewed. */
  installedDate?: string;
  /** ISO — the last annual inspection or thorough examination. */
  lastInspection?: string;
  extra?: Record<string, any>; // category-specific columns
  monthlyChecks?: Record<string, boolean>; // e.g. { "2025-07": true } for checklist sheets
  attachments?: Attachment[]; // photos / documents attached to this item

  /**
   * Flagged by the crew — "come back to this". Deliberately NOT a compliance
   * status: an item can be perfectly in date and still need a second look. The
   * flag answers "does a human need to look at it", and gets its own strip on the
   * Dashboard. (Ported from DEM.)
   */
  flagged?: boolean;
  flagNote?: string;

  // NB: when an item was last scanned is deliberately NOT stored here — it is a
  // property of this device, not of the equipment, and living on the item it
  // would be wiped by the next Save. See services/scanHistory.ts.

  updatedAt: number;
}

export type ComplianceStatus = 'expired' | 'due' | 'ok' | 'none';

// Inspection/expiry status thresholds (days)
export const DUE_SOON_DAYS = 60;
