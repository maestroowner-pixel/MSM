import { WatchEntry, WatchParam, WatchTemplate } from '../types/watchLog';
import { uid } from '../utils/id';

// ─── Default template ────────────────────────────────────────────────────────

const p = (name: string, unit: string, type: WatchParam['type'] = 'number', normalMin?: number, normalMax?: number): WatchParam => ({
  id: uid(),
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
      p('Main Engine RPM', 'rpm'),
      p('ME Cooling Water Temp In', '°C'),
      p('ME Cooling Water Temp Out', '°C'),
      p('ME Lube Oil Pressure', 'bar'),
      p('ME Lube Oil Temp', '°C'),
      p('ME Exhaust Temp Max', '°C'),
      p('Shaft Generator Output', 'kW'),
      p('Bilge Level / Alarms', '', 'text'),
    ],
    updatedAt: Date.now(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Whether a numeric value is within the param's normal range. */
export function normalStatus(param: WatchParam, raw: string): 'ok' | 'warn' | 'none' {
  if (param.type !== 'number') return 'none';
  const v = parseFloat(raw);
  if (isNaN(v) || raw.trim() === '') return 'none';
  if (param.normalMin !== undefined && v < param.normalMin) return 'warn';
  if (param.normalMax !== undefined && v > param.normalMax) return 'warn';
  return 'ok';
}

/** Display string for a param value with its unit. */
export function fmtValue(param: WatchParam, raw: string): string {
  if (!raw || raw.trim() === '') return '—';
  if (param.type === 'number') {
    const v = parseFloat(raw);
    return isNaN(v) ? raw : `${v}${param.unit ? ' ' + param.unit : ''}`;
  }
  return raw;
}

/** Trend direction compared to the previous entry: 'up' | 'down' | 'same' | null. */
export function trend(param: WatchParam, entries: WatchEntry[]): 'up' | 'down' | 'same' | null {
  if (param.type !== 'number' || entries.length < 2) return null;
  const last = parseFloat(entries[0].values[param.id] ?? '');
  const prev = parseFloat(entries[1].values[param.id] ?? '');
  if (isNaN(last) || isNaN(prev)) return null;
  if (last > prev + 0.5) return 'up';
  if (last < prev - 0.5) return 'down';
  return 'same';
}

/** Today in YYYY-MM-DD. */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current local time as HH:MM. */
export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}
