// ===================================
// Enrolment — issuing accounts, on the server, where the secret can live.
//
// THE PROBLEM THIS SOLVES. Until now every device on a vessel signed in with the
// SAME connection password. That made three things impossible, and the third is
// why this file exists:
//
//   • Revoking one person meant changing the password for everybody.
//   • The Firestore rules could not tell one device from another — every device
//     held identical credentials — so "approved", "master" and "member" were
//     honest arrangements between colleagues rather than restrictions.
//   • There was no way to ISSUE an account to somebody. You told them a password.
//
// Now a Master issues an invitation — a name and an eight-digit PIN — and the
// device that enrols with it gets its own token, carrying claims:
//
//     vessel      which vessel's register this device may touch (the IMO digits)
//     role        user | admin | superadmin
//     approved    true, or no token is issued at all
//     deviceId    which install it is
//
// `firestore.rules` is written against those claims, so a promotion means a NEW
// token and nothing on a device can be edited into one.
//
// WHAT AN ATTACKER HAS AFTER THIS. An app containing no credentials, and a
// function that answers only to a name and a PIN it does not know, rate-limited
// here where the counter cannot be reached.
//
// WHAT THIS DOES NOT DO. It does not stop somebody who was given a real PIN and
// approved — an insider is still an insider. App Check would be the next layer,
// refusing calls that do not come from a genuine build at all.
//
// Ported from DEM/NSeaStoreManager (/Users/DEM/functions/index.js). Simplified
// where MSM does not need the difference: no locations, no chat push tokens, and
// no FNV legacy hash — MSM has no invitations written by an older scheme, so new
// ones are salted SHA-256 from the first day.
// ===================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const ROOT = 'safety_vessels';
const REGION = 'europe-west1';

/**
 * Stands in for an invitation while a vessel has none — the very first device,
 * which then invites everybody else.
 *
 * A SECRET, not a constant in the app: that is the entire point. Set it with
 *   npx firebase-tools functions:secrets:set BOOTSTRAP_CODE
 */
const BOOTSTRAP_CODE = defineSecret('BOOTSTRAP_CODE');

// ---- hashing ---------------------------------------------------------------

/** Salted per invitation, so two people with the same PIN do not share a hash
 *  and a stolen list cannot be reversed wholesale. */
function sha(pin, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}::${String(pin).trim().toLowerCase()}`)
    .digest('hex');
}

function newSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function secretHash(secret, salt) {
  return crypto.createHash('sha256').update(`${salt}::${String(secret)}`).digest('hex');
}

/** Constant time — a comparison that returns on the first wrong byte tells the
 *  person guessing how much of the guess was right. */
function secretMatches(secret, device) {
  if (!device?.secretHash || !device?.secretSalt || !secret) return false;
  const want = Buffer.from(device.secretHash, 'utf8');
  const got = Buffer.from(secretHash(secret, device.secretSalt), 'utf8');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Find a live invitation matching the name and PIN, or null. */
function matchInvite(invites, firstName, lastName, pin) {
  const want = nameKey(firstName, lastName);
  const typed = String(pin).trim().toLowerCase();
  return (
    invites.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((i) => {
        if (i.revoked) return false;
        if (nameKey(i.firstName, i.lastName) !== want) return false;
        if (i.pin) return String(i.pin).trim().toLowerCase() === typed;
        return !!(i.pinSalt && i.pinSha) && i.pinSha === sha(pin, i.pinSalt);
      }) || null
  );
}

/**
 * Log WHICH half was wrong. The reply to the caller stays one message for a bad
 * name and a bad PIN — saying which was right gives away the half that was — but
 * whoever is asked "why can't I get in" needs the answer, and in practice it is
 * nearly always the spelling of a name.
 */
function logRefusal(invites, deviceId, vessel, firstName, lastName) {
  const want = nameKey(firstName, lastName);
  const nameHit = invites.docs.some(
    (d) => !d.data().revoked && nameKey(d.data().firstName, d.data().lastName) === want
  );
  console.warn(
    `[enrol] refused ${deviceId} on ${vessel}: typed "${(firstName || '').trim()} ` +
      `${(lastName || '').trim()}" — ` +
      (nameHit ? 'the name matched an invitation, the PIN did not' : 'no invitation carries that name')
  );
}

const nameKey = (first, last) =>
  `${String(first || '').trim().toLowerCase()}|${String(last || '').trim().toLowerCase()}`;

/** The IMO digits are the vessel id. Normalised here so "IMO 9876543" and
 *  "9876543" cannot become two different vessels. */
const vesselKey = (v) => String(v || '').replace(/\D/g, '');

// ---- rate limiting ---------------------------------------------------------
// Kept in Firestore under the vessel, where the person guessing cannot reach it:
// the rules deny every client write to this collection and only the Admin SDK
// (which ignores rules) touches it.

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

