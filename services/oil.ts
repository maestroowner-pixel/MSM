// ===================================
// Oil analysis — the pure part (types/oil.ts): limits, the verdict of a sample,
// when the next sample is due, and reading a lab's Excel / CSV export.
// No React, no storage — `npm run check:oil` drives all of it.
//
// GUIDE LIMITS. The defaults below are the common guide values labs print for
// a high-speed diesel, a gearbox, hydraulics… They are where a vessel starts,
// not the engine maker's figures: every point can carry its own (OilPoint.limits),
// and the lab's own verdict counts too — the worse of the two is the verdict.
// ===================================

import { COMPARTMENT_LABEL, Compartment, Level, Limit, OilPoint, OilResult, OilSample, PARAM, PARAMS, ParamKey, Verdict } from '../types/oil';

const M = (c: number, a: number): Limit => ({ c, a });

/** Viscosity ±15 / 25 %, TBN at 60 / 50 % of new, TAN +1.5 / +2.5 over new — the same for every compartment. */
const COMMON: Partial<Record<ParamKey, Limit>> = { v40: M(15, 25), v100: M(15, 25), tbn: M(60, 50), tan: M(1.5, 2.5) };

export const GUIDE: Record<Compartment, Partial<Record<ParamKey, Limit>>> = {
  engine: { ...COMMON, fe: M(50, 100), cu: M(30, 60), pb: M(20, 40), al: M(15, 30), cr: M(10, 20), sn: M(10, 20), ni: M(5, 10), si: M(15, 25), na: M(50, 100), k: M(20, 40), water: M(0.2, 0.5), fuel: M(2.5, 5), soot: M(1.5, 3) },
  gear: { ...COMMON, fe: M(100, 200), cu: M(50, 100), pb: M(20, 40), al: M(15, 30), cr: M(10, 20), si: M(20, 40), water: M(0.1, 0.2), pq: M(50, 100) },
  hydraulic: { ...COMMON, fe: M(20, 40), cu: M(20, 40), al: M(10, 20), cr: M(5, 10), si: M(10, 20), water: M(0.05, 0.1) },
  thruster: { ...COMMON, fe: M(100, 200), cu: M(50, 100), si: M(20, 40), water: M(0.2, 0.5), pq: M(50, 100) },
  sterntube: { ...COMMON, fe: M(50, 100), cu: M(30, 60), pb: M(20, 40), sn: M(20, 40), na: M(100, 200), water: M(0.5, 1) },
  compressor: { ...COMMON, fe: M(30, 60), cu: M(20, 40), al: M(10, 20), si: M(15, 25), water: M(0.1, 0.2) },
  other: { ...COMMON },
};

/** Sample every 90 days; engines, gears and thrusters also every 500 running hours. */
export function guideInterval(c: Compartment): { days: number; hours?: number } {
  return c === 'engine' || c === 'gear' || c === 'thruster' ? { days: 90, hours: 500 } : { days: c === 'hydraulic' || c === 'sterntube' ? 180 : 90 };
}

/** The limit a point is judged by for one parameter: its own, else the guide's. */
export function limitFor(p: Pick<OilPoint, 'compartment' | 'limits'>, k: ParamKey): Limit | undefined {
  const own = p.limits?.[k];
  if (own && (own.c != null || own.a != null)) return own;
  return GUIDE[p.compartment]?.[k];
}

export const VERDICT_LEVEL: Record<Verdict, Level> = { normal: 0, caution: 1, action: 2 };
export const LEVEL_VERDICT: Verdict[] = ['normal', 'caution', 'action'];

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Finding {
  key: ParamKey | 'iso' | 'lab';
  level: Level;
  /** English — the report prints it; the screen shows it as it is. */
  text: string;
}

