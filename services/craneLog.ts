// ===================================
// Crane operator's log — the pure half (types/craneLog.ts): what a new entry
// must have, what stands once voided entries are taken out, and the
// experience statement — per crane, hours, lifts, days, the kinds of work and
// the dates — for one operator over a period. `npm run check:cranelog`.
// ===================================

import type { EquipmentItem } from '../types/equipment';
import { CRANE_OPS, CRANE_OP_EN, CRANE_TEST_EN, CRANE_TEST_KINDS, CraneEntry, CraneOp, CraneSnap, CraneTest, CraneTestKind } from '../types/craneLog';

/** The categories whose items are worked from a control position. */
export const CRANE_CATEGORIES = ['cranes'];

export const MAX_HOURS = 24;

/** The crane as it is on the register now — copied onto the entry. */
export function craneSnap(item: Pick<EquipmentItem, 'type' | 'make' | 'no' | 'position' | 'swl'>): CraneSnap {
  const label = [item.type || item.make || 'Crane', item.no != null && String(item.no).trim() ? `No. ${item.no}` : null, item.position?.trim() || null].filter(Boolean).join(' · ');
  return { label, ...(item.make?.trim() ? { make: item.make.trim() } : {}), ...(item.type?.trim() ? { type: item.type.trim() } : {}), ...(item.swl?.trim() ? { swl: item.swl.trim() } : {}) };
}

/** "2,5" / "2.5" → 2.5, rounded to the half hour; anything else → undefined. */
export function hoursOf(s: string): number | undefined {
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 2) / 2;
}

export type CraneProblem = 'hours' | 'tooMany' | 'ops' | 'lifts' | 'operator' | 'future';

export function entryProblem(e: Pick<CraneEntry, 'hours' | 'ops' | 'lifts' | 'crewId' | 'date'>, today: string): CraneProblem | null {
  if (!e.crewId) return 'operator';
  if (!(e.hours > 0)) return 'hours';
  if (e.hours > MAX_HOURS) return 'tooMany';
  if (e.date > today) return 'future';
  if (!e.ops.length) return 'ops';
  if (e.lifts != null && (!Number.isInteger(e.lifts) || e.lifts < 0)) return 'lifts';
  return null;
}

/** Entries that stand: neither a voiding entry nor one it voided. */
export function standing(all: CraneEntry[]): CraneEntry[] {
  const voided = new Set(all.filter((e) => e.voids).map((e) => e.voids!));
  return all.filter((e) => !e.voids && !voided.has(e.id));
}

export interface CraneTotal {
  itemId: string;
  crane: CraneSnap;
  hours: number;
  lifts: number;
  /** Entries without a lift count — the total is then "at least". */
  uncounted: number;
  days: number;
  ops: CraneOp[];
  first: string;
  last: string;
}

/** One operator's time per crane over [from, to], most hours first. */
export function operatorTotals(all: CraneEntry[], crewId: string, from = '0000-00-00', to = '9999-99-99'): CraneTotal[] {
  const by = new Map<string, CraneEntry[]>();
  for (const e of standing(all)) {
    if (e.crewId !== crewId || e.date < from || e.date > to) continue;
    by.set(e.itemId, [...(by.get(e.itemId) ?? []), e]);
  }
  return [...by.entries()]
    .map(([itemId, l]) => {
      const sorted = [...l].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
      const latest = [...l].sort((a, b) => b.at - a.at)[0];
      const ops = CRANE_OPS.filter((o) => l.some((e) => e.ops.includes(o)));
      return {
        itemId,
        crane: latest.crane,
        hours: l.reduce((n, e) => n + e.hours, 0),
        lifts: l.reduce((n, e) => n + (e.lifts ?? 0), 0),
        uncounted: l.filter((e) => e.lifts == null).length,
        days: new Set(l.map((e) => e.date)).size,
        ops,
        first: sorted[0].date,
        last: sorted[sorted.length - 1].date,
      };
    })
    .sort((a, b) => b.hours - a.hours || a.crane.label.localeCompare(b.crane.label));
}

