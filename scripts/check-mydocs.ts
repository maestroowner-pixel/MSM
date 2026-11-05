// npm run check:mydocs — one person's documents: who the device is, their certificates and nobody else's, drills carried out, the week's rest, what changed, the Board.
import { findMe, myCerts, myChanges, myDrills, myRest } from '../services/myDocs';
import { sdmDiffs, toMySdm } from '../services/mySdm';
import { buildBoard } from '../services/board';
import { todayIso } from '../services/pms';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = '2026-11-05';
const shift = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const M: any = { id: 'c1', name: 'Jez Dodd', rank: 'AB', active: true, addedAt: 1, updatedAt: 100 };
const crew: any[] = [M, { id: 'c2', name: 'Ann Lee', active: true, addedAt: 1, updatedAt: 1 }, { id: 'c3', name: 'Old Hand', active: true, deleted: true, addedAt: 1, updatedAt: 1 }];
const C = (o: any = {}): any => ({ id: 'x', scope: 'crew', crewId: 'c1', name: 'ENG1', itemIds: [], createdAt: 1, updatedAt: 50, ...o });

ok(findMe(crew, { key: 'device:abc', name: '  jez   DODD ' })?.id === 'c1', 'an enrolled device, by name');
ok(findMe(crew, { key: 'c2', name: 'Whatever' })?.id === 'c2', 'the crew member the device signs as, by id');
ok(!findMe(crew, { key: 'device:z', name: 'Not Here' }), 'not on the list: nobody');
ok(!findMe(crew, { key: 'c3', name: 'Old Hand' }), 'someone removed: nobody');
ok(!findMe(crew, null), 'no person: nobody');

const certs = [
  C({ id: 'ok', expiryDate: shift(300) }), C({ id: 'late', expiryDate: shift(-3) }), C({ id: 'soon', expiryDate: shift(10) }), C({ id: 'never' }),
  C({ id: 'other', crewId: 'c2' }), C({ id: 'vessel', scope: 'vessel', crewId: undefined }), C({ id: 'equip', scope: undefined, crewId: undefined }),
  C({ id: 'byname', crewId: undefined, holderName: 'jez dodd', expiryDate: shift(301) }), C({ id: 'otherName', crewId: undefined, holderName: 'Ann Lee' }),
];
const mine = myCerts(certs, M).map((c) => c.id);
ok(mine.join() === 'late,soon,ok,byname,never', `their own, what needs doing first (${mine.join()})`);

const D = (o: any = {}): any => ({ id: 'd', no: 'D1', type: 'fire', topic: 'Fire', date: '2026-10-01', scenario: [], theory: false, attendance: [{ name: 'Jez Dodd', present: true }], plannedBy: 'A', doneAt: 1, updatedAt: 1, ...o });
const dr = (l: any[]) => myDrills(l, M, T).map((d) => d.id).join();
ok(dr([D()]) === 'd', 'a drill attended');
ok(dr([D({ doneAt: undefined })]) === '', 'planned, not carried out: no');
ok(dr([D({ attendance: [{ name: 'Jez Dodd', present: false, reason: 'On watch' }] })]) === '', 'marked absent: no');
ok(dr([D({ attendance: [{ name: 'Ann Lee', present: true }] })]) === '', "someone else's: no");
ok(dr([D({ date: '2025-10-01' })]) === '', 'over a year ago: no');
ok(dr([D({ deleted: true })]) === '', 'deleted: no');
ok(dr([D({ id: 'a', date: '2026-01-01' }), D({ id: 'b', date: '2026-10-01' })]) === 'b,a', 'newest first');

const day = (date: string, crewId = 'c1', workH = 8) => ({ id: `${crewId}_${date}`, crewId, date, work: '1'.repeat(workH * 2) + '0'.repeat(48 - workH * 2), updatedAt: 1 });
const r = myRest([day('2026-11-05'), day('2026-11-04'), day('2026-11-05', 'c2')] as any, M, T);
ok(r.recorded === 2 && r.restHours === 32, `only their own days (${r.recorded} days, ${r.restHours} h)`);
ok(myRest([] as any, M, T).recorded === 0, 'nothing recorded: nothing claimed');
ok(myRest([day('2026-11-05', 'c1', 20)] as any, M, T).violations > 0, 'a breach is counted');

ok(myChanges([C()], M, undefined).length === 0, 'never looked: nothing called new');
ok(myChanges([C({ updatedAt: 500 })], M, 200)[0].id === 'x', 'a certificate changed since');
ok(myChanges([C({ updatedAt: 100 })], M, 200).length === 0, '…not before');
ok(myChanges([], { ...M, updatedAt: 300 }, 200)[0].kind === 'details', 'their details changed');

