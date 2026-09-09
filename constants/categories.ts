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
  /**
   * Source worksheet in the LSA/FFE workbook.
   *
   * OPTIONAL, because not every category comes from one. A hand-built list has
   * no sheet to import from and none to offer in the blank template, and giving
   * it an empty string instead made both places produce nonsense: the importer
   * reported a missing sheet with no name, and the template builder asked Excel
   * for a worksheet called "". Absent says it plainly; skip such categories.
   */
  sheet?: string;
  color: string;
  emoji: string;
  // Monochrome glyph (MaterialCommunityIcons) — shown across the UI instead of the emoji
  icon: string;
  // Which date field is the primary compliance driver for the dashboard
  dateField: 'nextInspection' | 'expiry';
  // Checklist-style categories get monthly check toggles
  monthly?: boolean;
  /** Set only on a vessel's own category — the merge key when two devices differ. */
  updatedAt?: number;
}

export const GROUP_COLORS: Record<Group, string> = {
  LSA: COLORS.lsa,
  FFE: COLORS.ffe,
  OTHER: COLORS.other,
};

const BUILT_IN: CategoryMeta[] = [
  // ----- LSA -----
  { key: 'liferafts', label: 'Liferafts / HRU', short: 'Liferafts', group: 'LSA', sheet: 'Liferafts', color: COLORS.lsa, emoji: '🛟', icon: 'lifebuoy', dateField: 'nextInspection' },
  { key: 'lifebuoys', label: 'Lifebuoys', short: 'Lifebuoys', group: 'LSA', sheet: 'Lifebuoys', color: COLORS.lsa, emoji: '🛟', icon: 'lifebuoy', dateField: 'expiry' },
  { key: 'lifejackets', label: 'Lifejackets', short: 'Lifejackets', group: 'LSA', sheet: 'LifeJackets', color: COLORS.lsa, emoji: '🦺', icon: 'tshirt-crew', dateField: 'expiry' },
  { key: 'immersion_suits', label: 'Immersion Suits', short: 'Imm. Suits', group: 'LSA', sheet: 'Immersion Suits', color: COLORS.lsa, emoji: '🧥', icon: 'hanger', dateField: 'nextInspection' },
  { key: 'inflatable_lifejackets', label: 'Inflatable Lifejackets', short: 'Infl. LJ', group: 'LSA', sheet: 'Inflatable LifeJackets', color: COLORS.lsa, emoji: '🦺', icon: 'tshirt-crew', dateField: 'expiry' },
  { key: 'mob', label: 'MOB Boat / Davit', short: 'MOB', group: 'LSA', sheet: 'MOB', color: COLORS.lsa, emoji: '🚤', icon: 'ferry', dateField: 'nextInspection' },
  { key: 'plb', label: "PLB's", short: 'PLB', group: 'LSA', sheet: "PLB's", color: COLORS.lsa, emoji: '📡', icon: 'radio-tower', dateField: 'expiry' },
  { key: 'harnesses', label: 'Harnesses / Fall Arrest', short: 'Harnesses', group: 'LSA', sheet: 'Harnesses', color: COLORS.lsa, emoji: '🪢', icon: 'carabiner', dateField: 'nextInspection' },
  { key: 'gmdss_pyro', label: 'GMDSS / SART / EPIRB / Pyro', short: 'GMDSS', group: 'LSA', sheet: 'GMDSS + Pyrotechnics', color: COLORS.lsa, emoji: '📻', icon: 'radio', dateField: 'expiry' },

  // ----- FFE / FIFI -----
  { key: 'fire_extinguishers', label: 'Fire Extinguishers', short: 'Extinguishers', group: 'FFE', sheet: 'Fire extinguishers', color: COLORS.ffe, emoji: '🧯', icon: 'fire-extinguisher', dateField: 'nextInspection' },
  { key: 'fire_dampers', label: 'Fire Dampers', short: 'Dampers', group: 'FFE', sheet: 'Fire Dampers', color: COLORS.ffe, emoji: '🚪', icon: 'air-filter', dateField: 'nextInspection' },
  { key: 'fire_vents', label: 'Fire Vents', short: 'Vents', group: 'FFE', sheet: 'Fire Vents', color: COLORS.ffe, emoji: '🌀', icon: 'fan', dateField: 'nextInspection' },
  { key: 'hydrants_fireboxes', label: 'Hydrants / Fireboxes', short: 'Hydrants', group: 'FFE', sheet: 'Hydrants, Fireboxes', color: COLORS.ffe, emoji: '🚒', icon: 'fire-hydrant', dateField: 'nextInspection', monthly: true },
  { key: 'fixed_co2', label: 'Fixed CO₂', short: 'CO₂', group: 'FFE', sheet: 'Fixed CO2', color: COLORS.ffe, emoji: '💨', icon: 'molecule-co2', dateField: 'nextInspection' },
  { key: 'fifi_ba', label: 'FIFI Outfit & BA Sets', short: 'FIFI/BA', group: 'FFE', sheet: "FIFI Outfit & BA's", color: COLORS.ffe, emoji: '🧑‍🚒', icon: 'diving-scuba-tank', dateField: 'nextInspection' },
  { key: 'bottle_pressure', label: 'BA Bottle Pressure', short: 'BA Bottles', group: 'FFE', sheet: 'Bottle Press.', color: COLORS.ffe, emoji: '🛢️', icon: 'gauge', dateField: 'nextInspection', monthly: true },
  { key: 'eebd', label: 'EEBD', short: 'EEBD', group: 'FFE', sheet: 'EEBD', color: COLORS.ffe, emoji: '😷', icon: 'air-purifier', dateField: 'expiry' },
  { key: 'fire_detectors', label: 'Fire Detectors', short: 'Detectors', group: 'FFE', sheet: 'Fire detectors', color: COLORS.ffe, emoji: '🔔', icon: 'smoke-detector', dateField: 'nextInspection', monthly: true },

  // ----- OTHER -----
  { key: 'eye_wash', label: 'Eye Wash Stations', short: 'Eye Wash', group: 'OTHER', sheet: 'Eye Wash St.', color: COLORS.other, emoji: '👁️', icon: 'eye', dateField: 'expiry' },
  { key: 'first_aid', label: 'First Aid Kits', short: 'First Aid', group: 'OTHER', sheet: 'First Aid Kit', color: COLORS.other, emoji: '🩹', icon: 'medical-bag', dateField: 'expiry' },
  { key: 'chemical_suits', label: 'Chemical Suits', short: 'Chem. Suits', group: 'OTHER', sheet: 'Chemical Suits', color: COLORS.other, emoji: '🧪', icon: 'biohazard', dateField: 'nextInspection' },
  { key: 'gas_detection', label: 'Gas Detection Meters', short: 'Gas Det.', group: 'OTHER', sheet: 'Gas Detection ', color: COLORS.other, emoji: '🟢', icon: 'meter-gas', dateField: 'expiry' },
  { key: 'sopep', label: 'SOPEP Locker', short: 'SOPEP', group: 'OTHER', sheet: 'SOPEP', color: COLORS.other, emoji: '🛢️', icon: 'barrel', dateField: 'expiry' },
  // The catch-all. Every register carries equipment the standard sheets do not
  // name — a portable pump, a spare EEBD charge, a locker of gear nobody else
  // counts — and with nowhere to put it that item stays on paper, which makes it
  // the one that gets missed. No `sheet`: there is no worksheet to import from,
  // so this list is only ever built by hand with the + button.
  { key: 'other_safety', label: 'Other Safety Equipment', short: 'Other', group: 'OTHER', color: COLORS.other, emoji: '🧰', icon: 'toolbox', dateField: 'expiry' },
];

