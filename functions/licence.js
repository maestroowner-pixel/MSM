// ===================================
// One licence key = one vessel (21 Nov 2026).
//
// Until now the app activated a Lemon Squeezy key in the browser and the Master wrote
// it onto the vessel document. Nothing tied the key to that vessel: when the key's
// activation limit was used up the app fell back to `validate`, which any valid key
// passes, so one subscription could license any number of ships.
//
// Now the key is attached by this callable only:
//   - the caller is a live Master device of the vessel (as apiKeyCreate);
//   - the key is checked with Lemon Squeezy FROM HERE (store + product), so a made-up
//     key cannot be written;
//   - `licence_keys/{sha256(key)}` → {vessel} is created in a transaction. A key held by
//     another vessel is refused; the same vessel may attach it again (a new Master
//     device, a reinstall).
//   - the entitlement is written onto the vessel with admin credentials.
// firestore.rules let a Master change the entitlement only with the SAME key (the daily
// re-check), and nobody reads or writes `licence_keys` from a device.
// Moving a key to another vessel (a ship sold, a mistake): `npm run licence -- free <IMO>`.
// ===================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { liveCaller } = require('./access');

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';
const LS_API = 'https://api.lemonsqueezy.com/v1';
/** Copies of services/lemonSqueezy.ts LS_STORE_ID / LS_PRODUCT_IDS — change both. */
const LS_STORE_ID = 374407;
const LS_PRODUCT_IDS = [1197509, 1205672, 1535056, 1535063, 1535068, 1535069];

const db = () => admin.firestore();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const keyDoc = (key) => `licence_keys/${sha256(String(key).trim())}`;

/** What Lemon Squeezy says of a key: {ok, status, expiresAt, product} or {ok:false, message}. */
async function lsValidate(key, instanceId) {
  const params = new URLSearchParams({ license_key: key });
  if (instanceId) params.set('instance_id', instanceId);
  let data;
  try {
    const r = await fetch(`${LS_API}/licenses/validate`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    data = await r.json();
  } catch (e) {
    throw new HttpsError('unavailable', 'Could not reach Lemon Squeezy — try again in a minute.');
  }
  return readValidation(data);
}

/** Pure: Lemon Squeezy's validate answer → verdict. Exported for the check. */
function readValidation(data) {
  if (!data || data.valid !== true) {
    return { ok: false, message: (data && typeof data.error === 'string' && data.error) || 'Invalid or unrecognised licence key.' };
  }
  const meta = data.meta || {};
  if (Number(meta.store_id) !== LS_STORE_ID || !LS_PRODUCT_IDS.includes(Number(meta.product_id))) {
    const name = typeof meta.product_name === 'string' && meta.product_name.trim();
    return { ok: false, message: name ? `This licence key is for "${name}", not ISM AI Pilot.` : 'This licence key is for a different product.' };
  }
  const lk = data.license_key || {};
  if (lk.status && lk.status !== 'active') return { ok: false, message: `Licence key is ${lk.status}.` };
  return {
    ok: true,
    expiresAt: lk.expires_at ? Date.parse(lk.expires_at) : null,
    variant: typeof meta.variant_name === 'string' ? meta.variant_name : '',
  };
}

/**
 * Pure: may `vessel` take the key, given the registry record (or null)?
 * Exported for the check.
 */
function bindVerdict(record, vessel) {
  if (!record || !record.vessel) return 'bind';
  if (record.vessel === vessel) return 'same';
  return 'taken';
}

const TAKEN = 'This licence key is already in use on another vessel. One key licenses one vessel — buy a licence for this vessel, or write to sales@ismpilot.com if the key should move here.';

const licenceBind = onCall({ region: REGION }, async (req) => {
  const t = (req.auth && req.auth.token) || {};
  if (!t.vessel || t.approved !== true || t.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only the Master can attach the licence to the vessel. Activate it on the Master device.');
  }
  await liveCaller(t, ['superadmin']);
  const vessel = String(t.vessel);
  const key = String((req.data && req.data.key) || '').trim();
  const instanceId = String((req.data && req.data.instanceId) || '').trim().slice(0, 100);
  if (!/^[A-Za-z0-9-]{8,80}$/.test(key)) throw new HttpsError('invalid-argument', 'Enter your licence key.');

  // Refuse a taken key before asking Lemon Squeezy anything.
  const ref = db().doc(keyDoc(key));
  const before = await ref.get();
  if (bindVerdict(before.exists ? before.data() : null, vessel) === 'taken') throw new HttpsError('already-exists', TAKEN);

  const v = await lsValidate(key, instanceId);
  if (!v.ok) throw new HttpsError('failed-precondition', v.message);

  const now = Date.now();
  const ent = {
    active: true,
    provider: 'lemonsqueezy',
    licenseKey: key,
    ...(instanceId ? { instanceId } : {}),
    activatedAt: now,
    expiresAt: v.expiresAt,
    lastCheckedAt: now,
    ...(v.variant ? { plan: v.variant } : {}),
  };
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const verdict = bindVerdict(s.exists ? s.data() : null, vessel);
    if (verdict === 'taken') throw new HttpsError('already-exists', TAKEN);
    if (verdict === 'bind') tx.set(ref, { vessel, boundAt: now, by: String(t.deviceId || '') });
    // update, not set+merge: merge would keep fields of an older entitlement (its instanceId).
    tx.update(db().doc(`${ROOT}/${vessel}`), { entitlement: ent });
  });
  return { entitlement: ent };
});

module.exports = { licenceBind, readValidation, bindVerdict, keyDoc, sha256, LS_STORE_ID, LS_PRODUCT_IDS };
