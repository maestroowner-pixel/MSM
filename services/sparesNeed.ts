// ===================================
// Spares needed for the jobs coming up — ordered before the job falls due
// (11 Oct 2026, after the usual class-aligned PMS: "requisitions raised before
// a job is due"). A job counts when it is overdue or due within the horizon,
// by the calendar or by the running-hours rate. Pure, tested (check:spares).
// ===================================

import { Machine, PmsDeferral, PmsJob } from '../types/pms';
import { SparePart, SpareMove } from '../types/spares';
import { PurchaseOrder } from '../types/orders';
import { activeDeferral, jobDue, todayIso } from './pms';
import { poStage } from './poApproval';

export interface PartNeed {
  part: SparePart;
  need: number;
  onHand: number;
  /** How many to order: need beyond what is on hand, topped up to the re-order level. */
  order: number;
  /** "Main engine — Oil change (in 12 d)". */
  forJobs: string[];
  /** Already on an open order, not yet aboard — counted as stock. */
  onOrder: number;
}

export interface NeedOpts {
  /** Days a part takes to arrive (leadTimes): its jobs are looked for that much further ahead. */
  lead?: Map<string, number>;
  /** What is already on order (onOrder). */
  onOrder?: Map<string, number>;
  /** Level to keep after the jobs, per part (reorderPoint); the re-order level when absent. */
  keep?: Map<string, number>;
}

export function upcomingNeeds(jobs: PmsJob[], machines: Machine[], deferrals: PmsDeferral[], parts: SparePart[], stock: Map<string, number>, horizonDays = 30, today = todayIso(), opts: NeedOpts = {}): PartNeed[] {
  const mById = new Map(machines.map((m) => [m.id, m]));
  const pById = new Map(parts.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const need = new Map<string, { qty: number; jobs: string[] }>();
  for (const j of jobs) {
    if (j.deleted || !j.parts?.length) continue;
    const m = mById.get(j.machineId);
    if (!m) continue;
    const d = jobDue(j, m, today, activeDeferral(j, deferrals));
    const days = d.daysLeft ?? d.estDaysForHours;
    // A part that takes 45 days to arrive is wanted for the jobs 45 days beyond the horizon.
    const soon = (partId: string) => d.status === 'expired' || d.status === 'due' || (days != null && days <= horizonDays + (opts.lead?.get(partId) ?? 0));
    const when = d.status === 'expired' ? 'overdue' : days != null ? `in ${Math.max(0, days)} d` : 'due';
    for (const jp of j.parts) {
      if (!pById.has(jp.partId) || !(jp.qty > 0) || !soon(jp.partId)) continue;
      const n = need.get(jp.partId) ?? { qty: 0, jobs: [] };
      n.qty += jp.qty;
      n.jobs.push(`${m.name} — ${j.title} (${when})`);
      need.set(jp.partId, n);
    }
  }
  const out: PartNeed[] = [];
  for (const [id, n] of need) {
    const part = pById.get(id)!;
    const onHand = stock.get(id) ?? 0;
    const onOrder = opts.onOrder?.get(id) ?? 0;
    // After the jobs, keep at least the re-order level on the shelf.
    const order = Math.max(0, n.qty + (opts.keep?.get(id) ?? part.minQty ?? 0) - onHand - onOrder);
    if (order > 0) out.push({ part, need: n.qty, onHand, order, forJobs: n.jobs, onOrder });
  }
  return out.sort((a, b) => b.order - a.order || a.part.name.localeCompare(b.part.name));
}

// ---- What to order (plan item 36): the jobs, the re-order levels, what is on the way ----

const dayN = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000;

/**
 * Quantity per spare part (or store item) still to come on open orders: a draft, one with the
 * Master or the office, one returned for rework, one sent and not all delivered.
 * Without it the same part went into a new draft every time the button was pressed.
 * Rejected, cancelled and delivered orders bring nothing; office cuts are already in `qty`.
 */
export function onOrder(orders: PurchaseOrder[], link: 'spareId' | 'storeItemId' = 'spareId'): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of orders) {
    if (o.deleted) continue;
    const s = poStage(o);
    if (s === 'rejected' || s === 'cancelled' || s === 'delivered') continue;
    for (const l of o.lines) {
      const id = l[link];
      if (!id) continue;
      const left = Math.max(0, l.qty - (l.qtyReceived ?? 0));
      if (left > 0) out.set(id, Math.round(((out.get(id) ?? 0) + left) * 1000) / 1000);
    }
  }
  return out;
}