/**
 * Every category in force: the built-ins above, plus any this vessel invented.
 *
 * MUTATED IN PLACE, never reassigned. Two dozen modules hold a reference to this
 * array and to the map below; handing them a new object would leave half the app
 * looking at the registry as it was when it started, which is the sort of bug
 * that shows up as one screen knowing about a category and the next one not.
 */
export const CATEGORIES: CategoryMeta[] = [...BUILT_IN];

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<CategoryKey, CategoryMeta>
);

/** A vessel's own category, as opposed to one the app ships. */
export const VESSEL_CATEGORY_PREFIX = 'v_';

export function isVesselCategory(key: CategoryKey): boolean {
  return String(key).startsWith(VESSEL_CATEGORY_PREFIX);
}

/**
 * Install this vessel's categories. Called once at load, before the register is
 * read, and again whenever the list changes or arrives from another device.
 *
 * ORDER MATTERS at startup: `storage.loadAll` enumerates CATEGORIES to decide
 * which buckets to read, so a register loaded before its categories were
 * installed simply would not see those items.
 */
export function setVesselCategories(list: CategoryMeta[]): void {
  const own = list.filter((c) => isVesselCategory(c.key));
  CATEGORIES.length = 0;
  CATEGORIES.push(...BUILT_IN, ...own);
  for (const k of Object.keys(CATEGORY_MAP)) delete CATEGORY_MAP[k];
  for (const c of CATEGORIES) CATEGORY_MAP[c.key] = c;
}

export function categoriesByGroup(group: Group): CategoryMeta[] {
  return CATEGORIES.filter((c) => c.group === group);
}
