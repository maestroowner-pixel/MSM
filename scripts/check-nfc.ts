// npm run check:nfc — NFC tags (the register, what a tap means), musters (the count, the paper), the boat landing,
// signatures by wristband, rules, sync and words.
import { activeTag, issueTag, normUid, payloadFor, registerName, resolveTap, revokeTag, tagId, uidTail } from '../services/nfcTags';
import { closeMuster, countMuster, durationText, liveStations, markPerson, musterSheet, nextStationCode, pobList, runningMuster, startMuster } from '../services/muster';
import { nextMove, outByBoat, personsOnBoard, recentBoats } from '../services/gangway';
import { bandPending, bandPerson } from '../services/nfcPerson';
import { en } from '../constants/i18n/en';
import { es } from '../constants/i18n/es';
import { no } from '../constants/i18n/no';
import { pt } from '../constants/i18n/pt';
import { ru } from '../constants/i18n/ru';
import { uk } from '../constants/i18n/uk';
import { MODULES } from '../constants/modules';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

// ---- the register -----------------------------------------------------------------
ok(normUid('04:a1:b2 c3-d4') === '04A1B2C3D4' && tagId('04:a1:b2:c3') === 'tag_04A1B2C3', 'a UID however the phone spells it is one id');
ok(payloadFor('person', 'c1') === 'msm://crew/c1' && payloadFor('checkpoint', 'cp1') === 'msm://checkpoint/cp1' && payloadFor('muster', 'ms1') === 'msm://muster/ms1', 'a tag says what its QR says');
ok(registerName('pax7', 'Ann Lee') === 'A…e' && registerName('c1', ' Max Payne ') === 'Max Payne', 'a guest is masked on the register');

let tags = issueTag([], '04a1b2c3d4e580', 'person', 'c1', 'Max', 'C/O', 100);
ok(tags.length === 1 && tags[0].id === 'tag_04A1B2C3D4E580' && tags[0].uid === '04A1B2C3D4E580' && tags[0].issuedAt === 100, 'a wristband issued');
const second = issueTag(tags, '04FFFFFFFFFF01', 'person', 'c1', 'Max', 'C/O', 200);
ok(second.length === 2 && second[1].id === tags[0].id && second[1].revokedAt === 200 && second[1].revokedBy === 'C/O', 'a new wristband for the same person revokes the old one');
tags = [second[0], second[1]];
ok(activeTag(tags, 'person', 'c1')?.uid === '04FFFFFFFFFF01', 'the new one is in force');
const cp = issueTag(tags, '04C0C0C0C0C0C0', 'checkpoint', 'cp1', 'CP-01 · Engine room', 'C/O', 300);
tags = [...tags, ...cp];
ok(cp.length === 1 && activeTag(tags, 'person', 'c1')?.uid === '04FFFFFFFFFF01', 'another person or place does not touch it');
ok(uidTail('04A1B2C3D4E580') === 'D4:E5:80', 'the end of a UID to tell bands apart');

