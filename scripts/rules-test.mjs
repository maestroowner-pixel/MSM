// Firestore rules tests — run in the emulator, from a folder with its own deps
// (the app's firebase version conflicts with @firebase/rules-unit-testing):
//   mkdir /tmp/rt && cd /tmp/rt && npm init -y && npm i @firebase/rules-unit-testing firebase
//   cp <repo>/scripts/rules-test.mjs . && echo '{"emulators":{"firestore":{"host":"127.0.0.1","port":8085}}}' > firebase.json
//   npx firebase-tools@13.35.1 emulators:exec --only firestore --project demo-msm-rules "node rules-test.mjs <repo>/firestore.rules"
// (13.x runs on Java 17; firebase-tools 14+ needs Java 21.) 29 cases, 9 Oct 2026.

import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const V = '9000001', OTHER = '9000002';
const env = await initializeTestEnvironment({
  projectId: 'demo-msm-rules',
  firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8085 },
});
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, 'safety_vessels', V), { register: '{}', registerUpdatedAt: 1 });
  await setDoc(doc(d, 'safety_vessels', OTHER), { register: '{}' });
  await setDoc(doc(d, 'safety_vessels', V, 'devices', 'devU'), { role: 'user', approved: true, firstName: 'A' });
  await setDoc(doc(d, 'safety_vessels', V, 'crew', 'c1'), { name: 'Jez', active: true });
  await setDoc(doc(d, 'safety_vessels', V, 'crew_private', 'c1'), { id: 'c1', passportNo: 'X' });
  await setDoc(doc(d, 'safety_vessels', V, 'pms_done', 'p1'), { id: 'p1' });
});
const tok = (role, extra = {}) => ({ vessel: V, role, approved: true, deviceId: `dev${role[0].toUpperCase()}`, ...extra });
const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const master = as('m', tok('superadmin'));
const officer = as('o', tok('admin'));
const crew = as('u', { ...tok('user'), deviceId: 'devU' });
const pending = as('p', { vessel: V, role: 'user', approved: false, deviceId: 'devP' });
const shore = as('s', { shore: true, fleet: { [V]: true }, deviceId: 'devS' });

let n = 0, bad = 0;
const t = async (ok, label, p) => { n++; try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log(`✓ ${label}`); } catch (e) { bad++; console.log(`✗ ${label} — ${e.message.split('\n')[0]}`); } };
const R = (d, ...p) => doc(d, 'safety_vessels', V, ...p);

await t(true, 'crew member reads the register', getDoc(doc(crew, 'safety_vessels', V)));
await t(false, 'crew member cannot read another vessel', getDoc(doc(crew, 'safety_vessels', OTHER)));
await t(false, 'pending device reads nothing', getDoc(doc(pending, 'safety_vessels', V)));
await t(true, 'everyone reads the crew list', getDoc(R(crew, 'crew', 'c1')));
await t(true, 'Master writes the crew list', setDoc(R(master, 'crew', 'c2'), { name: 'Ana', active: true }));
await t(true, 'Officer (Chief Officer) writes the crew list — NEW', setDoc(R(officer, 'crew', 'c3'), { name: 'Tom', active: true }));
await t(false, 'Crew cannot write the crew list', setDoc(R(crew, 'crew', 'c4'), { name: 'X', active: true }));
await t(true, 'Officer reads personal details / next of kin', getDoc(R(officer, 'crew_private', 'c1')));
await t(true, 'Master writes personal details', setDoc(R(master, 'crew_private', 'c2'), { id: 'c2', nextOfKin: { name: 'K' } }));
await t(false, 'Crew cannot read personal details', getDoc(R(crew, 'crew_private', 'c1')));
await t(false, 'Crew cannot write personal details', setDoc(R(crew, 'crew_private', 'c9'), { id: 'c9' }));
await t(false, 'Nobody deletes personal details', deleteDoc(R(master, 'crew_private', 'c1')));
await t(true, 'Crew records own hours of rest', setDoc(R(crew, 'rest', 'c1_2026-10-09'), { crewId: 'c1', work: '0'.repeat(48) }));
await t(false, 'Hours of rest cannot be deleted', deleteDoc(R(master, 'rest', 'c1_2026-10-09')));
await t(false, 'Signed PMS completion cannot be edited', updateDoc(R(master, 'pms_done', 'p1'), { note: 'x' }));
await t(true, 'Device updates its own platform', updateDoc(R(crew, 'devices', 'devU'), { platform: 'ios' }));
await t(false, 'Device cannot change its own tabs', updateDoc(R(crew, 'devices', 'devU'), { tabs: ['rest'] }));
await t(false, 'Device cannot rename itself', updateDoc(R(crew, 'devices', 'devU'), { firstName: 'Master' }));
await t(true, 'Master sets a device\'s tabs', updateDoc(R(master, 'devices', 'devU'), { tabs: ['rest'] }));
await t(false, 'Crew cannot read invitations (PINs)', getDoc(R(crew, 'invites', 'i1')));
await t(true, 'Superintendent reads the register of a fleet vessel', getDoc(doc(shore, 'safety_vessels', V)));
await t(false, 'Superintendent cannot read a vessel outside the fleet', getDoc(doc(shore, 'safety_vessels', OTHER)));
await t(true, 'Superintendent writes an ISM document', setDoc(R(shore, 'ism_docs', 'd1'), { id: 'd1', title: 'X', revision: 1 }));
await t(false, 'Superintendent cannot write the crew list', setDoc(R(shore, 'crew', 'c5'), { name: 'X' }));
await t(false, 'Superintendent cannot write the register', updateDoc(doc(shore, 'safety_vessels', V), { register: '{"x":1}' }));
await t(false, 'Superintendent cannot read invitations', getDoc(R(shore, 'invites', 'i1')));
await t(false, 'Crew cannot write ISM documents', setDoc(R(crew, 'ism_docs', 'd2'), { id: 'd2' }));
await t(true, 'Crew signs an ISM document', setDoc(R(crew, 'ism_doc_acks', 'a1'), { id: 'a1' }));
await t(false, 'A document signature cannot be changed', updateDoc(R(crew, 'ism_doc_acks', 'a1'), { by: 'x' }));

await env.cleanup();
console.log(`\n${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
