// ===================================
// Emissions arithmetic (types/emissions.ts) — pure, so check:emissions can hold it.
//
//   CO2   = fuel (t) x 3.206 — diesel / gas oil: Regulation (EU) 2015/757 Annex I, the IMO factor.
//   CH4, N2O = fuel (t) x 0.00005, 0.00018 — the same table (from 2024).
//   CII   = g CO2 / (capacity x nm). Required = a x capacity^-c x (1 - Z/100)
//           (G2 MEPC.353(78), G3 MEPC.338(76) + MEPC.400(83)); the rating by the
//           dd vectors of G4 MEPC.354(78). No correction factors or voyage
//           adjustments (G5): they need an approved SEEMP Part III.
//
// Litres become tonnes at the BDN density at 15 degrees, litre-weighted over the year's
// bunkers, else the last before it. No density, no tonnes: a figure is never assumed.
// What is missing or does not add up comes back as a gap, so a verifier is told.
// ===================================

import { FuelBunker, FuelReading, FuelTank } from '../types/fuel';
import { fuelMonth } from './fuel';
import { EmCommercial, EmConsumer, EM_CONSUMERS, EmFrozen, EmPassage, EmShipType, EmSplit, EmStatement, EmVessel } from '../types/emissions';

export const CF_CO2 = 3.206;
export const CF_CH4 = 0.00005;
export const CF_N2O = 0.00018;

const round = (x: number, p = 1) => Math.round(x * 10 ** p) / 10 ** p;
const ms = (s: string) => Date.parse(`${s}:00Z`);
const yearStart = (y: number) => Date.UTC(y, 0, 1);

// ---- Which rule applies ------------------------------------------------------------------------

export type EmApplies = 'applies' | 'no' | 'check' | 'unknown';
export type EmRule = 'dcs' | 'cii' | 'mrv';

const CII_TYPES: EmShipType[] = ['bulk', 'gas', 'tanker', 'container', 'generalCargo', 'reefer', 'combination', 'lng', 'vehicle', 'roroCargo', 'roroPax', 'roroPaxHsc', 'cruise'];

export function applicability(v: EmVessel | undefined): Record<EmRule, EmApplies> {
  if (!v || v.gt == null) return { dcs: 'unknown', cii: 'unknown', mrv: 'unknown' };
  const big = v.gt >= 5000;
  const smallMrv = v.gt >= 400 && (v.type === 'offshore' || v.type === 'generalCargo');
  const inMrv = big || smallMrv;
  const commercial: Record<EmCommercial, EmApplies> = { yes: 'applies', no: 'no', unsure: 'check' };
  return {
    dcs: big ? 'applies' : 'no',
    cii: big && CII_TYPES.includes(v.type) ? 'applies' : 'no',
    mrv: inMrv ? commercial[v.commercial] : 'no',
  };
}

// ---- CII ---------------------------------------------------------------------------------------

/** Reduction factors, % below the 2019 line. Beyond 2030 the IMO has set none, so no rating. */
export const CII_Z: Record<number, number> = { 2023: 5, 2024: 7, 2025: 9, 2026: 11, 2027: 13.625, 2028: 16.25, 2029: 18.875, 2030: 21.5 };

interface Line { capacity: number; a: number; c: number; dd: [number, number, number, number] }