export interface Lead { days: number; from: 'history' | 'supplier' }

/**
 * How long each part takes to arrive: the mean of its last three deliveries
 * (sent → the delivery that brought the line), rounded up; with no history,
 * the usual supplier's stated lead time.
 */
export function leadTimes(parts: SparePart[], orders: PurchaseOrder[]): Map<string, Lead> {
  const seen = new Map<string, { sent: string; days: number }[]>();
  for (const o of orders) {
    if (o.deleted || !o.sentAt) continue;
    for (const l of o.lines) {
      if (!l.spareId) continue;
      const got = (o.deliveries ?? []).filter((d) => (d.lines[l.id] ?? 0) > 0).map((d) => d.date).sort()[0] ?? (o.status === 'received' ? o.receivedAt : undefined);
      if (!got) continue;
      const days = dayN(got) - dayN(o.sentAt);
      if (!(days >= 0)) continue;
      seen.set(l.spareId, [...(seen.get(l.spareId) ?? []), { sent: o.sentAt, days }]);
    }
  }
  const out = new Map<string, Lead>();
  for (const p of parts) {
    const h = (seen.get(p.id) ?? []).sort((a, b) => b.sent.localeCompare(a.sent)).slice(0, 3);
    if (h.length) out.set(p.id, { days: Math.ceil(h.reduce((s, x) => s + x.days, 0) / h.length), from: 'history' });
    else if (p.suppliers?.[0]?.leadDays != null) out.set(p.id, { days: p.suppliers[0].leadDays, from: 'supplier' });
  }
  return out;
}

/** Days of use a fresh order should cover when the part has no maximum. */
export const COVER_DAYS = 90;

/**
 * Average use per day over the last year — `used` movements (jobs and taken by hand).
 * A part stocked less than a year is averaged over its own time aboard, but never
 * under 30 days, so one impeller taken last week is not read as a daily habit.
 */
export function dailyUse(moves: SpareMove[], today = todayIso(), days = 365): Map<string, number> {
  const from = dayN(today) - days;
  const first = new Map<string, number>();
  const used = new Map<string, number>();
  for (const m of moves) {
    const d = dayN(m.date);
    first.set(m.partId, Math.min(first.get(m.partId) ?? Infinity, d));
    if (m.kind === 'used' && d > from && d <= dayN(today)) used.set(m.partId, (used.get(m.partId) ?? 0) - m.delta);
  }
  const out = new Map<string, number>();
  for (const [id, u] of used) {
    if (!(u > 0)) continue;
    const span = Math.max(30, Math.min(days, dayN(today) - Math.max(from, first.get(id)!)));
    out.set(id, u / span);
  }
  return out;
}

export interface Levels {
  /** Re-order point: the minimum kept as safety stock, plus what is used while an order is on its way. */
  rop: number;
  /** An order brings the stock (with what is on order) back to this. */
  target: number;
}

const up = (n: number) => Math.ceil(n - 1e-9);

/** Re-order point and order-up-to level from the minimum, the use per day and the lead time. */
export function levels(part: Pick<SparePart, 'minQty' | 'maxQty'>, daily = 0, leadDays = 0): Levels {
  const rop = (part.minQty ?? 0) + up(daily * leadDays);
  const target = part.maxQty != null && part.maxQty > rop ? part.maxQty : rop + Math.max(1, up(daily * COVER_DAYS));
  return { rop, target };
}

