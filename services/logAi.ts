// ===================================
// Voice into the logs (plan AI-8, 6 Nov 2026): what the officer of the watch or
// the engineer said — dictated, any language — becomes a draft of the deck log
// entry or the engine room round. The AI puts the figures into the fields and
// writes the events in English; the form takes only what is still empty, the
// remarks are added under what is there, and the entry is signed as any other.
//
// Names stay aboard: the words go through scrubNames (services/incidentAi.ts)
// first. Nothing about earlier entries goes.
// ===================================

import type { Visibility, WindDir } from '../types/deckLog';
import type { WatchParam } from '../types/watchLog';
import { rangeText } from './watchLog';

export const MAX_SAID = 3000;

const WIND: WindDir[] = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const VIS: Visibility[] = ['good', 'moderate', 'poor', 'fog'];
export const WX_CONDITIONS = ['Clear', 'Cloudy', 'Overcast', 'Rain', 'Drizzle', 'Fog', 'Mist', 'Snow', 'Thunder'];

/** The deck log's numeric fields the AI may fill, each with the range a figure must be in. */
const DECK_NUM: Record<string, { min: number; max: number; int?: boolean; sea?: boolean }> = {
  latDeg: { min: 0, max: 90, int: true, sea: true },
  latMin: { min: 0, max: 59.99, sea: true },
  lonDeg: { min: 0, max: 180, int: true, sea: true },
  lonMin: { min: 0, max: 59.99, sea: true },
  courseGyro: { min: 0, max: 360, sea: true },
  courseMagnetic: { min: 0, max: 360, sea: true },
  speed: { min: 0, max: 60, sea: true },
  distanceRun: { min: 0, max: 99999, sea: true },
  rpm: { min: 0, max: 3000, sea: true },
  engLoadPort: { min: 0, max: 120, sea: true },
  engLoadStbd: { min: 0, max: 120, sea: true },
  windBft: { min: 0, max: 12, int: true },
  seaState: { min: 0, max: 9, int: true, sea: true },
  pressure: { min: 900, max: 1100, sea: true },
  tempAir: { min: -60, max: 60 },
};

export type DeckField = keyof typeof DECK_NUM | 'latHem' | 'lonHem' | 'windDir' | 'visibility' | 'wxCondition';
export const DECK_FIELDS = [...Object.keys(DECK_NUM), 'latHem', 'lonHem', 'windDir', 'visibility', 'wxCondition'] as DeckField[];

/** The deck draft as the form's text boxes hold it (strings), only the fields the AI gave and that passed. */
export type DeckValues = Partial<Record<DeckField, string>>;

export interface LogAiReply {
  time?: string | null;
  fields?: Record<string, unknown>;
  values?: Record<string, unknown>;
  remarks?: string;
  unclear?: string[];
}

export interface LogRead {
  time?: string;
  /** deck: field → value; engine: param id → value. */
  values: Record<string, string>;
  remarks?: string;
  unclear: string[];
  /** What the AI gave that could not be taken (unknown key, out of range) — counted, not shown. */
  dropped: number;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ').slice(0, max) : '');

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const s = v.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : undefined;
}

function hhmm(v: unknown): string | undefined {
  const m = /^(\d{1,2})[:.h]?(\d{2})$/.exec(clean(v, 8));
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : undefined;
}

const remarksOf = (v: unknown) => clean(typeof v === 'string' ? v.replace(/\r/g, '') : '', 2000).replace(/\n{3,}/g, '\n\n') || undefined;
const unclearOf = (r: LogAiReply) => (Array.isArray(r.unclear) ? r.unclear : []).map((q) => clean(q, 200)).filter(Boolean).slice(0, 4);

