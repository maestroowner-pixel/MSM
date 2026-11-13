// ===================================
// PSC walk-round — the marks on this device and the PDF (services/pscWalk.ts is
// the pure half).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { PSC_WALK_KEY, PscWalk, emptyWalk, readWalk, walkPages } from './pscWalk';

export async function loadWalk(): Promise<PscWalk> {
  try {
    const raw = await AsyncStorage.getItem(PSC_WALK_KEY);
    return raw ? readWalk(JSON.parse(raw), Date.now()) : emptyWalk(Date.now());
  } catch {
    return emptyWalk(Date.now());
  }
}

export async function saveWalk(w: PscWalk): Promise<void> {
  try {
    await AsyncStorage.setItem(PSC_WALK_KEY, JSON.stringify(w));
  } catch {
    /* a draft; the screen still holds it */
  }
}

export async function exportWalkPdf(w: PscWalk, vessel: VesselInfo | null) {
  const now = Date.now();
  return exportPmsHistory('PSC walk-round', `PSC walk-round ${new Date(now).toISOString().slice(0, 10)}`, vessel, walkPages(w, now));
}
