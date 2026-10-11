// ===================================
// The round this device is working in — chosen on the round's screen, kept
// across launches, so a label scanned on the way round signs into it. One per
// device; the round itself (and its progress) is shared by every device.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'msm:active_round';
let current: string | null = null;
let loaded = false;
const listeners = new Set<(id: string | null) => void>();

export async function loadActiveRound(): Promise<string | null> {
  if (!loaded) {
    current = await AsyncStorage.getItem(KEY).catch(() => null);
    loaded = true;
  }
  return current;
}

export async function setActiveRound(id: string | null): Promise<void> {
  current = id;
  loaded = true;
  if (id) await AsyncStorage.setItem(KEY, id).catch(() => {});
  else await AsyncStorage.removeItem(KEY).catch(() => {});
  listeners.forEach((l) => l(id));
}

/** The active round id, live. */
export function useActiveRound(): string | null {
  const [id, setId] = useState<string | null>(current);
  useEffect(() => {
    void loadActiveRound().then(setId);
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return id;
}
