// ===================================
// The specs of the record books on the shared screen (screens/LogBookSc):
// their codes, the fields each code asks for, the methods, the rules checked
// before signing, and the line as it reads in the book. Pure, tested
// (check:logbooks).
//
//   Sewage    MARPOL Annex IV reg. 11: treated by an approved plant — any
//             distance; comminuted and disinfected — ≥ 3 nm; from the holding
//             tank untreated — ≥ 12 nm, en route at ≥ 4 knots.
//   Ballast   BWM Convention, BWRB (Appendix II): uptake, circulation /
//             treatment, exchange (D-1: ≥ 200 nm and ≥ 200 m deep, else ≥ 50 nm),
//             discharge, to a reception facility, accidental, BWMS failure.
//   Fuel      MARPOL Annex VI reg. 14.6: the volume of compliant fuel in each
//   changeover tank, date, time and position when a changeover is completed
//             before entering an ECA or commenced after leaving one; ECA fuel
//             ≤ 0.10 % S (reg. 14.4). EU ports at berth > 2 h: ≤ 0.10 % S
//             (Directive (EU) 2016/802 art. 7) — the changeover times too.
//   ODS       Annex VI reg. 12.6: recharge (full / partial), repair or
//             maintenance, deliberate and non-deliberate discharge to the
//             atmosphere, to a reception facility, supply to the ship — by mass (kg).
// ===================================

import { BookKey, LogEntry, LogField } from '../types/logbook';

export interface CodeSpec {
  label: string;
  fields: LogField[];
  methods?: Record<string, string>;
}
export interface BookSpec {
  key: BookKey;
  title: string;
  subtitle: string;
  help: string;
  codes: Record<string, CodeSpec>;
  /** What is missing or against the rules; null when the entry is fine. */
  problem: (e: Partial<LogEntry> & { code: string }) => string | null;
  /** The line in the book. */
  text: (e: Partial<LogEntry> & { code: string }) => string;
}

