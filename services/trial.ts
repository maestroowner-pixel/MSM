// ===================================
// Free-trial counter + free-tier list limits.
//
// `ENFORCE_LIMITS` is the master switch, and it is **ON everywhere the licence
// can be activated** — which since 5 Sep 2026 means everywhere but Windows.
//
// It used to be iOS + web only, because Android had no way to pay: there was no
// Play product and no RevenueCat `goog_…` key, and sending somebody to a paywall
// they cannot complete is worse than not charging them. That reason is gone. MSM
// Pro is now one LICENCE PER VESSEL bought on LemonSqueezy and attached to the
// vessel's account, so a device pays nothing and needs no store — it enters a key,
// or simply inherits the licence from the ship it has joined. Android can be held
// to the same terms as everything else. Switched on with no users on it yet.
//
// Windows stays out, and not as an oversight: `syncSupported()` is false there
// (see firebaseService's Windows note), so there is no vessel account to attach a
// licence to and no way to activate one. Enforcing limits there would build a
// dead end rather than a paywall. The react-native-windows track is retired
// anyway — desktop is served by the web build.
//
// (This header once said the switch was `false` and that nothing was limited,
// long after it had been switched on; the stale text read as an assurance. If you
// change the switch, change this paragraph in the same commit.)
//
// While enforcement is on, the counter runs for TRIAL_DAYS from first launch and
// non-subscribers then hit the free-tier caps below and are routed to the paywall.
// Where enforcement is off, `limitsActive()` always resolves false and the counter
// merely records how many days have elapsed.
// ===================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { EquipmentItem } from '../types/equipment';
import { isSubscribed } from './purchases';
import * as fb from './firebaseService';

/**
 * MASTER SWITCH — enforcement is ON where there's a working purchase path:
 *   • iOS — RevenueCat subscription (entitlement "pro").
 *   • web — LemonSqueezy license (account-bound).
 * Android stays OFF until the Play app + RevenueCat `goog_…` key are configured —
 * enabling it there would route users to a paywall they can't complete. After the
 * 60-day trial, non-subscribers hit the free-tier caps and are routed to the paywall.
 */
export const ENFORCE_LIMITS = Platform.OS !== 'windows';

/** Length of the free period before limits kick in (2 months). */
export const TRIAL_DAYS = 60;

/** Free-tier caps, applied only once ENFORCE_LIMITS is true and the trial ended. */
export const FREE_ITEMS_PER_CATEGORY = 15; // tune later

/**
 * How many files an UNLICENSED vessel may put in Cloud Storage.
 *
 * This one is not like the caps above, and the difference is the point. Those
 * limit what the app will do on the device, and they hold off until the trial
 * has ended — a trial should feel like the product. This limits what we PAY FOR:
 * every photograph uploaded is storage and egress on our bill, for a vessel that
 * has not paid and may never. So it applies during the trial as well.
 *
 * Nothing is refused to the user's own device. Photographs are taken, attached,
 * shown and kept exactly as before, and they travel in a .msm backup. What stops
 * at the limit is the copy that goes to the other devices — and the moment the
 * vessel is licensed, everything held back goes up on the next sync.
 *
 * 25 is enough to work a round with evidence and see what the feature is for,
 * and far too few to keep a fleet's photo archive on someone else's account.
 */
export const FREE_UPLOADS_PER_VESSEL = 25;
export const FREE_CERTIFICATES = 10; // tune later

const FIRST_LAUNCH_KEY = 'msm:first_launch';
const DAY_MS = 86_400_000;

// Reinstall protection (native). AsyncStorage is wiped when the app is deleted, so
// the trial would reset on reinstall. The iOS Keychain, however, survives app
// deletion — so we ALSO keep first-launch there and treat the earliest of the two
// as authoritative. (Android's secure store is cleared on uninstall, so there this
// is a no-op extra copy; Android reinstall protection comes from the Firebase
// account via syncTrialWithAccount, or later a Play-side signal.)
const SECURE_FIRST_LAUNCH_KEY = 'msm_first_launch'; // Keychain keys: no ':'
const useKeychain = Platform.OS === 'ios' || Platform.OS === 'android';

