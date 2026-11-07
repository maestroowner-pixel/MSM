// ===================================
// Limits for the public HTTP endpoints (plan item 61, 7 Nov 2026).
//
// submitObs, inspectView, icsCalendar and api answer anyone who has the link — no
// enrolment, no Firebase sign-in. A link that leaks, or a script hammering one,
// costs Firestore reads and writes billed to us, and submitObs writes into the
// vessel's own records. So:
//   - every public function runs on at most PUBLIC_MAX_INSTANCES instances: a flood
//     queues and gets 429s from the platform instead of scaling the bill;
//   - a writer counts against a window per vessel (`takeOne`, in a transaction, as
//     access.js `vesselGuard` does for PIN guesses);
//   - free text is capped before it is stored.
// Pure parts are tested by `npm run check:publicfns`.
// ===================================

const admin = require('firebase-admin');

const PUBLIC_MAX_INSTANCES = 5;

/** The next state of a window counter, or null when the window is full. Pure. */
function nextCount(cur, max, windowMs, now = Date.now()) {
  const fresh = cur && typeof cur.since === 'number' && now - cur.since < windowMs ? cur : { since: now, count: 0 };
  return fresh.count >= max ? null : { since: fresh.since, count: fresh.count + 1 };
}

/** Takes one from the allowance kept at `path`; false when it is used up. */
async function takeOne(path, max, windowMs) {
  const db = admin.firestore();
  const ref = db.doc(path);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = nextCount(snap.exists ? snap.data() : null, max, windowMs, now);
    if (next) tx.set(ref, next);
    return !!next;
  });
}

/** A trimmed string no longer than `max`, or '' for anything that is not a string. */
const capped = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** For text put into an HTML page — a vessel name is typed by anyone aboard. */
const escHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = { PUBLIC_MAX_INSTANCES, nextCount, takeOne, capped, escHtml };
