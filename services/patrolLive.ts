// ===================================
// A security round under way on this device (types/patrols.ts) — kept until it
// is finished and filed, so the app can be closed in the middle and a scan from
// the scanner (screens/ScanSc) lands in it. One at a time per device.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Checkpoint, PatrolVisit } from '../types/patrols';

export interface LivePatrol {
  planId: string;
  slot?: string;
  date: string;
  startedAt: number;
  dutiesDone: boolean;
  visits: PatrolVisit[];
  remarks: string;
}

const KEY = 'msm:patrol_live';
const listeners = new Set<(p: LivePatrol | null) => void>();

export async function loadLive(): Promise<LivePatrol | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LivePatrol) : null;
  } catch {
    return null;
  }
}

export async function saveLive(p: LivePatrol | null): Promise<void> {
  if (p) await AsyncStorage.setItem(KEY, JSON.stringify(p));
  else await AsyncStorage.removeItem(KEY);
  listeners.forEach((f) => f(p));
}

export function onLive(f: (p: LivePatrol | null) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/**
 * A checkpoint scanned: recorded in the round under way. Null when no round is
 * under way; `already` when it was scanned on this round before (the first time
 * stands).
 */
export async function visit(c: Checkpoint, how: PatrolVisit['how'], at = Date.now()): Promise<{ live: LivePatrol; already: boolean } | null> {
  const live = await loadLive();
  if (!live) return null;
  if (live.visits.some((v) => v.checkpointId === c.id)) return { live, already: true };
  const next = { ...live, visits: [...live.visits, { checkpointId: c.id, code: c.code, name: c.name, at, how }] };
  await saveLive(next);
  return { live: next, already: false };
}
