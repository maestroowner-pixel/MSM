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
/** The vessel's "scan before you sign" rule, as this device last knew it. */
export const SIGNING_POLICY_KEY = `${PREFIX}signing_policy`;
/** What this vessel has archived and what the last sweep did — services/photoArchive.ts. */
export const PHOTO_ARCHIVE_KEY = `${PREFIX}photo_archive`;
export const TEMPLATES_KEY = `${PREFIX}templates`;
export const CATEGORIES_KEY = `${PREFIX}categories`;
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
    VESSEL_KEY,
    SIGNING_POLICY_KEY,
    PHOTO_ARCHIVE_KEY,
  ];
  await AsyncStorage.multiRemove(keys);
}