// ---- a tap ----------------------------------------------------------------------
const r1 = resolveTap('04:ff:ff:ff:ff:ff:01', 'msm://crew/c1', tags);
ok(r1.ok && r1.code === 'msm://crew/c1', 'the wristband in force: the scan\'s own code');
const r2 = resolveTap('04FFFFFFFFFF01', null, tags);
ok(r2.ok && r2.code === 'msm://crew/c1', 'a wiped wristband: the register still knows it');
const r3 = resolveTap('04A1B2C3D4E580', 'msm://crew/c1', tags);
ok(!r3.ok && (r3 as any).why === 'revoked', 'the old wristband: revoked');
const r4 = resolveTap('04DEADBEEF0001', 'msm://crew/c1', tags);
ok(!r4.ok && (r4 as any).why === 'unknown', 'a blank written with someone\'s id: not on the register');
const r5 = resolveTap('04FFFFFFFFFF01', 'msm://crew/master', tags);
ok(!r5.ok && (r5 as any).why === 'mismatch', 'a registered wristband rewritten to another person: refused');
const r6 = resolveTap('04FFFFFFFFFF01', 'msm://checkpoint/c1', tags);
ok(!r6.ok && (r6 as any).why === 'mismatch', '…or rewritten to a place');
ok(resolveTap('04C0C0C0C0C0C0', 'msm://checkpoint/cp1', tags).ok, 'a checkpoint tag');
// A watch or a door card registered as is: a 4-byte UID, no words on the chip.
const watch = issueTag([], 'a1:b2:c3:d4', 'person', 'c3', 'Tom Hall', 'Chief Officer', 500);
ok(watch[0].id === 'tag_A1B2C3D4' && resolveTap('A1B2C3D4', null, watch).ok && (resolveTap('a1b2c3d4', null, watch) as any).code === 'msm://crew/c3', 'a watch registered as is (4-byte UID, no words) opens as its person');
const back = revokeTag(tags[0], 'Master', 400);
ok(back.revokedAt === 400 && !resolveTap('04FFFFFFFFFF01', null, [back]).ok, 'revoked by hand (lost): no longer opens');

// ---- the muster -------------------------------------------------------------------
const crew: any[] = [
  { id: 'c1', name: 'Max', rank: 'Bosun', active: true },
  { id: 'c2', name: 'Eva', rank: 'Chief Officer', active: true },
  { id: 'c3', name: 'Tom', rank: 'AB', active: true },
  { id: 'c4', name: 'Off', rank: 'AB', active: true, onBoard: false },
];
const pax: any[] = [{ id: 'pax1', name: 'Ann Lee', embarked: '2026-11-01', addedAt: 1, updatedAt: 1 }];
const moves: any[] = [{ id: 'm1', crewId: 'c3', name: 'Tom', dir: 'ashore', date: '2026-11-15', time: '09:00', at: 50, by: 'Gw', via: 'qr', updatedAt: 50 }];
const visitors: any[] = [{ id: 'v1', name: 'Surveyor Bob', company: 'Class', date: '2026-11-15', timeIn: '08:00', purpose: 'Survey' }];
const pob = pobList(crew, moves, visitors, pax, '2026-11-15');
ok(pob.map((p) => p.id).join() === 'c1,c2,pax1,v1', 'on board: crew not ashore, not signed off; the guest; the visitor');
ok(pob.find((p) => p.id === 'pax1')!.name === 'A…e', '…a guest masked in the muster (it goes to the cloud)');
ok(pob.length === personsOnBoard(crew, moves, visitors, pax, '2026-11-15').total, '…the same count as the gangway\'s persons on board');

const stations: any[] = [
  { id: 'ms2', code: 'MS-2', name: 'Port', order: 1, crewIds: ['c2'], updatedAt: 1 },
  { id: 'ms1', code: 'MS-1', name: 'Stbd', order: 0, crewIds: ['c1'], updatedAt: 1 },
  { id: 'ms0', code: 'MS-9', name: 'Old', order: 2, removed: true, updatedAt: 1 },
];
ok(liveStations(stations).map((s) => s.id).join() === 'ms1,ms2', 'stations in order, a removed one gone');
ok(nextStationCode(stations) === 'MS-10' && nextStationCode([]) === 'MS-1', 'the next station number');

