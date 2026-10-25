import { WatchEntry, WatchParam, WatchTemplate } from '../types/watchLog';
import { shipHm, shipToday } from '../utils/shipTime';

// ─── Default template ────────────────────────────────────────────────────────

// Fixed ids: until the vessel saves its own template every round is made from
// this one, and the trends follow a reading from one round to the next by id.
const p = (id: string, name: string, unit: string, type: WatchParam['type'] = 'number', normalMin?: number, normalMax?: number): WatchParam => ({
  id,
  name,
  unit,
  type,
  ...(normalMin !== undefined ? { normalMin } : {}),
  ...(normalMax !== undefined ? { normalMax } : {}),
});

export function defaultTemplate(): WatchTemplate {
  return {
    id: 'default',
    name: 'Engine Room Round',
    params: [
      p('me-rpm', 'Main Engine RPM', 'rpm'),
      p('me-cw-in', 'ME Cooling Water Temp In', '°C'),
      p('me-cw-out', 'ME Cooling Water Temp Out', '°C'),
      p('me-lo-press', 'ME Lube Oil Pressure', 'bar'),
      p('me-lo-temp', 'ME Lube Oil Temp', '°C'),
      p('me-exh-max', 'ME Exhaust Temp Max', '°C'),
      p('sg-kw', 'Shaft Generator Output', 'kW'),
      p('bilge', 'Bilge Level / Alarms', '', 'text'),
    ],
    updatedAt: 0,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A typed reading as a number — "12,5" and "12.5" alike; NaN when it is not one. */
export function num(raw: string | undefined): number {
  const s = (raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
}

/** Whether a numeric value is within the param's normal range. */
export function normalStatus(param: WatchParam, raw: string): 'ok' | 'warn' | 'none' {
  if (param.type !== 'number') return 'none';
  const v = num(raw);
  if (isNaN(v)) return 'none';
  if (param.normalMin !== undefined && v < param.normalMin) return 'warn';
  if (param.normalMax !== undefined && v > param.normalMax) return 'warn';
  return 'ok';
}

/** The params of an entry whose reading is outside the normal range. */
export function outOfRange(params: WatchParam[], values: Record<string, string>): WatchParam[] {
  return params.filter((q) => normalStatus(q, values[q.id] ?? '') === 'warn');
}

/** "≥ 2 – ≤ 5" for a param with a normal range, '' without one. */
export function rangeText(param: WatchParam): string {
  const lo = param.normalMin != null ? `≥ ${param.normalMin}` : '';
  const hi = param.normalMax != null ? `≤ ${param.normalMax}` : '';
  return lo && hi ? `${lo} – ${hi}` : lo || hi;
}

/** Display string for a param value with its unit. */
export function fmtValue(param: WatchParam, raw: string): string {
  if (!raw || raw.trim() === '') return '—';
  if (param.type === 'number') {
    const v = num(raw);
    return isNaN(v) ? raw : `${v}${param.unit ? ' ' + param.unit : ''}`;
  }
  return raw;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The same reading in an entry's snapshot: by id, else by name and unit — a
 * template rebuilt by hand, or rounds made before the default had fixed ids.
 */
export function sameParam(param: WatchParam, snapshot: WatchParam[]): WatchParam | undefined {
  return snapshot.find((q) => q.id === param.id)
    ?? snapshot.find((q) => norm(q.name) === norm(param.name) && norm(q.unit) === norm(param.unit));
}

export interface Reading { at: number; date: string; time: string; value: number }

/** Numeric readings of one param, oldest first — the last `limit` of them. */
export function history(param: WatchParam, entries: WatchEntry[], limit = 14): Reading[] {
  const out: Reading[] = [];
  for (const e of entries) {
    const q = sameParam(param, e.params);
    const v = q ? num(e.values[q.id]) : NaN;
    if (!isNaN(v)) out.push({ at: e.at, date: e.date, time: e.time, value: v });
  }
  return out.sort((a, b) => a.at - b.at).slice(-limit);
}

/** The latest numeric reading of a param made before `before` (ms). */
export function previous(param: WatchParam, entries: WatchEntry[], before = Infinity): Reading | undefined {
  const h = history(param, entries.filter((e) => e.at < before), 1);
  return h[0];
}

/** Direction from the previous reading: 'up' | 'down' | 'same', or null when either is missing. */
export function trend(raw: string, prev: Reading | undefined): 'up' | 'down' | 'same' | null {
  const v = num(raw);
  if (!prev || isNaN(v)) return null;
  const tol = Math.max(Math.abs(prev.value) * 0.01, 1e-9);
  if (v > prev.value + tol) return 'up';
  if (v < prev.value - tol) return 'down';
  return 'same';
}

/** Today in YYYY-MM-DD, ship's time. */
export function todayStr(): string {
  return shipToday();
}

/** Ship's time as HH:MM. */
export function nowTime(): string {
  return shipHm();
}
