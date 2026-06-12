// ===================================
// Orientation policy: tablets rotate freely, phones stay portrait.
// iOS also enforces this at build time via Info.plist (per-idiom orientation
// arrays in app.json); this runtime lock is what makes Android phones behave,
// since Android cannot express per-device-class orientation statically.
//
// IMPORTANT: expo-screen-orientation is loaded lazily inside a try/catch. If the
// native module is missing from a build (e.g. pods not reinstalled after adding
// the package), we must degrade gracefully — importing it at module scope would
// throw during startup and white-screen the whole app.
// ===================================

import { Platform, Dimensions } from 'react-native';

/** iPad on iOS, or an Android device whose shortest side is ≥ 600dp (sw600dp). */
export function isTablet(): boolean {
  if (Platform.OS === 'ios') return (Platform as any).isPad === true;
  const { width, height } = Dimensions.get('window');
  return Math.min(width, height) >= 600;
}

/** Lock phones to portrait; let tablets rotate. Best-effort (never throws). */
export async function applyOrientationPolicy(): Promise<void> {
  try {
    // Lazy require so a missing native module can't crash app startup.
    const ScreenOrientation = require('expo-screen-orientation');
    if (isTablet()) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  } catch {
    /* orientation control is best-effort — ignore (module missing or call failed) */
  }
}
