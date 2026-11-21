// ===================================
// The specs of the record books on the shared screen (screens/LogBookSc):
// their codes, the fields each code asks for, the methods, the rules checked
// before signing, and the line as it reads in the book. Pure, tested
// (check:logbooks).
//
//   Sewage    MARPOL Annex IV reg. 11: treated by an approved plant — any
//             distance; comminuted and disinfected — ≥ 3 nm; from the holding
//             tank untreated — ≥ 12 nm, en route at ≥ 4 knots.
//   Ballast   BWM Convention, BWRB (Appendix II as amended by MEPC.369(80), in
//             force 1 Feb 2025): A uptake, B discharge, C.1 exchange (D-1: ≥ 200 nm
//             and ≥ 200 m deep, else ≥ 50 nm; or a designated area), C.2 circulation
//             / in-tank treatment, D reception facility, E accidental, F BWMS
//             failure, G tank cleaning / sediments, H remarks.
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
import { parsePosition } from '../utils/position';
import type { VesselInfo } from './storage';

export interface CodeSpec {
  label: string;
  fields: LogField[];
  methods?: Record<string, string>;
  /** The code as the form prints it (Ballast: the section letter) — the id stays the key. */
  print?: string;
  /** The completion location may be a port, not only a position. */
  endPort?: boolean;
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

// The Ballast Water Record Book as the form reads since 1 Feb 2025 (BWM Appendix II, MEPC.369(80)):
// sections A–H, each with numbered items. The code ids (UP, DIS…) are PERMANENT — entries made before
// 2.78 carry them — and `print` is the section letter the book shows and prints.
const yn = (b?: boolean) => (b == null ? null : b ? 'yes' : 'no');
const at = (time?: string, place?: string) => [time, place].filter(Boolean).join(' ') || null;
/** ".1 a; .2 b" — the form's items, skipping the ones not given. */
const items = (head: string, list: [number, string | false | null | undefined][], remarks?: string) =>
  join([`${head}: ${list.filter(([, v]) => v).map(([n, v]) => `.${n} ${v}`).join('; ')}`, remarks]);
const qtyRob = (e: Partial<LogEntry>) => join([m3(e.quantity), e.rob != null && `total on board ${m3(e.rob)}`]).replace('; ', ', ') || null;
const OPS: Record<string, string> = { up: 'Uptake', dis: 'Discharge', ingress: 'Ingress' };

export const BALLAST: BookSpec = {
  key: 'ballast',
  title: 'Ballast water',
  subtitle: 'Ballast Water Record Book · BWM Convention',
  help: 'Ballast water',
  codes: {
    UP: { print: 'A', endPort: true, label: 'Taken on board from the aquatic environment (ballasting)', fields: ['place', 'placeEnd', 'start', 'stop', 'depth', 'tank', 'quantity', 'rob', 'bwmp', 'treatment'] },
    DIS: { print: 'B', endPort: true, label: 'Discharged into the aquatic environment (deballasting)', fields: ['place', 'placeEnd', 'start', 'stop', 'depth', 'tank', 'quantity', 'rob', 'bwmp', 'treatment'] },
    EXCH: {
      print: 'C.1',
      label: 'Ballast water exchange',
      fields: ['place', 'placeEnd', 'start', 'stop', 'distance', 'depth', 'area', 'method', 'bwmp', 'tank', 'quantity', 'rob', 'treatment'],
      methods: { seq: 'Sequential', flow: 'Flow-through', dil: 'Dilution' },
    },
    CIRC: { print: 'C.2', label: 'Internal circulation for treatment or in-tank treatment', fields: ['start', 'stop', 'tank', 'quantity', 'treatment'] },
    SHORE: { print: 'D', label: 'Uptake or discharge from / to a port-based or reception facility', fields: ['method', 'facility', 'place', 'start', 'stop', 'tank', 'quantity', 'rob', 'bwmp', 'treatment', 'receiptNo'], methods: { up: 'Uptake', dis: 'Discharge' } },
    ACC: { print: 'E', label: 'Accidental discharge / ingress or other exceptional uptake or discharge', fields: ['method', 'place', 'start', 'stop', 'tank', 'quantity'], methods: { ingress: 'Ingress', up: 'Uptake', dis: 'Discharge' } },
    BWMS: { print: 'F', endPort: true, label: 'Failure or inoperability of the ballast water management system', fields: ['method', 'place', 'placeEnd', 'start', 'stop'], methods: { up: 'During uptake', dis: 'During discharge' } },
    SED: { print: 'G', endPort: true, label: 'Ballast tank cleaning / flushing, removal and disposal of sediments', fields: ['place', 'placeEnd', 'start', 'stop', 'tank', 'method', 'quantity', 'facility', 'receiptNo', 'distance', 'depth'], methods: { shore: 'To a reception facility', sea: 'To the aquatic environment (per BWMP)' } },
    REM: { print: 'H', label: 'Additional operational procedures and general remarks', fields: [] },
  },
  problem: (e) => {
    const atSea = (p?: string) => !!p && !!parsePosition(p);
    switch (e.code) {
      case 'UP':
      case 'DIS':
        if (!e.start || !e.place || !e.stop || !e.placeEnd) return 'Start and completion — time and port or position.';
        if ((atSea(e.place) || atSea(e.placeEnd)) && e.depth == null) return 'Minimum depth of water during the operation.';
        if (!e.tank || e.quantity == null || e.rob == null) return 'Tanks, volume and the final total on board.';
        if (e.bwmp == null || !e.treatment) return 'Whether per the approved BWMP, and the treatment method.';
        return null;
      case 'EXCH':
        if (!e.start || !e.place || !e.stop || !e.placeEnd) return 'Start and completion — time and position.';
        if (!e.tank || e.quantity == null || e.rob == null || !e.method) return 'Tanks, volume exchanged, the final total on board and the method.';
        if (e.bwmp == null || !e.treatment) return 'Whether per the BWMP, and the treatment method for the incoming water.';
        if (e.area) return null; // a designated exchange area (reg. B-4.2): its own limits
        if (e.distance == null || e.depth == null) return 'Distance from the nearest land and the water depth — or the designated exchange area.';
        if (e.distance < 50) return 'Exchange: at least 50 nm from the nearest land and 200 m deep (D-1).';
        if (e.depth < 200) return 'Exchange: in water at least 200 m deep (D-1).';
        return null;
      case 'CIRC':
        return !e.start || !e.stop || !e.tank || e.quantity == null || !e.treatment ? 'Start and completion, tanks, quantity treated and the method.' : null;
      case 'SHORE':
        if (!e.method || !e.facility || !e.place || !e.start || !e.stop) return 'Uptake or discharge, the facility and port, start and completion.';
        if (!e.tank || e.quantity == null || e.rob == null) return 'Tanks, quantity and the final quantity on board.';
        return e.bwmp == null || !e.treatment ? 'Whether per the approved BWMP, and the onboard treatment method.' : null;
      case 'ACC':
        if (!e.method || !e.place || !e.start || !e.tank || e.quantity == null) return 'Ingress, uptake or discharge; where, when, tanks and quantity.';
        return !e.remarks ? 'Describe the circumstances, the reason, any treatment and remarks.' : null;
      case 'BWMS':
        if (!e.start || !e.place || !e.method) return 'Time and port / position of the failure, and the operation it happened in.';
        return !e.remarks ? 'Describe the issue (e.g. the alarm).' : null;
      case 'SED':
        if (!e.start || !e.place || !e.tank || !e.method) return 'Start — time and port / position — the tanks, and where the sediments went.';
        if (e.method === 'shore') return e.quantity == null || !e.facility ? 'Quantity and the name of the facility.' : null;
        return e.quantity == null || e.distance == null || e.depth == null ? 'Quantity, distance from the nearest land and the water depth.' : null;
      case 'REM':
        return !e.remarks ? 'Write the remarks.' : null;
      default:
        return null;
    }
  },
  text: (e) => {
    // Entries before 2.78 had treated yes/no instead of the method.
    const tr = e.treatment ?? (e.treated == null ? null : e.treated ? 'treated (BWMS)' : 'not treated');
    const op = e.method ? OPS[e.method] ?? e.method : null;
    switch (e.code) {
      case 'UP':
      case 'DIS':
        return items(e.code === 'UP' ? 'Ballasting' : 'Deballasting', [
          [1, at(e.start, e.place)],
          [2, join([at(e.stop, e.placeEnd), e.depth != null && `min. depth ${e.depth} m`]).replace('; ', ', ')],
          [3, e.tank],
          [4, qtyRob(e)],
          [5, yn(e.bwmp) && `per BWMP: ${yn(e.bwmp)}`],
          [6, tr],
        ], e.remarks);
      case 'EXCH': {
        const meth = e.method ? BALLAST.codes.EXCH.methods![e.method] ?? e.method : '';
        return items(`Exchange (${meth})`, [
          [1, at(e.start, e.place)],
          [2, at(e.stop, e.placeEnd)],
          [3, e.area ? `designated area ${e.area}` : join([e.distance != null && `${e.distance} nm from land`, e.depth != null && `min. depth ${e.depth} m`]).replace('; ', ', ')],
          [4, join([yn(e.bwmp) && `per BWMP: ${yn(e.bwmp)}`, meth]).replace('; ', ', ')],
          [5, e.tank],
          [6, qtyRob(e)],
          [7, tr],
        ], e.remarks);
      }
      case 'CIRC':
        return items('Circulation / in-tank treatment', [[1, e.start], [2, e.stop], [3, e.tank], [4, m3(e.quantity)], [5, tr]], e.remarks);
      case 'SHORE':
        return items('Reception facility', [
          [1, at(e.start, join([e.place, e.facility])) ],
          [2, e.stop],
          [3, op],
          [4, e.tank],
          [5, qtyRob(e)],
          [6, yn(e.bwmp) && `per BWMP: ${yn(e.bwmp)}`],
          [7, tr],
        ], join([e.receiptNo && `receipt ${e.receiptNo}`, e.remarks]));
      case 'ACC':
        return items('Accidental / exceptional', [[1, at(e.start, e.place)], [2, e.stop], [3, op], [4, e.tank], [5, m3(e.quantity)], [6, e.remarks]]);
      case 'BWMS':
        return items('BWMS failure', [[1, at(e.start, e.place)], [2, op], [3, e.remarks], [4, at(e.stop, e.placeEnd) && `operational ${at(e.stop, e.placeEnd)}`]]);
      case 'SED': {
        const to = e.method === 'shore'
          ? [4, join([m3(e.quantity), e.facility, e.receiptNo && `receipt ${e.receiptNo}`]).replace(/; /g, ', ')] as [number, string]
          : [5, join([m3(e.quantity), e.distance != null && `${e.distance} nm from land`, e.depth != null && `min. depth ${e.depth} m`]).replace(/; /g, ', ')] as [number, string];
        return items('Tank cleaning / sediments', [[1, at(e.start, e.place)], [2, at(e.stop, e.placeEnd)], [3, e.tank], to], e.remarks);
      }
      case 'REM':
        return e.remarks ?? '';
      default:
        return e.remarks ?? '';
    }
  },
};

/** The Ballast Water Record Book's cover (BWM Appendix II): GT, the IBWM Certificate and the total capacity, where set. */
export const cover = (spec: BookSpec, vessel: Pick<VesselInfo, 'gross_tonnage' | 'ibwm_cert_no' | 'bw_capacity'> | null): string =>
  spec.key !== 'ballast' || !vessel
    ? ''
    : [vessel.gross_tonnage && `GT ${vessel.gross_tonnage}`, vessel.ibwm_cert_no && `IBWM Certificate ${vessel.ibwm_cert_no}`, vessel.bw_capacity && `Total ballast water capacity ${vessel.bw_capacity} m³`, 'Tank diagram: see the Ballast Water Management Plan'].filter(Boolean).join(' · ');

/** The code as the book prints it: the section letter where the form has one (Ballast A–H), else the code. */
export const printedCode = (e: { book: BookKey; code: string }) => BOOKS[e.book]?.codes[e.code]?.print ?? e.code;

const ECAS: Record<string, string> = {
  baltic: 'Baltic Sea',
  north: 'North Sea',
  na: 'North American',
  usc: 'US Caribbean',
  med: 'Mediterranean Sea',
  arctic: 'Canadian Arctic',
  norw: 'Norwegian Sea',
  neatl: 'North-East Atlantic',
  other: 'Other (see remarks)',
};
// An ECA in force before its 0.10 % S limit applies (MEPC.407(84): North-East
// Atlantic from 1 Sep 2027, sulphur from 1 Sep 2028) — no sulphur warning yet.
const SULPHUR_FROM: Record<string, string> = { neatl: '2028-09-01' };
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
        if (e.code === 'IN' && SULPHUR_FROM[e.method] && (e.date ?? '') < SULPHUR_FROM[e.method]) return null;
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
