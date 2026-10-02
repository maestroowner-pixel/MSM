// ===================================
// Category registry
// Maps each CategoryKey -> display metadata, group, source sheet,
// which date field drives compliance, and whether it uses a monthly checklist.
// Drives the category grid, the importer, and the dashboard.
// ===================================

import { CategoryKey, Group } from '../types/equipment';
import { COLORS } from '../theme';
import { moduleOn } from './modules';
import { LIFTING_CATEGORIES } from './lifting';

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
  /**
   * The vessel does not use this category, so it is not shown (29 Sep 2026).
   *
   * Asked for in these words: several categories are not carried at all, and a
   * grid full of them buries the ones that are. Hiding is presentation and
   * nothing else — **the items, their history, labels and certificates stay
   * exactly where they are**, which is what makes it safe to hide something you
   * are not sure about. `CATEGORIES` therefore still contains hidden entries,
   * because `storage.loadAll` walks it to decide which buckets to read; it is the
   * screens and the reports that ask for `visibleCategories()`.
   */
  hidden?: boolean;
}

export const GROUP_COLORS: Record<Group, string> = {
  LSA: COLORS.lsa,
  FFE: COLORS.ffe,
  OTHER: COLORS.other,
  LIFTING: COLORS.lifting,
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
  // Escape hatches, escape routes and the gear along them — a vessel's SMS
  // inspects them on a round of their own, and filing them under "Other" made
  // that round invisible in the LSA report. Added 19 Sep 2026 at a customer's
  // request. No column in the reference workbook; the template offers a sheet.
  { key: 'emergency_escapes', label: 'Emergency Escapes', short: 'Escapes', group: 'LSA', sheet: 'Emergency Escapes', color: COLORS.lsa, emoji: '🚪', icon: 'door-open', dateField: 'nextInspection' },

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
/**
 * The registers this build has, in the order they are shown.
 *
 * Every screen asks for this rather than writing the list out: a group added
 * here appears in the grid, the checklists, the scan rules and the reports
 * without anybody having to remember those four places. A module that is off
 * (constants/modules.ts) is simply not in it.
 */
export const GROUP_ORDER: Group[] = ['LSA', 'FFE', 'OTHER', ...(moduleOn('lifting') ? (['LIFTING'] as Group[]) : [])];

export const GROUP_LABEL: Record<Group, string> = {
  LSA: 'Life-Saving Appliances',
  FFE: 'Fire-Fighting Equipment',
  OTHER: 'Other Safety Equipment',
  LIFTING: 'Lifting & Mooring',
};

/** Short form, for chips and report titles where the full name will not fit. */
export const GROUP_SHORT: Record<Group, string> = {
  LSA: 'LSA',
  FFE: 'FFE',
  OTHER: 'Other',
  LIFTING: 'Lifting',
};

export const CATEGORIES: CategoryMeta[] = [
  ...BUILT_IN,
  // Dark until the module is switched on — see constants/modules.ts.
  ...(moduleOn('lifting') ? LIFTING_CATEGORIES : []),
];

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<CategoryKey, CategoryMeta>
);

/**
 * A label reduced to something Excel will accept as a worksheet name.
 *
 * The rule matters in two places that must agree: the blank template names its
 * sheets with this, and the importer looks a category's sheet up by name. Let
 * them disagree — by storing a raw label with a slash in it, say — and the
 * template writes "Escape Routes   Walkways" while the importer hunts for
 * "Escape Routes / Walkways" and reports the sheet as missing.
 */
export function sheetSafeName(label: string): string {
  // Excel: max 31 chars, and none of : \ / ? * [ ]
  return label.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
}

/** A sheet name no other category is already using (case-insensitive). */
export function uniqueSheetName(label: string, exceptKey?: CategoryKey): string {
  const base = sheetSafeName(label) || 'Category';
  const taken = new Set(
    CATEGORIES.filter((c) => c.key !== exceptKey && c.sheet).map((c) => c.sheet!.toLowerCase())
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n++) {
    const tryName = `${base.slice(0, 28)} ${n}`;
    if (!taken.has(tryName.toLowerCase())) return tryName;
  }
  return base.slice(0, 28) + ' ' + Date.now().toString().slice(-2);
}

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
  // Rows whose key is a BUILT-IN one are not new categories, they are the
  // vessel's changes to a category the app ships: a name in the words the SMS
  // uses, a different icon, or hidden because the ship does not carry it.
  const changes = new Map(list.filter((c) => !isVesselCategory(c.key)).map((c) => [c.key, c]));
  CATEGORIES.length = 0;
  const shipped = [...BUILT_IN, ...(moduleOn('lifting') ? LIFTING_CATEGORIES : [])];
  CATEGORIES.push(...shipped.map((b) => applyVesselChange(b, changes.get(b.key))), ...own);
  for (const k of Object.keys(CATEGORY_MAP)) delete CATEGORY_MAP[k];
  for (const c of CATEGORIES) CATEGORY_MAP[c.key] = c;
}

/**
 * A built-in category as this vessel has it.
 *
 * `sheet` is deliberately NOT taken from the change. The importer matches a
 * workbook's tabs by that name and the blank template writes them from it, so
 * renaming "Lifebuoys" to "Lifebuoys (port side)" would leave every existing
 * spreadsheet importing into nothing. The vessel's name is what people read;
 * the sheet name is a key, and keys do not get renamed.
 */
function applyVesselChange(builtIn: CategoryMeta, change?: CategoryMeta): CategoryMeta {
  if (!change) return builtIn;
  return {
    ...builtIn,
    label: change.label?.trim() || builtIn.label,
    short: change.short?.trim() || change.label?.trim() || builtIn.short,
    icon: change.icon || builtIn.icon,
    group: change.group ?? builtIn.group,
    hidden: change.hidden,
    updatedAt: change.updatedAt,
  };
}

/**
 * The categories to SHOW — everything the vessel has not switched off.
 *
 * Every screen and every report asks for this; only storage walks `CATEGORIES`
 * itself, because a hidden category still has items that must be loaded, synced
 * and kept.
 */
export function visibleCategories(): CategoryMeta[] {
  return CATEGORIES.filter((c) => !c.hidden);
}

/** Is this category switched off for this vessel? */
export function isHiddenCategory(key: CategoryKey): boolean {
  return !!CATEGORY_MAP[key]?.hidden;
}

export function categoriesByGroup(group: Group): CategoryMeta[] {
  return CATEGORIES.filter((c) => c.group === group);
}
