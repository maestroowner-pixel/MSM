// ===================================
// Spares needed for the jobs coming up — ordered before the job falls due
// (11 Oct 2026, after the usual class-aligned PMS: "requisitions raised before
// a job is due"). A job counts when it is overdue or due within the horizon,
// by the calendar or by the running-hours rate. Pure, tested (check:spares).
// ===================================

import { Machine, PmsDeferral, PmsJob } from '../types/pms';
import { SparePart } from '../types/spares';
import { activeDeferral, jobDue, todayIso } from './pms';

export interface PartNeed {
  part: SparePart;
  need: number;
  onHand: number;
  /** How many to order: need beyond what is on hand, topped up to the re-order level. */
  order: number;
  /** "Main engine — Oil change (in 12 d)". */
  forJobs: string[];
}

export function upcomingNeeds(jobs: PmsJob[], machines: Machine[], deferrals: PmsDeferral[], parts: SparePart[], stock: Map<string, number>, horizonDays = 30, today = todayIso()): PartNeed[] {
  const mById = new Map(machines.map((m) => [m.id, m]));
  const pById = new Map(parts.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const need = new Map<string, { qty: number; jobs: string[] }>();
  for (const j of jobs) {
    if (j.deleted || !j.parts?.length) continue;
    const m = mById.get(j.machineId);
    if (!m) continue;
    const d = jobDue(j, m, today, activeDeferral(j, deferrals));
    const days = d.daysLeft ?? d.estDaysForHours;
    const soon = d.status === 'expired' || d.status === 'due' || (days != null && days <= horizonDays);
    if (!soon) continue;
    const when = d.status === 'expired' ? 'overdue' : days != null ? `in ${Math.max(0, days)} d` : 'due';
    for (const jp of j.parts) {
      if (!pById.has(jp.partId) || !(jp.qty > 0)) continue;
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
    // After the jobs, keep at least the re-order level on the shelf.
    const order = Math.max(0, n.qty + (part.minQty ?? 0) - onHand);
    if (order > 0) out.push({ part, need: n.qty, onHand, order, forJobs: n.jobs });
  }
  return out.sort((a, b) => b.order - a.order || a.part.name.localeCompare(b.part.name));
}
