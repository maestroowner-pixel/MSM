// Issue or revoke a vessel's API key from here, with admin credentials — for
// support, and for testing the API against the test vessel. The Master's own way
// is Settings → API access (apiKeyCreate / apiKeyRevoke in api.js); this writes
// exactly what they write.
//
//   npm run apikey -- 1234567 "Test — Claude" [--write]     prints the key once
//   npm run apikey -- 1234567 --revoke <keyId>
//
// Credentials: application default (`gcloud auth application-default login`),
// or GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key.

const admin = require('firebase-admin');
const { newKey, sha256 } = require('../api');

admin.initializeApp({ projectId: 'marine-safety-manager' });
const db = admin.firestore();

async function main() {
  const [imo, ...rest] = process.argv.slice(2);
  if (!/^\d{7}$/.test(imo || '')) throw new Error('First argument: the vessel IMO (7 digits).');
  const keys = db.collection(`safety_vessels/${imo}/api_keys`);
  const r = rest.indexOf('--revoke');
  if (r >= 0) {
    const ref = keys.doc(rest[r + 1] || '-');
    const s = await ref.get();
    if (!s.exists) throw new Error('No such key on this vessel.');
    const batch = db.batch();
    if (s.data().hash) batch.delete(db.doc(`api_keys/${s.data().hash}`));
    batch.update(ref, { revokedAt: Date.now(), revokedBy: 'Kuka Soft support' });
    await batch.commit();
    console.log(`Revoked ${ref.id}.`);
    return;
  }
  const label = rest.filter((x) => !x.startsWith('--')).join(' ').trim();
  if (!label) throw new Error('Name the key: npm run apikey -- <IMO> "Office BI" [--write]');
  const key = newKey();
  const ref = keys.doc();
  const batch = db.batch();
  batch.set(db.doc(`api_keys/${sha256(key)}`), { vessel: imo, keyId: ref.id });
  batch.set(ref, { label, write: rest.includes('--write'), hint: `${key.slice(0, 9)}…${key.slice(-4)}`, hash: sha256(key), createdAt: Date.now(), createdBy: 'Kuka Soft support', calls: 0 });
  await batch.commit();
  console.log(`keyId ${ref.id}\n${key}`);
}

main().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
