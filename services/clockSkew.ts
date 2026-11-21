// ===================================
// The pure half of services/clockCheck (ISO 21745 §4.2.1): how far the device clock is from UTC, judged from an
// HTTP `Date` header, and what the top line says about it. npm run check:clock.
// ===================================

export interface ClockCheck {
  /** Device time of the check (ms). */
  at: number;
  /** Device clock minus UTC, ms (0 within the check's own uncertainty). */
  skewMs: number;
}

/** From this far off the clock is reported as wrong. */
export const SKEW_WARN_MS = 10_000;
/** A check older than this no longer says the clock is right. */
export const STALE_MS = 6 * 3600_000;
/** A round trip longer than this tells too little to judge by. */
export const MAX_RTT_MS = 5_000;

/**
 * Device clock minus the server's, from an HTTP `Date` header (whole seconds) and the device times the request
 * was sent and answered. The server's moment lies in [Date, Date + 1 s) and somewhere in the round trip, so
 * only what is beyond that uncertainty counts; null when the header is unreadable or the round trip too long.
 */
export function skewOf(dateHeader: string | null | undefined, sent: number, received: number): number | null {
  if (!dateHeader) return null;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server) || received < sent || received - sent > MAX_RTT_MS) return null;
  const mid = (sent + received) / 2;
  const skew = mid - (server + 500);
  const doubt = 500 + (received - sent) / 2;
  return Math.abs(skew) <= doubt ? 0 : skew - Math.sign(skew) * doubt;
}

export type ClockState =
  | { kind: 'synced'; check: ClockCheck }
  | { kind: 'off'; check: ClockCheck }
  | { kind: 'stale'; check: ClockCheck }
  | { kind: 'unchecked' };

export function clockState(check: ClockCheck | null, now: number): ClockState {
  if (!check) return { kind: 'unchecked' };
  if (Math.abs(check.skewMs) >= SKEW_WARN_MS) return { kind: 'off', check };
  if (now - check.at > STALE_MS) return { kind: 'stale', check };
  return { kind: 'synced', check };
}

/** "+43 s", "−2 min 05 s", "+1 h 02 min". */
export function skewText(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  const s = Math.round(Math.abs(ms) / 1000);
  if (s < 60) return `${sign}${s} s`;
  if (s < 3600) return `${sign}${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${sign}${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
}