/** Everyone who has a standing entry, with their hours — the list to pick an operator from. */
export function operators(all: CraneEntry[], tests: CraneTest[] = []): { crewId: string; name: string; rank?: string; hours: number; last: string }[] {
  const m = new Map<string, { crewId: string; name: string; rank?: string; hours: number; last: string; at: number }>();
  // Someone who has only worked a load test still gets a statement.
  for (const x of tests) if (x.crewId && x.name && !m.has(x.crewId)) m.set(x.crewId, { crewId: x.crewId, name: x.name, ...(x.rank ? { rank: x.rank } : {}), hours: 0, last: x.date, at: 0 });
  for (const e of standing(all)) {
    const o = m.get(e.crewId);
    if (!o) m.set(e.crewId, { crewId: e.crewId, name: e.name, ...(e.rank ? { rank: e.rank } : {}), hours: e.hours, last: e.date, at: e.at });
    else {
      o.hours += e.hours;
      if (e.date > o.last) o.last = e.date;
      if (e.at > o.at) Object.assign(o, { name: e.name, rank: e.rank, at: e.at });
    }
  }
  return [...m.values()].map(({ at: _at, ...o }) => o).sort((a, b) => b.hours - a.hours);
}

const dmy = (iso: string) => iso.split('-').reverse().join('.');
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export interface StatementInput {
  name: string;
  rank?: string;
  vesselName?: string;
  imo?: string;
  flag?: string;
  from: string;
  to: string;
  today: string;
  signatory?: { name: string; rank?: string };
}

