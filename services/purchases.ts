// ===================================
// Subscriptions. The PaywallSc screen talks ONLY to this module.
//
//  • iOS / Android — RevenueCat (`react-native-purchases`), entitlement "pro".
//  • Web           — LemonSqueezy checkout + license key (unchanged, see below).
//
// Offer: 2-month free trial, then a yearly subscription. The price string and the
// trial length are read from the STORE (RevenueCat's annual package), not from
// the constants here — the store is the source of truth for what the user is
// actually charged, and Apple only allows fixed intro periods (1/2/3/6 months…).
// TRIAL_DAYS below is only the local free-period counter (services/trial.ts).
// ===================================

import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fb from './firebaseService';
import * as ls from './lemonSqueezy';

export const TRIAL_DAYS = 60;

const onWeb = Platform.OS === 'web';

// RevenueCat public SDK keys (safe to ship — they are client keys, not secrets).
// Empty key = purchases disabled on that platform (loadPurchases() returns null),
// so Android stays inert until the Play app is configured (below) and the key set.
const RC_API_KEY = Platform.select({
  ios: 'appl_pHgoBIkwWhdTNspFBmzTJXKPSNZ',
  // Play product: msm_year : msm-year (base plan), entitlement "pro", in the
  // MSM-Year offering's $rc_annual package.
  android: 'goog_mYTzodNDvQxKlPjaNscFFlHonyt',
  default: '',
})!;

/**
 * Lazily load the native SDK. Deliberately NOT a top-level import: a binary built
 * before `react-native-purchases` was added has no native module, and a top-level
 * import would crash the app at startup instead of just leaving purchases off.
 * `undefined` = not tried yet, `null` = unavailable on this build/platform.
 */
let purchasesMod: any | null | undefined;
function loadPurchases(): any | null {
  if (purchasesMod !== undefined) return purchasesMod;
  if (onWeb || !RC_API_KEY) {
    purchasesMod = null;
  } else {
    try {
      purchasesMod = require('react-native-purchases').default ?? null;
    } catch {
      purchasesMod = null;
    }
  }
  return purchasesMod;
}

let configured = false;
/** Returns the configured SDK, or null when purchases aren't available here. */
async function ensureConfigured(): Promise<any | null> {
  const P = loadPurchases();
  if (!P) return null;
  if (!configured) {
    try {
      await P.configure({ apiKey: RC_API_KEY });
      configured = true;
    } catch {
      return null;
    }
  }
  return P;
}

/** True once an entitlement named ENTITLEMENT_ID is active on the customer info. */
function hasPro(info: any): boolean {
  return info?.entitlements?.active?.[ENTITLEMENT_ID] != null;
}

/**
 * Free-trial length of the product's introductory offer, in days — converted from
 * the store's period so PaywallSc renders "2 months" rather than a raw count.
 * Returns null when the product has no FREE intro offer.
 */
function introTrialDays(product: any): number | null {
  const intro = product?.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = Number(intro.periodNumberOfUnits ?? 0);
  if (!n) return null;
  switch (String(intro.periodUnit).toUpperCase()) {
    case 'DAY':
      return n;
    case 'WEEK':
      return n * 7;
    case 'MONTH':
      return n * 30;
    case 'YEAR':
      return n * 365;
    default:
      return null;
  }
}
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

/**
 * Anyone showing subscription state can subscribe here.
 *
 * The trial banner used to re-read only when its screen regained focus, and the
 * paywall never re-read at all — so after a licence was activated the banner
 * stayed on screen and the paywall looked untouched, even though the entitlement
 * had been written to the vessel and cached locally. Focus is the wrong signal:
 * the change happens on the screen the user is already looking at.
 */
type EntitlementListener = () => void;
const entitlementListeners = new Set<EntitlementListener>();

export function onEntitlementChange(cb: EntitlementListener): () => void {
  entitlementListeners.add(cb);
  return () => entitlementListeners.delete(cb);
}

function notifyEntitlementChange(): void {
  entitlementListeners.forEach((cb) => {
    try { cb(); } catch { /* a bad listener must not break activation */ }
  });
}

async function cacheEntitlement(e: fb.Entitlement | null): Promise<void> {
  try {
    if (e) await AsyncStorage.setItem(ENT_CACHE_KEY, JSON.stringify(e));
    else await AsyncStorage.removeItem(ENT_CACHE_KEY);
  } catch {
    /* best-effort */
  }
  notifyEntitlementChange();
}

function entitlementActive(e: fb.Entitlement | null): boolean {
  if (!e?.active) return false;
  if (e.expiresAt && e.expiresAt < Date.now()) return false;
  return true;
}

// Identifiers to configure in RevenueCat + App Store Connect / Play Console.
export const ENTITLEMENT_ID = 'pro';
// App Store product id (as created in App Store Connect + RevenueCat). Reference
// only — getOffer() reads the annual PACKAGE from the Offering, not this id.
export const YEARLY_PRODUCT_ID = 'msm_year';
// RevenueCat Offering identifier. Used as a fallback if this offering hasn't been
// marked "Current" in the dashboard (then offerings.current is null).
export const OFFERING_ID = 'MSM-Year';

