// ===================================
// Local storage wrapper
// One AsyncStorage key per category array, plus vessel_info.
// Flat-key pattern (like MHM's `medicines` / `issue_log`).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState, normalizeCompressorState } from '../types/compressor';
import { Inspection, InspectionPeriod } from '../types/inspection';
import { CrewMember } from '../types/crew';
import { ChecklistTemplate, VESSEL_TEMPLATE_PREFIX } from '../constants/checklists';
import { CATEGORIES, CategoryMeta, setVesselCategories } from '../constants/categories';
import { uid } from '../utils/id';

const PREFIX = 'msm:';
export const CERTIFICATES_KEY = `${PREFIX}certificates`;
export const COMPRESSOR_KEY = `${PREFIX}compressor`;
export const PREFS_KEY = `${PREFIX}prefs`;
export const INSPECTIONS_KEY = `${PREFIX}inspections`;
export const CREW_KEY = `${PREFIX}crew`;
export const REST_KEY = `${PREFIX}rest`;
export const PMS_MACHINES_KEY = `${PREFIX}pms_machines`;
export const PMS_JOBS_KEY = `${PREFIX}pms_jobs`;
export const PMS_DONE_KEY = `${PREFIX}pms_done`;
export const PMS_DEFERRALS_KEY = `${PREFIX}pms_deferrals`;
export const PMS_DEFECTS_KEY = `${PREFIX}pms_defects`;
export const PMS_PROJECTS_KEY = `${PREFIX}pms_projects`;
export const SPARES_KEY = `${PREFIX}spares`;
export const SPARE_MOVES_KEY = `${PREFIX}spare_moves`;
export const DOCS_KEY = `${PREFIX}ism_docs`;
export const CREW_PRIVATE_KEY = `${PREFIX}crew_private`;
export const PERMITS_KEY = `${PREFIX}permits`;
export const RISKS_KEY = `${PREFIX}risk_assessments`;
export const FUEL_TANKS_KEY = `${PREFIX}fuel_tanks`;
export const FUEL_READINGS_KEY = `${PREFIX}fuel_readings`;
export const FUEL_BUNKERS_KEY = `${PREFIX}fuel_bunkers`;
export const FUEL_TRANSFERS_KEY = `${PREFIX}fuel_transfers`;
export const FUEL_DAILY_KEY = `${PREFIX}fuel_daily`;
export const GARBAGE_KEY = `${PREFIX}garbage`;
export const GARBAGE_SIGNS_KEY = `${PREFIX}garbage_signs`;
export const ORB_KEY = `${PREFIX}orb`;
export const ORB_SIGNS_KEY = `${PREFIX}orb_signs`;
export const ROUNDS_KEY = `${PREFIX}rounds`;
export const SEWAGE_KEY = `${PREFIX}sewage`;
export const SEWAGE_SIGNS_KEY = `${PREFIX}sewage_signs`;
export const BALLAST_KEY = `${PREFIX}ballast`;
export const BALLAST_SIGNS_KEY = `${PREFIX}ballast_signs`;
export const SOPEP_ITEMS_KEY = `${PREFIX}sopep_items`;
export const SOPEP_LOCKERS_KEY = `${PREFIX}sopep_lockers`;
export const SOPEP_CHECKS_KEY = `${PREFIX}sopep_checks`;
export const SOPEP_DRILLS_KEY = `${PREFIX}sopep_drills`;
export const VISITORS_KEY = `${PREFIX}visitors`;
export const SECURITY_LEVEL_KEY = `${PREFIX}security_levels`;
export const SECURITY_DRILLS_KEY = `${PREFIX}security_drills`;
export const CREW_MOVES_KEY = `${PREFIX}crew_moves`;
export const SURVEYS_KEY = `${PREFIX}surveys`;
export const SURVEYS_DONE_KEY = `${PREFIX}surveys_done`;
export const OBSERVATIONS_KEY = `${PREFIX}observations`;
export const NCS_KEY = `${PREFIX}ncs`;
export const DRILLS_KEY = `${PREFIX}drills`;
export const DRILL_PLANS_KEY = `${PREFIX}drill_plans`;
export const MED_ITEMS_KEY = `${PREFIX}med_items`;
export const MED_MOVES_KEY = `${PREFIX}med_moves`;
export const MED_TREATMENTS_KEY = `${PREFIX}med_treatments`;
export const PASSENGERS_KEY = `${PREFIX}passengers`;
export const SAFETY_MEETINGS_KEY = `${PREFIX}safety_meetings`;
export const DP_CHECKS_KEY = `${PREFIX}dp_checks`;
export const DP_DAYS_KEY = `${PREFIX}dp_days`;
export const DP_INFO_KEY = `${PREFIX}dp_info`;
export const DP_TEMPLATES_KEY = `${PREFIX}dp_templates`;
export const STORE_ITEMS_KEY = `${PREFIX}store_items`;
export const STORE_MOVES_KEY = `${PREFIX}store_moves`;
export const STORE_ROOMS_KEY = `${PREFIX}store_rooms`;
export const SOPEP_DOCS_KEY = `${PREFIX}sopep_docs`;
export const SSP_DOCS_KEY = `${PREFIX}ssp_docs`;
export const SEARCH_PLAN_KEY = `${PREFIX}search_plan`;
export const SEARCHES_KEY = `${PREFIX}searches`;
// Security rounds and the key register (types/patrols.ts, types/keys.ts; 17 Oct 2026).
export const CHECKPOINTS_KEY = `${PREFIX}checkpoints`;
export const PATROL_PLANS_KEY = `${PREFIX}patrol_plans`;
export const PATROLS_KEY = `${PREFIX}patrols`;
export const KEYS_KEY = `${PREFIX}key_register`;
export const KEY_MOVES_KEY = `${PREFIX}key_moves`;
export const PASSENGERS_PRIVATE_KEY = `${PREFIX}passengers_private`;
export const MED_ORDERS_KEY = `${PREFIX}med_orders`;
export const MED_CHECKS_KEY = `${PREFIX}med_checks`;
export const DOC_ACKS_KEY = `${PREFIX}ism_doc_acks`;
/** The vessel's "scan before you sign" rule, as this device last knew it. */
export const SIGNING_POLICY_KEY = `${PREFIX}signing_policy`;
/** What this vessel has archived and what the last sweep did — services/photoArchive.ts. */
export const PHOTO_ARCHIVE_KEY = `${PREFIX}photo_archive`;
/** Modules switched on for THIS vessel only (constants/modules `setVesselModules`), as last seen. */
export const VESSEL_MODULES_KEY = `${PREFIX}vessel_modules`;
/** Engine-room rounds template and signed entries (backlog #9, Oct 2026). */
export const WATCH_TEMPLATES_KEY = `${PREFIX}watch_templates`;
export const WATCH_LOG_KEY = `${PREFIX}watch_log`;
export const DECK_LOG_KEY = `${PREFIX}deck_log`;
export const GMDSS_KEY = `${PREFIX}gmdss`;
export const INTERNAL_AUDITS_KEY = `${PREFIX}internal_audits`;
/** Shore movements and landing reports (#27, Oct 2026). */
export const ITEM_MOVEMENTS_KEY = `${PREFIX}item_movements`;
export const LANDINGS_KEY = `${PREFIX}landings`;
export const TEMPLATES_KEY = `${PREFIX}templates`;
export const CATEGORIES_KEY = `${PREFIX}categories`;
/** Purchase orders / requisitions by department (types/orders.ts). */
export const PURCHASE_ORDERS_KEY = `${PREFIX}purchase_orders`;
/** Named groups of purchase orders — charters, drydocks, etc. */
export const ORDER_GROUPS_KEY = `${PREFIX}order_groups`;
/** Galley (food & beverage) purchase orders — separate type from department POs. */
export const GALLEY_ORDERS_KEY = `${PREFIX}galley_orders`;
/**
 * CATEGORY BUCKETS THIS BUILD DOES NOT KNOW ABOUT — the keys, not the items.
 *
 * `loadAll` opens the buckets named in the registry, which is the right answer
 * for every screen: a category this build has no heading for cannot be drawn.
 * It is the WRONG answer for the register that goes to the vessel, because a
 * register assembled that way is a statement that those categories do not exist
 * — and the next device to pull it deletes them.
 *
 * That is not hypothetical. A module switched off in one build and on in another
 * (constants/modules.ts) makes the two disagree by eight whole categories, and a
 * vessel category created on one device is unknown to every other until the
 * categories collection catches up. Modelled on 30 Sep 2026: the website adds one
 * extinguisher and the vessel's whole lifting register is gone.
 *
 * So a pull records the names of the buckets it wrote but could not name, and a
 * push carries them through untouched. The items are never parsed, never shown
 * and never merged by this device — it is a courier, not a reader.
 */