/** One value against its limit. */
export function judge(p: Pick<OilPoint, 'compartment' | 'limits' | 'newOil'>, k: ParamKey, v: number): Finding | null {
  const def = PARAM[k];
  const l = limitFor(p, k);
  if (!def || !l) return null;
  const lvl = (bad: (x: number) => boolean): Level => (l.a != null && bad(l.a) ? 2 : l.c != null && bad(l.c) ? 1 : 0);
  if (def.kind === 'max') {
    const level = lvl((x) => v >= x);
    return level ? { key: k, level, text: `${def.label} ${v}${def.unit ? ` ${def.unit}` : ''} (${level === 2 ? 'action' : 'caution'} at ${level === 2 ? l.a : l.c})` } : null;
  }
  const ref = k === 'v40' || k === 'v100' || k === 'tbn' || k === 'tan' ? p.newOil?.[k] : undefined;
  if (ref == null || !(ref > 0) && def.kind !== 'tan') return null;
  if (def.kind === 'visc') {
    const ch = ((v - ref) / ref) * 100;
    const level = lvl((x) => Math.abs(ch) >= x);
    return level ? { key: k, level, text: `${def.label} ${v} cSt, ${ch > 0 ? '+' : ''}${r1(ch)} % from new ${ref}` } : null;
  }
  if (def.kind === 'tbn') {
    const left = (v / ref) * 100;
    const level = lvl((x) => left < x);
    return level ? { key: k, level, text: `TBN ${v}, ${r1(left)} % of new ${ref}` } : null;
  }
  if (def.kind === 'tan') {
    const rise = v - ref;
    const level = lvl((x) => rise >= x);
    return level ? { key: k, level, text: `TAN ${v}, +${r1(rise)} over new ${ref}` } : null;
  }
  return null;
}

