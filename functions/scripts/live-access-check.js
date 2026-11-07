// Live check of functions/access.js on the TEST vessel only (7 Nov 2026):
//   1. a Master invitation older than 48 hours is refused
//   2. a fresh Master invitation lets one device in; a second device on it is refused
//   3. a crew device: approved → reads the vessel; switched off → its session is
//      revoked, and (once firestore.rules are deployed) its token reads nothing
//   4. wrong PINs from ever-new device ids stop at the vessel's limit
// Everything it makes is removed at the end (invitations, devices, attempt
// counters, the vessel's guard, auth users), also when a step fails.
//   cd functions && node scripts/live-access-check.js
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'marine-safety-manager' });
const db = admin.firestore();

const V = '1234567'; // the test vessel — nobody real on it
const ROOT = 'safety_vessels';
const API_KEY = 'AIzaSyDkYyhyLpz05Xsj0CLus3ncJmPQIk1FLR8'; // the app's public web key (services/firebaseService.ts)
const FN = 'https://europe-west1-marine-safety-manager.cloudfunctions.net';
const TAG = `zzlive${Date.now().toString(36)}`;
const H = 3600_000;

const made = { invites: [], devices: new Set() };
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };

async function call(name, data) {
  const r = await fetch(`${FN}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
  const j = await r.json().catch(() => ({}));
  return j.error ? { error: j.error } : { result: j.result };
}

async function invite(role, lastName, pin, issuedAt, activations = []) {
  const ref = db.collection(`${ROOT}/${V}/invites`).doc(`${TAG}-${lastName}`);
  await ref.set({ firstName: 'Live', lastName: `${lastName}${TAG}`, pin, role, createdAt: issuedAt, issuedAt: admin.firestore.Timestamp.fromMillis(issuedAt), activations, createdBy: 'live-access-check' });
  made.invites.push(ref.id);
  return { firstName: 'Live', lastName: `${lastName}${TAG}`, pin };
}

const enrol = (who, deviceId) => {
  made.devices.add(deviceId);
  return call('enrol', { vessel: V, ...who, deviceId, platform: 'web', appVersion: 'live-check' });
};

async function signIn(customToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  return r.json();
}
async function renew(refreshToken) {
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}` });
  return r.json();
}
async function readVessel(idToken) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/marine-safety-manager/databases/(default)/documents/${ROOT}/${V}?mask.fieldPaths=registerUpdatedAt`, { headers: { Authorization: `Bearer ${idToken}` } });
  return r.status;
}
// Storage — its rules read the device record from Firestore (a cross-service read).
const BUCKET = 'marine-safety-manager.firebasestorage.app';
const FILE = `${ROOT}/${V}/attachments/${TAG}/check.txt`;
async function putFile(idToken) {
  const r = await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(FILE)}`, { method: 'POST', headers: { Authorization: `Firebase ${idToken}`, 'Content-Type': 'text/plain' }, body: 'live access check' });
  return r.status;
}
async function getFile(idToken) {
  const r = await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(FILE)}?alt=media`, { headers: { Authorization: `Firebase ${idToken}` } });
  return r.status;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. older than 48 hours
  const old = await invite('superadmin', 'Old', '48151623', Date.now() - 49 * H);
  const r1 = await enrol(old, `${TAG}-old`);
  ok(r1.error?.status === 'FAILED_PRECONDITION' && /expired/.test(r1.error.message), 'Master invitation of 49 h is refused', r1.error?.message || JSON.stringify(r1.result));

  // 2. fresh: one device, not two
  const fresh = await invite('superadmin', 'Fresh', '27182818', Date.now());
  const r2 = await enrol(fresh, `${TAG}-m1`);
  ok(r2.result?.status === 'ok', 'fresh Master invitation lets the first device in', r2.error?.message || r2.result?.status);
  const r2b = await enrol(fresh, `${TAG}-m2`);
  ok(r2b.error?.status === 'FAILED_PRECONDITION' && /already been used/.test(r2b.error.message), '…and refuses a second device', r2b.error?.message || JSON.stringify(r2b.result));
  const r2c = await enrol(fresh, `${TAG}-m1`);
  ok(r2c.result?.status === 'ok', '…but takes the same device again (reply lost)', r2c.error?.message || r2c.result?.status);

  // 3. switched off
  const crew = await invite('user', 'Crew', '31415926', Date.now());
  const dev = `${TAG}-c1`;
  const r3 = await enrol(crew, dev);
  ok(r3.result?.status === 'pending', 'crew device waits for approval', r3.error?.message || r3.result?.status);
  await db.doc(`${ROOT}/${V}/devices/${dev}`).set({ approved: true }, { merge: true });
  const rr = await call('refresh', { vessel: V, deviceId: dev, deviceSecret: r3.result?.deviceSecret });
  const s = rr.result?.token ? await signIn(rr.result.token) : {};
  ok(!!s.idToken, 'approved device gets a session', rr.error?.message || '');
  ok((await readVessel(s.idToken)) === 200, 'approved device reads the vessel');
  const up = await putFile(s.idToken);
  ok(up === 200, 'approved device uploads an attachment (Storage rules read Firestore)', `HTTP ${up}`);
  const down = await getFile(s.idToken);
  ok(down === 200, '…and reads it back', `HTTP ${down}`);
  await db.doc(`${ROOT}/${V}/devices/${dev}`).set({ disabled: true }, { merge: true });
  let revoked = false;
  for (let i = 0; i < 24 && !revoked; i++) {
    await sleep(5000);
    const n = await renew(s.refreshToken);
    revoked = !n.id_token;
  }
  ok(revoked, 'switched off → its session can no longer be renewed (revokeOnSwitchOff)');
  const st = await readVessel(s.idToken);
  console.log(st === 403 ? '✓ switched off → its live token reads nothing (rules deployed)' : `· switched off → its live token still reads (HTTP ${st}): firestore.rules not deployed yet`);
  if (st === 403) pass++;
  const down2 = await getFile(s.idToken);
  ok(down2 === 403, 'switched off → reads no attachment either', `HTTP ${down2}`);

  // 4. guessing from ever-new device ids
  await db.doc(`${ROOT}/${V}/meta/enrolGuard`).delete();
  let stoppedAt = 0;
  for (let i = 1; i <= 25 && !stoppedAt; i++) {
    const r = await enrol({ firstName: 'Live', lastName: `Crew${TAG}`, pin: String(10000000 + i) }, `${TAG}-g${i}`);
    if (r.error?.status === 'RESOURCE_EXHAUSTED') stoppedAt = i;
  }
  ok(stoppedAt === 21, 'wrong PINs from new device ids stop after 20 on the vessel', stoppedAt ? `stopped at try ${stoppedAt}` : 'never stopped');
}

async function cleanup() {
  for (const id of made.invites) await db.doc(`${ROOT}/${V}/invites/${id}`).delete();
  for (const d of made.devices) {
    await db.doc(`${ROOT}/${V}/devices/${d}`).delete();
    await db.doc(`${ROOT}/${V}/enrolAttempts/${d}`).delete();
    await admin.auth().deleteUser(`${V}__${d}`).catch(() => {});
  }
  await db.doc(`${ROOT}/${V}/meta/enrolGuard`).delete();
  await admin.storage().bucket(BUCKET).file(FILE).delete().catch(() => {});
  const left = await db.collection(`${ROOT}/${V}/devices`).where(admin.firestore.FieldPath.documentId(), '>=', TAG).where(admin.firestore.FieldPath.documentId(), '<', TAG + '~').get();
  console.log(`cleanup: ${made.invites.length} invitations, ${made.devices.size} devices removed; left with the tag: ${left.size}`);
}

main()
  .catch((e) => { fail++; console.error('✗ stopped:', e.message); })
  .finally(async () => {
    await cleanup().catch((e) => console.error('cleanup failed:', e.message));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