export const FOREIGN_CATEGORIES_KEY = `${PREFIX}foreign_categories`;

/** Bucket keys held on this device that the registry has no heading for. */
export async function loadForeignCategories(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FOREIGN_CATEGORIES_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const known = new Set(CATEGORIES.map((c) => String(c.key)));
    // A key that has since become known is no longer foreign — the module was
    // switched on, or the category heading arrived.
    return Array.isArray(list) ? list.filter((k) => typeof k === 'string' && !known.has(k)) : [];
  } catch {
    return [];
  }
}

export async function saveForeignCategories(keys: string[]): Promise<void> {
  const known = new Set(CATEGORIES.map((c) => String(c.key)));
  const list = Array.from(new Set(keys.filter((k) => !known.has(k)))).sort();
  try {
    if (list.length) await AsyncStorage.setItem(FOREIGN_CATEGORIES_KEY, JSON.stringify(list));
    else await AsyncStorage.removeItem(FOREIGN_CATEGORIES_KEY);
  } catch {
    /* a device that cannot remember them simply stops forwarding them */
  }
}

/** The foreign buckets themselves, read straight through without interpretation. */
export async function loadForeignBuckets(): Promise<Record<string, EquipmentItem[]>> {
  const keys = await loadForeignCategories();
  if (!keys.length) return {};
  const pairs = await AsyncStorage.multiGet(keys.map((k) => `${PREFIX}${k}`));
  const out: Record<string, EquipmentItem[]> = {};
  keys.forEach((k, i) => {
    const raw = pairs[i]?.[1];
    try {
      const items = raw ? (JSON.parse(raw) as EquipmentItem[]) : [];
      if (items.length) out[k] = items;
    } catch {
      /* unreadable: forward nothing rather than something wrong */
    }
  });
  return out;
}

