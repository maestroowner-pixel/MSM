// ===================================
// Sample data — so a new ISMPilot is not an empty app (17 Nov 2026: "an empty
// app scares; not only the chest — equipment, log entries, every screen, a
// little for testing"; as Marine Hospital Manager's sample stock).
//
// On the very first start of a device that has never joined a vessel and holds
// nothing yet, a few rows go into every screen such a device opens (constants/
// modules STANDALONE_MODULES): the LSA/FFE register (some out of date, some
// due), certificates (one expired, one due), crew and a week of their hours of
// rest (one day short of rest), PMS with an overdue job and an open defect, and
// spares. Every row's id starts with `sample_`; the Dashboard says so in a
// banner and one tap clears them. Settings → Data loads them again.
//
// The hospital, the record books, drills and the rest are locked on such a
// device, so nothing goes there. And nothing reaches a vessel: their moves and
// books are append-only in the cloud and could never be cleared — sample data
// only sits on a device without a vessel, and joining one clears it first
// (services/enrolment). Clearing also
// takes the rows that point at a sample row (a job done on a sample machine, a
// move of a sample medicine) — they would mean nothing without it.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as storage from './storage';
import { getDeviceSecret } from './firebaseService';
import { CATEGORIES } from '../constants/categories';
import { Certificate } from '../types/certificate';
import { CrewMember } from '../types/crew';
import { EquipmentItem } from '../types/equipment';
import { Machine, PmsDefect, PmsDone, PmsJob } from '../types/pms';
import { RestDay, restDayId } from '../types/rest';
import { SpareMove, SparePart } from '../types/spares';

/** Every sample row's id starts with it — and it is how one is known. */
export const SAMPLE_PREFIX = 'sample_';
/** Set once the first start has been looked at — sample data never comes back by itself. */
const FIRST_START_KEY = `msm:sample_first_start`;

const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSample = (v: unknown) => typeof v === 'string' && v.startsWith(SAMPLE_PREFIX);
/** A sample row, or one that points at one (machineId, itemId, crewId…). */
const touchesSample = (row: unknown) => !!row && typeof row === 'object' && Object.values(row as Record<string, unknown>).some(isSample);

const LIST_KEYS = [
  storage.CERTIFICATES_KEY, storage.CREW_KEY, storage.REST_KEY,
  storage.PMS_MACHINES_KEY, storage.PMS_JOBS_KEY, storage.PMS_DONE_KEY, storage.PMS_DEFECTS_KEY,
  storage.SPARES_KEY, storage.SPARE_MOVES_KEY,
];
const categoryKey = (c: string) => `msm:${c}`;
const allKeys = () => [...LIST_KEYS, ...CATEGORIES.map((c) => categoryKey(c.key))];
/** Lists with no sample rows of their own that may point at one: a round signed on a sample item, a deferred sample job… */
const POINTING_KEYS = [storage.INSPECTIONS_KEY, storage.PMS_DEFERRALS_KEY, storage.ITEM_MOVEMENTS_KEY, storage.CREW_PRIVATE_KEY, storage.CERT_PRIVATE_KEY];