/** The annual package to sell: the current offering, or MSM-Year by identifier. */
function annualPackage(offerings: any): any | null {
  const offering = offerings?.current ?? offerings?.all?.[OFFERING_ID];
  return offering?.annual ?? null;
}

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

// Shown before the price source answers. It matches the LemonSqueezy vessel
// licence, because that is what MSM is sold as everywhere now — a placeholder
// that quotes a different number is worse than a brief dash.
const FALLBACK: Offer = {
  priceString: ls.LS_PRICE_STRING,
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
  const P = await ensureConfigured();
  if (!P) return FALLBACK;
  try {
    const offerings = await P.getOfferings();
    const pkg = annualPackage(offerings);
    if (!pkg?.product) return FALLBACK;
    return {
      priceString: pkg.product.priceString,
      period: 'year',
      // Store's own intro period — falls back to the local constant if the
      // product has no free trial configured yet.
      trialDays: introTrialDays(pkg.product) ?? TRIAL_DAYS,
      available: true,
    };
  } catch {
    return FALLBACK;
  }
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
  const P = await ensureConfigured();
  if (!P) return false;
  const offerings = await P.getOfferings();
  const pkg = annualPackage(offerings);
  if (!pkg) return false;
  try {
    const res = await P.purchasePackage(pkg);
    return hasPro(res?.customerInfo);
  } catch (e: any) {
    // Backing out of the store sheet is not an error — anything else is, and the
    // paywall surfaces it so a silent no-op can't look like a completed purchase.
    if (e?.userCancelled) return false;
    throw e;
  }
}

/**
 * Activate a LemonSqueezy licence key — on ANY platform.
 *
 * MSM Pro is licensed per VESSEL, so the entitlement is stored on the vessel
 * account and every enrolled device inherits it. That is the whole reason this
 * is no longer web-only: a store purchase is tied to the Apple ID that paid, so
 * the mate who bought it had Pro and the second officer beside him did not,
 * though the licence was meant to cover the ship.
 *
 * The vessel must be signed in — without an account there is nothing to attach
 * the licence to, and attaching it to the handset would recreate the problem.
 */
export async function activateLicense(key: string): Promise<{ ok: boolean; message?: string }> {
  // The VESSEL key, not the auth uid — see firebaseService.currentVesselKey().
  const uid = await fb.currentVesselKey();
  if (!uid) return { ok: false, message: 'Join this vessel first (Settings → Join this vessel), so the licence can be attached to it.' };
  const res = await ls.activateLicense(key);
  if (!res.ok) return { ok: false, message: res.message };
  // `instanceId` is absent whenever activation fell back to validate — which is
  // exactly what happens once the key's activation limit is used up. Firestore
  // refuses a payload containing `undefined`, so the key is omitted rather than
  // set to nothing.
  const ent: fb.Entitlement = {
    active: true,
    provider: 'lemonsqueezy',
    licenseKey: res.licenseKey ?? key.trim(),
    ...(res.instanceId ? { instanceId: res.instanceId } : {}),
    activatedAt: Date.now(),
    expiresAt: res.expiresAt ?? null,
    lastCheckedAt: Date.now(),
  };
  try {
    await fb.saveEntitlement(uid, ent);
  } catch (e: any) {
    const denied = /permission|insufficient/i.test(String(e?.message ?? e));
    return {
      ok: false,
      message: denied
        ? 'The licence is valid, but only the Master device may attach it to the vessel. ' +
          'Activate it on the Master, or ask them to make this device Master in Accounts → Devices.'
        : `Activated, but couldn't save to the vessel: ${String(e?.message ?? e)}`,
    };
  }
  await cacheEntitlement(ent);
  return { ok: true };
}

/**
 * How long a licence is trusted between confirmations with LemonSqueezy.
 *
 * MSM Pro is a YEARLY SUBSCRIPTION, and a subscription key carries no expiry
 * date while it runs — LemonSqueezy flips its status when it ends. So nothing
 * local can tell that a subscription was cancelled; without this the cached
 * entitlement said `active: true, expiresAt: null` and would have granted Pro
 * for ever.
 */
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Confirm the vessel's licence with LemonSqueezy, at most once a day.
 *
 * **A licence is only ever revoked on a definitive answer.** If the request did
 * not reach LemonSqueezy — which is the normal state of a ship at sea — the
 * entitlement is left exactly as it was and the clock is not advanced. Switching
 * Pro off because a vessel is mid-ocean would be indefensible; the cost of the
 * opposite mistake is a few days of access after a cancellation.
 */
