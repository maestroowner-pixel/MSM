// Specimen records for the flag's sample copies (erb-approval/06): the four MARPOL
// books for November 2026 on test vessel 1234567, each entry sealed with the same
// code a screen uses (services/seal), as IndexedDB rows for a browser profile.
// Not part of the app; run once, output to the path given.
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { chainHead, contentHash, keyIdOf, privateFrom, publicOf, sealHash, SignKeyRec } from '../services/seal';
import { orbText } from '../services/orb';
import { FUEL_CHANGE, ODS } from '../services/logbooks';
import { amended } from '../services/versions';

const T = (d: string, h: string) => Date.parse(`${d}T${h}:00Z`);
const key = () => privateFrom(new Uint8Array(randomBytes(32)))!;
const crew = [
  { id: 'cm-master', name: 'John Smith', rank: 'Master' },
  { id: 'cm-ce', name: 'Peter Hale', rank: 'Chief Engineer' },
  { id: 'cm-2e', name: 'Marco Rossi', rank: '2nd Engineer' },
  { id: 'cm-co', name: 'Anna Berg', rank: 'Chief Officer' },
  { id: 'cm-2o', name: 'Tom Reyes', rank: '2nd Officer' },
];
const priv: Record<string, Uint8Array> = Object.fromEntries(crew.map((c) => [c.id, key()]));
const keys: SignKeyRec[] = crew.map((c) => ({ id: keyIdOf(publicOf(priv[c.id])), person: c.id, name: c.name, kind: 'person', pub: publicOf(priv[c.id]), at: T('2026-10-01', '08:00'), updatedAt: T('2026-10-01', '08:00') }));
const who = (id: string) => crew.find((c) => c.id === id)!;
const DEV = 'dev_ecr_tablet';

const seal = <R extends object>(r: R, id: string, field: 'signedWith' | 'editedWith' = 'signedWith'): R =>
  ({ ...r, [field]: { ...(r as any)[field], seal: sealHash(priv[id], contentHash(r), 'person') } });

/** An entry as a screen saves it: signer, chain, proof, seal. */
function entry<R extends object>(book: any[], r: R, date: string, time: string, by: string): R {
  const at = T(date, time) + 5 * 60000;
  const head = chainHead(book);
  const p = who(by);
  const e = seal({ ...r, date, time, by: p.name, byRank: p.rank, byId: p.id, at, ...(head ? { prev: head } : {}), signedWith: { method: 'pin', deviceId: DEV, at }, updatedAt: at }, by);
  book.push(e);
  return e;
}

// ---- Oil Record Book Part I ----
const orb: any[] = [];
const o = (id: string, f: any, date: string, time: string, by: string) => entry(orb, { id, ...f, text: orbText({ ...f, date, time }) }, date, time, by);
o('orb_s1', { code: 'C', tank: 'Sludge tank 9P', retained: 1.4 }, '2026-11-02', '08:00', 'cm-2e');
o('orb_s2', { code: 'D', tank: 'Bilge holding tank', quantity: 3.2, method: 'ows', start: '14:10', stop: '15:40', place: "43°12.4'N 008°55.1'W → 43°24.0'N 009°02.8'W" }, '2026-11-04', '15:40', 'cm-2e');
const h = o('orb_s3', { code: 'H', place: 'Algeciras', grade: 'MGO 0.08 % S', quantity: 85, unit: 't', tank: 'DO storage 3P/3S', bdnNo: 'ALG-2611-0471' }, '2026-11-07', '18:30', 'cm-ce');
o('orb_s4', { code: 'C', tank: 'Sludge tank 9P', quantity: 4.5, method: 'shore', place: 'Algeciras', receiptNo: 'MRP-58213' }, '2026-11-08', '11:00', 'cm-ce');
o('orb_s5', { code: 'I', remarks: 'Weekly test of 15 ppm alarm and automatic stopping device — satisfactory' }, '2026-11-10', '10:00', 'cm-2e');
// The Master amends the bunkering line: BDN quantity corrected (his ECR-tablet key).
const fix = { ...h, quantity: 84.6 };
let a: any = amended(h, { quantity: 84.6, text: orbText({ ...fix }) }, 'orb_s3b', 'Quantity per final BDN figure', { name: 'John Smith', rank: 'Master', id: 'cm-master', proof: { method: 'pin', deviceId: DEV, at: T('2026-11-09', '09:05') } }, T('2026-11-09', '09:05'));
delete a.signedWith; a.prev = chainHead(orb);
a = { ...seal({ ...a, signedWith: h.signedWith }, 'cm-master', 'editedWith') };
orb.push(a);
o('orb_s6', { code: 'D', tank: 'Bilge holding tank', quantity: 2.1, method: 'ows', start: '09:20', stop: '10:25', place: "36°41.0'N 004°12.6'W → 36°45.3'N 003°58.9'W" }, '2026-11-14', '10:25', 'cm-2e');

