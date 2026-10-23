// ===================================
// Orientation policy: tablets rotate freely, phones stay portrait.
// The lock is applied here at runtime on both platforms. Info.plist allows
// landscape on iPhone too (app.json) — it has to, or iPhone Duo could never
// rotate when opened — so on an ordinary iPhone it is this lock that keeps
// the app portrait.
//
// Foldables (Android foldables, Surface Duo, iPhone Duo) are both at once: a
// phone when folded (or on one Duo screen), a tablet when opened (or spanned).
// So the policy is not decided once at launch — it is re-applied on every
// Dimensions change, otherwise an app started folded stayed locked to portrait
// after the device was opened.
//
// IMPORTANT: expo-screen-orientation is loaded lazily inside a try/catch. If the
// native module is missing from a build (e.g. pods not reinstalled after adding
// the package), we must degrade gracefully — importing it at module scope would
// throw during startup and white-screen the whole app.
// ===================================

import { Platform, Dimensions } from 'react-native';

const minSide = (d: { width: number; height: number }) => Math.min(d.width, d.height);

/**
 * iPad, or any device whose shortest side is ≥ 600dp/pt (sw600dp) — which is
 * how an opened iPhone Duo (inner display ≈ 626 × 890 pt, still the iPhone
 * idiom) counts as a tablet. Android looks at the screen as well as the window:
 * in split-screen on a tablet the window is narrow, and that must not lock the
 * device to portrait.
 */
export function isTablet(): boolean {
  if (Platform.OS === 'ios') {
    return (Platform as any).isPad === true || minSide(Dimensions.get('window')) >= 600;
  }
  return Math.max(minSide(Dimensions.get('window')), minSide(Dimensions.get('screen'))) >= 600;
}

let lastTablet: boolean | null = null;
let watching = false;

async function apply(): Promise<void> {
  try {
    // Lazy require so a missing native module can't crash app startup.
    const ScreenOrientation = require('expo-screen-orientation');
    const tablet = isTablet();
    if (tablet === lastTablet) return;
    lastTablet = tablet;
    if (tablet) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  } catch {
    /* orientation control is best-effort — ignore (module missing or call failed) */
  }
}

/** Lock phones to portrait; let tablets rotate; follow fold/unfold. Never throws. */
export async function applyOrientationPolicy(): Promise<void> {
  if (!watching) {
    watching = true;
    Dimensions.addEventListener('change', () => { apply(); });
  }
  await apply();
}
