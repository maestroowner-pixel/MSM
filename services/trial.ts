// ===================================
// Free-trial counter + free-tier list limits — PREPARED BUT OFF.
//
// `ENFORCE_LIMITS` is the master switch. While it is `false` (current state)
// NOTHING is limited: `limitsActive()` always resolves false and the counter
// merely records how many days have elapsed since first launch. Flip the switch
// to `true` later to turn the gate on (after the 60-day counter, non-subscribers
// hit the free-tier caps and are routed to the paywall).
// ===================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSubscribed } from './purchases';
import * as fb from './firebaseService';

/**
 * MASTER SWITCH — enforcement is ON for web only.
 * Web has a working unlock path (LemonSqueezy license, account-bound), so after
 * the 60-day trial non-subscribers hit the free-tier caps and are routed to the
 * paywall. iOS/Android stay OFF until RevenueCat purchases are wired (their
 * paywall buttons don't complete a purchase yet), so nothing is limited there.
 */
export const ENFORCE_LIMITS = Platform.OS === 'web';

/** Length of the free period before limits kick in (2 months). */
export const TRIAL_DAYS = 60;

/** Free-tier caps, applied only once ENFORCE_LIMITS is true and the trial ended. */
export const FREE_ITEMS_PER_CATEGORY = 15; // tune later
export const FREE_CERTIFICATES = 10; // tune later

const FIRST_LAUNCH_KEY = 'msm:first_launch';
const DAY_MS = 86_400_000;

/**
 * Desktop (Electron) injects a reinstall-proof first-launch timestamp from a
 * file in the user's home dir (see desktop/main.js) as `__MSM_TRIAL_START__`.
 * When present it's authoritative, so the trial survives clearing app data /
 * reinstalling. Absent in the browser (falls back to localStorage there).
 */
function injectedTrialStart(): number | null {
  const v = (globalThis as any).__MSM_TRIAL_START__;
  return typeof v === 'number' && v > 0 ? v : null;
}

/** Record the first-launch timestamp once. Safe to call on every app start. */
export async function ensureTrialStarted(): Promise<void> {
  if (injectedTrialStart() != null) return; // desktop file is authoritative
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (!v) await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(Date.now()));
  } catch {
    /* best-effort */
  }
}

export interface TrialInfo {
  startedAt: number | null;
  daysElapsed: number;
  daysLeft: number;
  expired: boolean;
  /** ms epoch when the trial ends (startedAt + TRIAL_DAYS), or null if not started. */
  endsAt: number | null;
}

/** Local first-launch: desktop injected file > localStorage > now (recorded). */
async function localTrialStart(): Promise<number> {
  const inj = injectedTrialStart();
  let ls: number | null = null;
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    ls = v ? Number(v) : null;
  } catch {
    /* ignore */
  }
  const found = [inj, ls].filter((x): x is number => typeof x === 'number' && x > 0);
  if (found.length) return Math.min(...found);
  const ts = Date.now();
  try { await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(ts)); } catch { /* ignore */ }
  return ts;
}

/**
 * Called after the vessel logs in (IMO): mirror the trial start to/from the
 * Firebase account so the trial is controlled from the cloud too. Uses the
 * EARLIEST of local vs account (so re-logging can't reset it), writes it back to
 * the account, and mirrors it locally so the counter reflects it everywhere.
 */
export async function syncTrialWithAccount(uid: string): Promise<void> {
  try {
    const local = await localTrialStart();
    let account: number | null = null;
    try { account = await fb.getAccountTrialStart(uid); } catch { /* offline / none */ }
    const earliest = account != null ? Math.min(local, account) : local;
    if (account == null || earliest !== account) {
      try { await fb.setAccountTrialStart(uid, earliest); } catch { /* best-effort */ }
    }
    try { await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(earliest)); } catch { /* ignore */ }
  } catch {
    /* best-effort — trial keeps working locally if the cloud is unreachable */
  }
}

export async function getTrialInfo(): Promise<TrialInfo> {
  // Earliest of the desktop injected file and localStorage (which account sync
  // may have moved earlier) — so the trial can't be reset by reinstall/re-login.
  const inj = injectedTrialStart();
  let ls: number | null = null;
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    ls = v ? Number(v) : null;
  } catch {
    /* ignore */
  }
  const found = [inj, ls].filter((x): x is number => typeof x === 'number' && x > 0);
  let startedAt: number | null = found.length ? Math.min(...found) : null;
  if (!startedAt) {
    // Not launched yet → assume a full trial starting now (for display).
    return { startedAt: null, daysElapsed: 0, daysLeft: TRIAL_DAYS, expired: false, endsAt: Date.now() + TRIAL_DAYS * DAY_MS };
  }
  const daysElapsed = Math.floor((Date.now() - startedAt) / DAY_MS);
  return {
    startedAt,
    daysElapsed,
    daysLeft: Math.max(0, TRIAL_DAYS - daysElapsed),
    expired: daysElapsed >= TRIAL_DAYS,
    endsAt: startedAt + TRIAL_DAYS * DAY_MS,
  };
}

/**
 * Whether free-tier limits currently apply. Returns false while ENFORCE_LIMITS
 * is off, while subscribed, or during the trial — so callers are no-ops today.
 */
export async function limitsActive(): Promise<boolean> {
  if (!ENFORCE_LIMITS) return false;
  if (await isSubscribed()) return false;
  return (await getTrialInfo()).expired;
}

/**
 * Gate for adding another item to a category. `true` = allowed.
 * Always true while limits are inactive (current behaviour).
 */
export async function canAddItem(currentCount: number): Promise<boolean> {
  if (!(await limitsActive())) return true;
  return currentCount < FREE_ITEMS_PER_CATEGORY;
}

/** Gate for adding another certificate. */
export async function canAddCertificate(currentCount: number): Promise<boolean> {
  if (!(await limitsActive())) return true;
  return currentCount < FREE_CERTIFICATES;
}
