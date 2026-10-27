// Firestore rules tests — run in the emulator, from a folder with its own deps
// (the app's firebase version conflicts with @firebase/rules-unit-testing):
//   mkdir /tmp/rt && cd /tmp/rt && npm init -y && npm i @firebase/rules-unit-testing firebase
//   cp <repo>/scripts/rules-test.mjs . && echo '{"emulators":{"firestore":{"host":"127.0.0.1","port":8085}}}' > firebase.json
//   npx firebase-tools@13.35.1 emulators:exec --only firestore --project demo-msm-rules "node rules-test.mjs <repo>/firestore.rules"
// (13.x runs on Java 17; firebase-tools 14+ needs Java 21 — Android Studio's jbr + Homebrew firebase work.)

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
  await setDoc(doc(d, 'safety_vessels', V), { register: '{}', registerUpdatedAt: 1, modules: { drills: true } });
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
// `modules` (pilot modules for one vessel) is ours: no device writes it, the Master's included.
await t(false, 'Master cannot switch a module on for the vessel', setDoc(doc(master, 'safety_vessels', V), { modules: { drills: true, pms: true } }, { merge: true }));
await t(false, 'Crew cannot switch a module on for the vessel', updateDoc(doc(crew, 'safety_vessels', V), { modules: { drills: true, stores: true } }));
const newcomer = as('n', { vessel: '9000003', role: 'superadmin', approved: true, deviceId: 'devN' });
await t(false, 'A new vessel document cannot arrive with modules', setDoc(doc(newcomer, 'safety_vessels', '9000003'), { register: '{}', modules: { pms: true } }));
await t(true, '…and arrives fine without them', setDoc(doc(newcomer, 'safety_vessels', '9000003'), { register: '{}' }));
await t(true, 'Crew still writes the register beside modules', setDoc(doc(crew, 'safety_vessels', V), { register: '{"a":1}', registerUpdatedAt: 2 }, { merge: true }));
await t(false, 'Master cannot take a module away either', updateDoc(doc(master, 'safety_vessels', V), { modules: {} }));
await t(true, 'Crew reads the modules it has been given', getDoc(doc(crew, 'safety_vessels', V)));
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
await t(false, 'Device cannot give itself the gear', updateDoc(R(crew, 'devices', 'devU'), { manage: ['stores', 'sopep'] }));
await t(true, 'Master gives a device the stores gear', updateDoc(R(master, 'devices', 'devU'), { manage: ['stores'] }));
await t(false, 'Device cannot change its own hidden pages', updateDoc(R(crew, 'devices', 'devU'), { hidePages: [] }));
await t(true, 'Master hides a page on a device', updateDoc(R(master, 'devices', 'devU'), { hidePages: ['Security:searches'] }));
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

await t(true, 'Crew member requests a permit to work', setDoc(R(crew, 'permits', 'ptw1'), { id: 'ptw1', status: 'requested' }));
await t(true, 'Officer approves it (update)', updateDoc(R(officer, 'permits', 'ptw1'), { status: 'approved' }));
await t(false, 'Nobody deletes a permit', deleteDoc(R(master, 'permits', 'ptw1')));
await t(true, 'Crew member writes a risk assessment', setDoc(R(crew, 'risk_assessments', 'ra1'), { id: 'ra1', title: 'x' }));
await t(false, 'Superintendent cannot write permits', setDoc(R(shore, 'permits', 'ptw2'), { id: 'ptw2' }));
await t(true, 'Superintendent reads permits', getDoc(R(shore, 'permits', 'ptw1')));

await t(true, 'Crew member records a fuel sounding', setDoc(R(crew, 'fuel_readings', 'rob_2026-10-10'), { id: 'rob_2026-10-10' }));
await t(true, 'Officer records a bunkering', setDoc(R(officer, 'fuel_bunkers', 'b1'), { id: 'b1', litres: 5000 }));
await t(false, 'Nobody deletes a bunkering', deleteDoc(R(master, 'fuel_bunkers', 'b1')));
await t(false, 'Superintendent cannot write fuel records', setDoc(R(shore, 'fuel_readings', 'x'), { id: 'x' }));

await t(true, 'Officer records a garbage entry', setDoc(R(officer, 'garbage', 'g1'), { id: 'g1', category: 'C' }));
await t(false, 'A garbage entry cannot be changed', updateDoc(R(officer, 'garbage', 'g1'), { volume: 9 }));
await t(false, 'An Officer cannot sign the month as Master', setDoc(R(officer, 'garbage_signs', 'grb_2026-10'), { id: 'grb_2026-10' }));
await t(true, 'The Master signs the month', setDoc(R(master, 'garbage_signs', 'grb_2026-10'), { id: 'grb_2026-10' }));

