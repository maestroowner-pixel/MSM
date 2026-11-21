// ===================================
// Is this device's clock on UTC? (ISO 21745:2019 §4.2.1, 21 Nov 2026: the record book's clock is kept to a UTC
// source; when that source is not available the internal clock is used and the book says so — the loss of
// synchronization and which time source is in use.)
//
// Every time in the app is the DEVICE's clock. Phones set it from the network or GNSS, a ship's laptop may not.
// So the app compares it with our own server's clock — the `Date` header of `/version.json` (same origin on
// the web; the hosting site on phones) — at start, every 30 minutes and when the app comes back to the front.
// Nothing is corrected: the times stay the device's, the top line only says how far that is from UTC and when
// it was last checked. Kept in memory only — after a restart at sea the honest answer is "not checked".
//
// `skewOf` and `clockState` are pure, in services/clockSkew (npm run check:clock).
// ===================================

import { AppState, Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { ClockCheck, skewOf } from './clockSkew';
export * from './clockSkew';

const EVERY_MS = 30 * 60_000;

// ---- the check itself (not pure) ----

const URL_NATIVE = 'https://app.ismpilot.com/version.json';
let last: ClockCheck | null = null;
let running: Promise<void> | null = null;
let started = false;
const listeners = new Set<(c: ClockCheck | null) => void>();

export async function checkClock(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const url = Platform.OS === 'web' ? `/version.json?clock=${Date.now()}` : `${URL_NATIVE}?clock=${Date.now()}`;
      const sent = Date.now();
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' } as RequestInit);
      const received = Date.now();
      const skew = skewOf(res.headers.get('date'), sent, received);
      if (skew != null) {
        last = { at: received, skewMs: skew };
        listeners.forEach((l) => l(last));
      }
    } catch {
      // No connection: the last check stands, and grows old.
    } finally {
      running = null;
    }
  })();
  return running;
}

function start() {
  if (started) return;
  started = true;
  void checkClock();
  setInterval(() => void checkClock(), EVERY_MS);
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void checkClock();
  });
}

/** The latest check, re-rendering when a new one comes in. */
export function useClockCheck(): ClockCheck | null {
  const [c, setC] = useState<ClockCheck | null>(last);
  useEffect(() => {
    start();
    listeners.add(setC);
    setC(last);
    return () => {
      listeners.delete(setC);
    };
  }, []);
  return c;
}
