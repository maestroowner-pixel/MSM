// ===================================
// Local storage wrapper
// One AsyncStorage key per category array, plus vessel_info.
// Flat-key pattern (like MHM's `medicines` / `issue_log`).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState, normalizeCompressorState } from '../types/compressor';
import { Inspection } from '../types/inspection';
import { CrewMember } from '../types/crew';
import { CATEGORIES } from '../constants/categories';

const PREFIX = 'msm:';
export const CERTIFICATES_KEY = `${PREFIX}certificates`;
export const COMPRESSOR_KEY = `${PREFIX}compressor`;
export const PREFS_KEY = `${PREFIX}prefs`;
export const INSPECTIONS_KEY = `${PREFIX}inspections`;
export const CREW_KEY = `${PREFIX}crew`;

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
  await saveCrew(list.filter((c) => c.id !== id));
}

// ---- Reset -----------------------------------------------------------------

/**
 * Wipe all user data: every category, certificates, compressor logs, the
 * inspection trail, the crew list and vessel info. Keeps device preferences
 * (`msm:prefs`) and legal consent.
 */
export async function resetAllData(): Promise<void> {
  const keys = [
    ...CATEGORIES.map((c) => catKey(c.key)),
    CERTIFICATES_KEY,
    COMPRESSOR_KEY,
    INSPECTIONS_KEY,
    CREW_KEY,
    VESSEL_KEY,
  ];
  await AsyncStorage.multiRemove(keys);
}
