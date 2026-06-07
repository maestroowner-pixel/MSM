// ===================================
// Local storage wrapper
// One AsyncStorage key per category array, plus vessel_info.
// Flat-key pattern (like MHM's `medicines` / `issue_log`).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState, normalizeCompressorState } from '../types/compressor';
import { CATEGORIES } from '../constants/categories';

const PREFIX = 'msm:';
export const CERTIFICATES_KEY = `${PREFIX}certificates`;
export const COMPRESSOR_KEY = `${PREFIX}compressor`;
export const PREFS_KEY = `${PREFIX}prefs`;

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

// ---- Reset -----------------------------------------------------------------

/**
 * Wipe all user data: every category, certificates, compressor logs and vessel
 * info. Keeps device preferences (`msm:prefs`) and legal consent.
 */
export async function resetAllData(): Promise<void> {
  const keys = [
    ...CATEGORIES.map((c) => catKey(c.key)),
    CERTIFICATES_KEY,
    COMPRESSOR_KEY,
    VESSEL_KEY,
  ];
  await AsyncStorage.multiRemove(keys);
}