/** "19/17/14" → [19, 17, 14]; "-/16/13" and "16/13" keep their positions from the right. */
export function isoCode(s?: string): number[] | null {
  if (!s) return null;
  const parts = String(s).split('/').map((x) => x.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const n = parts.map((x) => (/^\d{1,2}$/.test(x) ? Number(x) : NaN));
  if (n.filter((x) => !Number.isNaN(x)).length < 2) return null;
  return parts.length === 2 ? [NaN, ...n] : n;
}

/** Each count over the target is caution; two classes over (four times the particles) is action. */
export function judgeIso(target?: string, got?: string): Finding | null {
  const t = isoCode(target);
  const g = isoCode(got);
  if (!t || !g) return null;
  let over = 0;
  for (let i = 0; i < 3; i++) if (!Number.isNaN(t[i]) && !Number.isNaN(g[i])) over = Math.max(over, g[i] - t[i]);
  if (over <= 0) return null;
  const level: Level = over >= 2 ? 2 : 1;
  return { key: 'iso', level, text: `ISO 4406 ${got} over target ${target}` };
}

/**
 * Rising fast: a wear metal or contaminant up by half or more on the last sample
 * and already past half of its caution limit — the lab's "trend" warning, the
 * reason to resample early before the limit itself is crossed.
 */
export function rising(p: Pick<OilPoint, 'compartment' | 'limits'>, k: ParamKey, v: number, prev?: number): Finding | null {
  const def = PARAM[k];
  const l = limitFor(p, k);
  if (!def || def.kind !== 'max' || prev == null || !l?.c) return null;
  if (v < l.c / 2 || v < prev * 1.5 || v - prev <= 0) return null;
  return { key: k, level: 1, text: `${def.label} rising: ${prev} → ${v}${def.unit ? ` ${def.unit}` : ''}` };
}

export interface Assessment {
  level: Level;
  verdict: Verdict;
  findings: Finding[];
  /** The level each parameter reached on its own (for the trend table's colours). */
  byKey: Partial<Record<ParamKey | 'iso', Level>>;
}

/** A sample's verdict: every value against its limit, the trend from the previous result, and the lab's own verdict — the worst wins. */
export function assess(p: Pick<OilPoint, 'compartment' | 'limits' | 'newOil' | 'isoTarget'>, r: OilResult, prev?: OilResult): Assessment {
  const findings: Finding[] = [];
  const byKey: Assessment['byKey'] = {};
  for (const def of PARAMS) {
    const v = r.values[def.key];
    if (v == null || !Number.isFinite(v)) continue;
    const f = judge(p, def.key, v);
    // Rising is the early warning: once the limit itself is crossed it adds nothing.
    const tr = f ? null : rising(p, def.key, v, prev?.values[def.key]);
    const worst = [f, tr].filter(Boolean).sort((a, b) => b!.level - a!.level);
    if (worst.length) {
      findings.push(...(worst as Finding[]));
      byKey[def.key] = worst[0]!.level;
    } else byKey[def.key] = 0;
  }
  const iso = judgeIso(p.isoTarget, r.iso);
  if (iso) { findings.push(iso); byKey.iso = iso.level; }
  if (r.labVerdict && r.labVerdict !== 'normal') findings.push({ key: 'lab', level: VERDICT_LEVEL[r.labVerdict], text: `Lab: ${r.labVerdict}${r.labComment ? ` — ${r.labComment}` : ''}` });
  findings.sort((a, b) => b.level - a.level);
  const level = findings.reduce<Level>((m, f) => (f.level > m ? f.level : m), 0);
  return { level, verdict: LEVEL_VERDICT[level], findings, byKey };
}

// ---- dates ----

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** A point's samples, oldest first; ties by when they were recorded. */
export function samplesOf(pointId: string, samples: OilSample[]): OilSample[] {
  return samples.filter((s) => s.pointId === pointId).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
}

/** The result before this sample's, on the same point — what "rising" compares with. */
export function previousResult(s: OilSample, all: OilSample[]): OilResult | undefined {
  const list = samplesOf(s.pointId, all).filter((x) => x.result);
  const i = list.findIndex((x) => x.id === s.id);
  return (i > 0 ? list[i - 1] : i < 0 ? list[list.length - 1] : undefined)?.result;
}

export type Stage = 'taken' | 'sent' | 'result' | 'reviewed';
export function stageOf(s: OilSample): Stage {
  return s.review ? 'reviewed' : s.result ? 'result' : s.sent ? 'sent' : 'taken';
}

/** The verdict that stands: the officer's review, else the assessment of the result. */
export function verdictOf(p: OilPoint, s: OilSample, all: OilSample[]): Verdict | null {
  if (s.review) return s.review.verdict;
  if (!s.result) return null;
  return assess(p, s.result, previousResult(s, all)).verdict;
}

/** A sample sent this many days ago with no result is chased. */
export const RESULT_LATE_DAYS = 21;

export interface PointStatus {
  due: 'never' | 'ok' | 'soon' | 'overdue';
  dueDate?: string;
  dueHours?: number;
  last?: OilSample;
  /** The latest sample with a result — what the colour of the point is. */
  lastResult?: OilSample;
  verdict: Verdict | null;
  /** Samples waiting for the lab, and those of them late. */
  awaiting: number;
  late: number;
  /** Results nobody has reviewed yet. */
  toReview: number;
}

/** When the point's next sample is due (days or running hours, whichever first), and where it stands. */
export function pointStatus(p: OilPoint, all: OilSample[], machineHours: number | undefined, today: string): PointStatus {
  const list = samplesOf(p.id, all);
  const last = list[list.length - 1];
  const withResult = list.filter((s) => s.result);
  const lastResult = withResult[withResult.length - 1];
  const awaitingList = list.filter((s) => !s.result);
  const late = awaitingList.filter((s) => daysBetween(s.sent?.date ?? s.date, today) > RESULT_LATE_DAYS).length;
  const base = { last, lastResult, verdict: lastResult ? verdictOf(p, lastResult, all) : null, awaiting: awaitingList.length, late, toReview: list.filter((s) => s.result && !s.review).length };
  if (!last) return { ...base, due: 'never' };
  const dueDate = p.intervalDays ? addDays(last.date, p.intervalDays) : undefined;
  const dueHours = p.intervalHours && last.machineHours != null ? last.machineHours + p.intervalHours : undefined;
  const overdue = (dueDate != null && today > dueDate) || (dueHours != null && machineHours != null && machineHours >= dueHours);
  const soon =
    (dueDate != null && daysBetween(today, dueDate) <= 14) ||
    (dueHours != null && machineHours != null && p.intervalHours != null && dueHours - machineHours <= p.intervalHours / 10);
  return { ...base, due: overdue ? 'overdue' : soon ? 'soon' : 'ok', dueDate, dueHours };
}

/** What stops a sample being saved — an i18n key, or null. */
export function sampleProblem(s: Pick<OilSample, 'date' | 'machineHours'>, today: string, lastHours?: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return 'oil.err.date';
  if (s.date > today) return 'oil.err.future';
  if (s.machineHours != null && (!Number.isFinite(s.machineHours) || s.machineHours < 0)) return 'oil.err.hours';
  if (s.machineHours != null && lastHours != null && s.machineHours < lastHours) return 'oil.err.hoursBack';
  return null;
}

// ---- the lab's file ----

type Meta = 'date' | 'labNo' | 'unit' | 'verdict' | 'comment' | 'oilHours' | 'machineHours' | 'iso' | 'reportDate';

/** Header → field. Order matters: the first that matches wins (hours before unit, PQ and ISO before viscosity). */
const HEADERS: [RegExp, Meta | ParamKey][] = [
  [/report.*date|date.*(report|tested|analys|received)|tested on/, 'reportDate'],
  [/sampl\w*.*date|date.*sampl|^date$|^sampled$/, 'date'],
  [/lab\w*.*(no|number|ref|id)\b|sample.*(no|number|id|ref)\b|bottle|^lab ?no/, 'labNo'],
  [/(oil|lube|lubricant).*(hours|hrs|age)|hours on oil|oil life/, 'oilHours'],
  [/(unit|equipment|machine|engine|component|running).*(hours|hrs)|^hours$|^hrs$|^unit age/, 'machineHours'],
  [/iso.*4406|iso.*code|cleanliness|^iso$/, 'iso'],
  [/\bpq\b/, 'pq'],
  [/(visc\w*|\bkv\b|kin\w* visc\w*).*100|\bkv ?100\b|\bv100\b/, 'v100'],
  [/(visc\w*|\bkv\b).*40|\bkv ?40\b|\bv40\b|^visc\w*( \(?cst\)?)?$/, 'v40'],
  [/\btbn\b|\bbn\b|base number/, 'tbn'],
  [/\btan\b|acid number|\ban\b/, 'tan'],
  [/oxidation|\boxi\b/, 'oxi'],
  [/\bfe\b|\biron\b/, 'fe'],
  [/\bcu\b|copper/, 'cu'],
  [/\bpb\b|\blead\b/, 'pb'],
  [/\bal\b|alumin/, 'al'],
  [/\bcr\b|chrom/, 'cr'],
  [/\bsn\b|\btin\b/, 'sn'],
  [/\bni\b|nickel/, 'ni'],
  [/\bsi\b|silicon/, 'si'],
  [/\bna\b|sodium/, 'na'],
  [/\bk\b|potassium/, 'k'],
  [/fuel.*dil|dilution|^fuel\b/, 'fuel'],
  [/\bsoot\b|insolubles/, 'soot'],
  [/water|\bh2o\b|karl fischer|\bkf\b/, 'water'],
  [/^(status|severity|evaluation|rating|overall|condition|sample status|result)$|overall.*(status|rating|condition)|severity/, 'verdict'],
  [/comment|recommend|diagnos|remarks/, 'comment'],
  [/^(unit|unit id|equipment|component|compartment|machine|unit name|equipment id)$|unit.*(id|name)|component.*(id|name)/, 'unit'],
];

export function headerField(h: unknown): Meta | ParamKey | null {
  const s = String(h ?? '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || /viscosity index|\bvi\b/.test(s)) return null;
  for (const [re, f] of HEADERS) if (re.test(s)) return f;
  return null;
}

export interface LabRow {
  date?: string;
  reportDate?: string;
  labNo?: string;
  unit?: string;
  oilHours?: number;
  machineHours?: number;
  values: Partial<Record<ParamKey, number>>;
  iso?: string;
  verdict?: Verdict;
  comment?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A sheet cell → yyyy-mm-dd: a Date, an Excel serial, "2026-10-12", "12/10/2026", "12.10.2026" (day first, as outside the US). */
export function cellDate(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return undefined;
}

/** "12", "12,5", "<1" (below detection → 0), "1 234". Dashes and blanks are no value. */
export function cellNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '').trim();
  if (!s || /^[-–—]+$|^n\/?a$/i.test(s)) return undefined;
  if (/^<\s*\d/.test(s)) return 0;
  const n = Number(s.replace(/^>\s*/, '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function cellVerdict(v: unknown): Verdict | undefined {
  const s = String(v ?? '').toLowerCase();
  if (/critical|action|severe|\bred\b|alarm|urgent|abnormal/.test(s)) return 'action';
  if (/caution|attention|amber|yellow|marginal|monitor|warning|alert/.test(s)) return 'caution';
  if (/normal|green|satisfactory|\bok\b|acceptable|good/.test(s)) return 'normal';
  return undefined;
}

/**
 * The lab's export, any layout with a header row: the header is the first row
 * where three or more cells name a parameter. One row per sample after it.
 * Water given in ppm is turned into % (÷ 10 000).
 */
export function readLabSheet(rows: unknown[][]): LabRow[] | null {
  let at = -1;
  let cols: (Meta | ParamKey | null)[] = [];
  let ppmWater = false;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const f = (rows[i] ?? []).map(headerField);
    if (f.filter((x) => x && x in PARAM).length >= 3) {
      at = i;
      cols = f;
      const wi = f.indexOf('water');
      ppmWater = wi >= 0 && /ppm/i.test(String(rows[i][wi]));
      break;
    }
  }
  if (at < 0) return null;
  const out: LabRow[] = [];
  for (const row of rows.slice(at + 1)) {
    const r: LabRow = { values: {} };
    cols.forEach((f, j) => {
      if (!f) return;
      const v = row?.[j];
      if (f in PARAM) {
        const n = cellNumber(v);
        if (n != null) r.values[f as ParamKey] = f === 'water' && ppmWater ? n / 10000 : n;
      } else if (f === 'date' || f === 'reportDate') {
        const d = cellDate(v);
        if (d) r[f] = d;
      } else if (f === 'oilHours' || f === 'machineHours') {
        const n = cellNumber(v);
        if (n != null) r[f] = n;
      } else if (f === 'verdict') {
        const vd = cellVerdict(v);
        if (vd) r.verdict = vd;
      } else {
        const s = String(v ?? '').trim();
        if (s) (r as unknown as Record<string, string>)[f] = s;
      }
    });
    if (Object.keys(r.values).length || r.iso) out.push(r);
  }
  return out;
}

/** Which row of the lab's file is this sample: by the bottle / lab number, else the date taken, else the only row. -1 → ask. */
export function matchLabRow(rows: LabRow[], s: Pick<OilSample, 'bottle' | 'date'>): number {
  const norm = (x?: string) => (x ?? '').replace(/\s+/g, '').toLowerCase();
  if (s.bottle) {
    const i = rows.findIndex((r) => norm(r.labNo) === norm(s.bottle));
    if (i >= 0) return i;
  }
  const byDate = rows.map((r, i) => (r.date === s.date ? i : -1)).filter((i) => i >= 0);
  if (byDate.length === 1) return byDate[0];
  return rows.length === 1 ? 0 : -1;
}

/** A row of the lab's file as the sample's result. */
export function resultFromRow(r: LabRow, by: string, today: string, at: number): OilResult {
  return {
    date: r.reportDate ?? today,
    ...(r.labNo ? { labNo: r.labNo } : {}),
    values: r.values,
    ...(r.iso ? { iso: r.iso } : {}),
    ...(r.verdict ? { labVerdict: r.verdict } : {}),
    ...(r.comment ? { labComment: r.comment } : {}),
    from: 'sheet',
    by,
    at,
  };
}

/** "Main engine PS — Crankcase", for lists and file names. */
export function pointTitle(p: Pick<OilPoint, 'machineName' | 'name'>): string {
  return p.machineName ? `${p.machineName} — ${p.name}` : p.name;
}

export const compartmentLabel = (c: Compartment) => COMPARTMENT_LABEL[c];
