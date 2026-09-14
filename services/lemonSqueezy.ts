// ===================================
// LemonSqueezy — web license activation / validation.
//
// The web build sells MSM Pro through LemonSqueezy (checkout + license keys).
// After buying, the customer gets a license key by email and pastes it into the
// paywall; we activate it against the LemonSqueezy License API (no secret key
// needed — the license key authenticates itself, so this is safe from the
// browser). The resulting entitlement is stored on the vessel's Firebase account
// (see services/purchases.ts) so it follows the vessel across devices.
//
// CONFIG: fill in the three constants below from your LemonSqueezy dashboard.
//   - LS_CHECKOUT_URL: Store → Products → your product → "Share / Buy link"
//       (e.g. https://kukalab.lemonsqueezy.com/buy/xxxxxxxx-xxxx-...).
//   - LS_STORE_ID / LS_PRODUCT_IDS: numeric ids (Settings → Stores, and the
//       product's API id). Used to reject license keys from other products.
//       Leave 0 / empty to skip that check.
// ===================================

const LS_API = 'https://api.lemonsqueezy.com/v1';

/** LemonSqueezy hosted checkout link for the yearly MSM Pro product. */
export const LS_CHECKOUT_URL = 'https://kuka-lab.lemonsqueezy.com/checkout/buy/43d5ae44-87a1-4fd9-8eea-1253c2224651';
/** Numeric store id — a key whose meta.store_id differs is rejected (0 = skip). */
export const LS_STORE_ID = 374407;
/**
 * Product ids a key may belong to — any other meta.product_id is rejected (empty = skip).
 *
 * 1197509 is what the live checkout above SELLS: its cart reads
 * `"product_id":1197509, "variant_id":1872133` for "Marine Safety Manager" at
 * €99 (checked against the checkout page, 14 Sep 2026). The 2.2 release set this
 * to 1205672 alone, so every key a vessel actually bought was refused as "a
 * different product" — a customer's first licence, on 14 Sep 2026. 1205672 is
 * kept only because some key may have been issued against it; it is not what
 * the checkout sells. Re-check the checkout before changing this list: a wrong
 * id here fails silently for every buyer and loudly for none of us.
 */
export const LS_PRODUCT_IDS: number[] = [1197509, 1205672];
/**
 * The vessel licence price, shown in the app. LemonSqueezy exposes no price API
 * on this path, so it is written here and MUST be kept in step with the product
 * in the LemonSqueezy dashboard — if they disagree, the customer sees one figure
 * and is charged another.
 *
 * Per VESSEL (one IMO), per year — not per person and not per device. Every
 * enrolled device on that vessel inherits the licence from the account.
 */
export const LS_PRICE_STRING = '€99';

export function isLemonConfigured(): boolean {
  return !LS_CHECKOUT_URL.startsWith('PASTE');
}

export interface LicenseResult {
  ok: boolean;
  message?: string;
  /**
   * True when LemonSqueezy actually ANSWERED. A vessel at sea gets `ok:false`
   * because the request never left the ship, and that must never be mistaken for
   * "this licence is no longer valid" — the difference decides whether Pro is
   * switched off. Only a definitive answer may revoke.
   */
  reachable?: boolean;
  /** Subscription expiry (ms epoch) if the key carries one, else null (perpetual). */
  expiresAt?: number | null;
  /** LemonSqueezy activation instance id (needed to deactivate later). */
  instanceId?: string;
  licenseKey?: string;
}

async function lsPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${LS_API}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  // The license endpoints return JSON with 200 or 400; parse either way.
  return res.json();
}

function checkProduct(meta: any): string | null {
  const wrongStore = LS_STORE_ID && Number(meta?.store_id) !== LS_STORE_ID;
  const wrongProduct = LS_PRODUCT_IDS.length && !LS_PRODUCT_IDS.includes(Number(meta?.product_id));
  if (!wrongStore && !wrongProduct) return null;
  // Name what the key IS for, so a key from another Kuka Lab app explains itself
  // instead of sending the customer (and us) looking for a fault in this one.
  const name = typeof meta?.product_name === 'string' && meta.product_name.trim();
  return name
    ? `This licence key is for "${name}", not Marine Safety Manager.`
    : 'This license key is for a different product.';
}

function readStatus(data: any): LicenseResult | null {
  // For a yearly SUBSCRIPTION the key stays active and `expires_at` is null while
  // the subscription runs; LemonSqueezy flips this STATUS when it ends. So status
  // is the authority, not the date — a null expiry does not mean perpetual.
  const status = data?.license_key?.status; // active | expired | disabled | inactive
  if (status && status !== 'active') {
    return { ok: false, reachable: true, message: `License key is ${status}.` };
  }
  const exp = data?.license_key?.expires_at;
  return {
    ok: true,
    expiresAt: exp ? Date.parse(exp) : null,
    instanceId: data?.instance?.id,
  };
}

/**
 * Activate a license key for this app (creates an activation instance). Returns
 * ok:true with the entitlement details, or ok:false with a user-facing message.
 */
export async function activateLicense(key: string): Promise<LicenseResult> {
  const license_key = key.trim();
  if (!license_key) return { ok: false, message: 'Enter your license key.' };
  try {
    const instance_name = `MSM Web ${new Date().toISOString().slice(0, 10)}`;
    const data = await lsPost('/licenses/activate', { license_key, instance_name });
    if (data?.activated === true || data?.valid === true) {
      const bad = checkProduct(data?.meta);
      if (bad) return { ok: false, message: bad };
      const parsed = readStatus(data);
      if (parsed && parsed.ok) return { ...parsed, licenseKey: license_key };
    }
    // Activate can fail even for a valid key (e.g. activation limit reached from
    // earlier testing). Fall back to validate — the customer still owns the key.
    const v = await validateLicense(license_key);
    if (v.ok) return { ...v, licenseKey: license_key };
    return { ok: false, message: v.message || humanError(data) };
  } catch (e: any) {
    return { ok: false, message: `Could not reach LemonSqueezy: ${String(e?.message ?? e)}` };
  }
}

/** Validate a previously-activated key (used to re-check on restore / app open). */
export async function validateLicense(key: string, instanceId?: string): Promise<LicenseResult> {
  const license_key = key.trim();
  if (!license_key) return { ok: false, message: 'No license key.' };
  try {
    const params: Record<string, string> = { license_key };
    if (instanceId) params.instance_id = instanceId;
    const data = await lsPost('/licenses/validate', params);
    if (data?.valid !== true) return { ok: false, reachable: true, message: humanError(data) };
    const bad = checkProduct(data?.meta);
    if (bad) return { ok: false, reachable: true, message: bad };
    const parsed = readStatus(data);
    return parsed
      ? { ...parsed, reachable: true, licenseKey: license_key }
      : { ok: false, reachable: true, message: 'Invalid license key.' };
  } catch (e: any) {
    return { ok: false, reachable: false, message: `Could not reach LemonSqueezy: ${String(e?.message ?? e)}` };
  }
}

function humanError(data: any): string {
  const err = data?.error;
  if (typeof err === 'string' && err) return err;
  return 'Invalid or unrecognized license key.';
}