async function checkRate(vessel, deviceId) {
  const ref = db.doc(`${ROOT}/${vessel}/enrolAttempts/${deviceId || 'unknown'}`);
  const now = Date.now();
  const snap = await ref.get();
  const d = snap.exists ? snap.data() : null;
  const fresh = d && now - d.since < WINDOW_MS ? d : { since: now, count: 0 };

  if (fresh.count >= MAX_ATTEMPTS) {
    const wait = Math.ceil((fresh.since + WINDOW_MS - now) / 60000);
    throw new HttpsError(
      'resource-exhausted',
      `Too many attempts. Try again in about ${wait} minute${wait === 1 ? '' : 's'}.`
    );
  }
  return {
    fail: () => ref.set({ since: fresh.since, count: fresh.count + 1 }, { merge: true }),
    clear: () => ref.delete().catch(() => {}),
  };
}

// ---- enrol -----------------------------------------------------------------

exports.enrol = onCall({ secrets: [BOOTSTRAP_CODE], region: REGION }, async (req) => {
  const { vessel: rawVessel, firstName, lastName, pin, deviceId, platform, appVersion, takeover } =
    req.data || {};
  const vessel = vesselKey(rawVessel);

  if (!vessel || !deviceId || !pin) {
    throw new HttpsError('invalid-argument', 'vessel, deviceId and pin are required.');
  }

  const rate = await checkRate(vessel, deviceId);

  const invitesRef = db.collection(`${ROOT}/${vessel}/invites`);
  const invites = await invitesRef.get();

  // Is there anybody left who could approve a new device? If a vessel has no
  // APPROVED device at all, the bootstrap code is accepted again regardless of
  // how many invitations exist. Without this a vessel locks itself out: the sole
  // Master clears their browser data, comes back as a new device id, and lands in
  // a queue that only they could have emptied. Recovery previously meant editing
  // Firestore by hand.
  const devicesSnap = await db.collection(`${ROOT}/${vessel}/devices`).get();
  const anyApproved = devicesSnap.docs.some((d) => d.data()?.approved === true && !d.data()?.disabled);

  // TAKEOVER. "No approved device left" is not the shape the real failure takes:
  // clearing a browser's data destroys the device's SECRET but leaves its record
  // in the register, approved and looking healthy — so the vessel still has a
  // Master on paper and its only human is stuck in a queue nobody can empty.
  //
  // The honest recovery is a deliberate one: the holder of the setup code says,
  // in as many words, that they are taking the vessel over. The app asks first
  // and only then sends `takeover`. It is not granted silently, because the code
  // is shared across every vessel and an IMO is public — quietly minting a Master
  // for anyone who typed both would be a back door, not a recovery.
  const wantsTakeover = takeover === true && String(pin).trim() === BOOTSTRAP_CODE.value();

  let invite = null;

  if (invites.empty || !anyApproved || wantsTakeover) {
    // Nobody has set this vessel up. The bootstrap code stands in for an
    // invitation — and it never left the server.
    if (String(pin).trim() !== BOOTSTRAP_CODE.value()) {
      // With invitations present this is not necessarily a bootstrap attempt —
      // fall through and try the invitations before refusing.
      if (!invites.empty) {
        invite = matchInvite(invites, firstName, lastName, pin);
        if (!invite) {
          await rate.fail();
          logRefusal(invites, deviceId, vessel, firstName, lastName);
          throw new HttpsError('permission-denied', 'Those details are not recognised.');
        }
      } else {
        await rate.fail();
        throw new HttpsError('permission-denied', 'Those details are not recognised.');
      }
    }
  } else {
    invite = matchInvite(invites, firstName, lastName, pin);
    if (!invite) {
      await rate.fail();
      logRefusal(invites, deviceId, vessel, firstName, lastName);
      throw new HttpsError('permission-denied', 'Those details are not recognised.');
    }
  }

  // ---- the device's standing ----------------------------------------------
  const deviceRef = db.doc(`${ROOT}/${vessel}/devices/${deviceId}`);
  const deviceSnap = await deviceRef.get();
  const device = deviceSnap.exists ? deviceSnap.data() : null;

  if (device?.disabled) {
    throw new HttpsError('permission-denied', 'This device has been switched off.');
  }

  // The REGISTER wins for a device already in it; an invitation only proposes a
  // role for one that is not. The other way round undoes promotions: a Master
  // invited long ago as an officer would be demoted by re-enrolling his own
  // handset after a reinstall — same device id — leaving nobody able to approve
  // anyone. Demotions still work; they are made in Accounts, which writes the
  // record this line reads.
  let role = device?.role || invite?.role || 'user';
  let approved = device?.approved === true;

  // An invitation that grants MASTER approves its own device. Only a Master can
  // issue one, so the trust decision was already made — deliberately, by a person
  // — when the invitation was created; making them then approve the device is
  // asking the same question twice. It also unsticks the common case: a Master
  // whose browser data was cleared comes back as a new device id and would
  // otherwise queue for an approval only they could grant.
  if (!approved && invite?.role === 'superadmin') approved = true;

  // The first device on an unclaimed vessel becomes Master, because there is
  // nobody who could approve it. Claimed in a transaction so two devices setting
  // up at the same moment cannot both win.
  const markerRef = db.doc(`${ROOT}/${vessel}/meta/bootstrap`);
  const claimed = await db.runTransaction(async (tx) => {
    const marker = await tx.get(markerRef);
    // Re-claimable when the vessel has no approved device left — see the note
    // above `anyApproved`. Otherwise the marker is claimed exactly once.
    if (marker.exists && anyApproved && !wantsTakeover) return false;
    tx.set(markerRef, { deviceId, at: Date.now() });
    return true;
  });

  if (claimed) {
    role = 'superadmin';
    approved = true;
    if (wantsTakeover) {
      console.warn(`[enrol] TAKEOVER of ${vessel} by ${deviceId} using the setup code`);
    }
  }

  // The secret is issued HERE, past the PIN check, and re-issued on every
  // successful enrolment — so re-enrolling invalidates whatever an old install
  // was holding, which is what is wanted when a handset is lost.
  const now = Date.now();
  const secret = newSecret();
  const secretSalt = crypto.randomBytes(8).toString('hex');
  await deviceRef.set(
    {
      id: deviceId,
      secretSalt,
      secretHash: secretHash(secret, secretSalt),
      firstName: invite?.firstName ?? firstName ?? '',
      lastName: invite?.lastName ?? lastName ?? '',
      // Rank aboard, from the invitation only — a device does not get to name
      // its own rank, or the signature line would be self-declared. Bootstrap
      // has no invitation, hence the empty string rather than undefined
      // (Firestore rejects undefined outright).
      position: invite?.position ?? device?.position ?? '',
      role,
      approved,
      platform: platform ?? device?.platform ?? null,
      appVersion: appVersion ?? null,
      lastSeenAt: now,
      createdAt: device?.createdAt ?? now,
    },
    { merge: true }
  );

  if (invite) {
    // The activation journal, written where the device it describes cannot edit
    // it — the difference between a record and a claim.
    const others = (invite.activations || []).filter((a) => a.deviceId !== deviceId);
    await invitesRef.doc(invite.id).set(
      { activations: [...others, { deviceId, at: now, platform: platform ?? null }] },
      { merge: true }
    );
  }

  await rate.clear();
  console.log(
    `[enrol] ${deviceId} on ${vessel} via ${invite ? 'invitation ' + invite.id : 'the bootstrap code'} ` +
      `— role ${role}, approved ${approved}`
  );

  if (!approved) {
    // No token. Knowing a PIN gets a device into the queue and no further, and
    // the rules cannot be talked past because there is nothing signed to talk
    // with. The secret still goes out: waiting is exactly when a device has to
    // come back without a PIN, and it opens nothing on its own.
    return { status: 'pending', deviceId, role, deviceSecret: secret };
  }

  const token = await admin.auth().createCustomToken(`${vessel}__${deviceId}`, {
    vessel,
    role,
    approved: true,
    deviceId,
  });

  return {
    status: 'ok',
    token,
    role,
    deviceSecret: secret,
    // From the INVITATION, so the register reads as the person a Master invited
    // rather than as whatever was typed to get in.
    firstName: invite?.firstName ?? firstName ?? '',
    lastName: invite?.lastName ?? lastName ?? '',
    position: invite?.position ?? '',
  };
});

