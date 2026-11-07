// ===================================
// Rope and wire log — the pure part (types/wireLog.ts, plan item 67). Which
// register items keep a log, and what a rope's entries say about it: how much
// of its diameter is gone and how fast, when at that rate it reaches the
// discard diameter, how much length cut and slip has left, how old it is, its
// last look. Read from the entries since the rope was last renewed; nothing is
// stored. The limits are the item's (the maker's or the SMS's); without a
// discard diameter the log takes 10 % off the nominal and says so.
// ===================================

import type { EquipmentItem } from '../types/equipment';
import type { WireEntry, WireRating } from '../types/wireLog';
import { addMonths } from './surveys';

/** Categories whose items are ropes, or carry one (a crane's hoist wire, a davit's fall). */
export const WIRE_CATEGORIES = ['mooring', 'hooks_cables', 'cranes'];
/** The share of the nominal diameter a rope may lose when no discard diameter is given. */
export const DEFAULT_LOSS = 0.1;
/** Warn this many days before a limit the trend says will be reached. */
export const AHEAD_DAYS = 90;

/** A log for this item: one of the rope categories, or any lifting gear with a diameter typed. */
export function wireApplies(item: Pick<EquipmentItem, 'category' | 'diameter'>, liftingKeys: readonly string[]): boolean {
  if (WIRE_CATEGORIES.includes(item.category)) return true;
  return liftingKeys.includes(item.category) && diaOf(item.diameter) != null;
}

/** Steel wire rather than fibre: broken wires and birdcaging are asked only of wire. */
export function isWire(item: Pick<EquipmentItem, 'material' | 'type' | 'category'>): boolean {
  const s = `${item.material ?? ''} ${item.type ?? ''}`.toLowerCase();
  if (/(polyester|nylon|polyprop|dyneema|hmpe|aramid|fibre|fiber|synthetic|manila|rope tail|mixed)/.test(s)) return false;
  if (/(steel|wire|galv|stainless|dyform|compacted)/.test(s)) return true;
  return item.category === 'cranes' || item.category === 'hooks_cables';
}

/** "44", "44 mm", "11mm", "Ø 28,5" → mm. Inches and anything else → none (never converted by guess). */
export function diaOf(s?: string | number): number | undefined {
  if (typeof s === 'number') return s > 0 ? s : undefined;
  if (!s) return undefined;
  const t = s.trim().toLowerCase();
  if (/(in|inch|"|″)\b|"|″/.test(t) || t.includes('/')) return undefined;
  const m = /(\d+(?:[.,]\d+)?)\s*(mm)?\b/.exec(t);
  if (!m) return undefined;
  const v = Number(m[1].replace(',', '.'));
  return v > 0 ? v : undefined;
}

const dayMs = 86400000;
const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / dayMs;
const isoOf = (day: number) => new Date(Math.round(day) * dayMs).toISOString().slice(0, 10);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** The item's entries, oldest first (by the day, then by the signature). */
export function entriesFor(log: WireEntry[], itemId: string): WireEntry[] {
  return log.filter((e) => e.itemId === itemId).sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1));
}

export type WireIssue =
  | 'discard' // last look said discard
  | 'diameter' // at or below the discard diameter
  | 'length' // cut below the shortest length
  | 'age' // past its years in service
  | 'brake' // last brake test failed
  | 'poor' // last look said poor
  | 'soon' // the trend reaches the discard diameter within AHEAD_DAYS
  | 'nearDia' // three quarters of the allowance gone
  | 'nearLength' // within 10 % of the shortest length
  | 'nearAge'; // retires within AHEAD_DAYS

export const RED_ISSUES: WireIssue[] = ['discard', 'diameter', 'length', 'age', 'brake'];

