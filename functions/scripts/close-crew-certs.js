#!/usr/bin/env node
// Plan item 60: move the number and scan of crew passports, visas and medicals out
// of the register into cert_private and crew_docs/. Run once per vessel BEFORE a
// build with closed certificates reaches its devices: a crew device of that build
// sends the register without them, and an officer on an older build would lose its
// only copy. Running it again is safe: what is already moved is not there to find.
//
// Example: `npm run close-certs -- 1234567 --dry`
//          `npm run close-certs -- 1234567`
//
// Credentials: as scripts/set-modules.js.

const crypto = require('crypto');
const admin = require('firebase-admin');
const { isClosedCert } = require('../closedCerts');

const PROJECT = 'marine-safety-manager';
const BUCKET = 'marine-safety-manager.firebasestorage.app';
const FIELDS = ['number', 'fileUri', 'fileName', 'fileKind'];

/** A scan in the vessel's open folder moves to the closed one; its old address stops working. */
async function moveScan(bucket, imo, cert, dry) {
  const m = /\/o\/([^?]+)/.exec(cert.fileUri || '');
  const from = m ? decodeURIComponent(m[1]) : '';
  if (!from.startsWith(`safety_vessels/${imo}/attachments/`)) return cert.fileUri;
  const to = `safety_vessels/${imo}/crew_docs/${cert.id}/scan`;
  if (dry) return `(would move ${from})`;
  const token = crypto.randomUUID();
  await bucket.file(from).copy(bucket.file(to));
  await bucket.file(to).setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  await bucket.file(from).delete();
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(to)}?alt=media&token=${token}`;
}

async function main() {
  const [imo, flag] = process.argv.slice(2);
  if (!/^\d+$/.test(imo || '')) throw new Error('Usage: close-crew-certs <IMO> [--dry]');
  const dry = flag === '--dry';
  admin.initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const ref = db.doc(`safety_vessels/${imo}`);
  const snap = await ref.get();
  const blob = JSON.parse(snap.get('register') || '{}');
  const open = (blob.certificates || []).filter((c) => isClosedCert(c) && FIELDS.some((k) => c[k]));
  console.log(`${imo}: ${open.length} closed certificate(s) with a number or scan in the register`);
  const now = Date.now();
  for (const c of open) {
    const fileUri = await moveScan(bucket, imo, c, dry);
    console.log(`  ${c.id}: number ${c.number ? 'yes' : 'no'}, scan ${c.fileUri ? 'yes' : 'no'}`);
    if (dry) continue;
    const priv = { id: c.id, updatedAt: now };
    for (const [k, v] of Object.entries({ crewId: c.crewId, number: c.number, fileUri, fileName: c.fileName, fileKind: c.fileKind })) if (v) priv[k] = v;
    await db.doc(`safety_vessels/${imo}/cert_private/${c.id}`).set(priv);
  }
  if (dry || !open.length) return;
  await db.runTransaction(async (tx) => {
    const fresh = JSON.parse((await tx.get(ref)).get('register') || '{}');
    for (const c of fresh.certificates || []) if (isClosedCert(c)) for (const k of FIELDS) delete c[k];
    tx.set(ref, { register: JSON.stringify(fresh), registerUpdatedAt: now, registerDeviceId: 'admin:close-crew-certs' }, { merge: true });
  });
  console.log('Register rewritten.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
