// ===================================
// Subscriptions — UI-only stub for now; RevenueCat plugs in here later.
//
// The PaywallSc screen talks ONLY to this module, so wiring real purchases is a
// drop-in: implement the four functions with `react-native-purchases`
// (RevenueCat) and the screen keeps working unchanged.
//
// Offer: 1-month free trial, then a yearly subscription. Real, per-store
// localized prices (e.g. "$9.99", "€9,99", "₴399,00") come from RevenueCat's
// annual package once configured; until then `getOffer()` returns FALLBACK
// (available:false) so the screen shows a price but the buttons explain that
// purchasing isn't live yet.
// ===================================

export const TRIAL_DAYS = 30;

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
  priceString: '$10.00',
  period: 'year',
  trialDays: TRIAL_DAYS,
  available: false,
};

/** The yearly offer to display on the paywall. */
export async function getOffer(): Promise<Offer> {
  // TODO(revenuecat): const offerings = await Purchases.getOfferings();
  //   const pkg = offerings.current?.annual;
  //   return { priceString: pkg.product.priceString, period: 'year',
  //            trialDays: TRIAL_DAYS, available: true };
  return FALLBACK;
}

/** Start the yearly subscription (with the free trial). Returns true on success. */
export async function purchaseYearly(): Promise<boolean> {
  // TODO(revenuecat): await Purchases.purchasePackage(annualPackage);
  //   return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}

/** Restore a previous purchase. Returns true if an active entitlement was found. */
export async function restore(): Promise<boolean> {
  // TODO(revenuecat): const info = await Purchases.restorePurchases();
  //   return info.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}

/** Whether the user currently has an active subscription. */
export async function isSubscribed(): Promise<boolean> {
  // TODO(revenuecat): const info = await Purchases.getCustomerInfo();
  //   return info.entitlements.active[ENTITLEMENT_ID] != null;
  return false;
}
