// The store reviewers' account (14 Nov 2026): a Master invitation on our demo
// vessel, marked `review: true`, which the enrol function keeps open — no 48
// hours, any number of devices (functions/access.js isReviewInvite). Its details
// go into App Store Connect (App Review Information → Sign-in) and Play Console
// (App content → App access).
//
// Example: `npm run review-invite`            (create it, or show the one there is)
//          `npm run review-invite -- --new-pin` (a new PIN; the old one stops working)
//          `npm run review-invite -- --revoke`  (close it)
//
// Credentials: application default (`gcloud auth application-default login`).

const crypto = require('crypto');
const admin = require('firebase-admin');
const { REVIEW_VESSELS } = require('../access');

const PROJECT = 'marine-safety-manager';
const VESSEL = REVIEW_VESSELS[0];
const ID = 'inv_app_review';
const NAME = { firstName: 'App', lastName: 'Review' };

const pin = () => String(crypto.randomInt(0, 1e8)).padStart(8, '0'); // types/role PIN_LENGTH

async function main() {
  const args = process.argv.slice(2);
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const vessel = await db.doc(`safety_vessels/${VESSEL}`).get();
  if (!vessel.exists) throw new Error(`safety_vessels/${VESSEL} does not exist`);
  const ref = db.doc(`safety_vessels/${VESSEL}/invites/${ID}`);
  const cur = (await ref.get()).data();

  if (args.includes('--revoke')) {
    await ref.set({ revoked: true }, { merge: true });
    console.log('The reviewers\' invitation is closed.');
    return;
  }
  if (!cur || args.includes('--new-pin') || cur.revoked) {
    await ref.set({
      ...NAME,
      pin: args.includes('--new-pin') || !cur ? pin() : cur.pin,
      role: 'superadmin',
      position: 'Master',
      review: true,
      revoked: false,
      createdAt: cur?.createdAt ?? Date.now(),
      createdBy: 'review-invite.js',
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      activations: cur?.activations ?? [],
    }, { merge: true });
  }
  const inv = (await ref.get()).data();
  const name = vessel.get('vessel_name') || vessel.get('name') || '';
  console.log(`Vessel: ${name ? name + ', ' : ''}IMO ${VESSEL}`);
  console.log(`First name: ${inv.firstName}\nLast name: ${inv.lastName}\nPIN: ${inv.pin}`);
  console.log(`Joined from ${(inv.activations || []).length} device(s).`);
}

main().catch((e) => {
  console.error(e.message || e);
  if (/credentials/i.test(String(e))) console.error('Hint: `gcloud auth application-default login` and try again.');
  process.exit(1);
});
