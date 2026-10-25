// ===================================
// Hours of rest — the rules, as pure functions.
//
// MLC 2006 Reg. 2.3 and STCW Reg. VIII/1 (Code A-VIII/1) ask the same four
// things of a seafarer's rest, and this file checks those four:
//
//   24h    at least 10 hours of rest in ANY 24-hour period;
//   7d     at least 77 hours of rest in ANY 7-day period;
//   split  the 10 hours in no more than two periods, one of them at least
//          6 hours long;
//   gap    no more than 14 hours between consecutive periods of rest.
//
// "Any" period means rolling windows, not calendar days: a seafarer can have 10
// hours of rest on Monday and 10 on Tuesday and still go 20 hours without sleep
// across midnight. The windows here start on every half hour.
//
// HOW THE SPLIT RULE IS READ. Inside a rolling window a night's sleep is cut by
// the window's edges, so simply counting the rest periods in it would flag
// nearly every watchkeeper. The rule is read instead as the regulation is meant:
// the window must contain one rest period of at least 6 hours, and its two
// longest rest periods together must reach the 10 hours — rest that only adds up
// to 10 hours when you collect five scraps of it is a breach.
//
// THESE ARE INDICATIVE. Flags may allow exceptions (drills, emergencies, a
// collective agreement under STCW A-VIII/1 para 9), and the officer judges
// those. The app shows what the record says; it does not decide what the flag
// will accept.
//
// A day with no record is unknown. A window that touches an unknown day is not
// judged at all — neither passed nor failed — because a gap in the record is a
// different problem from a breach and is reported as "not recorded".
// ===================================

import { RestDay, SLOTS_PER_DAY, slotLabel } from '../types/rest';
import { ShipClockInfo, clockChanges, shipAndUtcAt, shipInstantAt } from '../utils/shipTime';

export type RestRule = '24h' | '7d' | 'split' | 'gap';

export interface RestViolation {
  rule: RestRule;
  /** Date the breach is attributed to (yyyy-mm-dd). */
  date: string;
  detail: string;
}

export interface RestDaySummary {
  date: string;
  recorded: boolean;
  restHours: number;
  workHours: number;
  /** 23 or 25 — only on the day the ship's clocks changed. */
  dayHours?: number;
  /** Least rest found in any 24h window starting on this day (hours), if judged. */
  minRest24h?: number;
  violations: RestViolation[];
}

const H = 2; // slots per hour
const DAY = SLOTS_PER_DAY;
const WEEK = DAY * 7;

export const RULES = {
  minRest24h: 10,
  minRest7d: 77,
  longestPeriod: 6,
  maxPeriods: 2,
  maxWorkStretch: 14,
} as const;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---- Days of 23 and 25 hours (25 Oct 2026) ---------------------------------
//
// The day a ship's clocks go back has 25 hours of real time, the day they go
// forward 23. A record keeps one character per REAL half hour — 50 or 46 then —
// so the rules, which are about real hours of rest, count what happened. Each
// slot carries the wall-clock label it showed: the repeated hour appears twice,
// the skipped hour not at all.

const STD = Array.from({ length: SLOTS_PER_DAY }, (_, i) => slotLabel(i));
const HALF = 1800000;

/** The wall-clock label of each real half hour of a ship's day. */
export function dayLabels(date: string, clock?: ShipClockInfo | null): string[] {
  if (!clock || !clockChanges(clock).length) return STD;
  const from = shipInstantAt(date, '00:00', clock);
  const to = shipInstantAt(addDays(date, 1), '00:00', clock);
  const n = Math.round((to - from) / HALF);
  if (n === SLOTS_PER_DAY && shipAndUtcAt(from, clock).ship.slice(11) === '00:00') {
    const labels = Array.from({ length: n }, (_, j) => half(shipAndUtcAt(from + j * HALF, clock).ship.slice(11)));
    if (labels.every((l, i) => l === STD[i])) return STD;
    return labels;
  }
  return Array.from({ length: n }, (_, j) => half(shipAndUtcAt(from + j * HALF, clock).ship.slice(11)));
}

/** "02:17" → "02:00": a slot is named by the half hour it starts in. */
const half = (hhmm: string) => `${hhmm.slice(0, 2)}:${Number(hhmm.slice(3, 5)) < 30 ? '00' : '30'}`;

/** The 48-slot position of a wall-clock label. */
export const wallIndex = (label: string) => Number(label.slice(0, 2)) * 2 + (label.slice(3) === '30' ? 1 : 0);

/**
 * A stored day fitted to the day's real half hours. A 48-slot record (made
 * before the change was planned, or on an older app) takes the repeated hour
 * twice and drops the skipped one.
 */
