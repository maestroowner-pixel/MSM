// ===================================
// Fuel arithmetic — remaining on board, consumption, the month (types/fuel.ts).
//
//   consumption between two soundings = ROB(before) + received between − ROB(after)
//
// A day with no sounding gets none of its own: what was burnt over the gap is
// put on the next day that was sounded, and the report says so ("over 3 days").
// A negative figure — more fuel than the last sounding plus bunkers — means a
// sounding or a bunker figure is wrong, and is reported as such, not hidden.
// ===================================

import { FuelBunker, FuelReading, FuelTank, FuelTransfer } from '../types/fuel';

export function robTotal(r: FuelReading, tanks: FuelTank[]): number {
  return tanks.reduce((n, t) => n + (r.tanks[t.id] ?? 0), 0);
}

export interface FuelDay {
  date: string;
  /** ROB at the sounding, litres; undefined = no sounding that day. */
  rob?: number;
  received: number;
  /** Litres burnt since the previous sounding, put on this day. */
  consumed?: number;
  /** How many days `consumed` covers (1 = just this day). */
  span?: number;
  /** Consumption came out negative — a figure is wrong. */
  suspect?: boolean;
}

export interface FuelMonth {
  month: string;
  days: FuelDay[];
  opening?: number;
  closing?: number;
  received: number;
  consumed: number;
  bunkers: FuelBunker[];
  transfers: FuelTransfer[];
}

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The month: day by day, with the opening ROB from the last sounding before it. */
export function fuelMonth(month: string, tanks: FuelTank[], readings: FuelReading[], bunkers: FuelBunker[], transfers: FuelTransfer[]): FuelMonth {
  const live = tanks.filter((t) => !t.deleted);
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay(month)).padStart(2, '0')}`;
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const before = [...sorted].reverse().find((r) => r.date < from);
  const inMonth = sorted.filter((r) => r.date >= from && r.date <= to);
  const robOf = new Map(inMonth.map((r) => [r.date, robTotal(r, live)]));
  const monthBunkers = bunkers.filter((b) => b.date >= from && b.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const recvOf = new Map<string, number>();
  for (const b of monthBunkers) recvOf.set(b.date, (recvOf.get(b.date) ?? 0) + b.litres);

  const days: FuelDay[] = [];
  let lastRob = before ? robTotal(before, live) : undefined;
  let lastDate = before?.date;
  let pendingRecv = before ? bunkers.filter((b) => b.date > before.date && b.date < from).reduce((n, b) => n + b.litres, 0) : 0;
  let consumed = 0;
  for (let d = 1; d <= lastDay(month); d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const received = recvOf.get(date) ?? 0;
    pendingRecv += received;
    const rob = robOf.get(date);
    const day: FuelDay = { date, rob, received };
    if (rob != null) {
      if (lastRob != null && lastDate) {
        const c = r1(lastRob + pendingRecv - rob);
        day.consumed = c;
        day.span = dayDiff(lastDate, date);
        if (c < 0) day.suspect = true;
        else consumed += c;
      }
      lastRob = rob;
      lastDate = date;
      pendingRecv = 0;
    }
    days.push(day);
  }
  const opening = before ? robTotal(before, live) : inMonth[0] ? robTotal(inMonth[0], live) : undefined;
  const closing = inMonth.length ? robTotal(inMonth[inMonth.length - 1], live) : undefined;
  return {
    month,
    days,
    opening,
    closing,
    received: monthBunkers.reduce((n, b) => n + b.litres, 0),
    consumed: r1(consumed),
    bunkers: monthBunkers,
    transfers: transfers.filter((t) => t.date >= from && t.date <= to).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Oil Record Book Part I style line for a bunkering (code H). */
export function orbBunkerLine(b: FuelBunker, tanks: FuelTank[]): string {
  const name = (id: string) => tanks.find((t) => t.id === id)?.name ?? 'tank';
  const into = Object.entries(b.into).filter(([, l]) => l > 0).map(([id, l]) => `${l} L into ${name(id)}`).join(', ');
  const tonnes = b.density ? ` (${r1((b.litres * b.density) / 1000)} t)` : '';
  return [
    `H 26.1 Place of bunkering: ${b.port}${b.time ? `, ${b.time}` : ''}`,
    `H 26.2 Type and quantity of fuel oil: marine gas oil, ${b.litres} L${tonnes}${b.sulphur != null ? `, sulphur ${b.sulphur} % m/m` : ''}`,
    `H 26.3 Tanks: ${into || '—'}`,
    b.bdnNo ? `BDN No. ${b.bdnNo}${b.supplier ? `, supplier ${b.supplier}` : ''}` : b.supplier ? `Supplier ${b.supplier}` : '',
  ].filter(Boolean).join('\n');
}

/** Tank contents after a transfer is applied to a sounding — for the record's remark. */
export function transferText(t: FuelTransfer, tanks: FuelTank[]): string {
  const name = (id: string) => tanks.find((x) => x.id === id)?.name ?? 'tank';
  return `${t.litres} L from ${name(t.fromTankId)} to ${name(t.toTankId)}`;
}