const kg = (n?: number) => (n == null ? '' : `${Math.round(n * 1000) / 1000} kg`);
const pct = (n?: number) => (n == null ? '' : `${n} % S`);
const m3 = (n?: number) => (n == null ? '' : `${Math.round(n * 1000) / 1000} m³`);
const join = (xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join('; ');
const span = (e: Partial<LogEntry>) => (e.start && e.stop ? `${e.start}–${e.stop}` : e.start ?? '');
const where = (e: Partial<LogEntry>) => (e.place && e.placeEnd ? `${e.place} → ${e.placeEnd}` : e.place ?? '');

export const SEWAGE: BookSpec = {
  key: 'sewage',
  title: 'Sewage',
  subtitle: 'Sewage record · MARPOL Annex IV',
  help: 'Sewage record',
  codes: {
    // Every discharge at sea: start and end — time and position — and the
    // ship's speed (13 Oct 2026).
    STP: { label: 'Discharge through the approved sewage treatment plant', fields: ['quantity', 'place', 'placeEnd', 'start', 'stop', 'speed'] },
    COM: { label: 'Discharge comminuted and disinfected (≥ 3 nm)', fields: ['quantity', 'place', 'placeEnd', 'start', 'stop', 'distance', 'speed'] },
    HT: { label: 'Discharge from the holding tank, untreated (≥ 12 nm, ≥ 4 kn)', fields: ['tank', 'quantity', 'place', 'placeEnd', 'start', 'stop', 'distance', 'speed'] },
    SHORE: { label: 'Delivered to a reception facility', fields: ['tank', 'quantity', 'place', 'receiptNo'] },
    LEVEL: { label: 'Holding tank level', fields: ['tank', 'quantity'] },
    PLANT: { label: 'Treatment plant: failure, maintenance, back in service', fields: ['start', 'stop'] },
  },
  problem: (e) => {
    switch (e.code) {
      case 'STP':
        if (e.quantity == null || !e.place) return 'Quantity and position are needed.';
        return !e.start || !e.stop || !e.placeEnd || e.speed == null ? 'Start and end of the discharge — time and position — and the ship’s speed.' : null;
      case 'COM':
        if (e.quantity == null || !e.place) return 'Quantity and position are needed.';
        if (e.distance == null) return 'Distance from the nearest land.';
        if (e.distance < 3) return 'Comminuted and disinfected sewage: at least 3 nm from the nearest land (MARPOL IV reg. 11).';
        return !e.start || !e.stop || !e.placeEnd || e.speed == null ? 'Start and end of the discharge — time and position — and the ship’s speed.' : null;
      case 'HT':
        if (!e.tank || e.quantity == null || !e.place) return 'Tank, quantity and position are needed.';
        if (e.distance == null || e.speed == null) return 'Distance from land and the ship’s speed.';
        if (e.distance < 12) return 'Untreated sewage from a holding tank: at least 12 nm from the nearest land.';
        if (e.speed < 4) return 'Untreated sewage: only with the ship en route at not less than 4 knots.';
        return !e.start || !e.stop || !e.placeEnd ? 'Start and end of the discharge — time and position.' : null;
      case 'SHORE':
        return e.quantity == null || !e.place ? 'Quantity and port are needed.' : null;
      case 'LEVEL':
        return !e.tank || e.quantity == null ? 'Tank and quantity in it.' : null;
      case 'PLANT':
        return !e.remarks ? 'Say what happened and what was done.' : null;
      default:
        return null;
    }
  },
  text: (e) => {
    switch (e.code) {
      case 'STP':
        return join([`Treated discharge ${m3(e.quantity)}`, span(e), where(e), e.speed != null && `${e.speed} kn`, e.remarks]);
      case 'COM':
        return join([`Comminuted / disinfected ${m3(e.quantity)}`, span(e), where(e), e.distance != null && `${e.distance} nm from land`, e.speed != null && `${e.speed} kn`, e.remarks]);
      case 'HT':
        return join([`Untreated from ${e.tank} ${m3(e.quantity)}`, span(e), where(e), e.distance != null && `${e.distance} nm from land`, e.speed != null && `${e.speed} kn`, e.remarks]);
      case 'SHORE':
        return join([`To reception facility ${m3(e.quantity)}${e.tank ? ` from ${e.tank}` : ''}`, e.place, e.receiptNo && `receipt ${e.receiptNo}`, e.remarks]);
      case 'LEVEL':
        return join([`${e.tank}: ${m3(e.quantity)}`, e.remarks]);
      case 'PLANT':
        return join([e.start && `from ${e.start}`, e.stop && `to ${e.stop}`, e.remarks]);
      default:
        return e.remarks ?? '';
    }
  },
};

export const BALLAST: BookSpec = {
  key: 'ballast',
  title: 'Ballast water',
  subtitle: 'Ballast Water Record Book · BWM Convention',
  help: 'Ballast water',
  codes: {
    UP: { label: 'Ballast water taken on board', fields: ['tank', 'quantity', 'place', 'start', 'stop', 'depth', 'treated'] },
    CIRC: { label: 'Circulated or treated for ballast water management', fields: ['tank', 'quantity', 'start', 'stop', 'treated'] },
    EXCH: {
      label: 'Ballast water exchange (D-1)',
      fields: ['tank', 'quantity', 'method', 'place', 'placeEnd', 'start', 'stop', 'distance', 'depth'],
      methods: { seq: 'Sequential', flow: 'Flow-through', dil: 'Dilution' },
    },
    DIS: { label: 'Ballast water discharged into the sea', fields: ['tank', 'quantity', 'place', 'placeEnd', 'start', 'stop', 'treated'] },
    SHORE: { label: 'Discharged to a reception facility', fields: ['tank', 'quantity', 'place', 'receiptNo'] },
    ACC: { label: 'Accidental or other exceptional uptake or discharge', fields: ['tank', 'quantity', 'place'] },
    BWMS: { label: 'Ballast water management system: failure, back in service', fields: ['start', 'stop'] },
  },
  problem: (e) => {
    switch (e.code) {
      case 'UP':
      case 'DIS':
        return !e.tank || e.quantity == null || !e.place ? 'Tanks, quantity and position / port are needed.' : null;
      case 'CIRC':
        return !e.tank || e.quantity == null ? 'Tanks and quantity.' : null;
      case 'EXCH':
        if (!e.tank || e.quantity == null || !e.method || !e.place || !e.placeEnd) return 'Tanks, volume, method, and the positions at start and end.';
        if (e.distance == null || e.depth == null) return 'Distance from the nearest land and the water depth.';
        if (e.distance < 50) return 'Exchange: at least 50 nm from the nearest land and 200 m deep (D-1).';
        if (e.depth < 200) return 'Exchange: in water at least 200 m deep (D-1).';
        return null;
      case 'SHORE':
        return e.quantity == null || !e.place ? 'Quantity and port.' : null;
      case 'ACC':
      case 'BWMS':
        return !e.remarks ? 'Describe the circumstances and the action taken.' : null;
      default:
        return null;
    }
  },
  text: (e) => {
    const tr = e.treated == null ? null : e.treated ? 'treated (BWMS)' : 'not treated';
    switch (e.code) {
      case 'UP':
        return join([`Uptake ${m3(e.quantity)} into ${e.tank ?? '…'}`, span(e), e.place, e.depth != null && `depth ${e.depth} m`, tr, e.remarks]);
      case 'CIRC':
        return join([`Circulated / treated ${m3(e.quantity)} in ${e.tank}`, span(e), tr, e.remarks]);
      case 'EXCH': {
        const meth = e.method ? BALLAST.codes.EXCH.methods![e.method] ?? e.method : '';
        return join([`Exchange (${meth}) ${m3(e.quantity)} in ${e.tank}`, span(e), where(e), e.distance != null && `${e.distance} nm from land`, e.depth != null && `depth ${e.depth} m`, e.remarks]);
      }
      case 'DIS':
        return join([`Discharged ${m3(e.quantity)} from ${e.tank}`, span(e), where(e), tr, e.remarks]);
      case 'SHORE':
        return join([`To reception facility ${m3(e.quantity)}${e.tank ? ` from ${e.tank}` : ''}`, e.place, e.receiptNo && `receipt ${e.receiptNo}`, e.remarks]);
      case 'ACC':
        return join([e.quantity != null && m3(e.quantity), e.tank, e.place, e.remarks]);
      case 'BWMS':
        return join([e.start && `failure ${e.start}`, e.stop && `back in service ${e.stop}`, e.remarks]);
      default:
        return e.remarks ?? '';
    }
  },
};

const ECAS: Record<string, string> = {
  baltic: 'Baltic Sea',
  north: 'North Sea',
  na: 'North American',
  usc: 'US Caribbean',
  med: 'Mediterranean Sea',
  arctic: 'Canadian Arctic',
  norw: 'Norwegian Sea',
  other: 'Other (see remarks)',
};
const ecaOf = (e: Partial<LogEntry>) => (e.method ? `${ECAS[e.method] ?? e.method} ECA` : 'the ECA');
const tanks = (e: Partial<LogEntry>) => [e.tank, m3(e.quantity)].filter(Boolean).join(' ');

export const FUEL_CHANGE: BookSpec = {
  key: 'fuelChange',
  title: 'Fuel oil changeover',
  subtitle: 'Fuel oil changeover record · MARPOL Annex VI reg. 14.6',
  help: 'Fuel oil changeover',
  codes: {
    // The compliant fuel in each tank — one entry per changeover, the tanks
    // and volumes in one line ("DB 3 P/S 24.5") when there are several.
    IN: { label: 'Changeover to compliant fuel completed — before entering an ECA', fields: ['method', 'tank', 'quantity', 'sulphur', 'place'], methods: ECAS },
    ENTER: { label: 'Entered the ECA', fields: ['method', 'place'], methods: ECAS },
    EXIT: { label: 'Left the ECA', fields: ['method', 'place'], methods: ECAS },
    OUT: { label: 'Changeover from compliant fuel commenced — after leaving an ECA', fields: ['method', 'tank', 'quantity', 'sulphur', 'place'], methods: ECAS },
    BERTH: { label: 'At berth (EU port, over 2 h): changeover to ≤ 0.10 % S completed', fields: ['tank', 'quantity', 'sulphur', 'place'] },
    DEPART: { label: 'Before departure (EU port): changeover from ≤ 0.10 % S commenced', fields: ['tank', 'quantity', 'sulphur', 'place'] },
  },
  problem: (e) => {
    switch (e.code) {
      case 'IN':
      case 'OUT':
        if (!e.method) return 'Which ECA.';
        if (!e.tank || e.quantity == null || !e.place) return 'Tanks, the volume of compliant fuel in them, and the position (reg. 14.6).';
        if (!e.time) return 'Time the changeover was ' + (e.code === 'IN' ? 'completed.' : 'commenced.');
        if (e.code === 'IN' && e.sulphur == null) return 'Sulphur content of the fuel changed to, % m/m.';
        return e.code === 'IN' && e.sulphur! > 0.1 && !e.remarks ? 'Inside an ECA: fuel of at most 0.10 % S (reg. 14.4) — or say why in the remarks (non-availability report).' : null;
      case 'ENTER':
      case 'EXIT':
        if (!e.method) return 'Which ECA.';
        return !e.place || !e.time ? 'Time and position at the boundary.' : null;
      case 'BERTH':
        if (!e.tank || e.quantity == null || !e.place || !e.time) return 'Tanks, quantity, port and the time the changeover was completed.';
        if (e.sulphur == null) return 'Sulphur content of the fuel changed to, % m/m.';
        return e.sulphur > 0.1 && !e.remarks ? 'At berth in an EU port: fuel of at most 0.10 % S (Directive (EU) 2016/802) — or say why in the remarks.' : null;
      case 'DEPART':
        return !e.tank || e.quantity == null || !e.place || !e.time ? 'Tanks, quantity, port and the time the changeover commenced.' : null;
      default:
        return null;
    }
  },
  text: (e) => {
    switch (e.code) {
      case 'IN':
        return join([`Changeover to ${pct(e.sulphur) || 'compliant fuel'} completed before entering ${ecaOf(e)}`, e.place, tanks(e), e.remarks]);
      case 'ENTER':
        return join([`Entered ${ecaOf(e)}`, e.place, e.remarks]);
      case 'EXIT':
        return join([`Left ${ecaOf(e)}`, e.place, e.remarks]);
      case 'OUT':
        return join([`Changeover${e.sulphur != null ? ` to ${pct(e.sulphur)}` : ''} commenced after leaving ${ecaOf(e)}`, e.place, tanks(e), e.remarks]);
      case 'BERTH':
        return join([`At berth: changeover to ${pct(e.sulphur)} completed`, e.place, tanks(e), e.remarks]);
      case 'DEPART':
        return join([`Before departure: changeover${e.sulphur != null ? ` to ${pct(e.sulphur)}` : ''} commenced`, e.place, tanks(e), e.remarks]);
      default:
        return e.remarks ?? '';
    }
  },
};

export const ODS: BookSpec = {
  key: 'ods',
  title: 'Ozone-depleting substances',
  subtitle: 'Ozone-depleting Substances Record Book · MARPOL Annex VI reg. 12.6',
  help: 'Ozone-depleting substances',
  codes: {
    FULL: { label: 'Recharge, full, of equipment containing ODS', fields: ['equipment', 'substance', 'mass'] },
    PART: { label: 'Recharge, partial, of equipment containing ODS', fields: ['equipment', 'substance', 'mass'] },
    REP: { label: 'Repair or maintenance of equipment containing ODS', fields: ['equipment', 'substance', 'mass'] },
    DELIB: { label: 'Discharge of ODS to the atmosphere — deliberate', fields: ['equipment', 'substance', 'mass'] },
    LEAK: { label: 'Discharge of ODS to the atmosphere — non-deliberate (leak)', fields: ['equipment', 'substance', 'mass'] },
    SHORE: { label: 'Discharge of ODS to a land-based reception facility', fields: ['substance', 'mass', 'place', 'receiptNo'] },
    SUPPLY: { label: 'Supply of ODS to the ship', fields: ['substance', 'mass', 'place'] },
  },
  problem: (e) => {
    switch (e.code) {
      case 'FULL':
      case 'PART':
        return !e.equipment || !e.substance || e.mass == null ? 'Equipment, substance and the mass charged, kg.' : null;
      case 'REP':
        if (!e.equipment || !e.substance) return 'Equipment and substance.';
        return !e.remarks ? 'Say what was repaired or serviced.' : null;
      case 'DELIB':
      case 'LEAK':
        if (!e.equipment || !e.substance || e.mass == null) return 'Equipment, substance and the mass lost, kg.';
        return !e.remarks ? (e.code === 'DELIB' ? 'Deliberate emissions are prohibited (reg. 12.2) — say why it happened.' : 'Say how it was found and what was done.') : null;
      case 'SHORE':
      case 'SUPPLY':
        return !e.substance || e.mass == null || !e.place ? 'Substance, mass in kg and the port.' : null;
      default:
        return null;
    }
  },
  text: (e) => {
    const what = [e.substance, kg(e.mass)].filter(Boolean).join(' ');
    switch (e.code) {
      case 'FULL':
        return join([`Full recharge of ${e.equipment}: ${what}`, e.remarks]);
      case 'PART':
        return join([`Partial recharge of ${e.equipment}: ${what}`, e.remarks]);
      case 'REP':
        return join([`Repair / maintenance of ${e.equipment}${e.substance ? ` (${e.substance})` : ''}`, e.mass != null && `${kg(e.mass)} recovered`, e.remarks]);
      case 'DELIB':
        return join([`Deliberate discharge to atmosphere from ${e.equipment}: ${what}`, e.remarks]);
      case 'LEAK':
        return join([`Non-deliberate discharge (leak) from ${e.equipment}: ${what}`, e.remarks]);
      case 'SHORE':
        return join([`To reception facility: ${what}`, e.place, e.receiptNo && `receipt ${e.receiptNo}`, e.remarks]);
      case 'SUPPLY':
        return join([`Supplied to the ship: ${what}`, e.place, e.remarks]);
      default:
        return e.remarks ?? '';
    }
  },
};

export const BOOKS: Record<BookKey, BookSpec> = { sewage: SEWAGE, ballast: BALLAST, fuelChange: FUEL_CHANGE, ods: ODS };