await t(true, 'Crew member records a SOPEP check', setDoc(R(crew, 'sopep_checks', 's1'), { id: 's1' }));
await t(false, 'A SOPEP check cannot be changed', updateDoc(R(crew, 'sopep_checks', 's1'), { remarks: 'x' }));
await t(true, 'Gangway watch signs a visitor on', setDoc(R(crew, 'visitors', 'v1'), { id: 'v1', name: 'X' }));
await t(true, 'Gangway watch signs the visitor off', updateDoc(R(crew, 'visitors', 'v1'), { timeOut: '12:00' }));
await t(false, 'Crew cannot change the security level', setDoc(R(crew, 'security_levels', 'l1'), { level: 2 }));
await t(true, 'Officer (SSO) sets the security level', setDoc(R(officer, 'security_levels', 'l1'), { level: 2 }));

await t(true, 'Crew member records a security drill', setDoc(R(crew, 'security_drills', 'd1'), { id: 'd1' }));
await t(false, 'A security drill cannot be changed', updateDoc(R(crew, 'security_drills', 'd1'), { findings: 'x' }));

await t(true, 'Gangway records a crew member going ashore', setDoc(R(crew, 'crew_moves', 'm1'), { id: 'm1', dir: 'ashore' }));
await t(false, 'A crew movement cannot be changed', updateDoc(R(crew, 'crew_moves', 'm1'), { dir: 'aboard' }));

await t(true, 'Crew member logs a fuel daily report as sent', setDoc(R(crew, 'fuel_daily', 'fd1'), { id: 'fd1' }));
await t(false, 'A sent daily report cannot be changed', updateDoc(R(crew, 'fuel_daily', 'fd1'), { text: 'x' }));

await t(false, 'Crew cannot change the survey plan', setDoc(R(crew, 'surveys', 'sv1'), { id: 'sv1' }));
await t(true, 'Officer plans a survey', setDoc(R(officer, 'surveys', 'sv1'), { id: 'sv1', due: '2026-12-15' }));
await t(true, 'Officer records a survey carried out', setDoc(R(officer, 'surveys_done', 'sd1'), { id: 'sd1' }));
await t(false, 'A survey carried out cannot be changed', updateDoc(R(officer, 'surveys_done', 'sd1'), { ref: 'x' }));

await t(false, 'An Officer cannot amend a garbage entry', setDoc(R(officer, 'garbage', 'g1v2'), { id: 'g1v2', supersedes: 'g1', editReason: 'x' }));
await t(true, 'The Master amends a garbage entry', setDoc(R(master, 'garbage', 'g1v3'), { id: 'g1v3', supersedes: 'g1', editReason: 'Amount misread' }));

await t(false, 'An Officer cannot amend a fuel sounding', setDoc(R(officer, 'fuel_readings', 'rob_v2'), { id: 'rob_v2', supersedes: 'rob_1', editReason: 'x' }));
await t(true, 'The Master amends a fuel sounding', setDoc(R(master, 'fuel_readings', 'rob_v3'), { id: 'rob_v3', supersedes: 'rob_1', editReason: 'Gauge misread' }));
await t(false, 'Crew cannot delete a SOPEP drill', setDoc(R(crew, 'sopep_drills', 'sd_x'), { id: 'sd_x', supersedes: 'sd_1', cancelled: true }));
await t(true, 'Gangway watch signs off an amended visitor', updateDoc(R(crew, 'visitors', 'v1'), { timeOut: '13:00' }));
await t(false, 'Gangway watch cannot turn a visit into another version', updateDoc(R(crew, 'visitors', 'v1'), { supersedes: 'v0' }));
await t(false, 'An Officer cannot overwrite a signed fuel sounding', setDoc(R(officer, 'fuel_readings', 'rob_v3'), { id: 'rob_v3', note: 'x' }));

await t(false, 'An Officer cannot defer a job', setDoc(R(officer, 'pms_deferrals', 'df1'), { id: 'df1', jobId: 'j1' }));
await t(true, 'The Master defers a job', setDoc(R(master, 'pms_deferrals', 'df2'), { id: 'df2', jobId: 'j1', reason: 'Spares on order' }));
await t(false, 'A deferral cannot be changed', updateDoc(R(master, 'pms_deferrals', 'df2'), { reason: 'x' }));

await t(true, 'Officer records an ORB entry', setDoc(R(officer, 'orb', 'o1'), { id: 'o1', code: 'D' }));
await t(false, 'An ORB entry cannot be changed', updateDoc(R(officer, 'orb', 'o1'), { quantity: 9 }));
await t(false, 'An Officer cannot amend an ORB entry', setDoc(R(officer, 'orb', 'o2'), { id: 'o2', supersedes: 'o1' }));
await t(false, 'An Officer cannot sign the ORB month', setDoc(R(officer, 'orb_signs', 'orb_2026-10'), { id: 'orb_2026-10' }));
await t(true, 'The Master signs the ORB month', setDoc(R(master, 'orb_signs', 'orb_2026-10'), { id: 'orb_2026-10' }));