/** How many to order with `position` (on hand + on order): nothing above the re-order point (or with stock and no levels). */
export function qtyFor(l: Levels, position: number): number {
  if (position > l.rop) return 0;
  return Math.round(Math.max(0, l.target - position) * 1000) / 1000;
}

/** Parts for critical machines — fitted to one, or used by one of its jobs. */
export function criticalParts(parts: SparePart[], machines: Machine[], jobs: PmsJob[]): Set<string> {
  const crit = new Set(machines.filter((m) => m.critical && !m.deleted).map((m) => m.id));
  const out = new Set<string>();
  for (const p of parts) if (p.machineIds?.some((id) => crit.has(id))) out.add(p.id);
  for (const j of jobs) if (!j.deleted && crit.has(j.machineId)) for (const jp of j.parts ?? []) out.add(jp.partId);
  return out;
}

export interface ReorderLine {
  part: SparePart;
  onHand: number;
  onOrder: number;
  /** For the coming jobs; 0 when the line is only below its re-order level. */
  need: number;
  /** To order now. */
  qty: number;
  forJobs: string[];
  critical: boolean;
  lead?: Lead;
  /** Average use per day over the last year (dailyUse). */
  daily: number;
  /** Re-order point (levels). */
  rop: number;
}

/**
 * One list for the Excel requisition and the draft orders: the coming jobs' parts
 * (enough for the jobs and back up to the maximum), then lines below their
 * re-order level — what is already on order counted as if aboard, critical
 * equipment's parts first.
 */
export function reorderList(
  jobs: PmsJob[], machines: Machine[], deferrals: PmsDeferral[], parts: SparePart[], stock: Map<string, number>, orders: PurchaseOrder[],
  horizonDays: number, today = todayIso(), withJobs = true, moves: SpareMove[] = [], only?: Set<string>,
): ReorderLine[] {
  const live = parts.filter((p) => !p.deleted && (!only || only.has(p.id)));
  const coming = onOrder(orders);
  const leads = leadTimes(live, orders);
  const crit = criticalParts(live, machines, jobs);
  const use = dailyUse(moves, today);
  const lv = new Map(live.map((p) => [p.id, levels(p, use.get(p.id) ?? 0, leads.get(p.id)?.days ?? 0)]));
  const lead = new Map([...leads].map(([id, l]) => [id, l.days]));
  const keep = new Map([...lv].map(([id, l]) => [id, l.rop]));
  const needs = withJobs ? upcomingNeeds(jobs, machines, deferrals, live, stock, horizonDays, today, { lead, onOrder: coming, keep }) : [];
  const line = (part: SparePart, onHand: number, later: number, need: number, forJobs: string[], qty: number): ReorderLine => ({
    part, onHand, onOrder: later, need, forJobs, qty, critical: crit.has(part.id), lead: leads.get(part.id), daily: use.get(part.id) ?? 0, rop: lv.get(part.id)!.rop,
  });
  // Enough for the jobs, and back up to the target after them.
  const out = needs.map((n) => line(n.part, n.onHand, n.onOrder, n.need, n.forJobs, Math.max(n.order, qtyFor(lv.get(n.part.id)!, n.onHand + n.onOrder - n.need))));
  const inJobs = new Set(out.map((x) => x.part.id));
  for (const p of live) {
    if (inJobs.has(p.id)) continue;
    const onHand = stock.get(p.id) ?? 0;
    const later = coming.get(p.id) ?? 0;
    const qty = qtyFor(lv.get(p.id)!, onHand + later);
    if (qty > 0) out.push(line(p, onHand, later, 0, [], qty));
  }
  return out.sort((a, b) => Number(b.critical) - Number(a.critical) || Number(b.need > 0) - Number(a.need > 0) || a.part.name.localeCompare(b.part.name));
}