export interface VesselInfo {
  vessel_name?: string;
  imo?: string;
  flag?: string;
  call_sign?: string;
  mmsi?: string;
  /** Where the vessel lies now — the gangway logbook's port and berth (11 Oct 2026). */
  port?: string;
  berth?: string;
  /** Ship's time as an offset from UTC ("+02:00"); unset — the device's own zone (utils/shipTime.ts). */
  ship_utc_offset?: string;
  /** Clock changes, planned and made — the history behind ship's time (utils/shipTime.ts, 25 Oct 2026). */
  ship_time_changes?: import('../utils/shipTime').ClockChange[];
}

export const VESSEL_KEY = `${PREFIX}vessel_info`;

function catKey(category: CategoryKey): string {
  return `${PREFIX}${category}`;
}

export async function loadCategory(category: CategoryKey): Promise<EquipmentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(catKey(category));
    return raw ? (JSON.parse(raw) as EquipmentItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveCategory(category: CategoryKey, items: EquipmentItem[]): Promise<void> {
  await AsyncStorage.setItem(catKey(category), JSON.stringify(items));
}

/** Load all categories at once, keyed by CategoryKey. */
export async function loadAll(): Promise<Record<CategoryKey, EquipmentItem[]>> {
  const keys = CATEGORIES.map((c) => catKey(c.key));
  const pairs = await AsyncStorage.multiGet(keys);
  const result = {} as Record<CategoryKey, EquipmentItem[]>;
  CATEGORIES.forEach((c, i) => {
    const raw = pairs[i]?.[1];
    try {
      result[c.key] = raw ? (JSON.parse(raw) as EquipmentItem[]) : [];
    } catch {
      result[c.key] = [];
    }
  });
  return result;
}

/**
 * Every bucket on this device, including the ones the registry cannot name.
 *
 * For anything that COPIES the register whole — the sync payload, a .msm backup,
 * a local snapshot — rather than anything that draws it. A copy taken through
 * `loadAll` silently drops a module's or another device's categories, and
 * restoring it later is a deletion nobody asked for.
 */
export async function loadAllWithForeign(): Promise<Record<string, EquipmentItem[]>> {
  const own = (await loadAll()) as Record<string, EquipmentItem[]>;
  const foreign = await loadForeignBuckets();
  const out: Record<string, EquipmentItem[]> = { ...own };
  for (const [k, items] of Object.entries(foreign)) if (out[k] === undefined) out[k] = items;
  return out;
}

/** Flat list of every item across all categories. */
export async function loadFlat(): Promise<EquipmentItem[]> {
  const all = await loadAll();
  return CATEGORIES.flatMap((c) => all[c.key]);
}

/** Upsert a single item into its category bucket. */
export async function upsertItem(item: EquipmentItem): Promise<void> {
  const items = await loadCategory(item.category);
  const idx = items.findIndex((x) => x.id === item.id);
  const next = { ...item, updatedAt: Date.now() };
  if (idx >= 0) items[idx] = next;
  else items.push(next);
  await saveCategory(item.category, items);
}

export async function deleteItem(category: CategoryKey, id: string): Promise<void> {
  const items = await loadCategory(category);
  await saveCategory(
    category,
    items.filter((x) => x.id !== id)
  );
}

/**
 * Move an item to another category, keeping everything that is attached to it.
 *
 * WHAT TRAVELS, and why it is safe: the item keeps its **id**, so its QR label
 * still resolves, its photos and documents come with it, every certificate that
 * covers it still does (a certificate links by item id, not by category), and its
 * inspection history is found by `forItem`, which asks by item id too.
 *
 * WHAT DOES NOT MOVE: the signed records' own `category`. They are append-only
 * (types/inspection.ts) and a round WAS carried out under the category it was
 * signed in, against that category's checklist — so an old round stays filed
 * where it happened, and the category report for last month still reads as it did
 * when it was printed. From the move on, the item owes the NEW category's rounds.
 *
 * Asked for by a vessel whose Working Aloft gear sat in LSA because there was
 * nowhere better for it, on the day there finally was (29 Sep 2026).
 *
 * The write order is deliberate: add to the new bucket first, then remove from
 * the old. Interrupted between the two the item exists twice, which the register
 * merge settles and a person can see and fix; the other order loses it.
 */
export async function moveItem(item: EquipmentItem, to: CategoryKey): Promise<EquipmentItem> {
  if (!to || to === item.category) return item;
  const moved: EquipmentItem = { ...item, category: to, updatedAt: Date.now() };
  const target = await loadCategory(to);
  await saveCategory(to, [...target.filter((x) => x.id !== item.id), moved]);
  await deleteItem(item.category, item.id);
  return moved;
}

/** Replace a whole category bucket (used by the importer). */
export async function replaceCategory(category: CategoryKey, items: EquipmentItem[]): Promise<void> {
  await saveCategory(category, items);
}

export async function loadVessel(): Promise<VesselInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(VESSEL_KEY);
    return raw ? (JSON.parse(raw) as VesselInfo) : null;
  } catch {
    return null;
  }
}

