// ===================================
// The fuel daily (noon) report — sent at noon with what was burnt over the last
// day (10 Oct 2026: "as a rule a report goes at noon with the fuel used
// yesterday").
//
// Nothing is typed into it but a remark: the figures come from the soundings.
// The day reported is the stretch between the previous sounding and the
// report day's sounding (normally noon to noon), plus whatever was bunkered in
// between — the same arithmetic as the monthly report (services/fuel.ts).
// ===================================

import { FuelBunker, FuelReading, FuelTank } from '../types/fuel';
import { robTotal } from './fuel';

export interface FuelDailyReport {
  date: string;
  /** The report day's sounding, if taken. */
  reading?: FuelReading;
  /** The sounding before it. */
  previous?: FuelReading;
  rob?: number;
  /** Litres by tank at the report day's sounding. */
  byTank: { name: string; litres: number }[];
  /** Burnt between the two soundings. */
  consumed?: number;
  /** Days between the two soundings (1 normally). */
  span?: number;
  /** Bunkered between the two soundings. */
  received: number;
  /** Average per day over the last 7 days of soundings. */
  avg7?: number;
  /** ROB ÷ avg7. */
  daysLeft?: number;
  /** Burnt from the first sounding of the month (or the last one before it). */
  monthToDate?: number;
  suspect?: boolean;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const r0 = (n: number) => Math.round(n);
const minusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/** Burnt between two soundings, counting what was received in between. */
function burnt(from: FuelReading, to: FuelReading, tanks: FuelTank[], bunkers: FuelBunker[]): { litres: number; received: number } {
  const received = bunkers.filter((b) => b.date > from.date && b.date <= to.date).reduce((n, b) => n + b.litres, 0);
  return { litres: robTotal(from, tanks) + received - robTotal(to, tanks), received };
}

export function fuelDaily(date: string, allTanks: FuelTank[], readings: FuelReading[], bunkers: FuelBunker[]): FuelDailyReport {
  const tanks = allTanks.filter((t) => !t.deleted).sort((a, b) => a.order - b.order);
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const reading = sorted.find((r) => r.date === date);
  const previous = [...sorted].reverse().find((r) => r.date < date);
  const out: FuelDailyReport = { date, reading, previous, byTank: [], received: 0 };
  if (!reading) return out;
  out.rob = robTotal(reading, tanks);
  out.byTank = tanks.map((t) => ({ name: t.name, litres: reading.tanks[t.id] ?? 0 }));
  if (previous) {
    const b = burnt(previous, reading, tanks, bunkers);
    out.consumed = r0(b.litres);
    out.received = b.received;
    out.span = dayDiff(previous.date, date);
    if (b.litres < 0) out.suspect = true;
  }
  // 7 days: from the earliest sounding on or after date − 7 to this one.
  const weekStart = sorted.find((r) => r.date >= minusDays(date, 7) && r.date < date);
  if (weekStart) {
    const b = burnt(weekStart, reading, tanks, bunkers);
    const days = dayDiff(weekStart.date, date);
    if (days > 0 && b.litres >= 0) {
      out.avg7 = r0(b.litres / days);
      if (out.avg7 > 0) out.daysLeft = Math.floor(out.rob / out.avg7);
    }
  }
  const month = date.slice(0, 7);
  const monthStart = [...sorted].reverse().find((r) => r.date < `${month}-01`) ?? sorted.find((r) => r.date.startsWith(month));
  if (monthStart && monthStart.date < date) {
    const b = burnt(monthStart, reading, tanks, bunkers);
    if (b.litres >= 0) out.monthToDate = r0(b.litres);
  }
  return out;
}

const L = (n: number) => `${Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ')} L`;
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** The report as text — for an e-mail, a message or the clipboard. */
export function fuelDailyText(r: FuelDailyReport, vesselLine: string, remarks: string, by: string, opts: { position?: string; port?: string; activity?: string[]; kind?: 'noon' | 'midnight'; stamp?: string } = {}): string {
  // The vessel's day (13 Oct 2026): where she is, the fuel, and what was done
  // on board — every log, counted (services/dailyActivity.ts).
  const lines = [`${opts.kind === 'midnight' ? 'MIDNIGHT REPORT' : opts.kind === 'noon' ? 'NOON REPORT' : 'DAILY REPORT'} ${dm(r.date)}.${r.date.slice(0, 4)}${r.reading?.time ? ` ${r.reading.time}` : ''}`, vesselLine];
  if (opts.stamp) lines.push(opts.stamp);
  if (opts.position?.trim()) lines.push(`Position: ${opts.position.trim()}`);
  else if (opts.port?.trim()) lines.push(`In port: ${opts.port.trim()}`);
  lines.push('', 'FUEL');
  if (!r.reading) lines.push('No sounding for the day.');
  if (r.consumed != null && r.previous)
    lines.push(`Consumed: ${L(r.consumed)}${r.span && r.span > 1 ? ` over ${r.span} days` : ''} (${dm(r.previous.date)} ${r.previous.time ?? ''} → ${dm(r.date)} ${r.reading?.time ?? ''})`.replace(/\s+\)/, ')').replace(/\s+→/, ' →'));
  if (r.received) lines.push(`Received: ${L(r.received)}`);
  if (r.rob != null) lines.push(`ROB: ${L(r.rob)}${r.byTank.length > 1 ? ` (${r.byTank.map((t) => `${t.name} ${L(t.litres)}`).join(' / ')})` : ''}`);
  if (r.avg7 != null) lines.push(`Average, last 7 days: ${L(r.avg7)}/day${r.daysLeft != null ? ` — about ${r.daysLeft} days at this rate` : ''}`);
  if (r.monthToDate != null) lines.push(`Month to date: ${L(r.monthToDate)}`);
  if (opts.activity?.length) lines.push('', opts.kind === 'noon' ? 'ON BOARD — noon to noon' : opts.kind === 'midnight' ? 'ON BOARD — 00:00 to 24:00' : 'ON BOARD', ...opts.activity);
  if (remarks.trim()) lines.push('', `Remarks: ${remarks.trim()}`);
  lines.push('', `— ${by}`);
  return lines.join('\n');
}
