// ===================================
// Subscriptions — UI-only stub for now; RevenueCat plugs in here later.
//
// The PaywallSc screen talks ONLY to this module, so wiring real purchases is a
// drop-in: implement the four functions with `react-native-purchases`
// (RevenueCat) and the screen keeps working unchanged.
//
// Offer: 2-month free trial, then a yearly subscription. Real, per-store
// localized prices (e.g. "€10,00", "$10.99", "₴399,00") come from RevenueCat's
// annual package once configured; until then `getOffer()` returns FALLBACK
// (available:false) so the screen shows a price but the buttons explain that
// purchasing isn't live yet.
// ===================================

import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fb from './firebaseService';
import * as ls from './lemonSqueezy';

export const TRIAL_DAYS = 60;

const onWeb = Platform.OS === 'web';
// Local cache of the account entitlement so the per-add gate (isSubscribed) is a
// fast local read, not a network call. The authoritative copy lives on the
// Firebase account; this is refreshed on activate / restore.
const ENT_CACHE_KEY = 'msm:entitlement';

async function cachedEntitlement(): Promise<fb.Entitlement | null> {
  try {
    const v = await AsyncStorage.getItem(ENT_CACHE_KEY);
    return v ? (JSON.parse(v) as fb.Entitlement) : null;
  } catch {
    return null;
  }
}

async function cacheEntitlement(e: fb.Entitlement | null): Promise<void> {
  try {
    if (e) await AsyncStorage.setItem(ENT_CACHE_KEY, JSON.stringify(e));
    else await AsyncStorage.removeItem(ENT_CACHE_KEY);
  } catch {
    /* best-effort */
  }
}

function entitlementActive(e: fb.Entitlement | null): boolean {
  if (!e?.active) return false;
  if (e.expiresAt && e.expiresAt < Date.now()) return false;
  return true;
}

// Identifiers to configure in RevenueCat + App Store Connect / Play Console.
export const ENTITLEMENT_ID = 'pro';
export const YEARLY_PRODUCT_ID = 'msm_pro_yearly'; // same id on both stores

export interface Offer {
  /** Localized price string for the period (store-formatted, per platform). */
  priceString: string;
  /** Billing period of the offer. */
  period: 'year';
  /** Free-trial length in days (intro offer). */
  trialDays: number;
  /** True once RevenueCat is wired AND the product is configured in the store. */
  available: boolean;
}

// Placeholder shown until RevenueCat returns the real localized store price.
const FALLBACK: Offer = {
  priceString: '€10.00',
  period: 'year',
  trialDays: TRIAL_DAYS,
  available: false,
};

/** The yearly offer to display on the paywall. */
export async function getOffer(): Promise<Offer> {
  if (onWeb) {
    // Web sells through LemonSqueezy; "available" once the checkout is configured.
    return {
      priceString: ls.LS_PRICE_STRING,
      period: 'year',
      trialDays: TRIAL_DAYS,
      available: ls.isLemonConfigured(),
    };
  }
  // TODO(revenuecat): const offerings = await Purchases.getOfferings();
  //   const pkg = offerings.current?.annual;
  //   return { priceString: pkg.product.priceString, period: 'year',
  //            trialDays: TRIAL_DAYS, available: true };
  return FALLBACK;
}

/**
 * Start the yearly subscription. On web this opens the LemonSqueezy checkout in
 * a new tab (the purchase completes there; the customer then activates the
 * emailed license key via activateLicenseWeb). Returns false because no
 * entitlement is active yet at this point.
 */
export async function purchaseYearly(): Promise<boolean> {
  if (onWeb) {
    if (ls.isLemonConfigured()) await Linking.openURL(ls.LS_CHECKOUT_URL).catch(() => {});
    return false;
  }
  // TODO(revenuecat): await Purchases.purchasePackage(annualPackage);
  //   return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}

/**
 * Web only: activate a LemonSqueezy license key. Requires the vessel to be
 * signed in (the entitlement is stored on the account). Returns a result with a
 * user-facing message on failure.
 */
export async function activateLicenseWeb(key: string): Promise<{ ok: boolean; message?: string }> {
  if (!onWeb) return { ok: false, message: 'Not supported on this platform.' };
  const uid = fb.currentUid();
  if (!uid) return { ok: false, message: 'Please sign in to your vessel first (Cloud sync).' };
  const res = await ls.activateLicense(key);
  if (!res.ok) return { ok: false, message: res.message };
  const ent: fb.Entitlement = {
    active: true,
    provider: 'lemonsqueezy',
    licenseKey: res.licenseKey ?? key.trim(),
    instanceId: res.instanceId,
    activatedAt: Date.now(),
    expiresAt: res.expiresAt ?? null,
  };
  try {
    await fb.saveEntitlement(uid, ent);
  } catch (e: any) {
    return { ok: false, message: `Activated, but couldn't save to your account: ${String(e?.message ?? e)}` };
  }
  await cacheEntitlement(ent);
  return { ok: true };
}

/**
 * Restore a previous purchase. On web: pull the entitlement from the signed-in
 * account and re-validate the license with LemonSqueezy. Returns true if active.
 */
export async function restore(): Promise<boolean> {
  if (onWeb) {
    const uid = fb.currentUid();
    if (!uid) return false;
    let ent: fb.Entitlement | null = null;
    try {
      ent = await fb.getEntitlement(uid);
    } catch {
      return false;
    }
    if (!ent?.licenseKey) return false;
    // Re-check with LemonSqueezy so a cancelled/expired license doesn't linger.
    const check = await ls.validateLicense(ent.licenseKey, ent.instanceId);
    const fresh: fb.Entitlement = { ...ent, active: check.ok, expiresAt: check.expiresAt ?? ent.expiresAt ?? null };
    await cacheEntitlement(entitlementActive(fresh) ? fresh : null);
    if (entitlementActive(fresh) !== ent.active) {
      try { await fb.saveEntitlement(uid, fresh); } catch { /* best-effort */ }
    }
    return entitlementActive(fresh);
  }
  // TODO(revenuecat): const info = await Purchases.restorePurchases();
  //   return info.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}

/** Web checkout URL (or null if not on web / not configured). */
export function webCheckoutUrl(): string | null {
  return onWeb && ls.isLemonConfigured() ? ls.LS_CHECKOUT_URL : null;
}

/** Whether the signed-in vessel account is known (web gate needs a login to unlock). */
export function isSignedIn(): boolean {
  return onWeb ? fb.currentUid() != null : true;
}

/** Open the platform's subscription-management screen (App Store / Google Play). */
export async function openManageSubscriptions(): Promise<void> {
  const url = Platform.select({
    ios: 'itms-apps://apps.apple.com/account/subscriptions',
    android: 'https://play.google.com/store/account/subscriptions?package=com.kukalab.msm',
    default: 'https://apps.apple.com/account/subscriptions',
  })!;
  try {
    await Linking.openURL(url);
  } catch {
    // Fallback to the web URL if the store deep-link can't be opened.
    if (Platform.OS === 'ios') await Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
  }
}

/** Whether the user currently has an active subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (onWeb) {
    // Fast local read (the per-add gate calls this). Authoritative copy is on the
    // account and refreshed by activateLicenseWeb / restore.
    return entitlementActive(await cachedEntitlement());
  }
  // TODO(revenuecat): const info = await Purchases.getCustomerInfo();
  //   return info.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}
