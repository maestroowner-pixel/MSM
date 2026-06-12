// ===================================
// Free-trial counter + free-tier list limits — PREPARED BUT OFF.
//
// `ENFORCE_LIMITS` is the master switch. While it is `false` (current state)
// NOTHING is limited: `limitsActive()` always resolves false and the counter
// merely records how many days have elapsed since first launch. Flip the switch
// to `true` later to turn the gate on (after the 31-day counter, non-subscribers
// hit the free-tier caps and are routed to the paywall).
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSubscribed } from './purchases';

/** MASTER SWITCH — keep false until we decide to enforce limits. */
export const ENFORCE_LIMITS = false;

/** Length of the free period before limits kick in. */
export const TRIAL_DAYS = 31;

/** Free-tier caps, applied only once ENFORCE_LIMITS is true and the trial ended. */
export const FREE_ITEMS_PER_CATEGORY = 15; // tune later
export const FREE_CERTIFICATES = 10; // tune later

const FIRST_LAUNCH_KEY = 'msm:first_launch';
const DAY_MS = 86_400_000;

/** Record the first-launch timestamp once. Safe to call on every app start. */
export async function ensureTrialStarted(): Promise<void> {
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
}

export async function getTrialInfo(): Promise<TrialInfo> {
  let startedAt: number | null = null;
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    startedAt = v ? Number(v) : null;
  } catch {
    /* ignore */
  }
  if (!startedAt) return { startedAt: null, daysElapsed: 0, daysLeft: TRIAL_DAYS, expired: false };
  const daysElapsed = Math.floor((Date.now() - startedAt) / DAY_MS);
  return {
    startedAt,
    daysElapsed,
    daysLeft: Math.max(0, TRIAL_DAYS - daysElapsed),
    expired: daysElapsed >= TRIAL_DAYS,
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