/** The reference line and rating vectors: G2 table 1, G4 table 1. undefined — the type or its tonnage is not there. */
export function ciiLine(type: EmShipType, gt?: number, dwt?: number): Line | undefined {
  const D = dwt ?? 0, G = gt ?? 0;
  const byDwt = (capacity: number, a: number, c: number, dd: Line['dd']) => (D > 0 ? { capacity, a, c, dd } : undefined);
  const byGt = (capacity: number, a: number, c: number, dd: Line['dd']) => (G > 0 ? { capacity, a, c, dd } : undefined);
  switch (type) {
    case 'bulk': return byDwt(Math.min(D, 279000), 4745, 0.622, [0.86, 0.94, 1.06, 1.18]);
    case 'gas': return D >= 65000 ? byDwt(D, 14405e7, 2.071, [0.81, 0.91, 1.12, 1.44]) : byDwt(D, 8104, 0.639, [0.85, 0.95, 1.06, 1.25]);
    case 'tanker': return byDwt(D, 5247, 0.61, [0.82, 0.93, 1.08, 1.28]);
    case 'container': return byDwt(D, 1984, 0.489, [0.83, 0.94, 1.07, 1.19]);
    case 'generalCargo': return D >= 20000 ? byDwt(D, 31948, 0.792, [0.83, 0.94, 1.06, 1.19]) : byDwt(D, 588, 0.3885, [0.83, 0.94, 1.06, 1.19]);
    case 'reefer': return byDwt(D, 4600, 0.557, [0.78, 0.91, 1.07, 1.2]);
    case 'combination': return byDwt(D, 5119, 0.622, [0.87, 0.96, 1.06, 1.14]);
    case 'lng':
      if (D >= 100000) return byDwt(D, 9.827, 0, [0.89, 0.98, 1.06, 1.13]);
      return D >= 65000 ? byDwt(D, 14479e10, 2.673, [0.78, 0.92, 1.1, 1.37]) : byDwt(65000, 14779e10, 2.673, [0.78, 0.92, 1.1, 1.37]);
    case 'vehicle': return G >= 30000 ? byGt(Math.min(G, 57700), 3627, 0.59, [0.86, 0.94, 1.06, 1.16]) : byGt(G, 330, 0.329, [0.86, 0.94, 1.06, 1.16]);
    case 'roroCargo': return byGt(G, 1967, 0.485, [0.76, 0.89, 1.08, 1.27]);
    case 'roroPax': return byGt(G, 2023, 0.46, [0.76, 0.92, 1.14, 1.3]);
    case 'roroPaxHsc': return byGt(G, 4196, 0.46, [0.76, 0.92, 1.14, 1.3]);
    case 'cruise': return byGt(G, 930, 0.383, [0.87, 0.95, 1.06, 1.16]);
    default: return undefined;
  }
}

export interface CiiResult { capacity: number; attained: number; required: number; rating: 'A' | 'B' | 'C' | 'D' | 'E'; bounds: [number, number, number, number]; z: number }

export function ciiFor(v: EmVessel | undefined, year: number, co2?: number, distance?: number): CiiResult | undefined {
  if (!v || co2 == null || !distance) return undefined;
  const line = ciiLine(v.type, v.gt, v.dwt);
  const z = CII_Z[year];
  if (!line || z == null) return undefined;
  const required = line.a * line.capacity ** -line.c * (1 - z / 100);
  const attained = (co2 * 1e6) / (line.capacity * distance);
  const bounds = line.dd.map((d) => d * required) as CiiResult['bounds'];
  const rating = attained < bounds[0] ? 'A' : attained < bounds[1] ? 'B' : attained < bounds[2] ? 'C' : attained < bounds[3] ? 'D' : 'E';
  return { capacity: line.capacity, attained, required, rating, bounds, z };
}

// ---- A passage ---------------------------------------------------------------------------------

export const crossesYear = (p: Pick<EmPassage, 'depAt' | 'arrAt'>) => p.depAt.slice(0, 4) !== p.arrAt.slice(0, 4);

