// ===================================
// Inspections — creating a signed record, and reading the trail back.
//
// The store itself is in services/storage.ts (one key, append-only). This file
// is the domain layer on top: it builds a record, and answers the questions the
// screens and reports actually ask — what has this item had done to it, what is
// still owed this month, what defects are open.
//
// Everything here except `create` is a pure function over an already-loaded
// array. The whole trail lives in memory via DataContext (it is small — a few
// hundred bytes per record), so a history list or a monthly report is a filter,
// not a round trip through AsyncStorage.
// ===================================

import { Attachment, CategoryKey, EquipmentItem } from '../types/equipment';
import {
  CheckResult,
  Inspection,
  InspectionVerification,
  InspectionPeriod,
  PERIOD_DAYS,
  outcomeOf,
  hasOpenDefect as recordHasOpenDefect,
} from '../types/inspection';
import { ChecklistTemplate, lineText, templateById } from '../constants/checklists';
import { CrewMember } from '../types/crew';
import { CATEGORY_MAP, CategoryMeta } from '../constants/categories';
import { uid } from '../utils/id';
import { formatDate } from '../utils/dates';

// ---- Creating --------------------------------------------------------------

export interface NewInspectionInput {
  item: EquipmentItem;
  template: ChecklistTemplate;
  results: Record<string, CheckResult>;
  /** Signature — a name snapshot, plus the crew id while it still resolves. */
  by: string;
  byRank?: string;
  byId?: string;
  comment?: string;
  photos?: Attachment[];
  /** Written up by hand. A failed line raises a defect on its own. */
  defectNote?: string;
  deviceId?: string;
  /** How the item was reached — a scan, or a Master's override with a reason. */
  verification?: InspectionVerification;
  /** Injectable for tests; production always stamps the real moment. */
  at?: number;
}

/**
 * Build the record. `at` is stamped here, once — the moment the crew member
 * signs — and the outcome is frozen alongside it (see types/inspection.ts).
 *
 * A defect is raised when any line failed OR the crew member wrote one up. Its
 * default note names the failed lines, because "FAIL" on its own tells the next
 * person nothing, and the one thing worse than no audit trail is one nobody can
 * act on.
 */
export function create(input: NewInspectionInput): Inspection {
  const at = input.at ?? Date.now();
  const outcome = outcomeOf(input.results);
  // The questions as asked, in the order they were put. See `lines` in
  // types/inspection.ts for why the text travels with the record.
  const lines = input.template.lines.map((l) => ({ id: l.id, text: l.text }));
  const failed = Object.entries(input.results)
    .filter(([, r]) => r === 'fail')
    .map(([id]) => lineText(input.template, id));

  const note = input.defectNote?.trim();
  const raisesDefect = outcome === 'fail' || !!note;

  return {
    id: uid(),
    itemId: input.item.id,
    category: input.item.category,
    at,
    by: input.by,
    byRank: input.byRank,
    byId: input.byId,
    period: input.template.period,
    templateId: input.template.id,
    templateVersion: input.template.version,
    results: input.results,
    lines,
    outcome,
    comment: input.comment?.trim() || undefined,
    photos: input.photos?.length ? input.photos : undefined,
    defect: raisesDefect
      ? { note: note || `Failed: ${failed.join('; ')}`, open: true }
      : undefined,
    verification: input.verification
      ? {
          method: input.verification.method,
          scannedAt: input.verification.scannedAt,
          reason: input.verification.reason?.trim() || undefined,
        }
      : undefined,
    deviceId: input.deviceId,
    updatedAt: at,
  };
}

/** Close a defect — stamped and signed in its own right, never a silent edit. */
export function closeDefect(
  insp: Inspection,
  by: string,
  note?: string,
  at: number = Date.now()
): Inspection {
  if (!insp.defect) return insp;
  return {
    ...insp,
    defect: { ...insp.defect, open: false, closedAt: at, closedBy: by, closedNote: note?.trim() || undefined },
    updatedAt: at,
  };
}

/** Re-open one that was closed too eagerly. The original close stamp is kept. */
export function reopenDefect(insp: Inspection, at: number = Date.now()): Inspection {
  if (!insp.defect) return insp;
  return { ...insp, defect: { ...insp.defect, open: true }, updatedAt: at };
}

// ---- Reading ---------------------------------------------------------------

const byNewest = (a: Inspection, b: Inspection) => b.at - a.at;

