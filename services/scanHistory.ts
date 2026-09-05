// ===================================
// Scan history — what THIS device just scanned.
//
// Deliberately NOT a field on EquipmentItem. A scan says nothing about the
// equipment, only about the phone in someone's hand: it must not bump the item's
// `updatedAt` (which orders the Flagged strip and every "recently edited" view),
// must not travel to the vessel register through Firebase sync or a .msm backup,
// and — the reason this file exists — must not be lost when the item is saved.
//
// The item edit screen loads its draft from the register when it opens, so a
// timestamp written onto the item *while that screen is open* (which is exactly
// what a scan does: it writes, then opens the item) is silently overwritten by
// the next Save. Keeping the trail in its own key means the two writes can never
// collide.
//
// Newest first, one entry per item (a re-scan moves it back to the top rather
// than duplicating it), capped — this is a trail to walk back, not a log.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCAN_HISTORY_KEY = 'msm:recent_scans';

/** `at` = epoch ms of the scan. The item itself is resolved from the register. */
export interface ScanEntry {
  id: string;
  at: number;
}

const CAP = 50;

export async function loadScanHistory(): Promise<ScanEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as ScanEntry[]) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((e) => e && typeof e.id === 'string' && typeof e.at === 'number');
  } catch {
    return [];
  }
}

/** Record a scan; returns the new list so the caller can publish it without a re-read. */
export async function recordScan(id: string, at: number = Date.now()): Promise<ScanEntry[]> {
  const prev = await loadScanHistory();
  const next = [{ id, at }, ...prev.filter((e) => e.id !== id)].slice(0, CAP);
  await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
  return next;
}