await t(true, 'Officer records a sewage entry', setDoc(R(officer, 'sewage', 's1'), { id: 's1', code: 'STP' }));
await t(false, 'A ballast entry cannot be amended by an Officer', setDoc(R(officer, 'ballast', 'b2'), { id: 'b2', supersedes: 'b1' }));
await t(true, 'The Master signs the ballast month', setDoc(R(master, 'ballast_signs', 'ballast_2026-10'), { id: 'ballast_2026-10' }));
await t(false, 'An Officer cannot sign the sewage month', setDoc(R(officer, 'sewage_signs', 'sewage_2026-10'), { id: 'sewage_2026-10' }));
await t(true, 'Officer records a fuel changeover', setDoc(R(officer, 'fuel_changeover', 'f1'), { id: 'f1', code: 'IN' }));
await t(false, 'A fuel changeover entry is never rewritten', setDoc(R(officer, 'fuel_changeover', 'f1'), { id: 'f1', code: 'OUT' }));
await t(false, 'An Officer cannot sign the fuel changeover month', setDoc(R(officer, 'fuel_changeover_signs', 'fuelChange_2026-10'), { id: 'fuelChange_2026-10' }));
await t(true, 'Officer opens an APA fund', setDoc(R(officer, 'apa_funds', 'fd1'), { id: 'fd1', name: 'Charter Jul', currency: 'EUR', opened: '2026-07-01' }));
await t(true, 'Officer records an APA payment', setDoc(R(officer, 'apa_entries', 'ap1'), { id: 'ap1', fundId: 'fd1', kind: 'out', amount: 120, currency: 'EUR' }));
await t(false, 'An APA entry is never rewritten', setDoc(R(officer, 'apa_entries', 'ap1'), { id: 'ap1', fundId: 'fd1', kind: 'out', amount: 12, currency: 'EUR' }));
await t(false, 'Crew cannot read the APA', getDoc(R(crew, 'apa_entries', 'ap1')));
await t(false, 'Crew cannot write the budget', setDoc(R(crew, 'budget', '2026:galley'), { id: '2026:galley', amount: 1 }));
await t(true, 'The shore reads the APA', getDoc(R(shore, 'apa_entries', 'ap1')));
await t(false, 'The shore cannot write the APA', setDoc(R(shore, 'apa_entries', 'ap2'), { id: 'ap2' }));
await t(true, 'Officer sets the budget', setDoc(R(officer, 'budget', '2026:galley'), { id: '2026:galley', year: 2026, centre: 'galley', amount: 20000, currency: 'EUR' }));
await t(true, 'Officer records an ODS entry', setDoc(R(officer, 'ods', 'o1'), { id: 'o1', code: 'PART' }));
await t(false, 'An ODS entry cannot be amended by an Officer', setDoc(R(officer, 'ods', 'o2'), { id: 'o2', supersedes: 'o1' }));
await t(false, 'An Officer cannot sign the ODS month', setDoc(R(officer, 'ods_signs', 'ods_2026-10'), { id: 'ods_2026-10' }));