/** The reply for the deck log: a field the form does not have in this mode, or a figure out of its range, goes. */
export function readDeck(reply: LogAiReply, mode: 'sea' | 'port'): LogRead {
  const values: Record<string, string> = {};
  let dropped = 0;
  const port = mode === 'port';
  for (const [k, v] of Object.entries(reply.fields ?? {})) {
    if (v === null || v === undefined || v === '') continue;
    const num = DECK_NUM[k];
    if (num) {
      const n = asNumber(v);
      if (n === undefined || n < num.min || n > num.max || (num.int && !Number.isInteger(n)) || (port && num.sea)) { dropped++; continue; }
      values[k] = String(n);
      continue;
    }
    const s = clean(v, 20);
    const up = s.toUpperCase();
    if (k === 'latHem' && !port && (up === 'N' || up === 'S')) values[k] = up;
    else if (k === 'lonHem' && !port && (up === 'E' || up === 'W')) values[k] = up;
    else if (k === 'windDir' && (WIND as string[]).includes(up)) values[k] = up;
    else if (k === 'visibility' && !port && (VIS as string[]).includes(s.toLowerCase())) values[k] = s.toLowerCase();
    else if (k === 'wxCondition' && port && WX_CONDITIONS.some((w) => w.toLowerCase() === s.toLowerCase())) values[k] = WX_CONDITIONS.find((w) => w.toLowerCase() === s.toLowerCase())!;
    else dropped++;
  }
  // A hemisphere without its degrees is no position.
  if (values.latHem && !values.latDeg) delete values.latHem;
  if (values.lonHem && !values.lonDeg) delete values.lonHem;
  const time = hhmm(reply.time);
  return { ...(time ? { time } : {}), values, ...(remarksOf(reply.remarks) ? { remarks: remarksOf(reply.remarks) } : {}), unclear: unclearOf(reply), dropped };
}

export interface ParamForAi {
  key: string;
  name: string;
  unit: string;
  type: 'number' | 'text';
  range?: string;
}

/** The round's readings under P1…; the ids stay on the device. */
export function paramsForAi(params: WatchParam[]): { params: ParamForAi[]; ids: string[] } {
  const list = params.slice(0, 120);
  return {
    params: list.map((p, i) => ({ key: `P${i + 1}`, name: p.name, unit: p.unit, type: p.type, ...(rangeText(p) ? { range: rangeText(p) } : {}) })),
    ids: list.map((p) => p.id),
  };
}

/** The reply for the engine round against the round as it is now: a key not sent, a reading no longer on it, a number that is not one, goes. */
export function readEngine(reply: LogAiReply, params: WatchParam[], sent: string[]): LogRead {
  const live = new Map(params.map((p) => [p.id, p]));
  const byKey = new Map(sent.map((id, i) => [`P${i + 1}`, id]));
  const values: Record<string, string> = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(reply.values ?? {})) {
    if (v === null || v === undefined || v === '') continue;
    const p = live.get(byKey.get(k) ?? '');
    if (!p) { dropped++; continue; }
    if (p.type === 'number') {
      const n = asNumber(v);
      if (n === undefined) { dropped++; continue; }
      values[p.id] = String(n);
    } else {
      const s = clean(typeof v === 'number' ? String(v) : v, 60);
      if (s) values[p.id] = s;
      else dropped++;
    }
  }
  return { values, ...(remarksOf(reply.remarks) ? { remarks: remarksOf(reply.remarks) } : {}), unclear: unclearOf(reply), dropped };
}

/**
 * The draft into the form: a value only where the box is empty (what the
 * officer typed stays, and is counted), the remarks under the ones there unless
 * they already say it.
 */
export function applyLog(form: Record<string, string>, remarks: string, read: LogRead): { values: Record<string, string>; remarks: string; filled: number; kept: number } {
  const values = { ...form };
  let filled = 0;
  let kept = 0;
  for (const [k, v] of Object.entries(read.values)) {
    if ((form[k] ?? '').trim()) {
      if (form[k].trim() !== v) kept++;
      continue;
    }
    values[k] = v;
    filled++;
  }
  const add = read.remarks?.trim();
  const has = remarks.trim();
  const next = !add ? remarks : !has ? add : has.toLowerCase().includes(add.toLowerCase()) ? remarks : `${has}\n${add}`;
  return { values, remarks: next, filled, kept };
}