export interface WireState {
  /** Renewed on (or installed on), the day the figures count from. */
  since?: string;
  nominal?: number;
  /** Discard diameter, and whether it is the item's or our 10 %. */
  discardAt?: number;
  discardAssumed: boolean;
  /** Latest measured diameter and how much of the nominal is gone, %. */
  lastDia?: number;
  lastDiaOn?: string;
  lossPct?: number;
  /** Loss rate, mm a year, from two or more readings at least 30 days apart. */
  mmPerYear?: number;
  /** When at that rate the discard diameter is reached (only while it is wearing). */
  discardOn?: string;
  /** Length as fitted, what cut and slip took, what is left. */
  baseLength?: number;
  cutTotal: number;
  cuts: number;
  length?: number;
  minLength?: number;
  endForEnd?: string;
  lubed?: string;
  brake?: { on: string; ok: boolean };
  lastLook?: { on: string; rating?: WireRating; by: string };
  retireOn?: string;
  years?: number;
  /** Entries since the renewal, in order. */
  entries: WireEntry[];
  issues: WireIssue[];
  level: 'red' | 'amber' | 'ok';
}

/**
 * Least squares through the readings — a single bad reading moves the line
 * less than "first against last" would.
 */
export function slopePerDay(points: { day: number; v: number }[]): number | undefined {
  if (points.length < 2) return undefined;
  const span = points[points.length - 1].day - points[0].day;
  if (span < 30) return undefined;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.day, 0) / n;
  const my = points.reduce((s, p) => s + p.v, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.day - mx) ** 2, 0);
  if (!sxx) return undefined;
  return points.reduce((s, p) => s + (p.day - mx) * (p.v - my), 0) / sxx;
}

export function wireState(item: EquipmentItem, log: WireEntry[], today: string): WireState {
  const all = entriesFor(log, item.id);
  let from = 0;
  all.forEach((e, i) => { if (e.kind === 'renewed') from = i; });
  const renewed = all[from]?.kind === 'renewed' ? all[from] : undefined;
  const entries = renewed ? all.slice(from) : all;
  const since = renewed?.date ?? item.installedDate;

  const nominal = renewed?.diaNew ?? diaOf(item.diameter);
  const discardAssumed = !item.discardDia && nominal != null;
  const discardAt = item.discardDia ?? (nominal != null ? r1(nominal * (1 - DEFAULT_LOSS)) : undefined);

  const readings = entries.filter((e) => e.kind === 'inspect' && e.diameterMm != null && e.diameterMm > 0);
  const last = readings[readings.length - 1];
  const lossPct = nominal && last ? r1(Math.max(0, ((nominal - last.diameterMm!) / nominal) * 100)) : undefined;
  // The new rope counts as a reading at its nominal on the day it went in.
  const pts = [...(nominal && since ? [{ day: dayOf(since), v: nominal }] : []), ...readings.map((e) => ({ day: dayOf(e.date), v: e.diameterMm! }))]
    .sort((a, b) => a.day - b.day);
  const slope = slopePerDay(pts);
  const mmPerYear = slope != null ? r1(-slope * 365) : undefined;
  let discardOn: string | undefined;
  if (slope != null && slope < 0 && last && discardAt != null) {
    discardOn = last.diameterMm! <= discardAt ? last.date : isoOf(dayOf(last.date) + (last.diameterMm! - discardAt) / -slope);
  }

  const baseLength = renewed?.lengthM ?? item.ropeLength;
  const cutList = entries.filter((e) => e.kind === 'cutSlip' && e.cutM);
  const cutTotal = r1(cutList.reduce((s, e) => s + (e.cutM ?? 0), 0));
  const length = baseLength != null ? r1(baseLength - cutTotal) : undefined;

  const lastOf = (k: WireEntry['kind']) => [...entries].reverse().find((e) => e.kind === k);
  const look = lastOf('inspect');
  const brake = lastOf('brake');
  const retireOn = since && item.retireYears ? addMonths(since, Math.round(item.retireYears * 12)) : undefined;
  const years = since ? r1((dayOf(today) - dayOf(since)) / 365.25) : undefined;

  const issues: WireIssue[] = [];
  if (look?.rating === 'discard') issues.push('discard');
  if (last && discardAt != null && last.diameterMm! <= discardAt) issues.push('diameter');
  if (length != null && item.minLength != null && length < item.minLength) issues.push('length');
  if (retireOn && retireOn <= today) issues.push('age');
  if (brake && brake.brakeOk === false) issues.push('brake');
  if (look?.rating === 'poor') issues.push('poor');
  const ahead = isoOf(dayOf(today) + AHEAD_DAYS);
  if (!issues.includes('diameter')) {
    if (discardOn && discardOn <= ahead) issues.push('soon');
    else if (nominal && discardAt != null && last && nominal - last.diameterMm! >= 0.75 * (nominal - discardAt)) issues.push('nearDia');
  }
  if (!issues.includes('length') && length != null && item.minLength != null && length * 10 < item.minLength * 11) issues.push('nearLength');
  if (!issues.includes('age') && retireOn && retireOn <= ahead) issues.push('nearAge');

  return {
    since, nominal, discardAt, discardAssumed,
    ...(last ? { lastDia: last.diameterMm, lastDiaOn: last.date } : {}),
    lossPct, mmPerYear, discardOn,
    baseLength, cutTotal, cuts: cutList.length, length, minLength: item.minLength,
    endForEnd: lastOf('endForEnd')?.date,
    lubed: lastOf('lube')?.date,
    ...(brake ? { brake: { on: brake.date, ok: brake.brakeOk !== false } } : {}),
    ...(look ? { lastLook: { on: look.date, rating: look.rating, by: look.by } } : {}),
    retireOn, years, entries, issues,
    level: issues.some((i) => RED_ISSUES.includes(i)) ? 'red' : issues.length ? 'amber' : 'ok',
  };
}