const mu = startMuster('drill', pob, 'C/O', 1000, ' fire drill ');
ok(mu.kind === 'drill' && mu.note === 'fire drill' && !mu.closedAt && runningMuster([mu])?.id === mu.id, 'a drill muster started');
let marks: any[] = [];
const a = markPerson(mu, marks, 'c1', 'ms1', 'nfc', 'Bosun', 1060);
ok(a.ok && a.mark.id === `${mu.id}_c1` && a.mark.via === 'nfc', 'a wristband at MS-1');
marks = [a.ok ? a.mark : null];
const again = markPerson(mu, marks, 'c1', 'ms2', 'manual', 'C/O', 1070);
ok(!again.ok && (again as any).why === 'already' && (again as any).mark.stationId === 'ms1', 'the first mark stands — a second at another station changes nothing');
ok(!markPerson(mu, marks, 'c3', 'ms1', 'qr', 'Bosun', 1080).ok, 'someone ashore when the alarm sounded is not counted');
const g = markPerson(mu, marks, 'pax1', 'ms1', 'manual', 'Bosun', 1090);
ok(g.ok && g.mark.name === 'A…e', 'a guest marked by name, masked');
marks.push(g.ok ? g.mark : null);
let c = countMuster(mu, marks, stations);
ok(c.total === 4 && c.accounted === 2 && c.missing.map((p) => p.id).join() === 'c2,v1', 'count: 2 of 4, Eva and the visitor missing');
const s1 = c.stations.find((s) => s.station?.id === 'ms1')!;
const s2 = c.stations.find((s) => s.station?.id === 'ms2')!;
ok(s1.here.length === 2 && s1.missing.length === 0 && s2.here.length === 0 && s2.missing[0].id === 'c2', 'per station: who is here, who of theirs is missing');
ok(c.stations.some((s) => s.station === null && s.missing[0]?.id === 'v1'), 'the unassigned missing are listed apart');
ok(c.allInSec === undefined, 'not all in yet');
const e = markPerson(mu, marks, 'c2', 'ms1', 'qr', 'Bosun', 1245);
marks.push(e.ok ? e.mark : null);
const v = markPerson(mu, marks, 'v1', 'ms2', 'manual', 'C/O', 1250);
marks.push(v.ok ? v.mark : null);
c = countMuster(mu, marks, stations);
ok(c.accounted === 4 && !c.missing.length && c.allInSec === 0, 'all accounted for, and in how long');
ok(c.stations.find((s) => s.station?.id === 'ms1')!.elsewhere === 1, 'Eva marked at MS-1 though her station is MS-2: said');
ok(durationText(245) === '4 min 05 s' && durationText(9) === '9 s', 'how long, in words');
const closed = closeMuster(mu, 'Master', 2000, 'All accounted for');
ok(closed.closedAt === 2000 && closed.closeNote === 'All accounted for' && !runningMuster([closed]), 'closed: no longer under way');
ok(!markPerson(closed, [], 'c1', 'ms1', 'nfc', 'B', 2100).ok, '…and nobody is marked after');
const sheet = musterSheet(closed, marks, stations, (id, f) => (id === 'pax1' ? 'Ann Lee' : f));
ok(/Muster — drill/.test(sheet.title) && sheet.facts.includes('Accounted for 4 of 4') && sheet.facts.some((f) => /On closing: All accounted for/.test(f)), 'the paper: what, when, how many');
ok(sheet.tables[0].rows.some((r) => r[1] === 'Ann Lee' && r[4] === 'By name') && sheet.tables[0].rows.some((r) => r[1] === 'Max' && r[4] === 'NFC wristband'), '…who, where, how — the guest\'s full name on this paper only');

// ---- the boat landing -------------------------------------------------------------
const bm = nextMove({ id: 'c1', name: 'Max' }, [], 'Bosun', 'nfc', new Date(5000), ' Tender 1 ');
ok(bm.dir === 'ashore' && bm.via === 'nfc' && bm.boat === 'Tender 1', 'a crossing at the boat landing carries the boat');
const plain = nextMove({ id: 'c2', name: 'Eva' }, [], 'Gw', 'qr', new Date(6000));
ok(!('boat' in plain), '…and one at the gangway does not');
const backIn = nextMove({ id: 'c1', name: 'Max' }, [bm], 'Bosun', 'nfc', new Date(9000), 'Tender 1');
const out = outByBoat([bm, plain, { ...nextMove({ id: 'c3', name: 'Tom' }, [], 'B', 'qr', new Date(5500), 'Tender 1') }]);
ok(out.get('Tender 1')?.map((m) => m.crewId).join() === 'c1,c3' && !out.has(''), 'who is out in which boat');
ok(!outByBoat([bm, backIn]).has('Tender 1'), '…back aboard: not out any more');
ok(recentBoats([bm, { ...bm, id: 'x', boat: 'tender 1', at: 1 }, { ...bm, id: 'y', boat: 'Jet RIB', at: 9999 }]).join() === 'Jet RIB,Tender 1', 'the boats named lately, newest first, once each');

