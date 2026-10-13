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

export const BOOKS: Record<BookKey, BookSpec> = { sewage: SEWAGE, ballast: BALLAST };