/** Everything recorded against one item, newest first. */
export function forItem(list: Inspection[], itemId: string): Inspection[] {
  return list.filter((i) => i.itemId === itemId).sort(byNewest);
}

/** The most recent record for an item, optionally for one period only. */
export function lastForItem(
  list: Inspection[],
  itemId: string,
  period?: InspectionPeriod
): Inspection | null {
  let best: Inspection | null = null;
  for (const i of list) {
    if (i.itemId !== itemId) continue;
    if (period && i.period !== period) continue;
    if (!best || i.at > best.at) best = i;
  }
  return best;
}

/** Every record carrying an unrectified defect, newest first. */
export function openDefects(list: Inspection[]): Inspection[] {
  return list.filter((i) => i.defect?.open).sort(byNewest);
}

/** Open defects against one item. */
export function openDefectsForItem(list: Inspection[], itemId: string): Inspection[] {
  return openDefects(list).filter((i) => i.itemId === itemId);
}

/** Records signed within [from, to). */
export function inRange(list: Inspection[], from: number, to: number): Inspection[] {
  return list.filter((i) => i.at >= from && i.at < to).sort(byNewest);
}

// ---- Period windows --------------------------------------------------------
// What "this month" means for a report. Local time throughout: a round done at
// 2330 ship's time belongs to that day, whatever UTC thinks.

/** Calendar month containing `ref`. */
export function monthWindow(ref: Date = new Date()): { from: number; to: number; label: string } {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const label = from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return { from: from.getTime(), to: to.getTime(), label };
}

/** ISO week (Monday–Sunday) containing `ref`. */
export function weekWindow(ref: Date = new Date()): { from: number; to: number; label: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  const end = new Date(to.getTime() - 1);
  const fmt = (x: Date) => x.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  return { from: from.getTime(), to: to.getTime(), label: `${fmt(from)} – ${fmt(end)}` };
}

/**
 * Calendar quarter containing `ref` — Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec.
 *
 * A quarter is a calendar obligation for the same reason a month is (see
 * `roundStatus`): a round done on 30 September does not cover the quarter that
 * starts the next day, so the window is the quarter itself and not "the last 91
 * days". Fixed calendar quarters rather than ones counted from the first round:
 * the vessel's SMS, the PMS and the superintendent's visit all mean Q3.
 */
export function quarterWindow(ref: Date = new Date()): { from: number; to: number; label: string } {
  const q = Math.floor(ref.getMonth() / 3);
  const from = new Date(ref.getFullYear(), q * 3, 1);
  const to = new Date(ref.getFullYear(), q * 3 + 3, 1);
  return { from: from.getTime(), to: to.getTime(), label: `Q${q + 1} ${from.getFullYear()}` };
}

/** Calendar year containing `ref`. */
export function yearWindow(ref: Date = new Date()): { from: number; to: number; label: string } {
  const from = new Date(ref.getFullYear(), 0, 1);
  const to = new Date(ref.getFullYear() + 1, 0, 1);
  return { from: from.getTime(), to: to.getTime(), label: String(from.getFullYear()) };
}

export function windowFor(period: InspectionPeriod, ref: Date = new Date()) {
  if (period === 'weekly') return weekWindow(ref);
  if (period === 'quarterly') return quarterWindow(ref);
  if (period === 'annual') return yearWindow(ref);
  return monthWindow(ref);
}

/** Move `ref` one period back or forward — what the report's ‹ › buttons step by. */
export function stepPeriod(period: InspectionPeriod, ref: Date, by: -1 | 1): Date {
  switch (period) {
    case 'weekly':
      return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7 * by);
    case 'quarterly':
      return new Date(ref.getFullYear(), ref.getMonth() + 3 * by, 1);
    case 'annual':
      return new Date(ref.getFullYear() + by, 0, 1);
    default:
      return new Date(ref.getFullYear(), ref.getMonth() + by, 1);
  }
}

// ---- "Is it done?" ---------------------------------------------------------

export type RoundStatus = 'done' | 'overdue' | 'never';

/**
 * Whether an item's periodic check has been signed off in the CURRENT window.
 * Deliberately window-based rather than "within the last 30 days": a monthly
 * check is a calendar obligation, and an item done on the 31st is not covered
 * for the month that starts the next day.
 */
export function roundStatus(
  list: Inspection[],
  itemId: string,
  period: InspectionPeriod,
  ref: Date = new Date()
): RoundStatus {
  const { from, to } = windowFor(period, ref);
  const done = list.some((i) => i.itemId === itemId && i.period === period && i.at >= from && i.at < to);
  if (done) return 'done';
  return list.some((i) => i.itemId === itemId && i.period === period) ? 'overdue' : 'never';
}

