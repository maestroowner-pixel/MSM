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
//   - LS_STORE_ID / LS_PRODUCT_ID: numeric ids (Settings → Stores, and the
//       product's URL / API). Used to reject license keys from other products.
//       Leave 0 to skip that check.
// ===================================

const LS_API = 'https://api.lemonsqueezy.com/v1';

/** LemonSqueezy hosted checkout link for the yearly MSM Pro product. */
export const LS_CHECKOUT_URL = 'https://kuka-lab.lemonsqueezy.com/checkout/buy/43d5ae44-87a1-4fd9-8eea-1253c2224651';
/** Numeric store id — a key whose meta.store_id differs is rejected (0 = skip). */
export const LS_STORE_ID = 0;
/** Numeric product id — a key whose meta.product_id differs is rejected (0 = skip).
 *  Left at 0: the dashboard URL id (1197509) is NOT necessarily the API product_id,
 *  so checking it can reject valid keys. A key only exists for this store anyway. */
export const LS_PRODUCT_ID = 0;
/** Displayed fallback price until you localize it (LemonSqueezy has no price API here). */
export const LS_PRICE_STRING = '€9.99';

export function isLemonConfigured(): boolean {
  return !LS_CHECKOUT_URL.startsWith('PASTE');
}

export interface LicenseResult {
  ok: boolean;
  message?: string;
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
  if (LS_STORE_ID && Number(meta?.store_id) !== LS_STORE_ID) return 'This license key is for a different product.';
  if (LS_PRODUCT_ID && Number(meta?.product_id) !== LS_PRODUCT_ID) return 'This license key is for a different product.';
  return null;
}

function readStatus(data: any): LicenseResult | null {
  const status = data?.license_key?.status; // active | expired | disabled | inactive
  if (status && status !== 'active') return { ok: false, message: `License key is ${status}.` };
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
    if (data?.valid !== true) return { ok: false, message: humanError(data) };
    const bad = checkProduct(data?.meta);
    if (bad) return { ok: false, message: bad };
    const parsed = readStatus(data);
    return parsed ? { ...parsed, licenseKey: license_key } : { ok: false, message: 'Invalid license key.' };
  } catch (e: any) {
    return { ok: false, message: `Could not reach LemonSqueezy: ${String(e?.message ?? e)}` };
  }
}

function humanError(data: any): string {
  const err = data?.error;
  if (typeof err === 'string' && err) return err;
  return 'Invalid or unrecognized license key.';
}
