// ===================================
// Handover — the draft on this device and the PDF (services/handover.ts is
// the pure half).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { Readiness } from './readiness';
import { HANDOVER_KEY, HandoverDraft, emptyDraft, handoverPages } from './handover';

export async function loadDraft(): Promise<HandoverDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(HANDOVER_KEY);
    return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export async function saveDraft(d: HandoverDraft | null): Promise<void> {
  try {
    if (d) await AsyncStorage.setItem(HANDOVER_KEY, JSON.stringify(d));
    else await AsyncStorage.removeItem(HANDOVER_KEY);
  } catch {
    /* a draft; the screen still holds it */
  }
}

export async function exportHandoverPdf(d: HandoverDraft, r: Readiness, vessel: VesselInfo | null) {
  const stem = `Handover ${r.today}${d.fromName.trim() ? ` ${d.fromName.trim()}` : ''}`;
  return exportPmsHistory('Handover at crew change', stem, vessel, handoverPages(d, r));
}
