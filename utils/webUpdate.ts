// ===================================
// "A newer build is live" — for the browser and for the Windows executable.
//
// Ported from DEM/NSeaStoreManager, cut to the one path MSM needs. DEM's version
// also asks GitHub for a release tag; MSM ships no tagged releases, so that half
// is left out rather than carried as a mechanism that can never fire.
//
// WHAT IS COMPARED, and why it is not a version number. Two builds of 2.1 differ
// every time a line changes, so the app would have to be re-versioned for every
// deploy or the check would stay quiet. `/version.json` carries the MOMENT the
// build was made (scripts/stamp-build.js in the web project), and that always
// differs.
//
// WHAT THE TAB COMPARES AGAINST. Not a stamp baked into the bundle — nothing has
// to be threaded through the build. The FIRST stamp a tab reads IS the build it
// is running, because index.html and version.json are deployed together and both
// are served no-cache. Every later reading is compared with that first one.
//
// A tab asks its OWN origin, so this works identically on the hosted site and
// inside the .exe, which serves its own copy of the same file.
//
// Native is a no-op: phones update through the App Store and Play.
// ===================================

import { Platform } from 'react-native';

const onWeb = Platform.OS === 'web';

/** Once every half hour is plenty — a vessel leaves this open for days. */
export const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** The stamp this tab booted with. Null until the first successful read. */
let bootStamp: number | null = null;

interface Stamp {
  version?: string;
  builtAt?: number;
}

async function readStamp(): Promise<Stamp | null> {
  if (!onWeb) return null;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Stamp;
    return typeof data?.builtAt === 'number' ? data : null;
  } catch {
    // Offline, or opened from somewhere that serves no stamp. Not an error —
    // there is simply nothing to say.
    return null;
  }
}

/**
 * True when the site has been redeployed since this tab loaded.
 * The first call only records the baseline and always answers false.
 */
export async function isNewBuildAvailable(): Promise<boolean> {
  const stamp = await readStamp();
  if (!stamp?.builtAt) return false;
  if (bootStamp === null) {
    bootStamp = stamp.builtAt;
    return false;
  }
  return stamp.builtAt > bootStamp;
}

/** Take the new build: a plain reload, because the server already has it. */
export function applyWebUpdate(): void {
  if (!onWeb) return;
  try {
    (globalThis as any).location?.reload?.();
  } catch {
    /* nothing sensible to do if even reload is unavailable */
  }
}

export const webUpdatesSupported = onWeb;