// ---- refresh ---------------------------------------------------------------

/**
 * Ask again without the PIN — for a device left waiting that has since been
 * approved, or whose role changed. Claims are baked into a token when it is
 * minted, so a promotion means a new token.
 *
 * "Without the PIN" is not "without anything": the caller presents the secret it
 * was given at enrolment.
 */
exports.refresh = onCall({ region: REGION }, async (req) => {
  const { vessel: rawVessel, deviceId, deviceSecret } = req.data || {};
  const vessel = vesselKey(rawVessel);
  if (!vessel || !deviceId) {
    throw new HttpsError('invalid-argument', 'vessel and deviceId are required.');
  }

  // Counted against the same window as enrolment, for the same reason: this is a
  // call that can be got wrong, so it is a call that can be guessed at.
  const rate = await checkRate(vessel, deviceId);

  const snap = await db.doc(`${ROOT}/${vessel}/devices/${deviceId}`).get();
  const device = snap.exists ? snap.data() : null;

  if (!device) throw new HttpsError('not-found', 'This device is not in the register.');
  if (device.disabled) throw new HttpsError('permission-denied', 'This device has been switched off.');
  if (!device.secretHash) return { status: 'reenrol', role: device.role ?? 'user' };

  if (!secretMatches(deviceSecret, device)) {
    await rate.fail();
    throw new HttpsError('permission-denied', 'This device is not recognised.');
  }
  await rate.clear();

  if (device.approved !== true) return { status: 'pending', role: device.role ?? 'user' };

  await snap.ref.set({ lastSeenAt: Date.now() }, { merge: true });

  const token = await admin.auth().createCustomToken(`${vessel}__${deviceId}`, {
    vessel,
    role: device.role ?? 'user',
    approved: true,
    deviceId,
  });

  return {
    status: 'ok',
    token,
    role: device.role ?? 'user',
    firstName: device.firstName ?? '',
    lastName: device.lastName ?? '',
    position: device.position ?? '',
  };
});