/**
 * How this item stands against the CURRENT round — the mark shown beside it.
 *
 *   fail   something is wrong and still outstanding
 *   done   inspected inside the current window and nothing outstanding
 *   due    not inspected, and the window is nearly over
 *   open   not inspected, with time still in hand
 *
 * FAIL OUTRANKS EVERYTHING, and it is not tied to the window. A defect raised in
 * March is still a defect in June, so an item carrying an open one is marked as
 * failed whatever else has happened since; it goes green only when the
 * rectification is signed. Anything else would let a red mark be cleared by the
 * calendar turning over, which is exactly the fact an audit is looking for.
 *
 * The distinction between `due` and `open` is the other half of the value. A
 * monthly item untouched on the 3rd is not a problem and must not look like one,
 * or the colour stops meaning anything and gets ignored; the same item untouched
 * on the 27th is the one a mate needs to see before the month closes. So the
 * warning is tied to the END of the calendar window, not to "30 days since last".
 */
export type RoundMark = 'fail' | 'done' | 'due' | 'open';

/** How close to the end of a window counts as "due" — a fifth of it, min 1 day. */
function warnMs(from: number, to: number): number {
  return Math.max(86_400_000, (to - from) * 0.2);
}

export function roundMark(
  list: Inspection[],
  itemId: string,
  period: InspectionPeriod,
  ref: Date = new Date()
): RoundMark {
  // An unrectified defect is the loudest thing this item has to say, whenever it
  // was raised — see the note above.
  if (list.some((i) => i.itemId === itemId && recordHasOpenDefect(i))) return 'fail';

  const { from, to } = windowFor(period, ref);
  const done = list.some(
    (i) => i.itemId === itemId && i.period === period && i.at >= from && i.at < to
  );
  if (done) return 'done';

  return ref.getTime() >= to - warnMs(from, to) ? 'due' : 'open';
}

/** The worst mark across every round the category owes — what a single dot shows. */
export function worstRoundMark(
  list: Inspection[],
  itemId: string,
  periods: InspectionPeriod[],
  ref: Date = new Date()
): RoundMark {
  const rank: Record<RoundMark, number> = { fail: 3, due: 2, open: 1, done: 0 };
  let worst: RoundMark = 'done';
  for (const p of periods) {
    const m = roundMark(list, itemId, p, ref);
    if (rank[m] > rank[worst]) worst = m;
  }
  return worst;
}

/** Days since the last check of this period; undefined when never checked. */
export function daysSinceLast(
  list: Inspection[],
  itemId: string,
  period: InspectionPeriod
): number | undefined {
  const last = lastForItem(list, itemId, period);
  if (!last) return undefined;
  return Math.floor((Date.now() - last.at) / 86_400_000);
}

/** Nominal days allowed between checks — the yardstick for "overdue by". */
export function allowance(period: InspectionPeriod): number {
  return PERIOD_DAYS[period];
}

// ---- Merging two devices' trails -------------------------------------------
// Lives here rather than in the sync layer because it is a property of the
// records, not of Firebase: append-only records with unique ids can never
// disagree, so the correct merge is a set union. Any transport that carries them
// — cloud sync, a .msm backup, a future one — wants exactly this function.

/** Union by id; on a genuine clash the later `updatedAt` wins (a defect close). */
export function mergeInspections(local: Inspection[], remote: Inspection[]): Inspection[] {
  const byId = new Map<string, Inspection>();
  for (const i of [...local, ...remote]) {
    if (!i?.id) continue;
    const prev = byId.get(i.id);
    if (!prev || (i.updatedAt ?? i.at) > (prev.updatedAt ?? prev.at)) byId.set(i.id, i);
  }
  return Array.from(byId.values()).sort(byNewest);
}

