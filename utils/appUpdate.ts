// ===================================
// "A newer version is in the store" — for the phone (21 Oct 2026: "check at
// start on mobile — update now or remind me later, and remind again before
// the app closes if it is still not installed").
//
// WHERE THE VERSION COMES FROM. The store itself, not our own server: a web
// deploy goes out the day it is built, while a phone build waits days for
// review — a version.json of ours would send a crew member to a store page
// that still offers the old one.
//   iOS     — the iTunes lookup API (public, JSON).
//   Android — Google Play has no public API; the version is read from the app's
//             store page. If Google changes that page the check goes quiet — it
//             never asks for an update that is not there.
//
// The web build has its own check (utils/webUpdate): there an update is a reload.
// ===================================

import { Linking, Platform } from 'react-native';

const BUNDLE = 'com.kukalab.msm';
const APPLE_ID = '6777250139';

/** "2.65" > "2.64", "2.10" > "2.9"; a missing part counts as 0. */
export function isNewer(store: string, here: string): boolean {
  const a = store.split('.').map((n) => parseInt(n, 10) || 0);
  const b = here.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** The version the store offers now; null offline, on web, or when it cannot be read. */
export async function storeVersion(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE}&t=${Date.now()}`);
      const data = await res.json();
      const v = data?.results?.[0]?.version;
      return typeof v === 'string' ? v : null;
    }
    if (Platform.OS === 'android') {
      const res = await fetch(`https://play.google.com/store/apps/details?id=${BUNDLE}&hl=en`);
      const html = await res.text();
      return html.match(/\[\[\["(\d+(?:\.\d+)+)"\]\]/)?.[1] ?? null;
    }
  } catch {
    // Offline at sea is the normal case — nothing to say.
  }
  return null;
}

/** The app's page in the store, opened in the store app. */
export async function openStore(): Promise<void> {
  const [app, web] =
    Platform.OS === 'ios'
      ? [`itms-apps://apps.apple.com/app/id${APPLE_ID}`, `https://apps.apple.com/app/id${APPLE_ID}`]
      : [`market://details?id=${BUNDLE}`, `https://play.google.com/store/apps/details?id=${BUNDLE}`];
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}
