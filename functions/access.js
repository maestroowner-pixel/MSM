// ===================================
// Who is still let in, said by the vessel's device register — not by a token
// (7 Nov 2026, "protect the vessel's data and the connection to it").
//
// A token's claims outlive the decision that granted them: Firebase renews a
// session with the same claims for as long as the install keeps it. A device the
// Master switched off or removed went on reading and writing — a lost phone, a
// browser left in an office. firestore.rules and storage.rules now read the
// device's record on every request (`live`); the callables check it here; and a
// switch-off revokes the device's sessions (`revokeOnSwitchOff`).
//
// Invitations that approve THEMSELVES — Master and shore — no longer stand open
// for ever: 48 hours from the PIN, and one device (`inviteClosed`). The Master
// knows an invitation is out and says so in a letter; any other invitation still
// waits for a Master or Officer to approve the device it brings.
//
// Guessing at a PIN is counted per vessel too (`vesselGuard`): the per-device
// counter alone was keyed by an id the caller makes up.
// Pure parts are tested by `npm run check:access-server`.
// ===================================

const { HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const ROOT = 'safety_vessels';

// ---- the device record --------------------------------------------------------

/** Approved and not switched off. Retired as a duplicate (devices.js) is not switched off. */
function isLive(d) {
  return !!d && d.approved === true && !(d.disabled === true && !d.retiredAt);
}

/** Switched off by the Master — what `revokeOnSwitchOff` reacts to. */
const switchedOff = (d) => !!d && d.disabled === true && !d.retiredAt;

/**
 * The caller's device record on `vessel`, live — or a refusal. `roles` narrows it
 * (the record's role, as the rules take the lower of token and record).
 */
async function liveDevice(vessel, deviceId, roles) {
  if (!vessel || !deviceId) throw new HttpsError('permission-denied', 'This device is not on the vessel.');
  const snap = await admin.firestore().doc(`${ROOT}/${vessel}/devices/${deviceId}`).get();
  const d = snap.exists ? snap.data() : null;
  if (!isLive(d)) throw new HttpsError('permission-denied', 'This device has been switched off or removed by the Master.');
  if (roles && !roles.includes(d.role)) throw new HttpsError('permission-denied', 'Your account cannot do this.');
  return d;
}

/** The same for a crew token's claims (`req.auth.token`). */
const liveCaller = (t, roles) => liveDevice(String(t.vessel || ''), String(t.deviceId || ''), roles);

/**
 * Switched off or removed → the device's sessions are revoked, so not even a fresh
 * ID token is minted for it. The rules already refuse it; this closes whatever reads
 * a token without them. Shore accounts are left alone: one session serves the whole
 * fleet, and the rules drop the vessel from it.
 */
const revokeOnSwitchOff = onDocumentWritten(
  { document: `${ROOT}/{vessel}/devices/{deviceId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!before || before.role === 'shore' || (after && after.role === 'shore')) return;
    const gone = !after || (switchedOff(after) && !switchedOff(before));
    if (!gone) return;
    const { vessel, deviceId } = event.params;
    try {
      await admin.auth().revokeRefreshTokens(`${vessel}__${deviceId}`);
      console.log(`[access] ${vessel}: sessions of ${deviceId} revoked (${after ? 'switched off' : 'removed'})`);
    } catch (e) {
      // Never signed in (no such user) — nothing to revoke.
      if (e?.code !== 'auth/user-not-found') throw e;
    }
  }
);

// ---- invitations that approve themselves ----------------------------------------

const SELF_APPROVING = ['superadmin', 'shore'];
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

const millis = (v) => (typeof v === 'number' ? v : v && typeof v.toMillis === 'function' ? v.toMillis() : 0);

/**
 * Why a matched invitation may not be used: null (it may), 'expired' (older than
 * 48 hours) or 'used' (another device joined on it since this PIN). The same device
 * again is let through — an enrolment whose reply never arrived is tried again.
 * `issuedAt` is the server's clock (app 2.73+); an older app writes only
 * `createdAt`, its own clock, and does not restamp a new PIN — there the 48 hours
 * run from the invitation itself.
 */
function inviteClosed(invite, deviceId, now = Date.now()) {
  if (!invite || !SELF_APPROVING.includes(invite.role)) return null;
  const issued = millis(invite.issuedAt) || millis(invite.createdAt);
  if (!issued) return 'expired';
  const others = (invite.activations || []).filter((a) => a.deviceId !== deviceId && millis(a.at) >= issued);
  if (others.length) return 'used';
  return now - issued > INVITE_TTL_MS ? 'expired' : null;
}

const CLOSED_TEXT = {
  expired: 'This invitation has expired (48 hours). Ask the Master for a new PIN.',
  used: 'This invitation has already been used on another device. Ask the Master for a new PIN.',
};

// ---- guesses per vessel -----------------------------------------------------------

const VESSEL_MAX = 20;
const VESSEL_WINDOW_MS = 15 * 60 * 1000;

/** The next state of the vessel's counter, or null when the window is full. Pure. */
function nextGuard(cur, now = Date.now()) {
  const fresh = cur && now - cur.since < VESSEL_WINDOW_MS ? cur : { since: now, count: 0 };
  return fresh.count >= VESSEL_MAX ? null : { since: fresh.since, count: fresh.count + 1 };
}

/**
 * Takes one try from the vessel's allowance before the PIN is looked at — in a
 * transaction, so a burst of parallel calls cannot all read the same count — and
 * gives it back when the try succeeds. Twenty wrong tries in 15 minutes on a vessel,
 * from any number of device ids, and joining waits.
 */
async function vesselGuard(vessel) {
  const db = admin.firestore();
  const ref = db.doc(`${ROOT}/${vessel}/meta/enrolGuard`);
  const now = Date.now();
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = nextGuard(snap.exists ? snap.data() : null, now);
    if (next) tx.set(ref, next);
    return !!next;
  });
  if (!ok) {
    console.warn(`[access] ${vessel}: joining paused — ${VESSEL_MAX} wrong tries in ${VESSEL_WINDOW_MS / 60000} min`);
    throw new HttpsError('resource-exhausted', 'Too many attempts on this vessel. Try again in 15 minutes.');
  }
  return {
    refund: () =>
      db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() : null;
        if (d && d.count > 0) tx.set(ref, { since: d.since, count: d.count - 1 });
      }).catch(() => {}),
  };
}

module.exports = {
  isLive,
  liveDevice,
  liveCaller,
  revokeOnSwitchOff,
  inviteClosed,
  CLOSED_TEXT,
  INVITE_TTL_MS,
  SELF_APPROVING,
  nextGuard,
  vesselGuard,
  VESSEL_MAX,
};