async function keychainGet(): Promise<number | null> {
  if (!useKeychain) return null;
  try {
    const v = await SecureStore.getItemAsync(SECURE_FIRST_LAUNCH_KEY);
    const n = v ? Number(v) : null;
    return n && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function keychainSet(ts: number): Promise<void> {
  if (!useKeychain) return;
  try {
    await SecureStore.setItemAsync(SECURE_FIRST_LAUNCH_KEY, String(ts));
  } catch {
    /* best-effort */
  }
}

async function asyncGet(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    const n = v ? Number(v) : null;
    return n && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Write the authoritative start to every writable local layer (heals reinstall). */
async function persistLocal(ts: number): Promise<void> {
  try { await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(ts)); } catch { /* ignore */ }
  await keychainSet(ts);
}

/**
 * Earliest known first-launch across ALL local sources (desktop injected file,
 * Keychain, AsyncStorage), or null if never launched. Reads only — callers decide
 * whether to persist. The earliest wins so nothing (reinstall, clearing data,
 * re-login) can push the trial start later.
 */
async function earliestLocalStart(): Promise<number | null> {
  const inj = injectedTrialStart();
  const [kc, as] = await Promise.all([keychainGet(), asyncGet()]);
  const found = [inj, kc, as].filter((x): x is number => typeof x === 'number' && x > 0);
  return found.length ? Math.min(...found) : null;
}

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
  const existing = await earliestLocalStart();
  // First-ever launch → stamp now. Otherwise re-persist the earliest to every
  // layer, so a reinstall (AsyncStorage gone, Keychain kept) heals on this launch.
  await persistLocal(existing ?? Date.now());
}

export interface TrialInfo {
  startedAt: number | null;
  daysElapsed: number;
  daysLeft: number;
  expired: boolean;
  /** ms epoch when the trial ends (startedAt + TRIAL_DAYS), or null if not started. */
  endsAt: number | null;
}

/** Local first-launch across all layers (Keychain-backed), recording now if none. */
async function localTrialStart(): Promise<number> {
  const existing = await earliestLocalStart();
  const ts = existing ?? Date.now();
  await persistLocal(ts);
  return ts;
}

/**
 * Mirror the trial start to and from the VESSEL account, taking the EARLIEST of
 * the two.
 *
 * This is what stops a reinstall handing out a fresh 60 days. On iOS the local
 * stamp survives deletion in the Keychain, but Android's secure store is wiped
 * with the app — so on Android the account copy is the only memory the trial has,
 * and the trial reset on every reinstall until this ran on the enrolment path.
 *
 * It is also the right SEMANTIC now that the licence is per vessel: a phone
 * joining a ship that has been running the app for three months joins a trial
 * that is three months old, not a new one. The trial belongs to the vessel.
 *
 * `uid` is the vessel key (IMO digits) and is resolved automatically when
 * omitted — passing the Firebase auth uid instead is the mistake that made
 * licence activation fail, see firebaseService.currentVesselKey().
 */
export async function syncTrialWithAccount(uid?: string): Promise<void> {
  try {
    const key = uid ?? (await fb.currentVesselKey());
    if (!key) return; // not attached to a vessel yet — nothing to mirror
    const local = await localTrialStart();
    let account: number | null = null;
    try { account = await fb.getAccountTrialStart(key); } catch { /* offline / none */ }
    const earliest = account != null ? Math.min(local, account) : local;
    if (account == null || earliest !== account) {
      try { await fb.setAccountTrialStart(key, earliest); } catch { /* best-effort */ }
    }
    await persistLocal(earliest); // mirror the account's (possibly earlier) start locally
  } catch {
    /* best-effort — trial keeps working locally if the cloud is unreachable */
  }
}

export async function getTrialInfo(): Promise<TrialInfo> {
  // Earliest across the desktop injected file, the Keychain and AsyncStorage — so
  // the trial can't be reset by reinstall / clearing data / re-login. (Read-only;
  // healing/persisting is done by ensureTrialStarted at launch.)
  const startedAt = await earliestLocalStart();
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

/**
 * How many more files this vessel may upload. `Infinity` once licensed.
 *
 * Deliberately NOT gated on the trial: see FREE_UPLOADS_PER_VESSEL. A licensed
 * vessel is unlimited; everyone else shares one allowance, counted on the vessel
 * document so five phones cannot each spend it.
 */
export async function uploadAllowance(used: number): Promise<number> {
  if (!ENFORCE_LIMITS) return Infinity;
  if (await isSubscribed()) return Infinity;
  return Math.max(0, FREE_UPLOADS_PER_VESSEL - (used || 0));
}

/** Gate for adding another certificate. */
export async function canAddCertificate(currentCount: number): Promise<boolean> {
  if (!(await limitsActive())) return true;
  return currentCount < FREE_CERTIFICATES;
}

// ---- Overflow lock (free tier) ---------------------------------------------
// When the trial has ended and there's no subscription, a category keeping MORE
// than FREE_ITEMS_PER_CATEGORY items locks the OVERFLOW: the oldest N stay usable,
// the rest become read-only (can't be opened) but are NOT deleted, and cloud sync
// keeps updating them. Subscribing unlocks everything. The lock is a display-only
// overlay computed here; it never touches stored data.

/** Creation time encoded in a uid() ("prefix_<base36 ms>_…"); 0 if unparseable. */
export function itemCreatedAt(id: string): number {
  const seg = id.split('_')[1];
  const n = seg ? parseInt(seg, 36) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Which item ids are locked under the free tier — per category, everything added
 * after the first FREE_ITEMS_PER_CATEGORY (oldest kept by creation time, newest
 * locked). Assumes limits are active; callers gate on the limits flag. Returns an
 * empty set for categories at or under the cap.
 */
export function overflowLockedIds(byCategory: Record<string, EquipmentItem[]>): Set<string> {
  const locked = new Set<string>();
  for (const list of Object.values(byCategory)) {
    if (!list || list.length <= FREE_ITEMS_PER_CATEGORY) continue;
    const ordered = [...list].sort(
      (a, b) => itemCreatedAt(a.id) - itemCreatedAt(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    for (const it of ordered.slice(FREE_ITEMS_PER_CATEGORY)) locked.add(it.id);
  }
  return locked;
}