export function fitDay(work: string, labels: string[]): string {
  if (work.length === labels.length) return work;
  if (work.length === SLOTS_PER_DAY) return labels.map((l) => (work[wallIndex(l)] === '1' ? '1' : '0')).join('');
  return (work + '0'.repeat(labels.length)).slice(0, labels.length);
}

/**
 * The day on the paper form's 48 columns: '1' worked in that wall half hour
 * (either time, if it came twice), '0' rest, 'x' a half hour the clocks skipped.
 */
export function toWall(work: string, labels: string[]): string {
  const out: string[] = new Array(SLOTS_PER_DAY).fill('x');
  labels.forEach((l, i) => {
    const w = wallIndex(l);
    out[w] = work[i] === '1' || out[w] === '1' ? '1' : '0';
  });
  return out.join('');
}

export function hours(slots: number): number {
  return slots / H;
}

/** Rest periods inside slots[from, to) as lengths in slots, edges clipped. */
function restRuns(timeline: (0 | 1 | null)[], from: number, to: number): number[] {
  const runs: number[] = [];
  let run = 0;
  for (let i = from; i < to; i++) {
    if (timeline[i] === 0) run += 1;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  if (run) runs.push(run);
  return runs;
}

/**
 * Check one person's days. `days` may be any subset, in any order, of one
 * person's records; `from`..`to` (inclusive) is the range reported on.
 */
export function analyseRest(days: RestDay[], from: string, to: string, ship?: ShipClockInfo | null): RestDaySummary[] {
  // A timeline from a week before `from` (so the 7-day windows at the start of
  // the month can be judged) to a day after `to` (for 24h windows that start on
  // the last day and run into the next).
  const start = addDays(from, -6);
  const end = addDays(to, 1);
  const nDays = daysBetween(start, end) + 1;
  const byDate = new Map(days.map((d) => [d.date, d]));

  // Each day as many real half hours as it had — 46, 48 or 50.
  const labelsOf: string[][] = [];
  const dayStart: number[] = [];
  let len = 0;
  for (let di = 0; di < nDays; di++) {
    const l = dayLabels(addDays(start, di), ship);
    labelsOf.push(l);
    dayStart.push(len);
    len += l.length;
  }
  const timeline: (0 | 1 | null)[] = new Array(len).fill(null);
  for (let di = 0; di < nDays; di++) {
    const rec = byDate.get(addDays(start, di));
    if (!rec) continue;
    const work = fitDay(rec.work, labelsOf[di]);
    for (let s = 0; s < work.length; s++) timeline[dayStart[di] + s] = work[s] === '1' ? 1 : 0;
  }
  const dayOf = (slot: number) => {
    let d = 0;
    while (d + 1 < dayStart.length && dayStart[d + 1] <= slot) d++;
    return d;
  };

  // Prefix sums of rest and of unknown slots — every window is then O(1).
  const restPre = new Array(timeline.length + 1).fill(0);
  const unkPre = new Array(timeline.length + 1).fill(0);
  for (let i = 0; i < timeline.length; i++) {
    restPre[i + 1] = restPre[i] + (timeline[i] === 0 ? 1 : 0);
    unkPre[i + 1] = unkPre[i] + (timeline[i] === null ? 1 : 0);
  }
  const rest = (a: number, b: number) => restPre[b] - restPre[a];
  const known = (a: number, b: number) => a >= 0 && b <= timeline.length && unkPre[b] - unkPre[a] === 0;

  // Every run of work longer than the limit, with the day it ends on.
  const gaps: { len: number; endDay: number }[] = [];
  {
    let run = 0;
    for (let i = 0; i <= timeline.length; i++) {
      if (i < timeline.length && timeline[i] === 1) run += 1;
      else {
        if (run > RULES.maxWorkStretch * H) gaps.push({ len: run, endDay: dayOf(i - 1) });
        run = 0;
      }
    }
  }

  const out: RestDaySummary[] = [];
  const reportFrom = daysBetween(start, from);
  const reportTo = daysBetween(start, to);

  for (let di = reportFrom; di <= reportTo; di++) {
    const date = addDays(start, di);
    const rec = byDate.get(date);
    const base = dayStart[di];
    const n = labelsOf[di].length;
    const at = (slot: number) => labelsOf[di][slot - base] ?? clock(slot - base);
    const summary: RestDaySummary = {
      date,
      recorded: !!rec,
      restHours: rec ? hours(rest(base, base + n)) : 0,
      workHours: rec ? hours(n - rest(base, base + n)) : 0,
      ...(n !== DAY ? { dayHours: n / H } : {}),
      violations: [],
    };
    if (!rec) {
      out.push(summary);
      continue;
    }

    // 24h and split — windows starting on each half hour of this day. Only the
    // worst window of each kind is reported, so one bad night is one line.
    let min24: number | null = null;
    let minAt = 0;
    let splitBad: { at: number; longest: number; two: number } | null = null;
    for (let s = base; s < base + n; s++) {
      if (!known(s, s + DAY)) continue;
      const r = rest(s, s + DAY);
      if (min24 === null || r < min24) {
        min24 = r;
        minAt = s;
      }
      if (r >= RULES.minRest24h * H) {
        const runs = restRuns(timeline, s, s + DAY).sort((a, b) => b - a);
        const longest = runs[0] ?? 0;
        const two = (runs[0] ?? 0) + (runs[1] ?? 0);
        if ((longest < RULES.longestPeriod * H || two < RULES.minRest24h * H) && !splitBad) {
          splitBad = { at: s, longest, two };
        }
      }
    }
    if (min24 !== null) {
      summary.minRest24h = hours(min24);
      if (min24 < RULES.minRest24h * H) {
        summary.violations.push({
          rule: '24h',
          date,
          detail: `${hours(min24)} h rest in the 24 h from ${at(minAt)} (minimum ${RULES.minRest24h})`,
        });
      }
    }
    if (splitBad) {
      summary.violations.push({
        rule: 'split',
        date,
        detail:
          splitBad.longest < RULES.longestPeriod * H
            ? `longest rest ${hours(splitBad.longest)} h in the 24 h from ${at(splitBad.at)} (one period must be at least ${RULES.longestPeriod} h)`
            : `rest split into more than two periods in the 24 h from ${at(splitBad.at)}`,
      });
    }

    // 7 days — the window ending at the end of this day, and every window ending
    // inside it, judged only when all seven days are recorded.
    let min7: number | null = null;
    for (let e = base + 1; e <= base + n; e++) {
      const s = e - WEEK;
      if (!known(s, e)) continue;
      const r = rest(s, e);
      if (min7 === null || r < min7) min7 = r;
    }
    if (min7 !== null && min7 < RULES.minRest7d * H) {
      summary.violations.push({
        rule: '7d',
        date,
        detail: `${hours(min7)} h rest in 7 days (minimum ${RULES.minRest7d})`,
      });
    }

    // Gap — a stretch of work longer than 14 h, reported on the day it ENDS.
    for (const g of gaps) {
      if (g.endDay === di) {
        summary.violations.push({
          rule: 'gap',
          date,
          detail: `${hours(g.len)} h without rest (maximum ${RULES.maxWorkStretch})`,
        });
      }
    }

    out.push(summary);
  }
  return out;
}

function clock(slot: number): string {
  const s = ((slot % DAY) + DAY) % DAY;
  return `${String(Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
}

// ---- Editing helpers --------------------------------------------------------

/** Set slots [from, to) to work ('1') or rest ('0'). */
export function paint(work: string, from: number, to: number, isWork: boolean): string {
  const a = work.split('');
  for (let i = Math.max(0, from); i < Math.min(a.length, to); i++) a[i] = isWork ? '1' : '0';
  return a.join('');
}

/** Common patterns, as work hours [from, to) in whole/half hours. */
export const REST_PRESETS: { key: string; label: string; work: [number, number][] }[] = [
  { key: 'day', label: 'Day work 08–17', work: [[8, 12], [13, 17]] },
  { key: 'w04', label: 'Watch 00–04 / 12–16', work: [[0, 4], [12, 16]] },
  { key: 'w48', label: 'Watch 04–08 / 16–20', work: [[4, 8], [16, 20]] },
  { key: 'w812', label: 'Watch 08–12 / 20–24', work: [[8, 12], [20, 24]] },
  { key: 'off', label: 'Day off', work: [] },
];

/** A pattern laid on the day's half hours by the clock — the repeated hour worked twice if it falls in a watch. */
export function presetWork(key: string, labels: string[] = STD): string {
  const p = REST_PRESETS.find((x) => x.key === key);
  return labels.map((l) => (p?.work ?? []).some(([a, b]) => wallIndex(l) >= a * 2 && wallIndex(l) < b * 2) ? '1' : '0').join('');
}

export function countWork(work: string): number {
  let n = 0;
  for (const c of work) if (c === '1') n += 1;
  return n;
}

export const RULE_LABEL: Record<RestRule, string> = {
  '24h': '10 h in 24 h',
  '7d': '77 h in 7 days',
  split: 'Rest periods',
  gap: '14 h between rest',
};