/** Why a form cannot be signed, or null. */
export function wireProblem(e: Partial<WireEntry>, length?: number): string | null {
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return 'date';
  if (e.kind === 'inspect' && !e.rating) return 'rating';
  if (e.diameterMm != null && (!(e.diameterMm > 0) || e.diameterMm > 500)) return 'diameter';
  if (e.kind === 'cutSlip') {
    if (!(e.cutM! > 0) || (length != null && e.cutM! >= length)) return 'cut';
  }
  if (e.kind === 'brake' && e.brakeOk == null) return 'brake';
  if (e.kind === 'renewed' && !(e.lengthM! > 0) && !(e.diaNew! > 0) && !e.certNo?.trim()) return 'renewed';
  return null;
}

/**
 * A renewal starts the rope again on the item: put in on that day, its new
 * diameter and length, its certificate. Only what was given changes.
 */
export function renewItem(item: EquipmentItem, e: WireEntry, now: number): EquipmentItem {
  return {
    ...item,
    installedDate: e.date,
    ...(e.diaNew ? { diameter: `${e.diaNew} mm` } : {}),
    ...(e.lengthM ? { ropeLength: e.lengthM } : {}),
    ...(e.certNo?.trim() ? { testCertNo: e.certNo.trim() } : {}),
    updatedAt: now,
  };
}

/** The ropes worst first: red, then amber, then the rest; within each the least life left first. */
export function sortRopes<T extends { state: WireState; name: string }>(rows: T[]): T[] {
  const rank = { red: 0, amber: 1, ok: 2 } as const;
  return [...rows].sort((a, b) => rank[a.state.level] - rank[b.state.level] || (b.state.lossPct ?? -1) - (a.state.lossPct ?? -1) || a.name.localeCompare(b.name));
}

/** For the Board: which ropes are red and which amber, by name. */
export function wireBoard(items: EquipmentItem[], log: WireEntry[], today: string, liftingKeys: readonly string[], nameOf: (i: EquipmentItem) => string) {
  const red: string[] = [];
  const amber: string[] = [];
  for (const i of items) {
    if (!wireApplies(i, liftingKeys)) continue;
    const s = wireState(i, log, today);
    if (s.level === 'red') red.push(nameOf(i));
    else if (s.level === 'amber') amber.push(nameOf(i));
  }
  return { red, amber };
}