// The maintenance plan: the Master or the superintendent; the crew records the work.
await t(true, 'The Master adds a machine to the plan', setDoc(R(master, 'pms_machines', 'mc1'), { id: 'mc1', name: 'Main engine PS', hours: 100 }));
await t(true, 'The superintendent adds a job to the plan', setDoc(R(shore, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 500 }));
await t(false, 'An Officer cannot add a job', setDoc(R(officer, 'pms_jobs', 'jb2'), { id: 'jb2', machineId: 'mc1', title: 'X' }));
await t(false, 'Crew cannot add a machine', setDoc(R(crew, 'pms_machines', 'mc2'), { id: 'mc2', name: 'X' }));
await t(false, 'An Officer cannot change an interval', setDoc(R(officer, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 1000 }));
await t(false, 'Crew cannot remove a job', setDoc(R(crew, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 500, deleted: true }));
await t(true, 'Crew records the job done (last done moves)', setDoc(R(crew, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 500, lastDoneDate: '2026-10-11', lastDoneHours: 120, updatedAt: 5 }));
await t(true, 'Crew writes a job up for an officer to sign (prepared)', setDoc(R(crew, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 500, lastDoneDate: '2026-10-11', lastDoneHours: 120, prepared: { date: '2026-10-15', by: 'AB Lee', at: 6 }, updatedAt: 6 }));
await t(false, 'Writing a job up does not change it (title)', setDoc(R(crew, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Renamed', intervalHours: 500, lastDoneDate: '2026-10-11', lastDoneHours: 120, prepared: { date: '2026-10-15', by: 'AB Lee', at: 6 }, updatedAt: 7 }));
await t(true, 'An officer signs it out: last done moves, the write-up cleared', setDoc(R(officer, 'pms_jobs', 'jb1'), { id: 'jb1', machineId: 'mc1', title: 'Oil change', intervalHours: 500, lastDoneDate: '2026-10-15', lastDoneHours: 130, prepared: null, updatedAt: 8 }));
await t(true, 'An Officer enters a counter reading', setDoc(R(officer, 'pms_machines', 'mc1'), { id: 'mc1', name: 'Main engine PS', hours: 130, hoursDate: '2026-10-11', updatedAt: 6 }));
await t(false, 'An Officer cannot rename a machine', setDoc(R(officer, 'pms_machines', 'mc1'), { id: 'mc1', name: 'Other', hours: 130, hoursDate: '2026-10-11', updatedAt: 7 }));

await t(true, 'Crew raises a machinery defect', setDoc(R(crew, 'pms_defects', 'df9'), { id: 'df9', machineId: 'mc1', category: 'safety', description: 'Leak' }));
await t(false, 'Crew cannot raise a defect already closed', setDoc(R(crew, 'pms_defects', 'df8'), { id: 'df8', closed: { note: 'x' } }));
await t(false, 'Crew cannot close a defect', setDoc(R(crew, 'pms_defects', 'df9'), { id: 'df9', machineId: 'mc1', category: 'safety', description: 'Leak', closed: { note: 'fixed' } }));
await t(false, 'An Officer cannot change what the defect says', setDoc(R(officer, 'pms_defects', 'df9'), { id: 'df9', machineId: 'mc1', category: 'operational', description: 'Leak' }));
await t(true, 'An Officer closes the defect', setDoc(R(officer, 'pms_defects', 'df9'), { id: 'df9', machineId: 'mc1', category: 'safety', description: 'Leak', closed: { note: 'Seal renewed' }, updatedAt: 9 }));
await t(false, 'A closed defect cannot be closed again', setDoc(R(master, 'pms_defects', 'df9'), { id: 'df9', machineId: 'mc1', category: 'safety', description: 'Leak', closed: { note: 'other' }, updatedAt: 10 }));

await t(true, 'An Officer records a counter replacement', setDoc(R(officer, 'pms_machines', 'mc1'), { id: 'mc1', name: 'Main engine PS', hours: 130, hoursDate: '2026-10-11', counterOffset: 130, updatedAt: 11 }));

await t(true, 'An Officer starts a round', setDoc(R(officer, 'rounds', 'r1'), { id: 'r1', period: 'monthly', categories: ['eebd'] }));
await t(false, 'Crew cannot start a round', setDoc(R(crew, 'rounds', 'r2'), { id: 'r2' }));
await t(false, 'A round cannot be re-scoped', setDoc(R(officer, 'rounds', 'r1'), { id: 'r1', period: 'weekly', categories: ['eebd'] }));
await t(true, 'An Officer closes a round', setDoc(R(officer, 'rounds', 'r1'), { id: 'r1', period: 'monthly', categories: ['eebd'], closedAt: 5, closedBy: 'Jez', closedByRank: 'Chief Officer', closedWith: { method: 'pin', at: 5 }, closeNote: 'Reviewed', updatedAt: 5 }));
await t(false, 'A closed round is not signed off again', setDoc(R(master, 'rounds', 'r1'), { id: 'r1', period: 'monthly', categories: ['eebd'], closedAt: 6, closedBy: 'Liam', closedByRank: 'Chief Officer', closedWith: { method: 'pin', at: 5 }, closeNote: 'Reviewed', updatedAt: 6 }));

await t(false, 'An Officer cannot cancel a sign-out', setDoc(R(officer, 'pms_done', 'pd2'), { id: 'pd2', supersedes: 'p1', cancelled: true }));
await t(true, 'The Master cancels a wrong sign-out', setDoc(R(master, 'pms_done', 'pd3'), { id: 'pd3', supersedes: 'p1', cancelled: true, editReason: 'Wrong job signed' }));

await t(true, 'The Master creates a yard project', setDoc(R(master, 'pms_projects', 'pj1'), { id: 'pj1', name: 'Yard Feb 2027', dueDate: '2027-02-01' }));
await t(false, 'An Officer cannot create a project', setDoc(R(officer, 'pms_projects', 'pj2'), { id: 'pj2', name: 'X' }));

await t(true, 'Crew writes an observation card', setDoc(R(crew, 'observations', 'o1'), { id: 'o1', kind: 'unsafe_condition', what: 'Guard missing', updatedAt: 1 }));
await t(false, 'Crew cannot review a card', setDoc(R(crew, 'observations', 'o1'), { id: 'o1', kind: 'unsafe_condition', what: 'Guard missing', reviewedAt: 2, updatedAt: 2 }));
await t(false, 'A card cannot be rewritten', setDoc(R(officer, 'observations', 'o1'), { id: 'o1', kind: 'good_practice', what: 'Guard missing', updatedAt: 2 }));
await t(true, 'An Officer reviews a card', setDoc(R(officer, 'observations', 'o1'), { id: 'o1', kind: 'unsafe_condition', what: 'Guard missing', reviewedAt: 2, reviewedBy: 'Jez', review: 'Fitted', updatedAt: 2 }));
await t(false, 'Crew cannot raise an NC', setDoc(R(crew, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', actions: [] }));
await t(true, 'An Officer raises an NC', setDoc(R(officer, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Guard', actions: [], updatedAt: 1 }));
await t(true, 'Crew signs off an action', setDoc(R(crew, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Guard', actions: [{ id: 'a', doneAt: 3 }], updatedAt: 3 }));
await t(false, 'Crew cannot change the finding', setDoc(R(crew, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Other', actions: [{ id: 'a', doneAt: 3 }], updatedAt: 4 }));
await t(false, 'An Officer cannot close an NC', setDoc(R(officer, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Guard', actions: [{ id: 'a', doneAt: 3 }], closedAt: 5, updatedAt: 5 }));
await t(true, 'The Master closes an NC', setDoc(R(master, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Guard', actions: [{ id: 'a', doneAt: 3 }], closedAt: 5, updatedAt: 5 }));
await t(false, 'A closed NC is final', setDoc(R(master, 'ncs', 'n1'), { id: 'n1', no: 'NC-2026-001', title: 'Guard', actions: [], updatedAt: 6 }));

await t(false, 'Crew cannot plan a drill', setDoc(R(crew, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [], attendance: [], updatedAt: 1 }));
await t(true, 'An Officer plans a drill', setDoc(R(officer, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [], attendance: [], updatedAt: 1 }));
await t(true, 'The Officer writes the scenario as it is typed', setDoc(R(officer, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [{ id: 's', min: 0, text: 'Alarm' }], attendance: [], updatedAt: 2 }));
await t(true, 'Crew signs the attendance list', setDoc(R(crew, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [{ id: 's', min: 0, text: 'Alarm' }], attendance: [{ name: 'A', present: true, signedAt: 2 }], updatedAt: 2 }));
await t(false, 'Crew cannot change the scenario', setDoc(R(crew, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [], attendance: [{ name: 'A', present: true, signedAt: 2 }], updatedAt: 3 }));
await t(true, 'Signed as carried out', setDoc(R(officer, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [{ id: 's', min: 0, text: 'Alarm' }], attendance: [{ name: 'A', present: true }], doneAt: 3, doneBy: 'Jez', updatedAt: 3 }));
await t(false, 'Crew cannot sign after the drill is signed', setDoc(R(crew, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [{ id: 's', min: 0, text: 'Alarm' }], attendance: [{ name: 'A', present: true }, { name: 'B', present: true, signedAt: 9 }], doneAt: 3, doneBy: 'Jez', updatedAt: 9 }));
await t(false, 'A signed drill is final', setDoc(R(master, 'drills', 'd1'), { id: 'd1', no: 'DR-2026-001', type: 'fire', scenario: [], attendance: [], updatedAt: 4 }));
await t(true, 'The Master edits a planned drill', setDoc(R(master, 'drills', 'd2'), { id: 'd2', no: 'DR-2026-002', type: 'mob', scenario: [], attendance: [], updatedAt: 1 }).then(() => setDoc(R(master, 'drills', 'd2'), { id: 'd2', no: 'DR-2026-002', type: 'mob', topic: 'MOB aft', scenario: [], attendance: [], updatedAt: 2 })));
await t(true, 'Crew reads drills', getDoc(R(crew, 'drills', 'd1')));

await t(true, 'An Officer adds a medicine', setDoc(R(officer, 'med_items', 'm1'), { id: 'm1', name: 'Paracetamol', unit: 'tablets', required: 100, kind: 'medicine', order: 0, updatedAt: 1 }));
await t(false, 'Crew cannot change the chest', setDoc(R(crew, 'med_items', 'm1'), { id: 'm1', name: 'Paracetamol', unit: 'tablets', required: 1, kind: 'medicine', order: 0, updatedAt: 2 }));
await t(true, 'Crew sees the chest', getDoc(R(crew, 'med_items', 'm1')));
await t(true, 'An Officer receives stock', setDoc(R(officer, 'med_moves', 'mv1'), { id: 'mv1', itemId: 'm1', kind: 'received', qty: 100, expiry: '2028-01-31', by: 'Jez', updatedAt: 1 }));
await t(false, 'A move is never changed', setDoc(R(master, 'med_moves', 'mv1'), { id: 'mv1', itemId: 'm1', kind: 'received', qty: 10, by: 'Jez', updatedAt: 2 }));
await t(false, 'A move never carries a patient', setDoc(R(officer, 'med_moves', 'mv2'), { id: 'mv2', itemId: 'm1', kind: 'issued', qty: 2, patient: 'Max', by: 'Jez', updatedAt: 1 }));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'safety_vessels', V, 'med_treatments', 'old'), { id: 'old', no: 'MED-2026-009', patient: 'Max Payne', complaint: 'x', issued: [], outcome: 'fit', by: 'Jez', updatedAt: 1 }); });
await t(true, 'An older entry with the full name is masked', setDoc(R(officer, 'med_treatments', 'old'), { id: 'old', no: 'MED-2026-009', patient: 'M…e', complaint: 'x', issued: [], outcome: 'fit', by: 'Jez', updatedAt: 2 }));
await t(false, 'The patient\'s full name never goes up', setDoc(R(officer, 'med_treatments', 't0'), { id: 't0', no: 'MED-2026-000', patient: 'Max Payne', complaint: 'x', issued: [], outcome: 'fit', by: 'Jez', updatedAt: 1 }));
await t(true, 'An Officer writes the medical log', setDoc(R(officer, 'med_treatments', 't1'), { id: 't1', no: 'MED-2026-001', patient: 'M…x', complaint: 'Cut hand', issued: [], outcome: 'fit', by: 'Jez', updatedAt: 1 }));
await t(false, 'Crew cannot read the medical log', getDoc(R(crew, 'med_treatments', 't1')));
await t(false, 'The shore cannot read the medical log', getDoc(R(shore, 'med_treatments', 't1')));
await t(false, 'Crew cannot write the medical log', setDoc(R(crew, 'med_treatments', 't2'), { id: 't2', no: 'MED-2026-002', patient: 'Max', complaint: 'x', issued: [], outcome: 'fit', by: 'Max', updatedAt: 1 }));
await t(true, 'Medical advice added to an entry', setDoc(R(officer, 'med_treatments', 't1'), { id: 't1', no: 'MED-2026-001', patient: 'M…x', complaint: 'Cut hand', issued: [], outcome: 'fit', by: 'Jez', files: [{ id: 'f', name: 'advice.pdf' }], updatedAt: 3 }));
await t(true, 'An Officer orders', setDoc(R(officer, 'med_orders', 'o1'), { id: 'o1', no: 'MO-2026-001', lines: [{ id: 'l', itemId: 'm1', qty: 10 }], by: 'Jez', updatedAt: 1 }));
await t(false, 'Crew cannot order', setDoc(R(crew, 'med_orders', 'o2'), { id: 'o2', no: 'MO-2026-002', lines: [], by: 'Max', updatedAt: 1 }));
await t(true, 'An Officer closes an order', setDoc(R(officer, 'med_orders', 'o1'), { id: 'o1', no: 'MO-2026-001', lines: [{ id: 'l', itemId: 'm1', qty: 10 }], by: 'Jez', closedAt: 5, closeNote: 'Rest not available', updatedAt: 5 }));
await t(false, 'A closed order is final', setDoc(R(master, 'med_orders', 'o1'), { id: 'o1', no: 'MO-2026-001', lines: [], by: 'Jez', updatedAt: 6 }));
await t(true, 'An Officer signs an inventory', setDoc(R(officer, 'med_checks', 'c1'), { id: 'c1', no: 'INV-2026-001', lines: [], by: 'Jez', updatedAt: 1 }));
await t(false, 'An inventory is final', setDoc(R(master, 'med_checks', 'c1'), { id: 'c1', no: 'INV-2026-001', lines: [{ x: 1 }], by: 'Jez', updatedAt: 2 }));
await t(false, 'A masked name is not unmasked', setDoc(R(master, 'med_treatments', 't1'), { id: 't1', no: 'MED-2026-001', patient: 'Max', complaint: 'Cut hand', issued: [], outcome: 'fit', by: 'Jez', files: [{ id: 'f', name: 'advice.pdf' }], updatedAt: 4 }));
await t(false, 'A medical log entry is final', setDoc(R(master, 'med_treatments', 't1'), { id: 't1', no: 'MED-2026-001', patient: 'M…x', complaint: 'Other', issued: [], outcome: 'fit', by: 'Jez', updatedAt: 2 }));

await t(false, 'A guest\'s full name never goes up', setDoc(R(officer, 'passengers', 'pax0'), { id: 'pax0', name: 'Sophie Martin', cabin: 'VIP', updatedAt: 1 }));
await t(false, 'A guest\'s nationality stays on board', setDoc(R(officer, 'passengers', 'pax0'), { id: 'pax0', name: 'S…n', nationality: 'FR', updatedAt: 1 }));
await t(true, 'An Officer adds a passenger (masked)', setDoc(R(officer, 'passengers', 'pax1'), { id: 'pax1', name: 'S…n', cabin: 'VIP', updatedAt: 1 }));
await t(true, 'Crew (the gangway watch) read the passenger list', getDoc(R(crew, 'passengers', 'pax1')));
await t(false, 'Crew cannot change the passenger list', setDoc(R(crew, 'passengers', 'pax1'), { id: 'pax1', name: 'X', updatedAt: 2 }));
await t(false, 'A guest\'s documents never go up', setDoc(R(master, 'passengers_private', 'pax1'), { id: 'pax1', idType: 'Passport', idNo: '12AB34567', updatedAt: 1 }));
await t(false, 'Crew cannot read a passenger\'s documents', getDoc(R(crew, 'passengers_private', 'pax1')));
await t(false, 'The shore cannot read a passenger\'s documents', getDoc(R(shore, 'passengers_private', 'pax1')));
await t(false, 'A guest\'s crossing never carries the full name', setDoc(R(crew, 'crew_moves', 'mvp0'), { id: 'mvp0', crewId: 'pax1', name: 'Sophie Martin', dir: 'ashore', date: '2026-10-13', time: '10:00', at: 1, by: 'Max', via: 'qr', updatedAt: 1 }));
await t(true, 'The watch records a passenger going ashore', setDoc(R(crew, 'crew_moves', 'mvp1'), { id: 'mvp1', crewId: 'pax1', name: 'S…n', dir: 'ashore', date: '2026-10-13', time: '10:00', at: 1, by: 'Max', via: 'qr', updatedAt: 1 }));

// Dynamic positioning.
const DPC = { id: 'dpc1', templateId: 'dp.handover', title: 'DP watch handover', where: 'bridge', at: 1, lines: [{ id: 'dp.handover.01', text: 'DP status' }], results: { 'dp.handover.01': 'pass' }, by: 'Max', updatedAt: 1 };
await t(true, 'Crew (a DPO) sign a DP checklist', setDoc(R(crew, 'dp_checks', 'dpc1'), DPC));
await t(false, 'A signed DP checklist cannot be changed — even by the Master', setDoc(R(master, 'dp_checks', 'dpc1'), { ...DPC, results: { 'dp.handover.01': 'fail' }, updatedAt: 2 }));
await t(false, 'Nobody deletes a DP checklist', deleteDoc(R(master, 'dp_checks', 'dpc1')));
await t(true, 'A DPO enters his DP time', setDoc(R(crew, 'dp_days', 'c1_2026-10-16'), { id: 'c1_2026-10-16', crewId: 'c1', name: 'Max', date: '2026-10-16', slots: [1, 1, 1, 1], updatedAt: 1 }));
await t(true, 'and corrects it', setDoc(R(crew, 'dp_days', 'c1_2026-10-16'), { id: 'c1_2026-10-16', crewId: 'c1', name: 'Max', date: '2026-10-16', slots: [1, 1, 2, 2], updatedAt: 2 }));
await t(false, 'DP time is not deleted', deleteDoc(R(master, 'dp_days', 'c1_2026-10-16')));
await t(false, 'Crew cannot change the letter\'s company details', setDoc(R(crew, 'dp_info', 'info'), { id: 'info', company: 'X', updatedAt: 1 }));
await t(true, 'An Officer sets them', setDoc(R(officer, 'dp_info', 'info'), { id: 'info', company: 'Ocean Co', updatedAt: 1 }));
await t(false, 'Crew cannot reword the DP checklists', setDoc(R(crew, 'dp_templates', 'dp.handover'), { id: 'dp.handover', title: 'x', lines: [], updatedAt: 1 }));
await t(true, 'An Officer rewords them', setDoc(R(officer, 'dp_templates', 'dp.handover'), { id: 'dp.handover', title: 'Our handover', lines: [], updatedAt: 1 }));
await t(true, 'Crew read the DP checklists', getDoc(R(crew, 'dp_templates', 'dp.handover')));

const SM = { id: 'sm1', no: 'SM-2026-001', date: '2026-10-13', agenda: [], attendance: [{ name: 'Max', present: true }], carried: [], actions: [], plannedBy: 'Jez', updatedAt: 1 };
await t(true, 'An Officer writes the safety meeting', setDoc(R(officer, 'safety_meetings', 'sm1'), SM));
await t(true, 'Crew sign their attendance line', setDoc(R(crew, 'safety_meetings', 'sm1'), { ...SM, attendance: [{ name: 'Max', present: true, signedAt: 5 }], updatedAt: 2 }));
await t(false, 'Crew cannot change the minutes', setDoc(R(crew, 'safety_meetings', 'sm1'), { ...SM, attendance: [{ name: 'Max', present: true, signedAt: 5 }], minutes: 'x', updatedAt: 3 }));
await t(true, 'The Master signs the meeting', setDoc(R(master, 'safety_meetings', 'sm1'), { ...SM, attendance: [{ name: 'Max', present: true, signedAt: 5 }], doneAt: 9, doneBy: 'Jez', updatedAt: 9 }));
await t(false, 'A signed meeting is final', setDoc(R(master, 'safety_meetings', 'sm1'), { ...SM, minutes: 'later', doneAt: 9, updatedAt: 10 }));

await t(true, 'Crew name a SOPEP locker', setDoc(R(crew, 'sopep_lockers', 'lk1'), { id: 'lk1', name: 'Bow locker', location: 'Forepeak', order: 1, updatedAt: 1 }));
await t(true, 'The shore reads the SOPEP lockers', getDoc(R(shore, 'sopep_lockers', 'lk1')));

await t(true, 'Crew add a store item', setDoc(R(crew, 'store_items', 'st1'), { id: 'st1', store: 'ppe', name: 'Coveralls', size: 'L', unit: 'pcs', min: 2, order: 0, updatedAt: 1 }));
await t(true, 'Crew issue from the store', setDoc(R(crew, 'store_moves', 'sm1'), { id: 'sm1', itemId: 'st1', kind: 'issued', qty: 1, date: '2026-10-14', to: 'Max', by: 'Jez', at: 1, updatedAt: 1 }));
await t(false, 'A store move is never changed', setDoc(R(master, 'store_moves', 'sm1'), { id: 'sm1', itemId: 'st1', kind: 'issued', qty: 5, date: '2026-10-14', by: 'Jez', at: 1, updatedAt: 2 }));
await t(true, 'An officer draws up the drill plan', setDoc(R(officer, 'drill_plans', '2027'), { id: '2027', slots: [{ kind: 'fire', title: 'Fire', month: 1 }], updatedAt: 1 }));
await t(true, 'The crew read the drill plan', getDoc(R(crew, 'drill_plans', '2027')));
await t(false, 'The crew cannot change the drill plan', setDoc(R(crew, 'drill_plans', '2027'), { id: '2027', slots: [], updatedAt: 2 }));
await t(true, 'An officer files the SSP', setDoc(R(officer, 'ssp_docs', 'd1'), { id: 'd1', title: 'Ship Security Plan — approved', updatedAt: 1 }));
await t(false, 'The crew cannot read the SSP', getDoc(R(crew, 'ssp_docs', 'd1')));
await t(false, 'The shore cannot read the SSP', getDoc(R(shore, 'ssp_docs', 'd1')));
await t(false, 'The crew cannot write the SSP shelf', setDoc(R(crew, 'ssp_docs', 'd2'), { id: 'd2', title: 'x', updatedAt: 1 }));
await t(true, 'The Master reads the SOPEP docs', setDoc(R(master, 'sopep_docs', 'd1'), { id: 'd1', title: 'SOPEP — approved plan', updatedAt: 1 }));
await t(false, 'The crew cannot read the SOPEP docs', getDoc(R(crew, 'sopep_docs', 'd1')));
await t(true, 'An officer sets the search areas and teams', setDoc(R(officer, 'search_plan', 'plan'), { id: 'plan', teams: [], areas: [], updatedAt: 1 }));
await t(false, 'The crew cannot change the search plan', setDoc(R(crew, 'search_plan', 'plan'), { id: 'plan', teams: [], areas: [], updatedAt: 2 }));
await t(true, 'The crew read the search plan', getDoc(R(crew, 'search_plan', 'plan')));
await t(true, 'Crew mark an area searched', setDoc(R(crew, 'searches', 's1'), { id: 's1', kind: 'stowaway', date: '2026-10-15', time: '10:00', areas: [{ areaId: 'a1', name: 'Lazarette', result: 'clear', by: 'Max' }], updatedAt: 1 }));
await t(false, 'A search is never deleted', deleteDoc(R(master, 'searches', 's1')));
await t(true, 'Crew add a store with its ID and place', setDoc(R(crew, 'store_rooms', 'str1'), { id: 'str1', code: 'ST-01', name: "Bosun's store", kind: 'general', location: 'Fwd lazarette', order: 2, updatedAt: 1 }));
await t(true, 'The shore reads the stores', getDoc(R(shore, 'store_rooms', 'str1')));
await t(false, 'A store is never deleted (removed by a mark)', deleteDoc(R(master, 'store_rooms', 'str1')));
await t(false, 'Another vessel cannot add a store here', setDoc(doc(crew, 'safety_vessels', OTHER, 'store_rooms', 'x'), { id: 'x', code: 'X', name: 'X', kind: 'general', order: 0, updatedAt: 1 }));

await env.cleanup();
console.log(`\n${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