/** What stops a passage being signed, or marks a corrected one as a gap. */
export function passageProblem(p: Partial<EmPassage>): 'ports' | 'times' | 'order' | 'rob' | 'distance' | 'yearEnd' | 'tooLong' | null {
  if (!p.fromPort?.trim() || !p.toPort?.trim()) return 'ports';
  const at = [p.depAt, p.faopAt, p.eospAt, p.arrAt];
  if (at.some((s) => !s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || !Number.isFinite(ms(s)))) return 'times';
  const t = (at as string[]).map(ms);
  if (t[0] > t[1] || t[1] >= t[2] || t[2] > t[3]) return 'order';
  if (p.robDep == null || p.robArr == null || !(p.robDep >= 0) || !(p.robArr >= 0)) return 'rob';
  if (!(p.distanceNm! > 0)) return 'distance';
  const years = Number(p.arrAt!.slice(0, 4)) - Number(p.depAt!.slice(0, 4));
  if (years > 1) return 'tooLong';
  if (years === 1 && (p.yearEndRob == null || p.yearEndNm == null || p.yearEndNm < 0 || p.yearEndNm > p.distanceNm! || p.yearEndRob < 0)) return 'yearEnd';
  return null;
}

/** Between two dates, strictly: on the day itself a bunker is before leaving or after arriving. */
const bunkersBetween = (bunkers: FuelBunker[], from: string, to: string) => bunkers.filter((b) => b.date > from && b.date < to).reduce((n, b) => n + b.litres, 0);

export interface PassagePart { passage: EmPassage; litres: number; distance: number; hours: number; suspect: boolean }

/** The part of a passage that falls in `year`, or nothing. */
export function passagePart(p: EmPassage, year: number, bunkers: FuelBunker[]): PassagePart | undefined {
  const dy = Number(p.depAt.slice(0, 4)), ay = Number(p.arrAt.slice(0, 4));
  if (year !== dy && year !== ay) return undefined;
  const cross = dy !== ay;
  const yearEnd = `${dy}-12-31`;
  const first = !cross || year === dy, last = !cross || year === ay;
  const robA = first ? p.robDep : p.yearEndRob ?? p.robDep;
  const robB = last ? p.robArr : p.yearEndRob ?? p.robArr;
  const from = first ? p.depAt.slice(0, 10) : `${year}-01-00`;
  const to = last ? p.arrAt.slice(0, 10) : `${yearEnd}~`;
  const litres = robA + bunkersBetween(bunkers, from, to) - robB;
  const nmEnd = p.yearEndNm ?? p.distanceNm;
  const distance = !cross ? p.distanceNm : year === dy ? nmEnd : p.distanceNm - nmEnd;
  const a = Math.max(ms(p.faopAt), yearStart(year)), b = Math.min(ms(p.eospAt), yearStart(year + 1));
  return { passage: p, litres: round(Math.max(litres, 0)), distance: round(distance), hours: round(Math.max(b - a, 0) / 3600000, 2), suspect: litres < 0 };
}

export const sortPassages = (list: EmPassage[]) => [...list].sort((a, b) => a.depAt.localeCompare(b.depAt));

// ---- The year ----------------------------------------------------------------------------------

export type EmGapKey =
  | 'noFuel' | 'noDensity' | 'oddDensity' | 'bunkerNoDensity' | 'suspect' | 'noOpening' | 'gapDays' | 'yearEnd'
  | 'noPassages' | 'badPassage' | 'suspectPassage' | 'chain' | 'seaNoPassage' | 'noTonnage' | 'splitOff' | 'changed' | 'unsigned';

export interface EmGap { key: EmGapKey; params?: Record<string, string | number> }

