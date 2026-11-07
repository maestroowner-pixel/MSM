// Storage rules tests — the device record decides (7 Nov 2026). Run beside scripts/rules-test.mjs
// (same folder and deps), with both emulators and Java 21:
//   echo '{"emulators":{"firestore":{"port":8085},"storage":{"port":9199}},"storage":{"rules":"<repo>/storage.rules"}}' > firebase.json
//   firebase emulators:exec --only firestore,storage --project demo-msm-rules "node storage-rules-test.mjs <repo>/storage.rules"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { readFileSync } from 'fs';
const V = '9000001';
const env = await initializeTestEnvironment({
  projectId: 'demo-msm-rules',
  firestore: { rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if false; } }', host: '127.0.0.1', port: 8085 },
  storage: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 9199 },
});
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  for (const [id, x] of Object.entries({ devU: { role: 'user', approved: true }, devA: { role: 'admin', approved: true }, devOff: { role: 'admin', approved: true, disabled: true }, devDem: { role: 'user', approved: true }, devShore: { role: 'shore', approved: true }, devShoreOff: { role: 'shore', approved: true, disabled: true } }))
    await setDoc(doc(d, 'safety_vessels', V, 'devices', id), x);
  await uploadString(ref(c.storage(), `safety_vessels/${V}/attachments/o1/a.txt`), 'hi', 'raw', { contentType: 'text/plain' });
  await uploadString(ref(c.storage(), `safety_vessels/${V}/medical/o1/m.pdf`), 'pdf', 'raw', { contentType: 'application/pdf' });
});
const st = (uid, claims) => env.authenticatedContext(uid, claims).storage();
const tok = (role, deviceId) => ({ vessel: V, role, approved: true, deviceId });
let n = 0, bad = 0;
const t = async (ok, label, p) => { n++; try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log(`✓ ${label}`); } catch (e) { bad++; console.log(`✗ ${label} — ${e.message.split('\n')[0]}`); } };
const att = (s) => getBytes(ref(s, `safety_vessels/${V}/attachments/o1/a.txt`));
const med = (s) => getBytes(ref(s, `safety_vessels/${V}/medical/o1/m.pdf`));
await t(true, 'crew reads an attachment', att(st('u', tok('user', 'devU'))));
await t(false, 'switched-off device reads no attachment', att(st('x', tok('admin', 'devOff'))));
await t(false, 'removed device reads no attachment', att(st('r', tok('admin', 'devGone'))));
await t(false, 'switched-off device uploads nothing', uploadString(ref(st('x', tok('admin', 'devOff')), `safety_vessels/${V}/attachments/o2/b.txt`), 'x', 'raw', { contentType: 'text/plain' }));
await t(true, 'officer reads a medical file', med(st('a', tok('admin', 'devA'))));
await t(false, 'demoted officer (record crew) reads no medical file', med(st('d', tok('admin', 'devDem'))));
await t(false, 'crew reads no medical file', med(st('u', tok('user', 'devU'))));
await t(true, 'superintendent reads an attachment', att(st('s', { shore: true, fleet: { [V]: true }, deviceId: 'devShore' })));
await t(false, 'switched-off superintendent reads none', att(st('so', { shore: true, fleet: { [V]: true }, deviceId: 'devShoreOff' })));
await env.cleanup();
console.log(`\n${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
