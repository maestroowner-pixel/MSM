// ===================================
// Duplicate inspection rounds, closed by the server (Jez, 14 Oct 2026: two
// identical rounds open on the phone). The app (2.63) refuses to start a round
// that duplicates an open one — but phones on 2.62 and older, or two phones
// starting the same round before they sync, can still make one. Here the
// vessel's own record is put right whatever app made it:
//
//   on create   a new round that repeats an open one — the same period, a
//               category in common — is closed at once as a duplicate.
//   every hour  every vessel is looked over, for duplicates made before this
//               existed or while a phone was offline.
//
// The earlier round is kept (the earliest start, then the id); a later one whose
// categories it covers whole is closed with a note (a later one reaching wider is
// left open — the app's warning asks an officer). Every inspection counts towards the open round covering
// it, so nothing done in the duplicate is lost. Phones pick the closure up at
// their next sync, 2.62 included.
// ===================================

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const ROOT = 'safety_vessels';
const REGION = 'europe-west1';

/** Which open rounds to close: each that repeats an earlier open one. Pure — tested from a Mac. */
function duplicatesOf(rounds) {
  const open = rounds.filter((r) => !r.closedAt).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0) || String(a.id).localeCompare(String(b.id)));
  const kept = [];
  const close = [];
  for (const r of open) {
    // Only a round the kept one covers whole: closing a wider one would drop the categories only it had.
    const same = kept.find((k) => k.period === r.period && (r.categories || []).length > 0 && (r.categories || []).every((c) => (k.categories || []).includes(c)));
    if (same) close.push({ round: r, keep: same });
    else kept.push(r);
  }
  return close;
}

const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

async function closeDuplicates(vessel) {
  const db = admin.firestore();
  const snap = await db.collection(`${ROOT}/${vessel}/rounds`).get();
  const rounds = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const todo = duplicatesOf(rounds);
  const now = Date.now();
  for (const { round, keep } of todo) {
    await db.doc(`${ROOT}/${vessel}/rounds/${round.id}`).update({
      closedAt: now,
      closedBy: 'ISM AI Pilot (automatic)',
      closeNote: `Duplicate of the round started ${stamp(keep.startedAt)} by ${keep.startedBy || '—'} — closed automatically; its inspections count in that round.`,
      updatedAt: now,
    });
    console.log(`[rounds] ${vessel}: closed ${round.id} (duplicate of ${keep.id})`);
  }
  return todo.length;
}

exports.duplicatesOf = duplicatesOf;

// The trigger runs where the database is (nam5 — the US multi-region).
exports.roundsDedupOnCreate = onDocumentCreated({ document: `${ROOT}/{vessel}/rounds/{id}`, region: 'us-central1' }, async (event) => {
  await closeDuplicates(event.params.vessel);
});

exports.roundsDedupSweep = onSchedule({ schedule: 'every 60 minutes', timeZone: 'UTC', region: REGION, timeoutSeconds: 300 }, async () => {
  const snap = await admin.firestore().collectionGroup('rounds').select('closedAt').get();
  const open = new Map();
  snap.docs.forEach((d) => {
    if (d.data().closedAt) return;
    const vessel = d.ref.parent.parent && d.ref.parent.parent.id;
    if (vessel && d.ref.parent.parent.parent.id === ROOT) open.set(vessel, (open.get(vessel) || 0) + 1);
  });
  let closed = 0;
  for (const [vessel, n] of open) if (n > 1) closed += await closeDuplicates(vessel);
  if (closed) console.log(`[rounds] sweep closed ${closed}`);
});