/** For the report — always English. The screen has its own words (em.gap.*). */
export const EM_GAP_EN: Record<EmGapKey, (p: Record<string, any>) => string> = {
  noFuel: () => 'No fuel soundings in the year.',
  noDensity: () => 'No BDN density in or before the year: litres cannot be turned into tonnes.',
  oddDensity: (p) => `${p.n} bunkering(s) with a density outside 0.70–1.10 kg/L were left out.`,
  bunkerNoDensity: (p) => `${p.n} bunkering(s) in the year have no density.`,
  suspect: (p) => `${p.n} sounding(s) give negative consumption and are not counted: a sounding or a bunker figure is wrong.`,
  noOpening: (p) => `No sounding before ${p.date}: consumption before it is not counted.`,
  gapDays: (p) => `${p.n} day(s) without a sounding; what was burnt is on the next day sounded.`,
  yearEnd: (p) => `Last sounding of the year is ${p.date}: what was burnt after it falls in the next year.`,
  noPassages: () => 'No passages recorded: no distance, hours or EU figures.',
  badPassage: (p) => `${p.n} passage(s) are incomplete and are not counted.`,
  suspectPassage: (p) => `${p.n} passage(s) show more fuel at the end than at the start: check ROB and bunkers.`,
  chain: (p) => `${p.n} passage(s) do not start at the port where the one before ended: a passage may be missing; no port-stay figure for those.`,
  seaNoPassage: (p) => `${p.n} day(s) with deck log entries at sea fall outside every passage.`,
  noTonnage: () => 'Gross tonnage or deadweight is missing: no CII.',
  splitOff: (p) => `The consumer split adds up to ${p.split} t against ${p.total} t from the soundings.`,
  changed: () => 'Records changed after this statement was signed: the figures below differ from those signed.',
  unsigned: () => 'Not signed.',
};

export interface EmMrv { intra: number; from: number; to: number; berth: number; total: number; co2?: number; co2Intra?: number; co2From?: number; co2To?: number; co2Berth?: number; ch4?: number; n2o?: number }

export interface EmYear {
  year: number;
  /** The year is still running. */
  ytd: boolean;
  litres: number;
  received: number;
  density?: number;
  densityFrom?: 'year' | 'before';
  tonnes?: number;
  co2?: number;
  ch4?: number;
  n2o?: number;
  distance: number;
  hours: number;
  laden: number;
  /** cargo tonnes or passengers x miles. */
  transportWork: number;
  parts: PassagePart[];
  mrv: EmMrv;
  cii?: CiiResult;
  gaps: EmGap[];
}

const dieselOnly = <T extends { kind?: string }>(list: T[]) => list.filter((x) => (x.kind ?? 'diesel') === 'diesel');

export function densityFor(year: number, dieselBunkers: FuelBunker[]) {
  const usable = dieselBunkers.filter((b) => b.density != null && b.density >= 0.7 && b.density <= 1.1);
  const inYear = usable.filter((b) => b.date.startsWith(`${year}-`));
  const litres = inYear.reduce((n, b) => n + b.litres, 0);
  if (litres > 0) return { density: inYear.reduce((n, b) => n + b.litres * b.density!, 0) / litres, from: 'year' as const };
  const before = usable.filter((b) => b.date < `${year}-01-01`).sort((a, b) => a.date.localeCompare(b.date)).pop();
  return before ? { density: before.density!, from: 'before' as const } : { density: undefined, from: undefined };
}

export interface EmInput {
  year: number;
  today: string;
  vessel?: EmVessel;
  tanks: FuelTank[];
  readings: FuelReading[];
  bunkers: FuelBunker[];
  passages: EmPassage[];
  /** Signed deck log entries — only to see days at sea outside every passage. */
  deck?: { date: string; mode?: string; period?: string; draft?: boolean }[];
}

