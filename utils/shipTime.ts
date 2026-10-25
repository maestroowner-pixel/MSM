// ===================================
// Ship's time and UTC (13 Oct 2026: "in the header, the date and time — ship's
// time / UTC — editable in Settings"). The vessel keeps its own clock: the
// zone it sails in, which is not always the zone the phone or the office
// computer is set to. Settings → Vessel → Ship's time sets it as an offset
// from UTC (+02:00); unset, the device's own zone is ship's time. Pure.
// ===================================

/** Minutes east of UTC from "+02:00" / "-03:30"; undefined when not set. */
export function offsetMinutes(text?: string): number | undefined {
  const m = /^([+-])(\d{1,2}):?(\d{2})$/.exec((text ?? '').trim());
  if (!m) return undefined;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -v : v;
}

export const offsetText = (min: number) => `${min < 0 ? '-' : '+'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`;

/** UTC−12 to UTC+14 by the WHOLE hour (16 Oct 2026: "ship's time is not set by
 *  the half hour — plus one hour, minus one hour"). Ship's time is a zone the
 *  Master keeps, moved an hour at a time, not a country's legal time. */
export const OFFSETS: string[] = Array.from({ length: 27 }, (_, i) => offsetText((i - 12) * 60));

const z = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;

/** An instant in ship's time and in UTC: "2026-10-13 12:00 LT (UTC+02:00) · 10:00 UTC". */
export function shipAndUtc(at: number, shipOffset?: string): { ship: string; utc: string; zone: string; line: string } {
  const off = offsetMinutes(shipOffset) ?? -new Date(at).getTimezoneOffset();
  const ship = stamp(new Date(at + off * 60000));
  const utc = stamp(new Date(at));
  const zone = `UTC${offsetText(off)}`;
  return { ship, utc, zone, line: `${ship} ship's time (${zone}) · ${utc.slice(ship.slice(0, 10) === utc.slice(0, 10) ? 11 : 0)} UTC` };
}

/** An instant at a given ship's-time wall clock on a date — noon or midnight of the report day. */
export function shipInstant(date: string, hhmm: string, shipOffset?: string): number {
  const off = offsetMinutes(shipOffset);
  if (off == null) return new Date(`${date}T${hhmm}:00`).getTime();
  return Date.parse(`${date}T${hhmm}:00Z`) - off * 60000;
}

// ─── Clock changes (25 Oct 2026: "the vessel crosses time zones and the time
// must be changed" — planned ahead by the Master, applied on time, kept as a
// history). A change says: from this instant the ship keeps `to` instead of
// `from`. Planned ones lie in the future; past ones are the history that lets a
// report for last Tuesday use last Tuesday's zone, not today's.

export interface ClockChange {
  id: string;
  /** The instant the clocks change (ms). */
  at: number;
  from: string;
  to: string;
  /** Who planned or made it, and when. */
  by?: string;
  madeAt: number;
}

export interface ShipClockInfo {
  ship_utc_offset?: string;
  ship_time_changes?: ClockChange[];
}

const byAt = (a: ClockChange, b: ClockChange) => a.at - b.at;

/** The vessel's clock changes, oldest first. */
export const clockChanges = (v?: ShipClockInfo | null): ClockChange[] => [...(v?.ship_time_changes ?? [])].sort(byAt);

/**
 * Ship's time offset in force at an instant: the last change made by then, or
 * — before the first change — the zone it changed from. No changes at all: the
 * offset set in Settings (undefined = the device's zone).
 */
export function offsetAt(at: number, v?: ShipClockInfo | null): string | undefined {
  const all = clockChanges(v);
  if (!all.length) return v?.ship_utc_offset;
  let off = all[0].from;
  for (const c of all) if (c.at <= at) off = c.to;
  return off;
}

/** The device's own zone as an offset ("+02:00"). */
export const deviceOffset = (at = Date.now()) => offsetText(-new Date(at).getTimezoneOffset());

/** shipAndUtc with the offset in force at that instant. */
export const shipAndUtcAt = (at: number, v?: ShipClockInfo | null) => shipAndUtc(at, offsetAt(at, v));

/**
 * The instant a ship's-time wall clock reads `hhmm` on `date`, in the zone in
 * force then. A wall time skipped by advancing clocks falls after the change; a
 * time repeated by retarding them is taken the first time it comes.
 */
