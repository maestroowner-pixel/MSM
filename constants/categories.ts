// ===================================
// Category registry
// Maps each CategoryKey -> display metadata, group, source sheet,
// which date field drives compliance, and whether it uses a monthly checklist.
// Drives the category grid, the importer, and the dashboard.
// ===================================

import { CategoryKey, Group } from '../types/equipment';
import { COLORS } from '../theme';

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  short: string;
  group: Group;
  sheet: string; // source worksheet name in the LSA/FFE xlsx
  color: string;
  emoji: string;
  // Which date field is the primary compliance driver for the dashboard
  dateField: 'nextInspection' | 'expiry';
  // Checklist-style categories get monthly check toggles
  monthly?: boolean;
}

export const GROUP_COLORS: Record<Group, string> = {
  LSA: COLORS.lsa,
  FFE: COLORS.ffe,
  OTHER: COLORS.other,
};

export const CATEGORIES: CategoryMeta[] = [
  // ----- LSA -----
  { key: 'liferafts', label: 'Liferafts / HRU', short: 'Liferafts', group: 'LSA', sheet: 'Liferafts', color: COLORS.lsa, emoji: '🛟', dateField: 'nextInspection' },
  { key: 'lifebuoys', label: 'Lifebuoys', short: 'Lifebuoys', group: 'LSA', sheet: 'Lifebuoys', color: COLORS.lsa, emoji: '🛟', dateField: 'expiry' },
  { key: 'lifejackets', label: 'Lifejackets', short: 'Lifejackets', group: 'LSA', sheet: 'LifeJackets', color: COLORS.lsa, emoji: '🦺', dateField: 'expiry' },
  { key: 'immersion_suits', label: 'Immersion Suits', short: 'Imm. Suits', group: 'LSA', sheet: 'Immersion Suits', color: COLORS.lsa, emoji: '🧥', dateField: 'nextInspection' },
  { key: 'inflatable_lifejackets', label: 'Inflatable Lifejackets', short: 'Infl. LJ', group: 'LSA', sheet: 'Inflatable LifeJackets', color: COLORS.lsa, emoji: '🦺', dateField: 'expiry' },
  { key: 'mob', label: 'MOB Boat / Davit', short: 'MOB', group: 'LSA', sheet: 'MOB', color: COLORS.lsa, emoji: '🚤', dateField: 'nextInspection' },
  { key: 'plb', label: "PLB's", short: 'PLB', group: 'LSA', sheet: "PLB's", color: COLORS.lsa, emoji: '📡', dateField: 'expiry' },
  { key: 'harnesses', label: 'Harnesses / Fall Arrest', short: 'Harnesses', group: 'LSA', sheet: 'Harnesses', color: COLORS.lsa, emoji: '🪢', dateField: 'nextInspection' },
  { key: 'gmdss_pyro', label: 'GMDSS / SART / EPIRB / Pyro', short: 'GMDSS', group: 'LSA', sheet: 'GMDSS + Pyrotechnics', color: COLORS.lsa, emoji: '📻', dateField: 'expiry' },

  // ----- FFE / FIFI -----
  { key: 'fire_extinguishers', label: 'Fire Extinguishers', short: 'Extinguishers', group: 'FFE', sheet: 'Fire extinguishers', color: COLORS.ffe, emoji: '🧯', dateField: 'nextInspection' },
  { key: 'fire_dampers', label: 'Fire Dampers', short: 'Dampers', group: 'FFE', sheet: 'Fire Dampers', color: COLORS.ffe, emoji: '🚪', dateField: 'nextInspection' },
  { key: 'fire_vents', label: 'Fire Vents', short: 'Vents', group: 'FFE', sheet: 'Fire Vents', color: COLORS.ffe, emoji: '🌀', dateField: 'nextInspection' },
  { key: 'hydrants_fireboxes', label: 'Hydrants / Fireboxes', short: 'Hydrants', group: 'FFE', sheet: 'Hydrants, Fireboxes', color: COLORS.ffe, emoji: '🚒', dateField: 'nextInspection', monthly: true },
  { key: 'fixed_co2', label: 'Fixed CO₂', short: 'CO₂', group: 'FFE', sheet: 'Fixed CO2', color: COLORS.ffe, emoji: '💨', dateField: 'nextInspection' },
  { key: 'fifi_ba', label: 'FIFI Outfit & BA Sets', short: 'FIFI/BA', group: 'FFE', sheet: "FIFI Outfit & BA's", color: COLORS.ffe, emoji: '🧑‍🚒', dateField: 'nextInspection' },
  { key: 'bottle_pressure', label: 'BA Bottle Pressure', short: 'BA Bottles', group: 'FFE', sheet: 'Bottle Press.', color: COLORS.ffe, emoji: '🛢️', dateField: 'nextInspection', monthly: true },
  { key: 'eebd', label: 'EEBD', short: 'EEBD', group: 'FFE', sheet: 'EEBD', color: COLORS.ffe, emoji: '😷', dateField: 'expiry' },
  { key: 'fire_detectors', label: 'Fire Detectors', short: 'Detectors', group: 'FFE', sheet: 'Fire detectors', color: COLORS.ffe, emoji: '🔔', dateField: 'nextInspection', monthly: true },

  // ----- OTHER -----
  { key: 'eye_wash', label: 'Eye Wash Stations', short: 'Eye Wash', group: 'OTHER', sheet: 'Eye Wash St.', color: COLORS.other, emoji: '👁️', dateField: 'expiry' },
  { key: 'first_aid', label: 'First Aid Kits', short: 'First Aid', group: 'OTHER', sheet: 'First Aid Kit', color: COLORS.other, emoji: '🩹', dateField: 'expiry' },
  { key: 'chemical_suits', label: 'Chemical Suits', short: 'Chem. Suits', group: 'OTHER', sheet: 'Chemical Suits', color: COLORS.other, emoji: '🧪', dateField: 'nextInspection' },
  { key: 'gas_detection', label: 'Gas Detection Meters', short: 'Gas Det.', group: 'OTHER', sheet: 'Gas Detection ', color: COLORS.other, emoji: '🟢', dateField: 'expiry' },
  { key: 'sopep', label: 'SOPEP Locker', short: 'SOPEP', group: 'OTHER', sheet: 'SOPEP', color: COLORS.other, emoji: '🛢️', dateField: 'expiry' },
];

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<CategoryKey, CategoryMeta>
);

export function categoriesByGroup(group: Group): CategoryMeta[] {
  return CATEGORIES.filter((c) => c.group === group);
}
