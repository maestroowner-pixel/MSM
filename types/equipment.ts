// ===================================
// Equipment data model
// One unified item type with category-specific extras,
// instead of 25 rigid per-sheet schemas.
// ===================================

export type CategoryKey =
  | 'liferafts'
  | 'lifebuoys'
  | 'lifejackets'
  | 'immersion_suits'
  | 'inflatable_lifejackets'
  | 'mob'
  | 'plb'
  | 'harnesses'
  | 'gmdss_pyro'
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
  | 'sopep';

export type Group = 'LSA' | 'FFE' | 'OTHER';

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
  serial?: string; // serial / ID number
  position?: string; // location on vessel
  quantity?: number;
  persons?: number; // liferaft capacity
  manufactureDate?: string; // ISO yyyy-mm-dd
  nextInspection?: string; // ISO — primary compliance date
  expiry?: string; // ISO — battery/light/pyro/bottle expiry
  remarks?: string;
  extra?: Record<string, any>; // category-specific columns
  monthlyChecks?: Record<string, boolean>; // e.g. { "2025-07": true } for checklist sheets
  attachments?: Attachment[]; // photos / documents attached to this item
  updatedAt: number;
}

export type ComplianceStatus = 'expired' | 'due' | 'ok' | 'none';

// Inspection/expiry status thresholds (days)
export const DUE_SOON_DAYS = 60;