/** The experience statement's pages, pure — the PDF draws them. */
export function statementPages(all: CraneEntry[], crewId: string, x: StatementInput, tests: CraneTest[] = []) {
  const rows = operatorTotals(all, crewId, x.from, x.to);
  const hours = rows.reduce((n, r) => n + r.hours, 0);
  const days = new Set(standing(all).filter((e) => e.crewId === crewId && e.date >= x.from && e.date <= x.to).map((e) => e.date)).size;
  const facts = [
    `${x.name}${x.rank ? `, ${x.rank}` : ''}`,
    [x.vesselName, x.imo ? `IMO ${x.imo}` : null, x.flag ? `flag ${x.flag}` : null].filter(Boolean).join(', '),
    `${dmy(x.from)} – ${dmy(x.to)}`,
    `${num(hours)} hours at the controls on ${days} day${days === 1 ? '' : 's'}, ${rows.length} crane${rows.length === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const cranes = {
    title: 'Cranes operated',
    head: ['Crane', 'Make', 'Type', 'SWL', 'Hours', 'Lifts', 'Days', 'Work', 'From', 'To'],
    rows: rows.map((r) => [r.crane.label, r.crane.make ?? '', r.crane.type ?? '', r.crane.swl ?? '', num(r.hours), r.uncounted && r.lifts ? `${r.lifts}+` : r.uncounted ? '—' : String(r.lifts), String(r.days), r.ops.map((o) => CRANE_OP_EN[o]).join('; '), dmy(r.first), dmy(r.last)]),
    widths: { 0: 42, 1: 24, 2: 30, 3: 18, 4: 13, 5: 13, 6: 11, 7: 60, 8: 19, 9: 19 },
  };
  const log = {
    title: 'Entries',
    head: ['Date', 'Crane', 'SWL', 'Hours', 'Lifts', 'Work', 'Heaviest', 'Confirmed by'],
    rows: standing(all)
      .filter((e) => e.crewId === crewId && e.date >= x.from && e.date <= x.to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at)
      .map((e) => [dmy(e.date), e.crane.label, e.crane.swl ?? '', num(e.hours), e.lifts != null ? String(e.lifts) : '—', e.ops.map((o) => CRANE_OP_EN[o]).join('; '), e.heaviest ?? '', `${e.by}${e.byRank ? `, ${e.byRank}` : ''}`]),
    widths: { 0: 19, 1: 50, 2: 20, 3: 13, 4: 13, 5: 70, 6: 22, 7: 50 },
  };
  const sign = {
    title: 'Confirmed',
    head: ['', 'Name', 'Rank', 'Signature and ship\'s stamp', 'Date'],
    rows: [['Master', x.signatory?.name ?? '', x.signatory?.rank ?? 'Master', '', dmy(x.today)]],
    widths: { 0: 25, 1: 60, 2: 40, 3: 90, 4: 25 },
  };
  // The days actually worked, not the period asked for: the Master signs what happened.
  const mine = tests.filter((t) => t.crewId === crewId && t.date >= x.from && t.date <= x.to).sort((a, b) => a.date.localeCompare(b.date));
  const worked = [...rows.flatMap((r) => [r.first, r.last]), ...mine.map((t) => t.date)].sort();
  const first = worked[0] ?? x.from;
  const last = worked[worked.length - 1] ?? x.to;
  const statement = `This is to confirm that ${x.name} operated the cranes below aboard ${x.vesselName || 'this vessel'} between ${dmy(first)} and ${dmy(last)}, as recorded day by day in the vessel's crane log and confirmed by the officer named against each entry.`;
  const tested = {
    title: 'Load tests operated',
    head: ['Date', 'Crane', 'SWL', 'Test', 'Test load', 'Result', 'Examiner', 'Certificate'],
    rows: mine.map((t) => [dmy(t.date), t.crane.label, t.crane.swl ?? '', CRANE_TEST_EN[t.kind], [t.testLoad, t.pctSwl ? `${t.pctSwl}% SWL` : null, t.radius ? `at ${t.radius}` : null].filter(Boolean).join(', '), t.result === 'pass' ? 'Passed' : 'Failed', t.examiner ?? '', t.certNo ?? '']),
    widths: { 0: 19, 1: 45, 2: 18, 3: 55, 4: 35, 5: 15, 6: 45, 7: 25 },
  };
  return [{ title: 'Crane operator — experience statement', facts: [...facts, statement], tables: [cranes, ...(mine.length ? [tested] : []), sign, log] }];
}

// ---- Load tests ----------------------------------------------------------------

export type TestProblem = 'crane' | 'date' | 'future' | 'pct' | 'due';

export function testProblem(x: Pick<CraneTest, 'itemId' | 'date' | 'pctSwl' | 'nextDue'>, today: string): TestProblem | null {
  if (!x.itemId) return 'crane';
  if (!x.date) return 'date';
  if (x.date > today) return 'future';
  if (x.pctSwl != null && !(x.pctSwl > 0 && x.pctSwl <= 300)) return 'pct';
  if (x.nextDue && x.nextDue <= x.date) return 'due';
  return null;
}

/**
 * The register item after a test. A pass writes the certificate number and moves the
 * crane's next inspection: a due date on or before the test is discharged and takes the
 * test's next due; a later due date is never pushed further out (a five-yearly test
 * does not excuse next year's annual). A failed test changes nothing on the item.
 */
export function applyTest(item: EquipmentItem, x: CraneTest, now: number): EquipmentItem | null {
  if (x.result !== 'pass') return null;
  const cur = item.nextInspection;
  const next = !x.nextDue ? cur : !cur || cur <= x.date ? x.nextDue : x.nextDue < cur ? x.nextDue : cur;
  const cert = x.certNo?.trim();
  if (next === cur && (!cert || cert === item.testCertNo)) return null;
  return { ...item, ...(next ? { nextInspection: next } : {}), ...(cert ? { testCertNo: cert } : {}), updatedAt: now };
}

export interface TestDue {
  kind: CraneTestKind;
  last: CraneTest;
  /** Next due, from the last test of this kind that gave one. */
  due?: string;
  level: 'red' | 'amber' | 'ok';
}

/** Per crane, the last test of each kind and when the next is due, worst first. */
export function testsDue(tests: CraneTest[], itemId: string, today: string): TestDue[] {
  const mine = tests.filter((x) => x.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);
  return CRANE_TEST_KINDS.flatMap((k) => {
    const of = mine.filter((x) => x.kind === k);
    if (!of.length) return [];
    const due = of.find((x) => x.result === 'pass' && x.nextDue)?.nextDue;
    // A failed last test is red whatever the date: the crane has not passed since.
    const level: TestDue['level'] = of[0].result === 'fail' || (due && due < today) ? 'red' : due && due <= soon ? 'amber' : 'ok';
    return [{ kind: k, last: of[0], ...(due ? { due } : {}), level }];
  }).sort((a, b) => ({ red: 0, amber: 1, ok: 2 })[a.level] - ({ red: 0, amber: 1, ok: 2 })[b.level]);
}
