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
const { onSchedule } = require('firebase-functions/v2/scheduler');
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

  // Is there anybody left who could issue an account or set a role? If a vessel
  // has no approved MASTER, the bootstrap code is accepted again — and grants
  // Master again — regardless of how many invitations or devices exist. Without
  // this a vessel locks itself out: the sole Master clears their browser data and
  // comes back as a new device id, or taps "Make Officer" on their own row, and
  // nobody is left who could put it right. Recovery previously meant editing
  // Firestore by hand.
  //
  // It is the MASTER that counts, not "any approved device". This first read
  // "any approved device", and a vessel found the gap on 10 Sep 2026: its only
  // device had demoted itself to Officer, it had never issued an invitation, and
  // the bootstrap code was then accepted (no invitations) but handed back the
  // register's role — Officer, approved, status ok. Not pending, not refused, so
  // the takeover button never appeared, and eight enrolments in two days each
  // re-issued the same Officer. An Officer can approve devices but cannot issue
  // an account or change a role, so a vessel with Officers and no Master is as
  // locked out as an empty one. Nothing new is exposed by this: the holder of
  // the setup code could already take such a vessel over explicitly.
  const devicesSnap = await db.collection(`${ROOT}/${vessel}/devices`).get();
  const anyMaster = devicesSnap.docs.some(
    (d) => d.data()?.approved === true && !d.data()?.disabled && d.data()?.role === 'superadmin'
  );

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

  if (invites.empty || !anyMaster || wantsTakeover) {
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
    // Re-claimable when the vessel has no approved Master left — see the note
    // above `anyMaster`. Otherwise the marker is claimed exactly once.
    if (marker.exists && anyMaster && !wantsTakeover) return false;
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
  const { vessel: rawVessel, deviceId, deviceSecret, platform, appVersion } = req.data || {};
  const vessel = vesselKey(rawVessel);
  if (!vessel || !deviceId) {
    throw new HttpsError('invalid-argument', 'vessel and deviceId are required.');
  }

  // Counted against the same window as enrolment, for the same reason: this is a
  // call that can be got wrong, so it is a call that can be guessed at.
  const rate = await checkRate(vessel, deviceId);

  const snap = await db.doc(`${ROOT}/${vessel}/devices/${deviceId}`).get();
  const device = snap.exists ? snap.data() : null;

  // The vessel does not know this device: removed by a Master, or the register
  // was reset. This is NOT an error to sit in — the device holds a secret, so the
  // app would go on believing it is enrolled and would never offer to join
  // again, which strands it with a "could not connect" it cannot act on. Say
  // `reenrol` and let the client forget the secret and start over.
  if (!device) return { status: 'reenrol', role: 'user' };
  if (device.disabled) throw new HttpsError('permission-denied', 'This device has been switched off.');
  if (!device.secretHash) return { status: 'reenrol', role: device.role ?? 'user' };

  if (!secretMatches(deviceSecret, device)) {
    await rate.fail();
    throw new HttpsError('permission-denied', 'This device is not recognised.');
  }
  await rate.clear();

  if (device.approved !== true) return { status: 'pending', role: device.role ?? 'user' };

  // The heartbeat, and with it WHAT IS ACTUALLY INSTALLED.
  //
  // `appVersion` and `platform` used to be written once, at enrolment, and never
  // again — so a device that enrolled on 2.3 and has updated four times since
  // still read as 2.3 in Accounts and in the fleet console. That is worse than
  // no version at all: it is the number a Master would use to decide whether
  // somebody's phone has the round they cannot find. Written on every refresh,
  // the record says what that install is running today.
  //
  // Older clients do not send them, so each is written only when present — an
  // undefined would fail the whole write, and a null would erase what enrolment
  // recorded in exchange for nothing.
  const beat = { lastSeenAt: Date.now() };
  if (typeof appVersion === 'string' && appVersion) beat.appVersion = appVersion;
  if (typeof platform === 'string' && platform) beat.platform = platform;
  await snap.ref.set(beat, { merge: true });

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

// ===================================
// The photo sweep — 90 days in the cloud, then the vessel's own archive.
//
// WHAT IT DOES. Once a night, for each vessel, it deletes the Cloud Storage
// objects belonging to inspections signed before a cutoff, and stamps what it
// did onto the vessel document so the app can show it.
//
// THE CUTOFF IS THE WHOLE SAFETY ARGUMENT, so it is written out here as well as
// in services/photoArchive.ts, where the app computes the same number:
//
//     cutoff = min(now - 90 days, photoArchive.archivedThrough)
//
// and NO archivedThrough means NO deletion at all — not "delete everything".
// A photograph is evidence for a signed record; after this job runs, the only
// copies are the vessel's archive ZIP and whatever devices hold locally. So the
// job refuses to be the reason a vessel has neither: it deletes only inside a
// period a Master has said, in the app, is archived.
//
// WHY IT DELETES BY THE RECORD'S DATE AND NOT THE OBJECT'S AGE. The queue holds
// photographs until the ship has Wi-Fi (services/photoQueue.ts), so a round done
// at sea in March can be uploaded in May. An age-based lifecycle rule on the
// bucket — the obvious alternative to this function — would measure from the
// upload and delete March's evidence two months early, or keep May's uploads two
// months late. The record's `at` is the only date that means anything here, and
// it lives in Firestore, which a lifecycle rule cannot read. That is why this is
// a function.
//
// IT RUNS WITH ADMIN CREDENTIALS, so storage.rules (`delete: if false`) and
// firestore.rules do not apply to it. That is deliberate and it is the design:
// no device, not even the Master's, may delete evidence — only this job may,
// only inside the archived period, and it says afterwards what it removed.
// ===================================

const RETENTION_DAYS = 90;
const DAY_MS = 86400000;

/** The same `min` the app computes (services/photoArchive.ts `sweepCutoff`). */
function sweepCutoff(archive, now) {
  const archivedThrough = Number(archive && archive.archivedThrough) || 0;
  if (archivedThrough <= 0) return 0;
  return Math.min(archivedThrough, now - RETENTION_DAYS * DAY_MS);
}

/**
 * Delete every object under one inspection's folder.
 *
 * By prefix rather than by a listed file name, because the app derives the path
 * from ids (services/photoStorage.ts) and a folder may hold up to four photos;
 * whatever is in there belongs to that record and goes with it.
 */
async function deleteInspectionPhotos(bucket, vessel, inspectionId) {
  const prefix = `${ROOT}/${vessel}/inspections/${inspectionId}/`;
  const [files] = await bucket.getFiles({ prefix });
  if (!files.length) return 0;
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
  return files.length;
}

exports.sweepPhotos = onSchedule(
  {
    // 03:00 UTC: ships are ships, but this is a background job and the hour only
    // needs to be a quiet one for Firestore reads.
    schedule: 'every day 03:00',
    timeZone: 'UTC',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const bucket = admin.storage().bucket();
    const now = Date.now();
    // `select` matters here: a vessel document carries the WHOLE register as one
    // JSON string field (see firebaseService), so reading the collection plainly
    // would pull megabytes per ship every night to look at one small map.
    const vessels = await db.collection(ROOT).select('photoArchive').get();
    let sweptVessels = 0;
    let deletedTotal = 0;

    for (const vesselDoc of vessels.docs) {
      const vessel = vesselDoc.id;
      // Enrolment keys the vessel by its IMO digits; a uid-shaped document is a
      // leftover from the retired sign-in model and holds no photos.
      if (!/^\d{5,9}$/.test(vessel)) continue;

      const cutoff = sweepCutoff(vesselDoc.get('photoArchive'), now);
      if (cutoff <= 0) continue; // nothing archived — nothing may be deleted

      // ONLY THE NEW BAND. Without this the job re-reads every record ever
      // signed before the cutoff, every night, for ever — and does a bucket
      // listing for each one. `sweptThrough` is where the last pass got to, and
      // the 30-day overlap covers the case this app is built around: a
      // photograph queued at sea and uploaded weeks later, after the sweep had
      // already passed its record's date (services/photoQueue.ts).
      const prevArchive = vesselDoc.get('photoArchive') || {};
      const from = Math.max(0, (Number(prevArchive.sweptThrough) || 0) - 30 * DAY_MS);
      if (from >= cutoff) continue; // nothing new to look at tonight

      // `at` is indexed by default, so this reads the band, not the trail.
      const old = await vesselDoc.ref
        .collection('inspections')
        .where('at', '>=', from)
        .where('at', '<', cutoff)
        .select('at') // the ids are what we need; the payload is not
        .get();

      let deleted = 0;
      for (const insp of old.docs) {
        try {
          deleted += await deleteInspectionPhotos(bucket, vessel, insp.id);
        } catch (e) {
          // One unreadable object must not stop the vessel's sweep, let alone
          // the fleet's. It will be picked up again tomorrow.
          console.warn(`[sweep] ${vessel}/${insp.id}: ${e && e.message ? e.message : e}`);
        }
      }

      if (deleted > 0) {
        sweptVessels++;
        deletedTotal += deleted;
      }
      // Stamped even when nothing was deleted, because `sweptThrough` is how the
      // next run knows where to start — a quiet night still moves the mark. The
      // rest is what the app shows: "Last cleared: 12 Oct 2026 · 143 files",
      // from the same field the devices already watch.
      await vesselDoc.ref.set(
        {
          photoArchive: {
            ...prevArchive,
            sweptThrough: cutoff,
            ...(deleted > 0 ? { lastSweepAt: now, lastSweepDeleted: deleted } : {}),
            updatedAt: now,
          },
        },
        { merge: true }
      );
      console.log(`[sweep] ${vessel}: cutoff ${new Date(cutoff).toISOString()}, ${old.size} records, ${deleted} files`);
    }

    console.log(`[sweep] done: ${deletedTotal} files across ${sweptVessels} vessels`);
  }
);
