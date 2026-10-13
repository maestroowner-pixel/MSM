// ===================================
// The data of an inspection report, without the printing — so the round's report
// and the period name can be built and tested outside the app (check:rounds).
// services/inspectionReport.ts turns it into the PDF and the spreadsheet.
// ===================================

import { CategoryKey, EquipmentItem, Group } from '../types/equipment';
import { Inspection, InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { InspectionRound } from '../types/round';
import { signatureLine } from '../types/crew';
import { CATEGORY_MAP } from '../constants/categories';
import * as inspections from './inspections';
import { roundProgress } from './rounds';
import { formatDate } from '../utils/dates';

export type ReportScope = Group | 'ALL';

export interface ReportData {
  title: string;
  windowLabel: string;
  scope: ReportScope;
  period: InspectionPeriod;
  /** The categories the report was narrowed to, if it was (see ReportOptions). */
  categories?: CategoryKey[];
  /** Items the period's round applies to. */
  inScope: EquipmentItem[];
  /** Signed in the window, newest first. */
  done: Inspection[];
  /** In scope, with nothing signed in the window. */
  missed: EquipmentItem[];
  /** Open defects on in-scope items, whenever they were raised. */
  defects: Inspection[];
  /** Whether every in-scope item was inspected in the window. */
  completed: boolean;
  /** Pass/fail of the round: each item judged by its LATEST record in the window,
   *  so an item that failed and was re-inspected clean is not held against it.
   *  null while nothing has been signed. */
  passed: boolean | null;
  /** "September 2026 Monthly Inspection – Completed – Passed": the line a vessel
   *  files as its evidence in the PMS, stated rather than left to be worked out. */
  headline: string;
  /** "September 2026" / "Week 37 · 07–13 Sep 2026" — English and locale-proof,
   *  because a report handed to a surveyor should not change language with the
   *  browser it was printed from. */
  periodName: string;
  /** The round this report is of, with its final sign-off when it is closed. */
  round?: InspectionRound;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MON = MONTH_NAMES.map((m) => m.slice(0, 3));

/** ISO-8601 week number of a local date. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function periodNameFor(period: InspectionPeriod, from: number, to: number): string {
  const a = new Date(from);
  if (period === 'annual') return String(a.getFullYear());
  // "Q3 2026 · Jul–Sep": the quarter is what the SMS and the superintendent call
  // it, the months are what anyone reading the file wants to see.
  if (period === 'quarterly') {
    const q = Math.floor(a.getMonth() / 3);
    return `Q${q + 1} ${a.getFullYear()} · ${MON[q * 3]}–${MON[q * 3 + 2]}`;
  }
  if (period !== 'weekly') return `${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
  const b = new Date(to - 1);
  const dd = (x: Date) => String(x.getDate()).padStart(2, '0');
  const range =
    a.getMonth() === b.getMonth()
      ? `${dd(a)}–${dd(b)} ${MON[b.getMonth()]} ${b.getFullYear()}`
      : `${dd(a)} ${MON[a.getMonth()]} – ${dd(b)} ${MON[b.getMonth()]} ${b.getFullYear()}`;
  return `Week ${isoWeek(a)} · ${range}`;
}

export function buildRoundReport(flat: EquipmentItem[], trail: Inspection[], round: InspectionRound): ReportData {
  const p = roundProgress(round, flat, trail);
  const order = new Map(p.scope.map((it, i) => [it.id, i]));
  const scopeIds = new Set(order.keys());
  // Every inspection signed in the round, in walking order (newest first within an item).
  const done = trail
    .filter((i) => i.roundId === round.id && scopeIds.has(i.itemId))
    .sort((a, b) => order.get(a.itemId)! - order.get(b.itemId)! || b.at - a.at);
  const passed = p.done.size ? ![...p.done.values()].some((i) => i.outcome === 'fail') : null;
  const completed = p.scope.length > 0 && p.outstanding.length === 0;
  const periodName = periodNameFor(round.period, round.from, round.to);
  const cats = round.categories.map((k) => CATEGORY_MAP[k]).filter(Boolean);
  const what = cats.length === 1 ? cats[0].label : cats.length <= 4 ? cats.map((c) => c.short).join(', ') : `${cats.length} categories`;
  return {
    title: `${PERIOD_LABEL[round.period]} Inspection Round Report — ${what}`,
    windowLabel: round.label,
    scope: 'ALL',
    period: round.period,
    categories: round.categories,
    inScope: p.scope,
    done,
    missed: p.outstanding,
    defects: inspections.openDefects(trail).filter((i) => scopeIds.has(i.itemId)),
    completed,
    passed,
    headline: [
      `${periodName} ${PERIOD_LABEL[round.period]} Inspection Round`,
      !p.scope.length ? 'Nothing in scope' : completed ? 'Completed' : `Incomplete (${p.done.size} of ${p.scope.length} inspected)`,
      passed == null ? null : passed ? 'Passed' : 'Failed',
      round.closedAt ? 'Signed off' : 'Open',
    ].filter(Boolean).join(' – '),
    periodName,
    round,
  };
}

const proofShort = (p?: { method?: string }) => (!p ? '' : p.method === 'biometric' ? 'signed biometrically' : p.method === 'drawn' ? 'signed by hand' : 'signed by PIN');

/** The round's final sign-off as one line, for the PDF and the spreadsheet. */
export function roundSignoffLine(r: InspectionRound): string {
  if (!r.closedAt) return '';
  const d = new Date(r.closedAt);
  const when = `${formatDate(d.toISOString().slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return [`${signatureLine(r.closedBy ?? '', r.closedByRank)}`, when, r.closedWith ? proofShort(r.closedWith) : null].filter(Boolean).join(' · ');
}
