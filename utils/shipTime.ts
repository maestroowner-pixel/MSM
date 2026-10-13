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

/** Every zone a ship keeps: UTC−12 to UTC+14, by the half hour (and the three ¾-hour zones). */
export const OFFSETS: string[] = [
  ...Array.from({ length: 53 }, (_, i) => offsetText((i - 24) * 30)),
  '+05:45', '+08:45', '+12:45',
].sort((a, b) => (offsetMinutes(a) ?? 0) - (offsetMinutes(b) ?? 0));

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
