// npm run check:closedcerts — a passport number or scan cannot reach the register everyone reads (plan item 60).
import * as fs from 'fs';

import { CLOSED_CERT_SOURCE, Certificate, isClosedCert, joinCerts, splitCert } from '../types/certificate';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const cert = (name: string, scope: Certificate['scope'] = 'crew'): Certificate => ({ id: 'c1', crewId: 'p1', scope, name, number: 'N1', fileUri: 'data:x', fileName: 'a.pdf', fileKind: 'document', expiryDate: '2030-01-01', itemIds: [], createdAt: 1, updatedAt: 2 });

for (const n of ['Passport', "Seaman's book", 'Visa', 'Schengen visa', 'ENG1 / Seafarer medical', 'Паспорт', 'Виза', 'Pasaporte']) ok(isClosedCert(cert(n)), `closed: ${n}`);
for (const n of ['STCW Basic Safety', 'Medical First Aid', 'Medical Care', 'Certificate of Competency (CoC)', 'GMDSS', 'Advisory']) ok(!isClosedCert(cert(n)), `open: ${n}`);
ok(!isClosedCert(cert('Passport', 'vessel')), 'a vessel paper is never closed');

const { lean, priv } = splitCert(cert('Passport'));
ok(!/N1|data:x|a\.pdf/.test(JSON.stringify(lean)), 'the register copy has no number and no scan');
ok(lean.expiryDate === '2030-01-01' && lean.crewId === 'p1', 'the register copy keeps the dates and the holder');
ok(priv?.number === 'N1' && priv.fileUri === 'data:x', 'number and scan are kept apart');
ok(splitCert(cert('GMDSS')).lean.number === 'N1' && splitCert(cert('GMDSS')).priv === null, 'an ordinary certificate is untouched');
const back = joinCerts([lean], [priv!])[0];
ok(back.number === 'N1' && back.fileName === 'a.pdf', 'an officer gets them back');
ok(joinCerts([lean], [])[0].number === undefined, 'a crew device does not');

const fn = fs.readFileSync('functions/closedCerts.js', 'utf8');
ok(fn.includes(JSON.stringify(CLOSED_CERT_SOURCE)), 'the shore function closes the same documents');
const store = fs.readFileSync('services/storage.ts', 'utf8');
ok(/CERTIFICATES_KEY, JSON\.stringify\(list\.map\(\(c\) => splitCert\(c\)\.lean\)\)/.test(store), 'the stored list is always the lean one');
const rules = fs.readFileSync('firestore.rules', 'utf8');
ok(/match \/cert_private\/\{id\} \{\s*allow read, create, update: if isAdmin\(v\);/.test(rules), 'rules: officers and the Master only');
const sr = fs.readFileSync('storage.rules', 'utf8');
ok(/crew_docs\/\{certId\}\/\{file\} \{\s*allow read, delete: if member\(vessel\) && \(claims\(\)\.role == 'admin'/.test(sr), 'storage rules: officers and the Master only');

if (bad) { console.error(`${bad} failed`); process.exit(1); }
console.log('All passed');
