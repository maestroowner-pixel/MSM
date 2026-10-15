// npm run check:gangway — who is ashore, persons on board, the next move a
// crew card makes, double scans, and the crew card QR payload.
import { isAshore, isDoubleScan, lastMoves, nextMove, personsOnBoard, photosToRemove } from '../services/gangway';
import { labelsToTspl } from '../services/tspl';
import { crewCardSpecs, visitorPassSpecs } from '../services/gangwayLabels';
import { crewQrPayload, parseCrewQr, parsePassQr, passQrPayload, samePass, parseSopepQr, sopepQrPayload } from '../services/crewQr';
import { MAIN_LOCKER, lockerCode, lockerOf, nextLockerCode, sopepLockers } from '../types/sopep';
import { planSopepImport, readSopepSheet } from '../services/sopepSheet';
import { sopepLabelSpecs } from '../services/gangwayLabels';
import { areasFor, defaultPlan, searchDone } from '../types/searches';
import { MENU_CHILDREN, MENU_GEAR } from '../utils/navOrder';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const crew: any[] = [
  { id: 'a', name: 'Ann', active: true },
  { id: 'b', name: 'Bob', active: true },
  { id: 'c', name: 'Cy', active: true, onBoard: false },
];
const t0 = new Date('2026-10-10T09:00:00');
const m1 = nextMove(crew[0], [], 'Watch', 'qr', t0);
ok(m1.dir === 'ashore' && m1.time === '09:00' && m1.date === '2026-10-10', 'first scan of someone aboard = ashore');
const m2 = nextMove(crew[0], [m1], 'Watch', 'qr', new Date('2026-10-10T18:30:00'));
ok(m2.dir === 'aboard', 'second scan = back aboard');
ok(isAshore('a', lastMoves([m1])) && !isAshore('a', lastMoves([m1, m2])), 'place is the last move');
ok(!isAshore('a', lastMoves([m2, m1].reverse())), 'order of the list does not matter');
const pob = personsOnBoard(crew, [m1], [{ timeOut: undefined } as any, { timeOut: '12:00' } as any]);
ok(pob.crewTotal === 2 && pob.crewAboard === 1 && pob.visitors === 1 && pob.total === 2, 'POB: signed-off crew and signed-out visitors not counted');
ok(isDoubleScan('a', [m1], t0.getTime() + 30_000) && !isDoubleScan('a', [m1], t0.getTime() + 120_000), 'double scan within a minute');
ok(parseCrewQr(crewQrPayload('crw_AbC')) === 'crw_AbC' && parseCrewQr('MSM://CREW/x1') === 'x1', 'crew QR round trip, case of scheme ignored');
ok(parseCrewQr('msm://item/x') === null, 'crew and item QRs do not mix');
ok(parsePassQr(passQrPayload('07')) === '07' && parsePassQr('msm://crew/x') === null && parseCrewQr(passQrPayload('07')) === null, 'visitor pass QR round trip, not a crew card');
ok(samePass('7', '07') && samePass('07', '7') && !samePass('7', '17') && !samePass(undefined, '7'), '"7" and "07" are the same pass');
// Crew cards and visitor passes on the Xprinter: the printer is sent the same QR the scanner reads.
{
  const tspl = labelsToTspl([...crewCardSpecs([{ id: 'c1', name: 'Jez Dodd', rank: '3/O' }], { vessel_name: 'MY Alpha' }, '60x40'), ...visitorPassSpecs(2, null, '50x30')]);
  ok(tspl.includes(crewQrPayload('c1')) && tspl.includes(passQrPayload('02')), 'TSPL carries the crew-card and pass QR payloads');
  ok((tspl.match(/PRINT 1/g) ?? []).length === 3 && tspl.includes('SIZE 60 mm,40 mm') && tspl.includes('Jez Dodd') && tspl.includes('VISITOR 01'), 'one PRINT per sticker, the roll size, the names');
}
{
  const V = (o: any): any => ({ id: 'v', date: '2026-07-01', timeIn: '08:00', name: 'X', purpose: 'Yard', inBy: 'Jez', updatedAt: 0, photo: 'data:', ...o });
  const due = photosToRemove([V({ id: 'old', timeOut: '17:00' }), V({ id: 'aboard' }), V({ id: 'recent', date: '2026-08-01', timeOut: '17:00' }), V({ id: 'nophoto', timeOut: '17:00', photo: undefined }), V({ id: 'stayed', date: '2026-06-01', dateOut: '2026-09-01', timeOut: '10:00' })], '2026-10-13');
  ok(due.map((v) => v.id).join() === 'old', `photo removed 90 days after leaving, never while aboard: ${due.map((v) => v.id)}`);
}
// SOPEP lockers (14 Oct 2026)
ok(parseSopepQr(sopepQrPayload('lk_ab12')) === 'lk_ab12' && parseSopepQr('MSM://SOPEP/main') === 'main' && parseSopepQr(crewQrPayload('c1')) === null && parseCrewQr(sopepQrPayload('x')) === null, 'SOPEP locker QR: its own scheme, not mistaken for a crew card');
ok(sopepLockers([])[0].id === MAIN_LOCKER && sopepLockers([{ id: 'lk2', name: 'Bow', order: 1, updatedAt: 1 }]).map((l) => l.id).join() === 'main,lk2' && sopepLockers([{ id: 'main', name: 'Engine room', order: 0, updatedAt: 1 }])[0].name === 'Engine room', 'lockers: the first is there before it is saved, renamed when saved');
ok(lockerOf({}) === MAIN_LOCKER && lockerOf({ lockerId: 'lk2' }) === 'lk2', 'an item without a locker is in the first one');
// SOPEP lockers with IDs, lists from Excel (15 Oct 2026)
const lk = sopepLockers([{ id: 'lk2', name: 'Bunker station', code: 'SP-02', order: 1, updatedAt: 1 }]);
ok(lockerCode(lk[0]) === 'SP-01' && lockerCode(lk[1]) === 'SP-02' && nextLockerCode(lk) === 'SP-03' && nextLockerCode([]) === 'SP-01', 'locker IDs: the first is SP-01, the next free one offered');
const sl = readSopepSheet([['SOPEP inventory'], ['Description', 'Qty', 'UoM', 'Stowage'], ['Example: x', 1, '', ''], ['Oil absorbent pads', '120', 'pcs', 'Shelf 1'], ['Scupper plugs', 8, '', '']]);
ok(sl.length === 2 && sl[0].required === 120 && sl[0].unit === 'pcs' && sl[0].location === 'Shelf 1' && sl[1].required === 8, `SOPEP sheet: other people's headings read: ${JSON.stringify(sl[0])}`);
const sitems: any[] = [{ id: 'i1', name: 'Scupper plugs', required: 6, order: 0, updatedAt: 0 }, { id: 'i2', name: 'Oil absorbent pads', required: 50, lockerId: 'lk2', order: 1, updatedAt: 0 }];
const sp1 = planSopepImport(sl, sitems, MAIN_LOCKER, MAIN_LOCKER);
ok(sp1.updated.join() === 'Scupper plugs' && sp1.added.join() === 'Oil absorbent pads' && sp1.save.find((x) => x.name === 'Scupper plugs')?.required === 8 && !sp1.save.some((x) => x.lockerId), 'SOPEP import into the first locker: matched there only (the bunker station pads untouched), added with no locker id');
const sp2 = planSopepImport(sl, sitems, 'lk2', MAIN_LOCKER);
ok(sp2.updated.join() === 'Oil absorbent pads' && sp2.save.every((x) => x.lockerId === 'lk2'), 'SOPEP import into another locker: its own list');
ok(sopepLabelSpecs([{ id: 'lk2', code: 'SP-02', name: 'Bunker station', location: 'Aft deck' }], null, '50x30')[0].qrPayload === sopepQrPayload('lk2'), 'SOPEP sticker: the QR carries the locker id');
// searches
const plan = defaultPlan();
const st = areasFor(plan, 'stowaway'), bo = areasFor(plan, 'bomb');
ok(st.length === plan.areas.length && bo.length === plan.areas.length - 1 && st.every((a) => a.team) && !bo.some((a) => /Tender garage/.test(a.name)), 'search areas: each with its team; the tender garage only for stowaways');
ok(searchDone({ areas: [{ areaId: 'a', name: 'x', result: 'clear' }, { areaId: 'b', name: 'y' }] } as any) === 1, 'search progress: areas marked');
// menu
ok(!!MENU_GEAR.Sopep && !!MENU_GEAR.Stores && MENU_CHILDREN.Sopep.map((k) => k.view).join() === 'inventory,drills,docs' && MENU_CHILDREN.Sopep.find((k) => k.view === 'docs')?.officers === true, 'menu: SOPEP — inventory, drills, docs (officers), with the gear');
ok(MENU_CHILDREN.Drills.filter((k) => k.route).map((k) => `${k.route}:${k.view}`).join() === 'Sopep:drills,Security:drills', 'menu: Drills lists the SOPEP and ISPS drills');
ok(MENU_CHILDREN.Security.some((k) => k.view === 'ssp' && k.officers) && MENU_CHILDREN.Security.some((k) => k.view === 'searches'), 'menu: Security — Ship Security Plan (officers), searches');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
