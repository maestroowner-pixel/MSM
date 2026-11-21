// Storage rules tests — the device record decides (7 Nov 2026). Run beside scripts/rules-test.mjs
// (same folder and deps), with both emulators and Java 21:
//   echo '{"emulators":{"firestore":{"port":8085},"storage":{"port":9199}},"storage":{"rules":"<repo>/storage.rules"}}' > firebase.json
//   firebase emulators:exec --only firestore,storage --project demo-msm-rules "node storage-rules-test.mjs <repo>/storage.rules"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { readFileSync } from 'fs';
const V = '9000001';
const env = await initializeTestEnvironment({
  projectId: 'demo-msm-rules',
  firestore: { rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if false; } }', host: '127.0.0.1', port: 8085 },
  storage: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 9199 },
});
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  for (const [id, x] of Object.entries({ devU: { role: 'user', approved: true }, devA: { role: 'admin', approved: true }, devOff: { role: 'admin', approved: true, disabled: true }, devDem: { role: 'user', approved: true }, devShore: { role: 'shore', approved: true }, devShoreOff: { role: 'shore', approved: true, disabled: true }, devMhmA: { role: 'admin', approved: true, app: 'mhm' }, devMhmU: { role: 'user', approved: true, app: 'mhm' } }))
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
// Who may change a file (15 Nov 2026): crew adds new files and re-sends the same bytes; changing or deleting one is an officer's.
const put = (s, path, body) => uploadString(ref(s, `safety_vessels/${V}/attachments/${path}`), body, 'raw', { contentType: 'text/plain' });
const crew = () => st('u', tok('user', 'devU'));
const officer = () => st('a', tok('admin', 'devA'));
const shoreS = () => st('s', { shore: true, fleet: { [V]: true }, deviceId: 'devShore' });
await t(true, 'crew adds a new file', put(crew(), 'o3/c.txt', 'first'));
await t(true, 'crew sends the same file again', put(crew(), 'o3/c.txt', 'first'));
await t(false, 'crew may not overwrite a file with something else', put(crew(), 'o1/a.txt', 'forged'));
await t(false, 'crew may not overwrite with other bytes of the same size', put(crew(), 'o1/a.txt', 'yo'));
await t(false, 'crew may not delete a file', deleteObject(ref(crew(), `safety_vessels/${V}/attachments/o1/a.txt`)));
await t(true, 'officer replaces a file', put(officer(), 'o3/c.txt', 'second'));
await t(true, 'superintendent replaces a certificate scan', put(shoreS(), 'o3/c.txt', 'third'));
await t(false, 'superintendent may not delete a file', deleteObject(ref(shoreS(), `safety_vessels/${V}/attachments/o3/c.txt`)));
await t(false, 'demoted officer (record crew) may not overwrite', put(st('d', tok('admin', 'devDem')), 'o3/c.txt', 'fourth'));
await t(true, 'officer deletes a file', deleteObject(ref(officer(), `safety_vessels/${V}/attachments/o3/c.txt`)));
// A PMS machine's manual (21 Nov 2026): `man_…` may go to 200 MB, from an officer or the office; anything else stays under 12 MB.
const big = (mb) => new Uint8Array(mb * 1024 * 1024);
const putBytes = (s, path, mb) => uploadBytes(ref(s, `safety_vessels/${V}/attachments/${path}`), big(mb), { contentType: 'application/pdf' });
await t(true, 'officer uploads a 20 MB manual', putBytes(officer(), 'mch1/man_1', 20));
await t(true, 'superintendent uploads a 20 MB manual', putBytes(shoreS(), 'mch1/man_2', 20));
await t(false, 'crew may not upload a big manual', putBytes(crew(), 'mch1/man_3', 20));
await t(true, '…a small one crew still may (any member adds a file)', putBytes(crew(), 'mch1/man_4', 1));
await t(false, 'a 20 MB file not named as a manual is refused', putBytes(officer(), 'mch1/other_1', 20));
// Over 200 MB cannot be sent to the emulator (it refuses the body itself), so the ceiling is read from the rules.
await t(true, 'the manual ceiling is 200 MB', Promise.resolve(/file\.matches\('man_\.\*'\) && request\.resource\.size < 200 \* 1024 \* 1024/.test(readFileSync(process.argv[2], 'utf8')) || Promise.reject(new Error('no 200 MB ceiling'))));
// Marine Hospital Manager (16 Nov 2026): the files of the medical log, nothing else.
const mhm = (role, id) => st(id, { ...tok(role, id), app: 'mhm' });
await t(true, 'MHM officer reads a medical file', med(mhm('admin', 'devMhmA')));
await t(true, 'MHM officer adds medical advice', uploadString(ref(mhm('admin', 'devMhmA'), `safety_vessels/${V}/medical/o9/n.pdf`), 'pdf', 'raw', { contentType: 'application/pdf' }));
await t(false, 'MHM crew reads no medical file', med(mhm('user', 'devMhmU')));
await t(false, 'MHM reads no attachment', att(mhm('admin', 'devMhmA')));
await t(false, 'MHM uploads no attachment', uploadString(ref(mhm('admin', 'devMhmA'), `safety_vessels/${V}/attachments/o9/x.txt`), 'x', 'raw', { contentType: 'text/plain' }));
await t(false, 'The MHM claim over an officer record reads no attachment', att(st('c', { ...tok('admin', 'devA'), app: 'mhm' })));
await env.cleanup();
console.log(`\n${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