// ---- Garbage Record Book Part I ----
const grb: any[] = [];
const g = (id: string, f: any, date: string, time: string, by: string) => entry(grb, { id, ...f }, date, time, by);
g('grb_s1', { category: 'B', method: 'sea', volume: 0.3, items: [{ category: 'B', volume: 0.3 }], comminuted: true, position: "42°58.7'N 009°31.2'W", distanceNm: 18 }, '2026-11-03', '19:30', 'cm-2o');
g('grb_s2', { category: 'A', method: 'shore', volume: 2.1, items: [{ category: 'A', volume: 1.2 }, { category: 'C', volume: 0.6 }, { category: 'I', volume: 0.3 }], port: 'Algeciras', receiptNo: 'ALG-W-7731', containerNo: 'Skip 14' }, '2026-11-08', '10:15', 'cm-co');
g('grb_s3', { category: 'C', method: 'incineration', volume: 0.4, items: [{ category: 'C', volume: 0.4 }], position: "36°20.5'N 002°10.4'W", remarks: 'Paper and cardboard; start 14:00, stop 15:30' }, '2026-11-12', '15:30', 'cm-co');
g('grb_s4', { category: 'E', method: 'shore', volume: 0.1, items: [{ category: 'E', volume: 0.1 }], port: 'Valletta', receiptNo: 'VLT-55102' }, '2026-11-17', '09:00', 'cm-co');

// ---- Fuel oil changeover ----
const fc: any[] = [];
const fe = (id: string, f: any, date: string, time: string, by: string) => entry(fc, { id, book: 'fuelChange', ...f, text: FUEL_CHANGE.text({ ...f, date, time }) }, date, time, by);
fe('fc_s1', { code: 'EXIT', method: 'north', place: "49°47.6'N 005°00.0'W" }, '2026-11-01', '03:20', 'cm-2o');
fe('fc_s2', { code: 'OUT', method: 'north', tank: 'HFO settling and service tanks', quantity: 42.0, sulphur: 0.48, place: "49°41.2'N 005°09.8'W" }, '2026-11-01', '04:10', 'cm-ce');
fe('fc_s3', { code: 'BERTH', tank: 'DO service tank', quantity: 16.5, sulphur: 0.08, place: 'Valletta, berth 3' }, '2026-11-16', '07:50', 'cm-ce');
fe('fc_s4', { code: 'DEPART', tank: 'HFO settling and service tanks', quantity: 38.0, sulphur: 0.48, place: 'Valletta, berth 3' }, '2026-11-18', '17:30', 'cm-ce');

// ---- ODS Record Book ----
const ods: any[] = [];
const de = (id: string, f: any, date: string, time: string, by: string) => entry(ods, { id, book: 'ods', ...f, text: ODS.text({ ...f, date, time }) }, date, time, by);
de('ods_s1', { code: 'REP', equipment: 'Provision refrigeration plant (IAPP 2.1.1)', substance: 'R-22', mass: 2.8, remarks: 'Compressor 2 valve plate renewed; charge recovered to cylinder C-17 and returned' }, '2026-11-05', '16:00', 'cm-ce');
de('ods_s2', { code: 'PART', equipment: 'Provision refrigeration plant (IAPP 2.1.1)', substance: 'R-22', mass: 0.9, remarks: 'Top-up after repair, leak test satisfactory' }, '2026-11-06', '10:30', 'cm-ce');
de('ods_s3', { code: 'SUPPLY', substance: 'R-22', mass: 10, place: 'Algeciras' }, '2026-11-08', '12:00', 'cm-ce');

const t0 = T('2026-10-01', '08:00');
const rows: Record<string, unknown> = {
  'msm:vessel_info': { vessel_name: 'TEST VESSEL', imo: '1234567', flag: 'Marshall Islands', ship_utc_offset: '+00:00' },
  'msm:crew': crew.map((c) => ({ id: c.id, name: c.name, rank: c.rank, active: true, onBoard: true, signOn: '2026-10-01', addedAt: t0, updatedAt: t0 })),
  'msm:sign_keys': keys,
  'msm:orb': orb,
  'msm:garbage': grb,
  'msm:fuel_changeover': fc,
  'msm:ods': ods,
};
writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
console.log('orb', orb.length, 'garbage', grb.length, 'changeover', fc.length, 'ods', ods.length);
