// ===================================
// App Check — the web build proves to Firebase that a request comes from our
// page, not from a script that copied FIREBASE_CONFIG (plan item 61, 19 Nov 2026).
//
// WEB ONLY, and MONITOR ONLY. The browser gets its token from reCAPTCHA
// Enterprise (invisible, score-based — no puzzle for the crew). Firestore,
// Storage and the functions are NOT set to enforce: the console just counts
// verified vs unverified requests. Enforcing comes later, and only once the
// phones send a token too — they need native attestation (App Attest / Play
// Integrity) through a native module, i.e. a store release, and an old install
// without it would be locked out the moment enforcement is switched on.
//
// Both Firebase apps get it: the vessel's default app (firebaseService) and the
// superintendent's 'shore' app (shore.ts). Off the production domains (localhost,
// the smoke test in Opera) it stays off — reCAPTCHA would reject the domain, and
// a page that keeps failing to get a token only adds noise to the console.
//
// CSP (firebase.json): reCAPTCHA needs www.google.com/recaptcha/ and
// www.gstatic.com/recaptcha/ in script-src and frame-src; the token exchange goes
// to content-firebaseappcheck.googleapis.com, already inside *.googleapis.com.
// scripts/check-csp.js keeps them there.
// ===================================

import { Platform } from 'react-native';
import type { FirebaseApp } from 'firebase/app';

/** reCAPTCHA Enterprise site key (Firebase console → App Check → web app). Empty = off. */
export const RECAPTCHA_SITE_KEY = '6LfYPyguAAAAANcq36SD3yO-fwddsaGzQtONac2b';

/** Hosts the key is registered for. Anywhere else App Check is not started. */
export const APP_CHECK_HOSTS = [
  'app.ismpilot.com',
  'ismpilot.web.app',
  'ismpilot.firebaseapp.com',
  'marine-safety-manager.web.app',
  'marine-safety-manager.firebaseapp.com',
];

export function appCheckWanted(os: string, host: string | undefined, key: string): boolean {
  return os === 'web' && !!key && !!host && APP_CHECK_HOSTS.includes(host);
}

const started = new WeakSet<FirebaseApp>();

/** Call right after initializeApp, before Firestore/Storage/Functions are used. */
export function startAppCheck(app: FirebaseApp): void {
  if (started.has(app)) return;
  const host = typeof location !== 'undefined' ? location.hostname : undefined;
  if (!appCheckWanted(Platform.OS, host, RECAPTCHA_SITE_KEY)) return;
  started.add(app);
  try {
    // Required lazily: the phones never load reCAPTCHA code.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = require('firebase/app-check');
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Already initialised (fast refresh) or blocked by an extension — never stop the app for it.
    console.warn('[appCheck]', e);
  }
}
