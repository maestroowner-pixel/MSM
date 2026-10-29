// ===================================
// Critical equipment (29 Oct 2026, plan item 34 — taken from JiBe).
//
// Two things the office must not learn late:
//   • a defect on a critical machine (steering, propulsion, fire-fighting,
//     safety systems), or any safety-critical defect — mailed to the office the
//     moment it syncs (functions/critAlert.js; `alertWorthy` is its rule);
//   • a machine out of service — downtime, "out of service from … to …".
//
// Downtime lives ON the defect (`PmsDefect.outOfService`): a machine is never
// out of service without a reason, and the reason is the defect. An officer
// marks it while the defect is open; it ends when the machine is back in service
// or, at the latest, when the defect is closed. A machine's downtime history is
// read from its defects. Days are whole calendar days, both ends counted.
//
// Pure, checked by `npm run check:criteq`.
// ===================================

import type { Machine, OutOfService, PmsDefect } from '../types/pms';

const DAY = 86400000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** A defect the office hears about at once: on a critical machine, or safety-critical anywhere. */
export function alertWorthy(d: Pick<PmsDefect, 'category'>, m?: Pick<Machine, 'critical'>): boolean {
  return d.category === 'safety' || !!m?.critical;
}

/** Still out of service: marked, not back, defect not closed. */
export function isOut(d: PmsDefect): boolean {
  return !!d.outOfService && !d.outOfService.to && !d.closed;
}

/** Back in service on — the day marked, else the day the defect was closed. */
export function backOn(d: PmsDefect): string | undefined {
  return d.outOfService?.to ?? (d.outOfService ? d.closed?.date : undefined);
}

/** Days out of service, both ends counted; still out → up to today. */
export function downtimeDays(d: PmsDefect, today: string): number {
  if (!d.outOfService) return 0;
  const end = backOn(d) ?? today;
  return Math.max(1, Math.round((ms(end) - ms(d.outOfService.from)) / DAY) + 1);
}

/** Days of downtime inside [from, to] (a month in the report). */
export function downtimeIn(d: PmsDefect, from: string, to: string, today: string): number {
  if (!d.outOfService) return 0;
  const a = d.outOfService.from > from ? d.outOfService.from : from;
  const endAll = backOn(d) ?? today;
  const b = endAll < to ? endAll : to;
  if (b < a) return 0;
  return Math.round((ms(b) - ms(a)) / DAY) + 1;
}

/** A defect marked out of service, signed by whoever marks it. */
export function markOut(d: PmsDefect, from: string, who: { name: string; rank?: string }, now: number): PmsDefect {
  if (d.closed) throw new Error('A closed defect cannot take the machine out of service.');
  const oos: OutOfService = { from, by: who.name, ...(who.rank ? { byRank: who.rank } : {}), at: now };
  return { ...d, outOfService: oos, updatedAt: now };
}

/** Back in service — no earlier than it went out. */
export function markBack(d: PmsDefect, to: string, who: { name: string; rank?: string }, now: number): PmsDefect {
  if (!d.outOfService || d.outOfService.to) throw new Error('Not out of service.');
  if (to < d.outOfService.from) throw new Error('Back in service before it went out.');
  return { ...d, outOfService: { ...d.outOfService, to, backBy: who.name, ...(who.rank ? { backByRank: who.rank } : {}), backAt: now }, updatedAt: now };
}

/** Closing a defect ends its downtime the same day, unless it already ended. */
export function closeOut(d: PmsDefect, date: string, who: { name: string; rank?: string }, now: number): Partial<PmsDefect> {
  if (!isOut(d)) return {};
  const to = date < d.outOfService!.from ? d.outOfService!.from : date;
  return { outOfService: markBack(d, to, who, now).outOfService };
}

/** A machine's downtime, latest first. */
export function machineDowntime(machineId: string, defects: PmsDefect[]): PmsDefect[] {
  return defects.filter((d) => d.machineId === machineId && d.outOfService).sort((a, b) => b.outOfService!.from.localeCompare(a.outOfService!.from));
}

/** The defect keeping this machine out of service now, if any. */
export function outNow(machineId: string, defects: PmsDefect[]): PmsDefect | undefined {
  return defects.find((d) => d.machineId === machineId && isOut(d));
}

export interface CritSummary {
  /** Open defects on critical machines. */
  defects: number;
  /** Machines out of service now — critical ones first, by name. */
  out: { machineId: string; name: string; critical: boolean; since: string }[];
}

/** What Fleet and the Board show: critical defects open and machines out of service now. */
export function critSummary(machines: Machine[], defects: PmsDefect[]): CritSummary {
  const byId = new Map(machines.filter((m) => !m.deleted).map((m) => [m.id, m]));
  const crit = (id: string) => !!byId.get(id)?.critical;
  const out = new Map<string, CritSummary['out'][number]>();
  for (const d of defects) {
    if (!isOut(d) || !byId.has(d.machineId)) continue;
    const prev = out.get(d.machineId);
    if (!prev || d.outOfService!.from < prev.since) out.set(d.machineId, { machineId: d.machineId, name: byId.get(d.machineId)!.name, critical: crit(d.machineId), since: d.outOfService!.from });
  }
  return {
    defects: defects.filter((d) => !d.closed && crit(d.machineId)).length,
    out: [...out.values()].sort((a, b) => Number(b.critical) - Number(a.critical) || a.name.localeCompare(b.name)),
  };
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const who = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);

export const DOWNTIME_HEAD = ['Out of service', 'Back in service', 'Days', 'Defect', 'Marked by'];

/** A machine's downtime as table rows (the surveyor's history, English). */
export function downtimeRows(list: PmsDefect[], today: string): string[][] {
  return list.map((d) => [dmy(d.outOfService!.from), backOn(d) ? dmy(backOn(d)) : 'STILL OUT', String(downtimeDays(d, today)), d.description, who(d.outOfService!.by, d.outOfService!.byRank)]);
}

export const MONTH_DOWNTIME_HEAD = ['Machine', 'Out of service', 'Back in service', 'Days this month', 'Defect'];

/** The month's downtime for the monthly PMS report — critical machines flagged ⚑, longest first. */
export function monthDowntime(month: string, machines: Machine[], defects: PmsDefect[], today: string): string[][] {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const byId = new Map(machines.map((x) => [x.id, x]));
  return defects
    .map((d) => ({ d, days: downtimeIn(d, first, last, today) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days)
    .map(({ d, days }) => [`${byId.get(d.machineId)?.critical ? '⚑ ' : ''}${d.machineName}`, dmy(d.outOfService!.from), backOn(d) ? dmy(backOn(d)) : 'still out', String(days), d.description]);
}