export function emissionsYear(x: EmInput): EmYear {
  const { year, today, vessel } = x;
  const tanks = dieselOnly(x.tanks);
  const bunkers = dieselOnly(x.bunkers);
  const gaps: EmGap[] = [];
  const ytd = today < `${year + 1}-01-01`;

  // Fuel, from the soundings: the fuel screen's own arithmetic, month by month.
  let litres = 0, received = 0, suspect = 0, gapDays = 0, lastSounding = '', firstSounding = '', opened = false;
  for (let m = 1; m <= 12; m++) {
    const mo = fuelMonth(`${year}-${String(m).padStart(2, '0')}`, tanks, x.readings, bunkers, []);
    litres += mo.consumed;
    received += mo.received;
    for (const d of mo.days) {
      if (d.suspect) suspect++;
      if (d.span && d.span > 1) gapDays += d.span - 1;
      if (d.rob != null) {
        if (!firstSounding) { firstSounding = d.date; opened = d.consumed != null; }
        lastSounding = d.date;
      }
    }
  }
  litres = round(litres);
  received = round(received);
  if (!firstSounding) gaps.push({ key: 'noFuel' });
  else {
    if (!opened) gaps.push({ key: 'noOpening', params: { date: firstSounding } });
    if (!ytd && lastSounding < `${year}-12-31`) gaps.push({ key: 'yearEnd', params: { date: lastSounding } });
  }
  if (suspect) gaps.push({ key: 'suspect', params: { n: suspect } });
  if (gapDays) gaps.push({ key: 'gapDays', params: { n: gapDays } });

  const inYear = bunkers.filter((b) => b.date.startsWith(`${year}-`));
  const noDensity = inYear.filter((b) => b.density == null).length;
  const odd = bunkers.filter((b) => b.density != null && (b.density < 0.7 || b.density > 1.1) && b.date <= `${year}-12-31`).length;
  if (noDensity) gaps.push({ key: 'bunkerNoDensity', params: { n: noDensity } });
  if (odd) gaps.push({ key: 'oddDensity', params: { n: odd } });
  const { density, from: densityFrom } = densityFor(year, bunkers);
  if (density == null && litres > 0) gaps.push({ key: 'noDensity' });
  const toT = (l: number) => (density == null ? undefined : (l * density) / 1000);
  const tonnes = toT(litres);
  const co2 = tonnes == null ? undefined : tonnes * CF_CO2;

  // Passages.
  const all = sortPassages(x.passages);
  const sound = all.filter((p) => !passageProblem(p));
  const bad = all.length - sound.length;
  const parts = sound.map((p) => passagePart(p, year, bunkers)).filter(Boolean) as PassagePart[];
  if (!parts.length) gaps.push({ key: 'noPassages' });
  if (bad) gaps.push({ key: 'badPassage', params: { n: bad } });
  const suspects = parts.filter((p) => p.suspect).length;
  if (suspects) gaps.push({ key: 'suspectPassage', params: { n: suspects } });
  const distance = round(parts.reduce((n, p) => n + p.distance, 0));
  const hours = round(parts.reduce((n, p) => n + p.hours, 0));
  const laden = round(parts.filter((p) => p.passage.carried).reduce((n, p) => n + p.distance, 0));
  const transportWork = Math.round(parts.reduce((n, p) => n + (p.passage.carried ?? 0) * p.distance, 0));

  // EU: voyages by their two ports; the stay at an EU berth between one passage and the next.
  const mrv: EmMrv = { intra: 0, from: 0, to: 0, berth: 0, total: 0 };
  for (const p of parts) {
    const { fromEu, toEu } = p.passage;
    if (fromEu && toEu) mrv.intra += p.litres;
    else if (fromEu) mrv.from += p.litres;
    else if (toEu) mrv.to += p.litres;
  }
  let broken = 0;
  sound.forEach((p, i) => {
    const next = sound[i + 1];
    if (!next || p.arrAt.slice(0, 4) !== String(year)) return;
    if (p.toPort.trim().toLowerCase() !== next.fromPort.trim().toLowerCase()) { broken++; return; }
    if (!p.toEu) return;
    const burnt = p.robArr + bunkers.filter((b) => b.date >= p.arrAt.slice(0, 10) && b.date <= next.depAt.slice(0, 10)).reduce((n, b) => n + b.litres, 0) - next.robDep;
    if (burnt > 0) mrv.berth += burnt;
  });
  if (broken) gaps.push({ key: 'chain', params: { n: broken } });
  mrv.total = round(mrv.intra + mrv.from + mrv.to + mrv.berth);
  mrv.intra = round(mrv.intra); mrv.from = round(mrv.from); mrv.to = round(mrv.to); mrv.berth = round(mrv.berth);
  const co2Of = (l: number) => { const t = toT(l); return t == null ? undefined : t * CF_CO2; };
  mrv.co2 = co2Of(mrv.total); mrv.co2Intra = co2Of(mrv.intra); mrv.co2From = co2Of(mrv.from); mrv.co2To = co2Of(mrv.to); mrv.co2Berth = co2Of(mrv.berth);
  const mrvT = toT(mrv.total);
  if (mrvT != null) { mrv.ch4 = mrvT * CF_CH4; mrv.n2o = mrvT * CF_N2O; }

  // Days the deck log says she was at sea, outside every passage.
  if (x.deck) {
    const days = new Set(x.deck.filter((e) => e.date.startsWith(`${year}-`) && !e.draft && e.mode !== 'port' && e.period !== 'port').map((e) => e.date));
    let outside = 0;
    days.forEach((d) => { if (!sound.some((p) => p.depAt.slice(0, 10) <= d && d <= p.arrAt.slice(0, 10))) outside++; });
    if (outside) gaps.push({ key: 'seaNoPassage', params: { n: outside } });
  }

  const applies = applicability(vessel);
  if (applies.cii === 'applies' && !ciiLine(vessel!.type, vessel!.gt, vessel!.dwt)) gaps.push({ key: 'noTonnage' });
  return {
    year, ytd, litres, received, density, densityFrom, tonnes, co2,
    ch4: tonnes == null ? undefined : tonnes * CF_CH4, n2o: tonnes == null ? undefined : tonnes * CF_N2O,
    distance, hours, laden, transportWork, parts, mrv,
    cii: applies.cii === 'applies' ? ciiFor(vessel, year, co2, distance) : undefined,
    gaps,
  };
}