export async function revalidateLicence(force = false): Promise<void> {
  const ent = await cachedEntitlement();
  if (!ent?.licenseKey) return;
  if (!force && ent.lastCheckedAt && Date.now() - ent.lastCheckedAt < RECHECK_AFTER_MS) return;

  const check = await ls.validateLicense(ent.licenseKey, ent.instanceId);
  if (!check.reachable) return; // offline — trust what we have, try again later

  const fresh: fb.Entitlement = {
    ...ent,
    active: check.ok,
    expiresAt: check.expiresAt ?? null,
    lastCheckedAt: Date.now(),
  };
  await cacheEntitlement(entitlementActive(fresh) ? fresh : null);

  // Mirror the verdict onto the vessel so the other devices learn it too. Only a
  // Master may write it; on anyone else this quietly fails, which is fine —
  // each device re-checks for itself.
  try {
    const uid = await fb.currentVesselKey();
    if (uid) await fb.saveEntitlement(uid, fresh);
  } catch {
    /* not the Master, or offline */
  }
}

/** @deprecated Use `activateLicense` — kept so existing callers keep compiling. */
export const activateLicenseWeb = activateLicense;

/**
 * Restore a previous purchase. On web: pull the entitlement from the signed-in
 * account and re-validate the license with LemonSqueezy. Returns true if active.
 */
export async function restore(): Promise<boolean> {
  // Try the vessel's licence first, on every platform — a new phone joining a
  // vessel that already paid should simply find Pro waiting for it.
  {
    const uid = await fb.currentVesselKey();
    if (!uid) return onWeb ? false : restoreFromStore();
    let ent: fb.Entitlement | null = null;
    try {
      ent = await fb.getEntitlement(uid);
    } catch {
      return false;
    }
    if (!ent?.licenseKey) return onWeb ? false : restoreFromStore();
    // Re-check with LemonSqueezy so a cancelled/expired license doesn't linger.
    const check = await ls.validateLicense(ent.licenseKey, ent.instanceId);
    const fresh: fb.Entitlement = { ...ent, active: check.ok, expiresAt: check.expiresAt ?? ent.expiresAt ?? null };
    await cacheEntitlement(entitlementActive(fresh) ? fresh : null);
    if (entitlementActive(fresh) !== ent.active) {
      try { await fb.saveEntitlement(uid, fresh); } catch { /* best-effort */ }
    }
    if (entitlementActive(fresh)) return true;
  }
  return onWeb ? false : restoreFromStore();
}

/** The App Store side of restore, for vessels that bought before licences. */
async function restoreFromStore(): Promise<boolean> {
  const P = await ensureConfigured();
  if (!P) return false;
  try {
    return hasPro(await P.restorePurchases());
  } catch {
    return false;
  }
}

/** Web checkout URL (or null if not on web / not configured). */
export function webCheckoutUrl(): string | null {
  return onWeb && ls.isLemonConfigured() ? ls.LS_CHECKOUT_URL : null;
}

/** Whether the signed-in vessel account is known (web gate needs a login to unlock). */
/**
 * Is this device attached to a vessel, so a licence has somewhere to land?
 *
 * On NATIVE this used to answer an unconditional `true`, which was fine while the
 * licence lived on the handset. It does not now: an unenrolled phone would sail
 * past the guard and fail deep inside the write. The question is the same on
 * every platform — is there a session at all.
 */
export function isSignedIn(): boolean {
  return fb.currentUid() != null;
}

// Generic store account pages — the fallback when RevenueCat has no per-subscription
// managementURL (no active purchase, or a purchase made through another store).
const MANAGE_FALLBACK_URL = Platform.select({
  ios: 'itms-apps://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions?package=com.kukalab.msm',
  default: 'https://apps.apple.com/account/subscriptions',
})!;

/**
 * Open the platform's subscription-management screen (App Store / Google Play).
 * Prefers RevenueCat's CustomerInfo.managementURL, which deep-links to THIS
 * subscription (on Android it opens the specific plan, not the whole list);
 * falls back to the generic store account page when it isn't available.
 */
export async function openManageSubscriptions(): Promise<void> {
  let url = MANAGE_FALLBACK_URL;
  const P = await ensureConfigured();
  if (P) {
    try {
      const info = await P.getCustomerInfo();
      // Null when there's no active/renewable subscription for this store account.
      if (info?.managementURL) url = info.managementURL;
    } catch {
      /* keep the fallback URL */
    }
  }
  try {
    await Linking.openURL(url);
  } catch {
    // If a store deep-link can't be opened, try the generic web account page.
    if (url !== MANAGE_FALLBACK_URL) {
      await Linking.openURL(MANAGE_FALLBACK_URL).catch(() => {});
    } else if (Platform.OS === 'ios') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
    }
  }
}

/** Whether the user currently has an active subscription. */
export async function isSubscribed(): Promise<boolean> {
  // The VESSEL's licence comes first, on every platform. It is read from a local
  // cache because the per-add gate (canAddItem) calls this on every insert; the
  // authoritative copy lives on the vessel account and is refreshed by
  // `activateLicense` and `restore`.
  if (entitlementActive(await cachedEntitlement())) return true;

  if (onWeb) return false;

  // A store subscription still counts where one exists — a vessel that bought
  // through the App Store before licences existed keeps working. It is checked
  // SECOND because it is tied to one Apple ID and therefore unlocks one phone,
  // which is not what a vessel licence is meant to do.
  const P = await ensureConfigured();
  if (!P) return false;
  try {
    return hasPro(await P.getCustomerInfo());
  } catch {
    return false;
  }
}