/** And once more for the vessel's own categories. Same rule, same reasoning. */
export function mergeCategories(local: CategoryMeta[], remote: CategoryMeta[]): CategoryMeta[] {
  const byId = new Map<string, CategoryMeta>();
  for (const c of [...local, ...remote]) {
    if (!c?.key) continue;
    const prev = byId.get(c.key);
    if (!prev || (c.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byId.set(c.key, c);
  }
  return Array.from(byId.values());
}

/**
 * Same merge again for the vessel's own checklist templates.
 *
 * Safe for the same reason the crew merge is: losing an edit costs a re-type,
 * whereas the records signed against any version of a template carry their own
 * copy of the questions and cannot be affected by which side wins here.
 */
export function mergeTemplates(
  local: ChecklistTemplate[],
  remote: ChecklistTemplate[]
): ChecklistTemplate[] {
  const byId = new Map<string, ChecklistTemplate>();
  for (const t of [...local, ...remote]) {
    if (!t?.id) continue;
    const prev = byId.get(t.id);
    if (!prev || (t.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

/** Same shape of merge for the crew list, which is edited rather than appended. */
export function mergeCrew(local: CrewMember[], remote: CrewMember[]): CrewMember[] {
  const byId = new Map<string, CrewMember>();
  for (const c of [...local, ...remote]) {
    if (!c?.id) continue;
    const prev = byId.get(c.id);
    if (!prev || (c.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byId.set(c.id, c);
  }
  return Array.from(byId.values());
}

// ---- Roll-ups for reports and the dashboard --------------------------------

export interface RoundSummary {
  period: InspectionPeriod;
  /** Items in scope (the categories that have a checklist for this period). */
  total: number;
  done: number;
  outstanding: number;
  /** Distinct items with at least one open defect. */
  defects: number;
}

/**
 * How a round stands right now, over a set of items. `scope` is normally one
 * group's categories (LSA or FFE) — the separation the report asks for.
 */
export function summarizeRound(
  items: EquipmentItem[],
  list: Inspection[],
  period: InspectionPeriod,
  ref: Date = new Date()
): RoundSummary {
  let done = 0;
  const withDefect = new Set<string>();
  for (const i of openDefects(list)) withDefect.add(i.itemId);
  for (const it of items) {
    if (roundStatus(list, it.id, period, ref) === 'done') done++;
  }
  const defects = items.reduce((n, it) => n + (withDefect.has(it.id) ? 1 : 0), 0);
  return { period, total: items.length, done, outstanding: items.length - done, defects };
}

/** Items of a given group (LSA / FFE / OTHER). */
export function itemsInGroup(flat: EquipmentItem[], group: 'LSA' | 'FFE' | 'OTHER'): EquipmentItem[] {
  return flat.filter((it) => CATEGORY_MAP[it.category]?.group === group);
}

/** Human-readable pass/fail line summary of a stored record. */
export function resultBreakdown(insp: Inspection): { passed: number; failed: number; na: number } {
  let passed = 0,
    failed = 0,
    na = 0;
  for (const r of Object.values(insp.results)) {
    if (r === 'pass') passed++;
    else if (r === 'fail') failed++;
    else na++;
  }
  return { passed, failed, na };
}

/**
 * Every line of the record, worded and ordered as the crew member saw it.
 *
 * The snapshot on the record is the truth when it is there. Records signed
 * before snapshots existed fall back to the template, which is still correct for
 * them: the only templates that could have produced those records live in code
 * and have never changed under a signature.
 *
 * Anything in `results` that neither source names is still emitted, keyed by its
 * own id — a result we cannot word is worth less than one we can, and worth far
 * more than one silently dropped from an audit trail.
 */
export function checklistRows(
  insp: Inspection
): { id: string; text: string; result: CheckResult }[] {
  const template = insp.lines?.length ? null : templateById(insp.templateId);
  const order = insp.lines?.length ? insp.lines : template?.lines ?? [];

  const rows: { id: string; text: string; result: CheckResult }[] = [];
  const seen = new Set<string>();
  for (const l of order) {
    const result = insp.results[l.id];
    if (!result) continue; // asked but not answered — not part of the record
    rows.push({ id: l.id, text: l.text, result });
    seen.add(l.id);
  }
  for (const [id, result] of Object.entries(insp.results)) {
    if (!seen.has(id)) rows.push({ id, text: id, result });
  }
  return rows;
}

/** The failed lines, worded as the crew member saw them. */
export function failedLines(insp: Inspection): string[] {
  return checklistRows(insp)
    .filter((r) => r.result === 'fail')
    .map((r) => r.text);
}

/**
 * What a defect IS, in words, for a reader who was not there.
 *
 * The failed checklist lines first, because they are the finding and they always
 * exist; the officer's note after, because it is optional. A defect described by
 * the note alone prints an empty reason whenever nobody typed one — on screen
 * that is annoying, in a report handed to an inspector it is a blank where the
 * finding should be, and the only way to fill it in is to come and ask.
 */
export function defectReason(insp: Inspection): string {
  const lines = failedLines(insp);
  const note = insp.defect?.note?.trim();
  return [lines.join('; '), note].filter(Boolean).join(' — ');
}

/** Category label for a record, for report rows. */
export function categoryLabel(category: CategoryKey): string {
  return CATEGORY_MAP[category]?.label ?? category;
}

// ---- what still has to go up ------------------------------------------------

/**
 * Which records this device owes the vessel.
 *
 * A signed inspection never changes, so remembering "already sent" by id was
 * right for everything except the ONE mutation the trail allows: a defect going
 * open→closed (see types/inspection.ts). That closure rewrites a record whose id
 * had of course already been sent, so it was filtered out and never left the
 * device — the rectification lived on the Master's screen while every other
 * device went on showing the defect as outstanding. Reported by a vessel on
 * 29 Sep 2026; the record it complained about was still `open: true` in the
 * vessel's own copy, eleven days after being closed.
 *
 * So what is remembered is the `updatedAt` that was sent, and a record goes up
 * when it is new OR has moved on since. `updatedAt` is stamped on creation and
 * again by `closeDefect`, which makes it exactly the right watermark.
 *
 * Pure, and checked in scripts/check-inspections.ts — the sync layer around it
 * is Firebase glue that no test here can exercise.
 */
export function unsentInspections(
  list: Inspection[],
  pushed: Record<string, number>
): Inspection[] {
  return list.filter((i) => {
    const sent = pushed[i.id];
    if (sent === undefined) return true;
    // `updatedAt` is optional on records written by older builds; treat a
    // missing one as "never moved" rather than re-pushing the whole trail.
    return (i.updatedAt ?? 0) > sent;
  });
}

/**
 * Who to print in the report's "Checked by / Rank / Date" line.
 *
 * Lives here rather than in services/inspectionReport so it can be checked:
 * that file imports SheetJS and expo-print, which the check script cannot load.
 *
 * Asked for by a vessel (29 Sep 2026), and the reason is filing rather than
 * ceremony: their reports are not printed, they are uploaded straight into the
 * PMS, so a blank signature line means every export needs a human pass before it
 * can be filed. Every record already carries who signed it and their rank — the
 * footer was simply not reading them.
 *
 * ONE signer fills the line outright. SEVERAL are all named, because a monthly
 * round shared between the mate and the bosun was signed by both and a footer
 * that picked one would misattribute the other's work. Beyond three it says how
 * many and leaves the table to carry the detail.
 *
 * The date is the LAST round in the report, not today: the document says when the
 * work was done, and re-exporting it in November must not restamp September's
 * inspections.
 */
export interface ReportSignoff {
  names: string;
  rank: string;
  date: string;
  /** Nothing was signed in this period — the blank line stays, to be filled by hand. */
  blank: boolean;
}

/**
 * `YYYY-MM-DD` in the SHIP's day, not in UTC.
 *
 * `toISOString().slice(0,10)` looks like the obvious way to do this and is wrong
 * east of Greenwich: a round signed at 00:30 BST is 23:30 the previous day in
 * UTC, so the report would date the night round to the day before — on a vessel
 * where rounds genuinely happen at night, and in a document filed as evidence.
 */
function localISODate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function signoffFor(data: { done: Inspection[] }): ReportSignoff {
  const signed = data.done;
  if (!signed.length) return { names: '', rank: '', date: '', blank: true };

  // Newest first out of buildReport, so the first record is the last round done.
  const last = signed[0];
  const people = new Map<string, { name: string; rank?: string }>();
  for (const i of signed) {
    const key = `${i.by}|${i.byRank ?? ''}`;
    if (!people.has(key)) people.set(key, { name: i.by, rank: i.byRank });
  }
  const list = [...people.values()];

  const names =
    list.length === 1
      ? list[0].name
      : list.length <= 3
        ? list.map((p) => p.name).join(', ')
        : `${list.slice(0, 3).map((p) => p.name).join(', ')} and ${list.length - 3} other${list.length - 3 === 1 ? '' : 's'}`;

  // The rank is printed only when it is not in dispute: one person, or several
  // who hold the same rank. Otherwise the ranks travel beside the names in the
  // table, and a single rank in the footer would be wrong for somebody.
  const ranks = new Set(list.map((p) => (p.rank ?? '').trim()).filter(Boolean));
  const rank = ranks.size === 1 && list.every((p) => (p.rank ?? '').trim()) ? [...ranks][0] : '';

  return { names, rank, date: formatDate(localISODate(last.at)), blank: false };
}