// ---- The statement -----------------------------------------------------------------------------

export const frozenOf = (y: EmYear): EmFrozen => ({
  litres: y.litres,
  ...(y.tonnes != null ? { tonnes: round(y.tonnes, 3) } : {}),
  ...(y.co2 != null ? { co2: round(y.co2, 3) } : {}),
  distance: y.distance,
  hours: y.hours,
});

export const emptySplit = (): EmSplit => ({ main: { u: 0, n: 0 }, aux: { u: 0, n: 0 }, boiler: { u: 0, n: 0 }, other: { u: 0, n: 0 } });
export const splitTotal = (s: EmSplit) => round(EM_CONSUMERS.reduce((n, c: EmConsumer) => n + s[c].u + s[c].n, 0), 3);

/** The newest statement of a year counts. */
export const statementOf = (list: EmStatement[], year: number) => list.filter((s) => s.year === year).sort((a, b) => b.at - a.at)[0];

/** Gaps a signature adds: the split that does not add up (more than 2 %), records changed since. */
export function statementGaps(y: EmYear, s: EmStatement | undefined): EmGap[] {
  if (!s) return [{ key: 'unsigned' }];
  const out: EmGap[] = [];
  const total = splitTotal(s.split);
  if (y.tonnes != null && y.tonnes > 0 && Math.abs(total - y.tonnes) / y.tonnes > 0.02) out.push({ key: 'splitOff', params: { split: total, total: round(y.tonnes, 1) } });
  const now = frozenOf(y);
  if (now.litres !== s.frozen.litres || now.distance !== s.frozen.distance || now.hours !== s.frozen.hours) out.push({ key: 'changed' });
  return out;
}

/**
 * The year whose statement is owed on `today` and has not been signed: last year, where DCS or
 * MRV applies and the vessel has passages in it — a vessel that started in November owes nothing
 * for the year before.
 */
export function statementDue(v: EmVessel | undefined, statements: EmStatement[], passages: EmPassage[], today: string): { year: number; late: boolean } | null {
  const a = applicability(v);
  if (a.dcs !== 'applies' && a.mrv !== 'applies') return null;
  const year = Number(today.slice(0, 4)) - 1;
  if (statementOf(statements, year) || !passages.some((p) => p.depAt.startsWith(`${year}-`) || p.arrAt.startsWith(`${year}-`))) return null;
  return { year, late: today > `${year + 1}-03-31` };
}