/** The rows, key by key. `today` fixes every date, so the states (expired, due, ok) are the same on every start. */
export function buildSampleData(today = new Date()): Record<string, { id: string }[]> {
  const now = today.getTime();
  const d = (days: number) => ymd(new Date(now + days * DAY));
  const id = (s: string) => `${SAMPLE_PREFIX}${s}`;
  const by = { by: 'Tom Harris', byRank: 'Chief Officer' };
  const out: Record<string, { id: string }[]> = {};

  // ---- LSA / FFE register: in date, due within 60 days, out of date ----
  const eq = (cat: string, n: number, rest: Partial<EquipmentItem>): EquipmentItem => ({ id: id(`${cat}_${n}`), category: cat, no: n, updatedAt: now, ...rest });
  const register: EquipmentItem[] = [
    eq('liferafts', 1, { type: 'Throw-over liferaft', make: 'Viking', size: '12 persons', persons: 12, serial: 'VK-48213', deck: 'Boat deck', position: 'Port side', manufactureDate: d(-2200), nextInspection: d(140) }),
    eq('liferafts', 2, { type: 'Throw-over liferaft', make: 'Viking', size: '12 persons', persons: 12, serial: 'VK-48214', deck: 'Boat deck', position: 'Starboard side', manufactureDate: d(-2200), nextInspection: d(25) }),
    eq('lifebuoys', 1, { type: 'Lifebuoy with light and smoke signal', make: 'Datrex', deck: 'Bridge deck', position: 'Bridge wing port', nextInspection: d(200), expiry: d(-12), remarks: 'Smoke signal out of date' }),
    eq('lifebuoys', 2, { type: 'Lifebuoy with line', make: 'Datrex', deck: 'Main deck', position: 'Aft starboard', nextInspection: d(200) }),
    eq('lifejackets', 1, { type: 'Adult lifejacket', make: 'Crewsaver', quantity: 14, deck: 'Accommodation', position: 'Cabins', nextInspection: d(300), expiry: d(900) }),
    eq('fire_extinguishers', 1, { type: 'Powder ABC', make: 'Gloria', size: '6 kg', serial: 'FE-01', deck: 'Bridge deck', position: 'Wheelhouse', nextInspection: d(90) }),
    eq('fire_extinguishers', 2, { type: 'CO2', make: 'Gloria', size: '5 kg', serial: 'FE-02', deck: 'Engine room', position: 'ECR entrance', nextInspection: d(-20) }),
    eq('fire_extinguishers', 3, { type: 'Foam', make: 'Gloria', size: '9 L', serial: 'FE-03', deck: 'Main deck', position: 'Galley', nextInspection: d(40) }),
    eq('eebd', 1, { type: 'EEBD 15 min', make: 'Dräger', serial: 'EB-2231', deck: 'Engine room', position: 'Upper platform', nextInspection: d(180), expiry: d(1200) }),
  ];
  for (const it of register) (out[categoryKey(it.category)] ??= []).push(it);

  // ---- certificates ----
  const cert = (n: string, rest: Partial<Certificate>): Certificate => ({ id: id(`cert_${n}`), name: n, itemIds: [], createdAt: now, updatedAt: now, ...rest });
  out[storage.CERTIFICATES_KEY] = [
    cert('Safety Equipment Certificate', { scope: 'vessel', number: 'SEC-2026-118', issuer: 'Lloyd’s Register', issueDate: d(-300), expiryDate: d(1500) }),
    cert('Liferaft annual service', { scope: 'equipment', number: 'LR-7731', issuer: 'Viking service station', issueDate: d(-340), expiryDate: d(25), itemIds: [id('liferafts_1'), id('liferafts_2')] }),
    cert('Fire extinguishers annual service', { scope: 'equipment', number: 'FX-0412', issuer: 'Fire Safety Ltd', issueDate: d(-385), expiryDate: d(-20), itemIds: [id('fire_extinguishers_1'), id('fire_extinguishers_2'), id('fire_extinguishers_3')] }),
  ];

  // ---- crew and hours of rest ----
  const crew: [string, string, string][] = [['master', 'James Walker', 'Master'], ['co', 'Tom Harris', 'Chief Officer'], ['ce', 'Peter Novak', 'Chief Engineer'], ['bosun', 'Luis Garcia', 'Bosun'], ['ab', 'Ana Santos', 'AB'], ['cook', 'Marco Rossi', 'Cook']];
  out[storage.CREW_KEY] = crew.map(([k, name, rank]): CrewMember => ({ id: id(`crew_${k}`), name, rank, active: true, onBoard: true, signOn: d(-45), signOnPort: 'Palma', addedAt: now, updatedAt: now }));
  // Watches 0–4 and 12–16 for the officer, day work 8–17 for the rest; the AB's last day short of rest.
  const work = (spans: [number, number][]) => Array.from({ length: 48 }, (_, s) => (spans.some(([a, b]) => s >= a * 2 && s < b * 2) ? '1' : '0')).join('');
  const rest: RestDay[] = [];
  for (let back = 6; back >= 0; back--) {
    const date = d(-back);
    for (const [k, name, rank] of crew.slice(1, 5)) {
      const spans: [number, number][] = k === 'co' ? [[0, 4], [12, 16]] : k === 'ab' && back === 1 ? [[6, 23]] : [[8, 12], [13, 17]];
      rest.push({ id: restDayId(id(`crew_${k}`), date), crewId: id(`crew_${k}`), holderName: `${name} · ${rank}`, date, work: work(spans), updatedAt: now });
    }
  }
  out[storage.REST_KEY] = rest;

  // ---- PMS: machines, jobs (one overdue), work done, an open defect ----
  const machines: Machine[] = [
    { id: id('mc_me'), name: 'Main engine', dept: 'engineering', critical: true, maker: 'MTU', model: '12V 2000 M72', location: 'Engine room', hours: 6420, hoursDate: d(0), updatedAt: now },
    { id: id('mc_dg1'), name: 'Generator No. 1', dept: 'engineering', maker: 'Kohler', model: '99EFOZ', location: 'Engine room', hours: 11840, hoursDate: d(0), updatedAt: now },
    { id: id('mc_crane'), name: 'Tender crane', dept: 'deck', maker: 'Nautical Structures', location: 'Aft deck', updatedAt: now },
    { id: id('mc_fd'), name: 'Fire detection system', dept: 'safety', critical: true, maker: 'Consilium', location: 'Bridge', updatedAt: now },
  ];
  const job = (k: string, machineId: string, title: string, rest: Partial<PmsJob>): PmsJob => ({ id: id(`job_${k}`), machineId, title, updatedAt: now, ...rest });
  out[storage.PMS_MACHINES_KEY] = machines;
  out[storage.PMS_JOBS_KEY] = [
    job('me_oil', id('mc_me'), 'Change lube oil and filters', { type: 'maintenance', intervalHours: 500, lastDoneHours: 6000, lastDoneDate: d(-60) }),
    job('me_belts', id('mc_me'), 'Inspect drive belts', { type: 'visual', intervalDays: 30, lastDoneDate: d(-41) }),
    job('dg1_oil', id('mc_dg1'), 'Change lube oil and filters', { type: 'maintenance', intervalHours: 250, lastDoneHours: 11700, lastDoneDate: d(-14) }),
    job('crane_wire', id('mc_crane'), 'Inspect and grease the wire', { type: 'safety', intervalDays: 90, lastDoneDate: d(-30) }),
    job('fd_test', id('mc_fd'), 'Test detectors by zone', { type: 'safety', intervalDays: 7, lastDoneDate: d(-3) }),
  ];
  const done = (k: string, j: string, m: Machine, title: string, date: string, note: string): PmsDone => ({ id: id(`done_${k}`), jobId: id(`job_${j}`), machineId: m.id, jobTitle: title, machineName: m.name, date, note, ...by, at: now, conditionAfter: 'good', updatedAt: now });
  out[storage.PMS_DONE_KEY] = [
    done('dg1', 'dg1_oil', machines[1], 'Change lube oil and filters', d(-14), '40 L 15W-40, filters replaced'),
    done('fd', 'fd_test', machines[3], 'Test detectors by zone', d(-3), 'Zones 1–6 tested, all alarms on the panel'),
  ];
  out[storage.PMS_DEFECTS_KEY] = [
    { id: id('def_crane'), machineId: id('mc_crane'), machineName: 'Tender crane', category: 'operational', description: 'Hydraulic leak at the slewing motor — drips after use', date: d(-5), ...by, at: now, responsible: 'Chief Engineer', awaitingSpares: { since: d(-4), note: 'Seal kit ordered' }, updatedAt: now } as PmsDefect,
  ];

  // ---- spares ----
  out[storage.SPARES_KEY] = [
    { id: id('sp_oilf'), name: 'Lube oil filter', partNo: 'MTU 0031846301', maker: 'MTU', location: 'ER store, shelf B2', unit: 'pcs', minQty: 4, machineIds: [id('mc_me')], updatedAt: now },
    { id: id('sp_fuelf'), name: 'Fuel filter', partNo: 'MTU X00059311', maker: 'MTU', location: 'ER store, shelf B2', unit: 'pcs', minQty: 4, machineIds: [id('mc_me')], updatedAt: now },
    { id: id('sp_seal'), name: 'Slewing motor seal kit', maker: 'Nautical Structures', location: 'Deck store', unit: 'kit', minQty: 1, machineIds: [id('mc_crane')], updatedAt: now },
  ] as SparePart[];
  const sm = (k: string, partId: string, partName: string, kind: SpareMove['kind'], delta: number, date: string, note?: string): SpareMove => ({ id: id(`spm_${k}`), partId: id(partId), partName, kind, delta, date, ...by, ...(note ? { note } : {}), at: now, updatedAt: now });
  out[storage.SPARE_MOVES_KEY] = [
    sm('oilf', 'sp_oilf', 'Lube oil filter', 'received', 6, d(-60), 'Delivered in Palma'),
    sm('fuelf', 'sp_fuelf', 'Fuel filter', 'received', 2, d(-60), 'Delivered in Palma'),
  ];

  return out;
}