// The seafarer's own SDM file.
const raw: any = {
  personal: { firstName: 'Jez', middleName: '', lastName: 'Dodd', birthDate: '1980-01-02', birthPlace: 'Hull', nationality: 'GB', phone: '+44', email: 'j@x', minDayRate: '999', minDayRateCurrency: 'EUR', photo: 'BASE64PHOTO', visaUSA: 'C1/D 2030', visaSchengen: '' },
  biometrics: { bloodType: 'O+', height: '180' }, notes: 'PRIVATE NOTES', dpDays: [{ id: 'x' }],
  nextOfKin: { name: 'Sam Dodd', relationship: 'Wife', phone: '+44 2' },
  documents: [
    { id: 'p', category: 'Passport', name: 'Passport', number: 'P123', expiryDate: '2030-01-01', noExpiryDate: false },
    { id: 'e', category: 'Medical', name: 'ENG1', number: 'E1', expiryDate: '2027-06-01', noExpiryDate: false },
    { id: 'n', category: 'STCW', name: 'Security Awareness', number: 'S9', expiryDate: '', noExpiryDate: true },
    { id: 'b', category: "Seaman's Book", name: "Seaman's Book", number: 'B1', expiryDate: '2031-01-01' },
    { id: 'x', category: 'Other', name: '' },
  ],
  seaService: [{ vesselName: 'Old Ship', position: 'AB', signOn: '2020-01-01', signOff: '2020-06-01' }, { vesselName: 'Newer Ship', position: 'AB', signOn: '2022-01-01', signOff: '2022-06-01', company: 'Co' }],
};
const my = toMySdm(raw, 'a.sdm', 5);
const kept = JSON.stringify(my);
for (const secret of ['BASE64PHOTO', 'O+', 'PRIVATE NOTES', '999', 'EUR', 'bloodType', 'dpDays']) ok(!kept.includes(secret), `not kept: ${secret}`);
ok(my.name === 'Jez Dodd' && my.birthPlace === 'Hull' && my.loadedAt === 5, 'who they are');
ok(my.kin?.name === 'Sam Dodd' && my.visas.length === 1 && my.visas[0].label === 'USA', 'next of kin, and only the visas they have');
ok(my.documents.length === 4, 'a document without a name is left out');
ok(my.documents.find((d) => d.id === 'n')?.noExpiry === true && my.documents.find((d) => d.id === 'n')?.expiryDate === undefined, 'no expiry stays no expiry');
ok(my.service[0].vessel === 'Newer Ship', 'sea service, newest first');
ok(toMySdm({ documents: [] }, 'b.sdm', 1).documents.length === 0, 'an almost empty file does not fail');
const vc = [C({ id: 'v1', name: 'Passport', expiryDate: '2030-01-01' }), C({ id: 'v2', name: 'Medical fitness', number: 'E-1', expiryDate: '2027-01-01' })];
const dff = sdmDiffs(my.documents, vc);
ok(dff.find((x) => x.doc.id === 'e')?.kind === 'date' && dff.find((x) => x.doc.id === 'e')?.vesselExpiry === '2027-01-01', 'matched by number whatever the name; the dates differ');
ok(dff.find((x) => x.doc.id === 'n')?.kind === 'missing', 'not on the vessel');
ok(!dff.some((x) => x.doc.id === 'p'), 'the passport agrees');
ok(!dff.some((x) => x.doc.id === 'b'), "the seaman's book is not a certificate on the vessel");
const store = readFileSync('services/firebaseService.ts', 'utf8') + readFileSync('services/backup.ts', 'utf8');
ok(!/MY_SDM_KEY|my_sdm/.test(store), 'never synced, never in the backup');
ok(/MY_SDM_KEY/.test(readFileSync('services/storage.ts', 'utf8').slice(readFileSync('services/storage.ts', 'utf8').indexOf('resetAllData'))), 'erased with the device');
ok(/moduleOn\('mySdm'\) && Platform\.OS !== 'web'/.test(readFileSync('screens/MyDocsSc.tsx', 'utf8')), 'behind its flag, and not in a browser');
ok(/^  mySdm: false,/m.test(readFileSync('constants/modules.ts', 'utf8')), 'not offered: the flag is off');
ok(/module: 'mySdm', drop: \[2\]/.test(readFileSync('constants/manual.ts', 'utf8')), 'nor described in the manual');

const base: any = {
  on: (k: string) => k === 'myDocs', role: 'user', me: { key: 'device:a', name: 'Jez Dodd' }, today: todayIso(), now: `${todayIso()}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew, crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
};
const note = (x: any, key: string) => buildBoard({ ...base, ...x }).attention.find((n: any) => n.key === key);
ok(note({ certificates: [C({ id: 'late', expiryDate: shift(-3) })] }, 'my:cert:late')?.level === 'red', 'Board: their expired certificate, red');
ok(note({ certificates: [C({ id: 'soon', expiryDate: shift(10) })] }, 'my:cert:soon')?.level === 'amber', 'Board: due soon, amber');
ok(!!note({ certificates: [C({ id: 'late', expiryDate: shift(-3) })] }, 'my:cert:late')?.first, '…addressed to them, ahead of the rest');
ok(!note({ certificates: [C({ id: 'ok', expiryDate: shift(300) })] }, 'my:cert:ok'), 'in date: nothing');
ok(!note({ certificates: [C({ id: 'o', crewId: 'c2', expiryDate: shift(-3) })] }, 'my:cert:o'), "someone else's: nothing");
ok(!note({ on: () => false, certificates: [C({ id: 'late', expiryDate: shift(-3) })] }, 'my:cert:late'), 'flag off: nothing');
ok(!!note({ prefs: { myDocsSeen: 10 }, certificates: [C({ updatedAt: 500 })] }, 'my:changed'), 'Board: something changed');
ok(!note({ prefs: {}, certificates: [C({ updatedAt: 500 })] }, 'my:changed'), '…not before they ever looked');

const scr = readFileSync('screens/MyDocsSc.tsx', 'utf8');
ok(!/crewPrivate/.test(scr), 'the screen does not reach for crew_private, which a crew device does not hold');
ok(!/saveRow|appendRow|saveCert/.test(scr), 'read only');
console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
process.exit(fail ? 1 : 0);
