// ===================================
// Duplicate connections, retired by the server (15 Oct 2026: "let the server
// switch the duplicates off itself"). Every new browser address, cleared browser
// storage or reinstalled phone joins as a NEW device and the old record stays, so
// a vessel's tables filled with five "Master Nemo · Web". The app hides them and
// offers to switch them off (types/role.ts olderConnections); here the server
// does it without being asked:
//
//   on enrolment  the person's other connections of the same rank and kind of
//                 device are retired — the new one is the one in use.
//   every day     on every vessel, an older connection not seen for three days
//                 is retired; the one seen last stays.
//
// RETIRED, NOT SWITCHED OFF. A retired record is `disabled` (gone from the
// tables) with `retiredAt` — and comes back by itself the next time that install
// opens the app and presents its secret (index.js `refresh`, `enrol`). A person
// with two browsers in real use is never locked out; only connections nobody uses
// stay away. The Master's own "Switch off" clears `retiredAt` (services/accounts
// disableDevice), and that one holds.
//
// Grouping is the app's: name, rank, kind of device. Shore accounts and anything
// not approved are left alone.
// ===================================

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const ROOT = 'safety_vessels';
const REGION = 'europe-west1';
const IDLE_MS = 3 * 24 * 60 * 60 * 1000;

const personName = (d) => [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
const seen = (d) => d.lastSeenAt || d.createdAt || 0;

/**
 * Which connections to retire. `keepId` (the device just enrolled) is kept in its
 * group and the rest go whatever their age; without it, the one seen last is kept
 * and the others go once idle for `idleMs`. Pure — tested from a Mac.
 * Returns [{ id, keep }].
 */
function retirable(devices, { keepId, now = Date.now(), idleMs = IDLE_MS } = {}) {
  const live = devices.filter((d) => d.approved === true && !d.disabled && d.role !== 'shore' && personName(d));
  const key = (d) => [personName(d).toLowerCase().replace(/\s+/g, ' '), d.role, d.platform || ''].join('|');
  const groups = new Map();
  for (const d of live) groups.set(key(d), [...(groups.get(key(d)) || []), d]);
  const out = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const mine = keepId ? g.find((d) => d.id === keepId) : null;
    if (keepId && !mine) continue; // enrolment touches only the enrolling person's group
    const keep = mine || [...g].sort((a, b) => seen(b) - seen(a) || String(a.id).localeCompare(String(b.id)))[0];
    for (const d of g) if (d.id !== keep.id && (mine || now - seen(d) >= idleMs)) out.push({ id: d.id, keep: keep.id });
  }
  return out;
}

async function retireDuplicates(vessel, keepId) {
  const db = admin.firestore();
  const snap = await db.collection(`${ROOT}/${vessel}/devices`).get();
  const devices = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const todo = retirable(devices, keepId ? { keepId } : {});
  const now = Date.now();
  for (const { id, keep } of todo) {
    await db.doc(`${ROOT}/${vessel}/devices/${id}`).set({ disabled: true, retiredAt: now, retiredFor: keep }, { merge: true });
    console.log(`[devices] ${vessel}: retired ${id} (older connection of ${keep})`);
  }
  return todo.length;
}

/** The fields that bring a retired connection back — written when it opens the app again. */
const revive = () => ({ disabled: false, retiredAt: FieldValue.delete(), retiredFor: FieldValue.delete() });

exports.retirable = retirable;
exports.retireDuplicates = retireDuplicates;
exports.revive = revive;

exports.devicesDedupSweep = onSchedule({ schedule: 'every day 03:30', timeZone: 'UTC', region: REGION, timeoutSeconds: 300 }, async () => {
  const snap = await admin.firestore().collectionGroup('devices').select('approved', 'disabled').get();
  const live = new Map();
  snap.docs.forEach((d) => {
    const v = d.ref.parent.parent;
    if (!v || v.parent.id !== ROOT || d.get('approved') !== true || d.get('disabled')) return;
    live.set(v.id, (live.get(v.id) || 0) + 1);
  });
  let retired = 0;
  for (const [vessel, n] of live) if (n > 1) retired += await retireDuplicates(vessel);
  if (retired) console.log(`[devices] sweep retired ${retired}`);
});
