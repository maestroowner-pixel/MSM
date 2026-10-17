// ===================================
// Security rounds and the key register — the rules, pure (types/patrols.ts,
// types/keys.ts). `npm run check:patrols` runs them in node.
//
// A round is DUE at each of its plan's times. It counts as done for that time
// when a round of the plan was finished for it (the watch picks the time when
// starting; the app offers the nearest one). A due time with none is MISSED —
// the daily and monthly reports print both, with who did what.
// ===================================

import { Checkpoint, Patrol, PatrolKind, PatrolPlan } from '../types/patrols';
import { KeyItem, KeyMove } from '../types/keys';

// ---- codes ------------------------------------------------------------------

/** The next free ID with this prefix: CP-01, CP-02… / K-01… */
export function nextCode(prefix: string, taken: { code: string }[]): string {
  const set = new Set(taken.map((t) => t.code.toUpperCase()));
  for (let n = 1; ; n++) {
    const c = `${prefix}${String(n).padStart(2, '0')}`;
    if (!set.has(c)) return c;
  }
}

// ---- the plans the app starts from ------------------------------------------------

/** A typical yacht's places to visit — offered once, then the vessel's own. */
export const STARTER_CHECKPOINTS: { name: string; location: string }[] = [
  { name: 'Gangway / passerelle', location: 'Main deck aft' },
  { name: 'Swim platform and tender garage', location: 'Aft, waterline' },
  { name: 'Aft deck', location: 'Main deck aft' },
  { name: 'Foredeck and anchor', location: 'Bow' },
  { name: 'Bridge', location: 'Bridge deck' },
  { name: 'Engine room entrance', location: 'Lower deck' },
  { name: 'Galley and stores', location: 'Main deck' },
  { name: 'Crew mess and crew corridor', location: 'Lower deck' },
];

const plan = (id: string, name: string, kind: PatrolKind, times: string[], duties: string[]): PatrolPlan => ({ id, name, kind, times, checkpointIds: [], duties, updatedAt: 0 });

export const STARTER_PLANS: PatrolPlan[] = [
  plan('patrol.opening', 'Morning opening round', 'opening', ['07:00'], [
    'Check the gangway / passerelle and its lighting are safe; put out the visitor log',
    'Open the agreed doors and hatches only — the rest stay locked',
    'Check moorings, fenders and the tender are secure',
    'Look for anything left out or changed overnight; report it to the OOW',
  ]),
  plan('patrol.daytime', 'Daytime round', 'daytime', ['10:00', '13:00', '16:00'], [
    'Check access points: nobody aboard who should not be',
    'Check moorings, fenders and the gangway',
    'Check for fire, flooding, smells, leaks or alarms',
    'Doors and hatches that should be closed are closed',
  ]),
  plan('patrol.closing', 'Evening closing round', 'closing', ['21:00'], [
    'Lock the agreed external doors and hatches; secure the tender garage',
    'Gangway raised or watched; deck lights on as required',
    'Galley appliances off; no smouldering ashtrays',
    'Visitors all signed off; report anything unusual to the OOW',
  ]),
];

// ---- what is due ------------------------------------------------------------------

const mins = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Plans in use, their times sorted. */
export const livePlans = (plans: PatrolPlan[]) => plans.filter((p) => !p.off).map((p) => ({ ...p, times: [...p.times].filter((t) => Number.isFinite(mins(t))).sort((a, b) => mins(a) - mins(b)) }));

export interface DueRound {
  plan: PatrolPlan;
  slot: string;
  done?: Patrol;
  /** Not done, and its time (plus the grace) has not passed yet — not missed. */
  pending?: boolean;
}

/** How long after its time a round not done counts as missed. */
export const GRACE_MIN = 120;

/**
 * Every round due on a date and the one that covered it. `now` (the date and
 * "HH:MM" of now) marks today's rounds whose time has not passed as pending.
 */
export function dayRounds(date: string, plans: PatrolPlan[], patrols: Patrol[], now?: { date: string; hhmm: string }): DueRound[] {
  const out: DueRound[] = [];
  for (const p of livePlans(plans)) {
    for (const slot of p.times) {
      const done = patrols.filter((x) => x.planId === p.id && x.date === date && x.slot === slot).sort((a, b) => a.finishedAt - b.finishedAt)[0];
      const pending = !done && !!now && (date > now.date || (date === now.date && mins(slot) + GRACE_MIN > mins(now.hhmm)));
      out.push({ plan: p, slot, done, ...(pending ? { pending } : {}) });
    }
  }
  return out.sort((a, b) => mins(a.slot) - mins(b.slot));
}

/**
 * The time a round started now is for: the latest due time not yet done that
 * is no more than an hour ahead, else the next one. Null for a plan with no times.
 */
export function slotFor(p: PatrolPlan, nowHhmm: string, doneSlots: string[]): string | null {
  const now = mins(nowHhmm);
  const open = livePlans([p])[0]?.times.filter((t) => !doneSlots.includes(t)) ?? [];
  if (!open.length) return null;
  const past = open.filter((t) => mins(t) <= now + 60);
  return past.length ? past[past.length - 1] : open[0];
}

/** The checkpoints of a round not visited. */
export function missedPoints(p: PatrolPlan, points: Checkpoint[], visited: string[]): Checkpoint[] {
  return p.checkpointIds.map((id) => points.find((c) => c.id === id && !c.deleted)).filter((c): c is Checkpoint => !!c && !visited.includes(c.id));
}

/** Rounds of a month, day by day: due, done, missed; and the missed checkpoints. */
export function monthSummary(month: string, plans: PatrolPlan[], patrols: Patrol[], today: string, nowHhmm = '23:59') {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows: { date: string; due: number; done: number; missed: string[]; points: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > today) break;
    const r = dayRounds(date, plans, patrols, { date: today, hhmm: nowHhmm }).filter((x) => !x.pending);
    rows.push({
      date,
      due: r.length,
      done: r.filter((x) => x.done).length,
      missed: r.filter((x) => !x.done).map((x) => `${x.slot} ${x.plan.name}`),
      points: r.reduce((n, x) => n + (x.done?.missed.length ?? 0), 0),
    });
  }
  return rows;
}

// ---- keys -----------------------------------------------------------------------

/** Each key's last move — where it is now. A key never moved is on the board. */
export function keyStatus(keys: KeyItem[], moves: KeyMove[]): Map<string, KeyMove | undefined> {
  const out = new Map<string, KeyMove | undefined>();
  const sorted = [...moves].sort((a, b) => a.at - b.at);
  for (const k of keys) out.set(k.id, undefined);
  for (const mv of sorted) if (out.has(mv.keyId)) out.set(mv.keyId, mv);
  return out;
}

/** Keys out now, longest out first, with how many days. */
export function keysOut(keys: KeyItem[], moves: KeyMove[], now: number) {
  const st = keyStatus(keys.filter((k) => !k.deleted), moves);
  return keys
    .filter((k) => !k.deleted && st.get(k.id)?.dir === 'out')
    .map((k) => ({ key: k, move: st.get(k.id)!, days: Math.floor((now - st.get(k.id)!.at) / 86_400_000) }))
    .sort((a, b) => a.move.at - b.move.at);
}