/** Any sample row left? */
export async function hasSampleData(): Promise<boolean> {
  const pairs = await AsyncStorage.multiGet(allKeys());
  return pairs.some(([, raw]) => !!raw && raw.includes(`"id":"${SAMPLE_PREFIX}`));
}

/** Put the sample rows in, beside whatever is there. */
export async function loadSampleData(): Promise<void> {
  const data = buildSampleData();
  for (const [key, rows] of Object.entries(data)) {
    const list = (await storage.loadList<{ id: string }>(key)).filter((r) => !isSample(r.id));
    await storage.saveList(key, [...list, ...rows]);
  }
}

/** Take out every sample row, and every row pointing at one. True if there were any. */
export async function clearSampleData(): Promise<boolean> {
  let any = false;
  for (const key of [...allKeys(), ...POINTING_KEYS]) {
    const list = await storage.loadList<{ id: string }>(key);
    const left = list.filter((r) => !touchesSample(r));
    if (left.length === list.length) continue;
    any = true;
    await storage.saveList(key, left);
  }
  return any;
}

/**
 * The very first start: sample data, if this device has never joined a vessel
 * and holds nothing yet. Looked at once — cleared, it does not come back.
 */
export async function sampleOnFirstStart(): Promise<boolean> {
  if (await AsyncStorage.getItem(FIRST_START_KEY)) return false;
  await AsyncStorage.setItem(FIRST_START_KEY, '1');
  if (await getDeviceSecret().catch(() => 'unknown')) return false;
  const pairs = await AsyncStorage.multiGet(allKeys());
  if (pairs.some(([, raw]) => !!raw && raw !== '[]')) return false;
  await loadSampleData();
  return true;
}