export async function saveVessel(info: VesselInfo): Promise<void> {
  await AsyncStorage.setItem(VESSEL_KEY, JSON.stringify(info));
}

/** Total item count across all categories. */
export async function totalCount(): Promise<number> {
  const flat = await loadFlat();
  return flat.length;
}

// ---- Certificates ----------------------------------------------------------

export async function loadCertificates(): Promise<Certificate[]> {
  try {
    const raw = await AsyncStorage.getItem(CERTIFICATES_KEY);
    return raw ? (JSON.parse(raw) as Certificate[]) : [];
  } catch {
    return [];
  }
}

export async function saveCertificates(list: Certificate[]): Promise<void> {
  await AsyncStorage.setItem(CERTIFICATES_KEY, JSON.stringify(list));
}

export async function upsertCertificate(cert: Certificate): Promise<void> {
  const list = await loadCertificates();
  const idx = list.findIndex((c) => c.id === cert.id);
  const next = { ...cert, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveCertificates(list);
}

export async function deleteCertificate(id: string): Promise<void> {
  const list = await loadCertificates();
  await saveCertificates(list.filter((c) => c.id !== id));
}

// ---- BA compressor logs (up to MAX_COMPRESSORS) ----------------------------

export async function loadCompressor(): Promise<CompressorState> {
  try {
    const raw = await AsyncStorage.getItem(COMPRESSOR_KEY);
    return normalizeCompressorState(raw ? JSON.parse(raw) : null);
  } catch {
    return { compressors: [] };
  }
}

export async function saveCompressor(state: CompressorState): Promise<void> {
  await AsyncStorage.setItem(COMPRESSOR_KEY, JSON.stringify(state));
}

// ---- Device preferences (local-only, not synced/backed up) -----------------

export interface Prefs {
  compressorEnabled?: boolean; // show the BA compressor log (FIFI outfit)
  notificationsEnabled?: boolean; // schedule expiry reminders (60/30/7 days)
  /** Per-stock-size label fine-tuning from the Label screen (QR size, fonts, QR
   *  position), keyed by LabelSize. Missing = that stock prints at layout defaults. */
  labelStyles?: Record<string, import('./qrLabel').LabelOverrides>;
  /** Per-ITEM printed-text overrides (custom sticker name + extra line), keyed by
   *  item id. Kept out of the register; local to this device. */
  labelText?: Record<string, import('./qrLabel').LabelText>;
  /** The roll actually loaded in a third-party thermal printer, in millimetres.
   *  Device-local: it describes the hardware on this desk, not the vessel. */
  labelCustom?: import('./qrLabel').CustomStock;
  /** Where labels print: 'roll' (thermal, one per page) or 'a4' (grid on a plain
   *  A4 sheet for an office printer). Remembered so a keeper picks it once. */
  labelPageMode?: import('./qrLabel').PageMode;
  /** How inspection photos may leave the vessel — see services/photoQueue.ts.
   *  Device-local, and defaults to Wi-Fi-only: the safe answer for a ship, where
   *  the alternative is somebody discovering the airtime bill after the fact. */
  photoUpload?: import('./photoQueue').UploadPolicy;
  /** Crew member who signed the last inspection ON THIS DEVICE — the default
   *  signer next time. Device-local on purpose: the bridge tablet and an
   *  engineer's phone should each default to whoever actually uses them. */
  lastCrewId?: string;
  /** Every sound cue off — the bell, the success and error chimes. A user working
   *  through forty inspections asked for it. Device-local. */
  soundsMuted?: boolean;
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ---- Inspections (append-only audit trail) ---------------------------------
// Records are added and never rewritten (see types/inspection.ts), so the only
// mutating call besides `append` is the one that closes a defect. Kept newest
// first in storage so the common reads — an item's history, this month's round —
// don't have to sort the whole trail.

export async function loadInspections(): Promise<Inspection[]> {
  try {
    const raw = await AsyncStorage.getItem(INSPECTIONS_KEY);
    const list = raw ? (JSON.parse(raw) as Inspection[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveInspections(list: Inspection[]): Promise<void> {
  await AsyncStorage.setItem(INSPECTIONS_KEY, JSON.stringify(list));
}

/** Add one signed record. Ignores a duplicate id (a double-tapped Save). */
export async function appendInspection(insp: Inspection): Promise<void> {
  const list = await loadInspections();
  if (list.some((i) => i.id === insp.id)) return;
  await saveInspections([insp, ...list]);
}

/**
 * Write back one record. The ONLY legitimate use is closing (or re-opening) a
 * defect — everything else about a signed record is immutable, and a correction
 * is a new inspection.
 */
export async function updateInspection(insp: Inspection): Promise<void> {
  const list = await loadInspections();
  const idx = list.findIndex((i) => i.id === insp.id);
  if (idx < 0) return;
  list[idx] = { ...insp, updatedAt: Date.now() };
  await saveInspections(list);
}

// ---- Categories the vessel invented ----------------------------------------
// The app ships 23; a vessel that inspects emergency lighting or escape routes
// needs headings nobody else asked for. These are stored, synced and installed
// into the registry at load — see setVesselCategories for why the ORDER of that
// matters more than it looks.

export async function loadVesselCategories(): Promise<CategoryMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
    const list = raw ? (JSON.parse(raw) as CategoryMeta[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Save AND install, so no caller can leave the two out of step. */
export async function saveVesselCategories(list: CategoryMeta[]): Promise<void> {
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
  setVesselCategories(list);
}

export async function upsertVesselCategory(meta: CategoryMeta): Promise<void> {
  const list = await loadVesselCategories();
  const idx = list.findIndex((c) => c.key === meta.key);
  const next = { ...meta, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveVesselCategories(list);
}

/**
 * Forget a category. Its ITEMS are deliberately left in storage rather than
 * deleted: removing a heading is a tidying-up decision, and it must not be a way
 * to destroy a hundred inspected items — with their signed history still
 * pointing at them — by tapping one button. Re-adding the heading brings them
 * straight back.
 */
export async function deleteVesselCategory(key: CategoryKey): Promise<void> {
  await saveVesselCategories((await loadVesselCategories()).filter((c) => c.key !== key));
}

// ---- Checklist templates the vessel wrote ----------------------------------
// Built-in templates live in constants/checklists.ts and cannot change under a
// signature. These are the vessel's own, edited aboard and synced like the crew
// list, and they REPLACE the built-in for their category and period.

export async function loadTemplates(): Promise<ChecklistTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
    const list = raw ? (JSON.parse(raw) as ChecklistTemplate[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveTemplates(list: ChecklistTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

/** Write one template, stamping `updatedAt` — the key both merges settle on. */
export async function upsertTemplate(template: ChecklistTemplate): Promise<void> {
  const list = await loadTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const next = { ...template, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveTemplates(list);
}

/**
 * Withdraw the vessel's wording, so the category falls back to its built-in
 * checklist — as a TOMBSTONE, not a deletion.
 *
 * Dropping the row is safe as far as the trail goes: every record signed against
 * it carries its own copy of the questions. It was never safe as far as SYNC goes.
 * Templates merge by union of ids (`mergeInspections`'s sibling `mergeTemplates`)
 * and nothing deletes the vessel's copy in Firestore, so a row deleted on the
 * bridge came straight back on the next pull and the standard checklist was
 * restored for about a minute. Keeping the row with `standard: true` carries the
 * withdrawal to the other devices instead, and it can be undone.
 */
export async function deleteTemplate(id: string): Promise<void> {
  const list = await loadTemplates();
  const row = list.find((t) => t.id === id);
  if (!row) return;
  await upsertTemplate({ ...row, standard: true, lines: [] });
}

/**
 * Switch a round on or off for a category — which frequencies this ship works to.
 *
 * Writes a row for the (category, period) even when the vessel never worded that
 * checklist, because the decision has to reach the other devices; a row with no
 * lines is a decision about the round, not a wording of it (see `roundsFor`).
 */
export async function setRoundEnabled(
  category: CategoryKey,
  period: InspectionPeriod,
  on: boolean
): Promise<void> {
  const list = await loadTemplates();
  const row = list
    .filter((t) => t.category === category && t.period === period)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  if (row) {
    await upsertTemplate({ ...row, off: !on });
    return;
  }
  await upsertTemplate({
    id: `${VESSEL_TEMPLATE_PREFIX}${category}.${period}.${uid()}`,
    version: 1,
    category,
    period,
    title: `${period} round`,
    lines: [],
    off: !on,
  });
}

// ---- Lists of records (planned maintenance) ---------------------------------

export async function loadList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function upsertInList<T extends { id: string }>(key: string, row: T): Promise<void> {
  const list = await loadList<T>(key);
  const i = list.findIndex((r) => r.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  await saveList(key, list);
}

/** Many rows into one list in a single write (an import, a scale, an inventory). */
export async function upsertManyInList<T extends { id: string }>(key: string, rows: T[]): Promise<void> {
  if (!rows.length) return;
  const list = await loadList<T>(key);
  const at = new Map(list.map((r, i) => [r.id, i]));
  for (const row of rows) {
    const i = at.get(row.id);
    if (i != null) list[i] = row;
    else {
      at.set(row.id, list.length);
      list.push(row);
    }
  }
  await saveList(key, list);
}

// ---- Hours of rest ----------------------------------------------------------

export async function loadRest(): Promise<import('../types/rest').RestDay[]> {
  try {
    const raw = await AsyncStorage.getItem(REST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveRest(list: import('../types/rest').RestDay[]): Promise<void> {
  await AsyncStorage.setItem(REST_KEY, JSON.stringify(list));
}

export async function upsertRestDay(day: import('../types/rest').RestDay): Promise<void> {
  const list = await loadRest();
  const i = list.findIndex((d) => d.id === day.id);
  if (i >= 0) list[i] = day;
  else list.push(day);
  await saveRest(list);
}

// ---- Crew (who signs) ------------------------------------------------------

export async function loadCrew(): Promise<CrewMember[]> {
  try {
    const raw = await AsyncStorage.getItem(CREW_KEY);
    const list = raw ? (JSON.parse(raw) as CrewMember[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveCrew(list: CrewMember[]): Promise<void> {
  await AsyncStorage.setItem(CREW_KEY, JSON.stringify(list));
}

export async function upsertCrewMember(member: CrewMember): Promise<void> {
  const list = await loadCrew();
  const idx = list.findIndex((c) => c.id === member.id);
  const next = { ...member, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveCrew(list);
}

/**
 * Remove someone from the crew list. Their past signatures are unaffected —
 * those hold a name snapshot, not a reference (see types/crew.ts) — but
 * retiring with `active: false` is usually the better move, since it keeps the
 * link live for the history screens.
 */
export async function deleteCrewMember(id: string): Promise<void> {
  const list = await loadCrew();
  // A tombstone, not a filter — see `CrewMember.deleted`. Filtering only ever
  // removed the entry from THIS device; the vessel handed it straight back.
  const now = Date.now();
  await saveCrew(list.map((c) => (c.id === id ? { ...c, deleted: true, active: false, updatedAt: now } : c)));
}

/** Tombstone the whole list at once — what "Reset all data" needs on a syncing Master. */
export async function tombstoneCrew(): Promise<CrewMember[]> {
  const now = Date.now();
  const list = (await loadCrew()).map((c) => ({ ...c, deleted: true, active: false, updatedAt: now }));
  await saveCrew(list);
  return list;
}

// ---- Reset -----------------------------------------------------------------

/**
 * Wipe all user data: every category, certificates, compressor logs, the
 * inspection trail, the crew list and vessel info. Keeps device preferences
 * (`msm:prefs`) and legal consent.
 */
export async function loadSigningPolicy(): Promise<import('./signingPolicy').SigningPolicy | null> {
  try {
    const raw = await AsyncStorage.getItem(SIGNING_POLICY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSigningPolicy(policy: import('./signingPolicy').SigningPolicy): Promise<void> {
  await AsyncStorage.setItem(SIGNING_POLICY_KEY, JSON.stringify(policy));
}

export async function loadVesselModules(): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(VESSEL_MODULES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveVesselModules(modules: Record<string, boolean>): Promise<void> {
  try {
    if (Object.keys(modules).length) await AsyncStorage.setItem(VESSEL_MODULES_KEY, JSON.stringify(modules));
    else await AsyncStorage.removeItem(VESSEL_MODULES_KEY);
  } catch {
    /* the cache is a convenience: the vessel document is the truth */
  }
}

export async function loadPhotoArchive(): Promise<import('./photoArchive').PhotoArchiveState | null> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePhotoArchive(state: import('./photoArchive').PhotoArchiveState): Promise<void> {
  await AsyncStorage.setItem(PHOTO_ARCHIVE_KEY, JSON.stringify(state));
}

export async function resetAllData(): Promise<void> {
  const foreign = await loadForeignCategories();
  const keys = [
    ...CATEGORIES.map((c) => catKey(c.key)),
    // Including the buckets this build cannot name: leaving them behind would
    // mean "wipe this device" quietly sent them back to the vessel afterwards.
    ...foreign.map((k) => `${PREFIX}${k}`),
    FOREIGN_CATEGORIES_KEY,
    CERTIFICATES_KEY,
    COMPRESSOR_KEY,
    INSPECTIONS_KEY,
    CREW_KEY,
    REST_KEY,
    PMS_MACHINES_KEY,
    PMS_JOBS_KEY,
    PMS_DONE_KEY,
    PMS_DEFERRALS_KEY,
    PMS_DEFECTS_KEY,
    PMS_PROJECTS_KEY,
    SPARES_KEY,
    SPARE_MOVES_KEY,
    DOCS_KEY,
    CREW_PRIVATE_KEY,
    PERMITS_KEY,
    RISKS_KEY,
    FUEL_TANKS_KEY,
    FUEL_READINGS_KEY,
    FUEL_BUNKERS_KEY,
    FUEL_TRANSFERS_KEY,
    FUEL_DAILY_KEY,
    GARBAGE_KEY,
    GARBAGE_SIGNS_KEY,
    ORB_KEY,
    ORB_SIGNS_KEY,
    ROUNDS_KEY,
    SEWAGE_KEY,
    SEWAGE_SIGNS_KEY,
    BALLAST_KEY,
    BALLAST_SIGNS_KEY,
    SOPEP_ITEMS_KEY,
    SOPEP_LOCKERS_KEY,
    SOPEP_CHECKS_KEY,
    SOPEP_DRILLS_KEY,
    VISITORS_KEY,
    SECURITY_LEVEL_KEY,
    SECURITY_DRILLS_KEY,
    CREW_MOVES_KEY,
    SURVEYS_KEY,
    SURVEYS_DONE_KEY,
    OBSERVATIONS_KEY,
    NCS_KEY,
    DRILLS_KEY,
    MED_ITEMS_KEY,
    MED_MOVES_KEY,
    MED_TREATMENTS_KEY,
    PASSENGERS_KEY,
    SAFETY_MEETINGS_KEY,
    DP_CHECKS_KEY,
    DP_DAYS_KEY,
    DP_INFO_KEY,
    DP_TEMPLATES_KEY,
    STORE_ITEMS_KEY,
    STORE_MOVES_KEY,
    STORE_ROOMS_KEY,
    SOPEP_DOCS_KEY,
    SSP_DOCS_KEY,
    SEARCH_PLAN_KEY,
    SEARCHES_KEY,
    CHECKPOINTS_KEY,
    PATROL_PLANS_KEY,
    PATROLS_KEY,
    KEYS_KEY,
    KEY_MOVES_KEY,
    'msm:patrol_live', // services/patrolLive.ts — a round under way on this device
    'msm:crew_photos', // services/crewPhotos.ts — ID card photos, this device only
    DRILL_PLANS_KEY,
    PASSENGERS_PRIVATE_KEY,
    MED_ORDERS_KEY,
    MED_CHECKS_KEY,
    DOC_ACKS_KEY,
    'msm:docfiles_pending',
    VESSEL_KEY,
    SIGNING_POLICY_KEY,
    PHOTO_ARCHIVE_KEY,
    VESSEL_MODULES_KEY,
    'msm:handover_draft', // services/handover.ts — the outgoing officer's notes
  ];
  await AsyncStorage.multiRemove(keys);
}