// ---- wiring -------------------------------------------------------------------------
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/nfc_tags\/\{id\}[\s\S]{0,900}id == 'tag_' \+ request\.resource\.data\.uid[\s\S]{0,600}allow delete: if false/.test(rules), 'rules: a tag is its UID, never deleted');
ok(/match \/muster_marks\/\{id\}[\s\S]{0,1200}allow update, delete: if false/.test(rules) && /musterId \+ '_' \+ request\.resource\.data\.personId/.test(rules), 'rules: one mark per person per muster, written once');
ok(/match \/musters\/\{id\}[\s\S]{0,900}affectedKeys\(\)\.hasOnly\(\['closedAt', 'closedBy', 'closeNote', 'updatedAt'\]\)/.test(rules), 'rules: a muster only closes');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'nfc_tags'.*module: 'nfc'/.test(fb) && /sub: 'muster_marks'.*appendOnly: true, module: 'muster'/.test(fb) && /sub: 'musters'.*module: 'muster'/.test(fb) && /sub: 'muster_stations'.*module: 'muster'/.test(fb), 'synced with the modules');
ok(MODULES.nfc === false && MODULES.muster === false, 'flags nfc and muster off in this build');
const idx = readFileSync('index.tsx', 'utf8');
ok(/Muster: \['muster'\]/.test(idx) && /name="Muster" component=\{gated\('Muster'/.test(idx), 'the muster screen gated by its module');
const bk = readFileSync('services/backup.ts', 'utf8');
ok(/NFC_TAGS_KEY/.test(bk) && /MUSTER_MARKS_KEY/.test(bk), 'in the backup');
const st = readFileSync('services/storage.ts', 'utf8');
ok(/    NFC_TAGS_KEY,\n    MUSTER_STATIONS_KEY,\n    MUSTERS_KEY,\n    MUSTER_MARKS_KEY,/.test(st), 'wiped with the rest on reset');
const scan = readFileSync('screens/ScanSc.tsx', 'utf8');
ok(/handle\(r\.code, 'nfc'\)/.test(scan) && /via === 'nfc' \? 'nfc'/.test(scan), 'the scanner takes a tap down the scan\'s path');
const sign = readFileSync('components/SignConfirm.tsx', 'utf8');
ok(/r\.tag\.id !== band\.id/.test(sign) && /proof\('nfc'/.test(sign), 'a signature by wristband: only the signer\'s own, in force');
const how = ['safety', 'drills', 'daTests', 'reportData', 'extInspections', 'meetings', 'appraisals', 'pmsHistory', 'pmsKpi', 'verification', 'signature'];
ok(how.every((f) => /method === 'nfc'/.test(readFileSync(`services/${f}.ts`, 'utf8'))), 'every paper says a wristband signature is one (not "by PIN")');
ok(!/import .*react-native-nfc-manager/.test(readFileSync('services/nfcReader.ts', 'utf8')), 'the NFC library is required lazily (a build without it does not crash)');
const app = JSON.parse(readFileSync('app.json', 'utf8'));
ok(JSON.stringify(app.expo.plugins).includes('react-native-nfc-manager'), 'the build asks for NFC (iOS entitlement, Android permission)');

// ---- a wristband held to the phone: its person, the gangway, what waits for a signature ----
{
  const now = 1_763_200_000_000;
  const crewB: any[] = [{ id: 'c1', name: 'Max Payne', rank: 'Bosun', active: true, addedAt: 1, updatedAt: 1 }, { id: 'c9', name: 'Old Hand', active: false, addedAt: 1, updatedAt: 1 }];
  const paxB: any[] = [{ id: 'pax1', name: 'Ann Lee', embarked: '2025-01-01', addedAt: 1, updatedAt: 1 }];
  const out = nextMove({ id: 'c1', name: 'Max Payne' }, [], 'Gangway', 'nfc', new Date(now));
  const p1 = bandPerson('c1', crewB, paxB, [out], '2025-11-15')!;
  ok(p1.who === 'crew' && p1.onList && p1.ashore && p1.last?.id === out.id && p1.rank === 'Bosun', 'a crew wristband: Max, ashore since his last crossing');
  const back = nextMove({ id: 'c1', name: 'Max Payne' }, [out], 'Gangway', 'nfc', new Date(now + 1000));
  ok(back.dir === 'aboard' && !bandPerson('c1', crewB, paxB, [out, back], '2025-11-15')!.ashore, '…the next crossing brings him back aboard');
  ok(bandPerson('pax1', crewB, paxB, [], '2025-11-15')?.who === 'pax' && !bandPerson('c9', crewB, paxB, [], '2025-11-15')!.onList && bandPerson('gone', crewB, paxB, [], '2025-11-15') === null, 'a guest; a signed-off crew member is not counted at the gangway; someone on no list → null');
  const doc: any = { id: 'd1', title: 'Garbage plan', docNo: 'SMS-07', category: 'sms', revision: 2, mustRead: true };
  const base = { nights: [], standing: [], orderAcks: [], docs: [doc], docAcks: [] as any[], crew: crewB, now: '2025-11-15T10:00', orders: true, dp: false, docsOn: true };
  const pend = bandPending(p1, base);
  ok(pend.length === 1 && pend[0].kind === 'doc' && (pend[0] as any).title === 'SMS-07 Garbage plan', 'Max has a document to read and sign');
  const ack = { id: 'd1_r2_c1', docId: 'd1', revision: 2, docTitle: 'Garbage plan', personKey: 'c1', by: 'Max Payne', at: now, updatedAt: now };
  ok(!bandPending(p1, { ...base, docAcks: [ack] }).length && bandPending(p1, { ...base, docAcks: [{ ...ack, revision: 1 }] }).length === 1, '…signed: nothing waits; an old revision signed still waits');
  ok(!bandPending(p1, { ...base, docsOn: false }).length && !bandPending({ id: 'pax1', name: 'Ann Lee', who: 'pax' }, base).length, 'documents off: nothing; a guest signs nothing');
}

// ---- words --------------------------------------------------------------------------
const files = ['screens/MusterSc.tsx', 'screens/ScanSc.tsx', 'components/NfcTagRow.tsx', 'components/BoatLanding.tsx', 'components/SignConfirm.tsx', 'components/useNfcTaps.ts', 'screens/PatrolsSc.tsx', 'screens/SecuritySc.tsx', 'screens/NfcPersonSc.tsx', 'components/NfcListener.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
const used = [...new Set([...files.matchAll(/\bt\('((?:nfc|mu|sc|band|scn|b)\.[\w.]+)'/g)].map((m) => m[1]))];
const dyn = ['nfc.why.unknown', 'nfc.why.revoked', 'nfc.why.mismatch', 'mu.who.crew', 'mu.who.pax', 'mu.who.visitor', 'menu.Muster'];
for (const [lang, dict] of [['en', en], ['es', es], ['no', no], ['pt', pt], ['ru', ru], ['uk', uk]] as const) {
  const missing = [...used, ...dyn].filter((k) => !(k in dict));
  ok(!missing.length, `every word in ${lang}${missing.length ? `: missing ${missing.join(', ')}` : ''}`);
}
const manual = readFileSync('constants/manual.ts', 'utf8');
ok(/title: "Muster and boat landing"/.test(manual) && /\{ title: ["']Muster and boat landing["'], module: 'muster' \}/.test(manual), 'the manual has the muster section, gone with the module');
ok(/title: "NFC wristbands and tags"/.test(manual) && /\{ title: ["']NFC wristbands and tags["'], module: 'nfc' \}/.test(manual), '…and the NFC section');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