export function shipInstantAt(date: string, hhmm: string, v?: ShipClockInfo | null): number {
  const all = clockChanges(v);
  if (!all.length) return shipInstant(date, hhmm, v?.ship_utc_offset);
  const wall = Date.parse(`${date}T${hhmm}:00Z`);
  const min = (o?: string) => offsetMinutes(o) ?? 0;
  const zones = [...new Set([all[0].from, ...all.map((c) => c.to)].map(min))];
  // An instant that reads this wall time in the zone in force at that instant.
  const fits = zones.map((z) => wall - z * 60000).filter((t) => min(offsetAt(t, v)) === Math.round((wall - t) / 60000));
  if (fits.length) return Math.min(...fits);
  // Skipped by an advance: the moment the clocks went forward.
  const gap = all.find((c) => wall - min(c.from) * 60000 >= c.at && wall - min(c.to) * 60000 < c.at);
  return gap ? gap.at : wall - min(offsetAt(wall, v)) * 60000;
}

/** Planned changes not yet made, soonest first. */
export const plannedChanges = (v?: ShipClockInfo | null, now = Date.now()) => clockChanges(v).filter((c) => c.at > now);

/** The next planned change if it is due within `withinMs` — for the reminder. */
export function nextChangeSoon(v?: ShipClockInfo | null, now = Date.now(), withinMs = 12 * 3600000): { change: ClockChange; time: string } | null {
  const c = plannedChanges(v, now)[0];
  if (!c || c.at - now > withinMs) return null;
  const s = shipAndUtc(c.at, c.from);
  const today = shipAndUtc(now, c.from).ship.slice(0, 10) === s.ship.slice(0, 10);
  return { change: c, time: today ? s.ship.slice(11) : `${s.ship.slice(8, 10)}.${s.ship.slice(5, 7)} ${s.ship.slice(11)}` };
}

/** Changes already made, newest first. */
export const pastChanges = (v?: ShipClockInfo | null, now = Date.now()) => clockChanges(v).filter((c) => c.at <= now).reverse();

/** "advanced 1 h" / "retarded 1 h" — how the clocks moved. */
export function clockShift(c: Pick<ClockChange, 'from' | 'to'>): { dir: 'advance' | 'retard' | 'none'; hours: number } {
  const d = (offsetMinutes(c.to) ?? 0) - (offsetMinutes(c.from) ?? 0);
  return { dir: d > 0 ? 'advance' : d < 0 ? 'retard' : 'none', hours: Math.abs(d) / 60 };
}

/** The log line for a change — English, as every record. */
export function clockChangeText(c: ClockChange): string {
  const s = clockShift(c);
  const h = `${s.hours} h`;
  return `Ship's time changed UTC${c.from} → UTC${c.to}` + (s.dir === 'none' ? '' : ` (clocks ${s.dir === 'advance' ? 'advanced' : 'retarded'} ${h})`);
}

/**
 * A change planned for `date hhmm` ship's time (the zone in force then), moving
 * the clocks by `hours` (+1 advance, −1 retard). Refused: in the past, beyond
 * UTC−12…+14, or not after the last change already planned.
 */
export function planChange(v: ShipClockInfo | null | undefined, date: string, hhmm: string, hours: number, id: string, by?: string, now = Date.now()): ClockChange | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hhmm)) return 'format';
  const at = shipInstantAt(date, hhmm, v);
  if (!(at > now)) return 'past';
  const last = clockChanges(v).slice(-1)[0];
  if (last && at <= last.at) return 'order';
  const from = offsetAt(at, v) ?? deviceOffset(at);
  const to = offsetText((offsetMinutes(from) ?? 0) + Math.round(hours * 60));
  const m = offsetMinutes(to) ?? 0;
  if (hours === 0 || m < -720 || m > 840) return 'range';
  return { id, at, from, to, ...(by ? { by } : {}), madeAt: now };
}

// ─── The ship's clock for records (25 Oct 2026: "the Deck Log and the other
// logs put the date and time by the device's clock"). DataContext hands the
// vessel here whenever it loads or changes, so every "today" and "now" a record
// is stamped with is ship's time — the zone in force at that moment — without
// threading the vessel through every screen. No ship's time set: the device's.

let clockInfo: ShipClockInfo | null = null;

export function setShipClock(v: ShipClockInfo | null | undefined): void {
  clockInfo = v ? { ship_utc_offset: v.ship_utc_offset, ship_time_changes: v.ship_time_changes } : null;
}

/** "YYYY-MM-DD HH:MM" in ship's time. */
export function shipStamp(at = Date.now()): string {
  const off = offsetAt(at, clockInfo);
  if (off == null) {
    const d = new Date(at);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }
  return shipAndUtc(at, off).ship;
}

/** Today's date in ship's time. */
export const shipToday = (at = Date.now()) => shipStamp(at).slice(0, 10);

/** "HH:MM" in ship's time. */
export const shipHm = (at = Date.now()) => shipStamp(at).slice(11, 16);

/** The hour (0–23) in ship's time — which watch it is. */
export const shipHour = (at = Date.now()) => Number(shipStamp(at).slice(11, 13));

/** The instant a record's ship's date and time stand for. */
export const shipAt = (date: string, hhmm = '00:00') => shipInstantAt(date, hhmm, clockInfo);
