import { DeckEntry, Visibility, WatchPeriod, WindDir } from '../types/deckLog';
import { entryZone, shipHm, shipHour, shipToday } from '../utils/shipTime';

export const PERIOD_LABEL: Record<WatchPeriod, string> = {
  '00-04': '00:00 – 04:00',
  '04-08': '04:00 – 08:00',
  '08-12': '08:00 – 12:00',
  '12-16': '12:00 – 16:00',
  '16-20': '16:00 – 20:00',
  '20-00': '20:00 – 00:00',
  noon: 'Noon',
  other: 'Other',
  port: 'Port',
};

export const PERIOD_SHORT: Record<WatchPeriod, string> = {
  '00-04': '00–04',
  '04-08': '04–08',
  '08-12': '08–12',
  '12-16': '12–16',
  '16-20': '16–20',
  '20-00': '20–00',
  noon: 'Noon',
  other: 'Other',
  port: 'Port',
};

export const WIND_DIRS: WindDir[] = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export const BEAUFORT_LABEL: Record<number, string> = {
  0: '0 — Calm',
  1: '1 — Light air',
  2: '2 — Light breeze',
  3: '3 — Gentle breeze',
  4: '4 — Moderate breeze',
  5: '5 — Fresh breeze',
  6: '6 — Strong breeze',
  7: '7 — Near gale',
  8: '8 — Gale',
  9: '9 — Strong gale',
  10: '10 — Storm',
  11: '11 — Violent storm',
  12: '12 — Hurricane',
};

export const SEA_STATE_LABEL: Record<number, string> = {
  0: '0 — Glassy',
  1: '1 — Rippled',
  2: '2 — Wavelets',
  3: '3 — Slight',
  4: '4 — Moderate',
  5: '5 — Rough',
  6: '6 — Very rough',
  7: '7 — High',
  8: '8 — Very high',
  9: '9 — Phenomenal',
};

/** Weather summary line for list view. */
export function weatherSummary(e: DeckEntry): string {
  const parts: string[] = [];
  if (e.windDir && e.windBft !== undefined) parts.push(`${e.windDir} Bft ${e.windBft}`);
  if (e.seaState !== undefined) parts.push(`SS ${e.seaState}`);
  if (e.visibility) {
    const vis: Record<Visibility, string> = { good: 'Good', moderate: 'Mod', poor: 'Poor', fog: 'Fog' };
    parts.push(vis[e.visibility]);
  }
  return parts.join(' · ') || '—';
}

/** Position string for list view. */
export function positionStr(e: DeckEntry): string {
  if (e.latDeg !== undefined && e.latMin !== undefined) {
    const lat = `${e.latDeg}°${e.latMin.toFixed(1)}'${e.latHem ?? 'N'}`;
    const lon = e.lonDeg !== undefined
      ? `  ${String(e.lonDeg).padStart(3, '0')}°${(e.lonMin ?? 0).toFixed(1)}'${e.lonHem ?? 'E'}`
      : '';
    return lat + lon;
  }
  if (e.lat && e.lon) return `${e.lat}  ${e.lon}`;
  return '';
}

/** Sort deck entries newest first. */
export function sortDeckEntries(entries: DeckEntry[]): DeckEntry[] {
  return [...entries].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.time.localeCompare(a.time);
  });
}

/** Today in YYYY-MM-DD, ship's time. */
export function todayStr(): string {
  return shipToday();
}

/** Ship's time as HH:MM. */
export function nowTime(): string {
  return shipHm();
}

/** Guess the current watch period from the local time. */
export function currentPeriod(): WatchPeriod {
  const h = shipHour();
  if (h < 4) return '00-04';
  if (h < 8) return '04-08';
  if (h < 12) return '08-12';
  if (h < 16) return '12-16';
  if (h < 20) return '16-20';
  return '20-00';
}

/**
 * The entry as it is saved, with the ship's zone of its date and time frozen at the signature
 * (Panama MMC-193 §4.1.2: ship's time and UTC). A draft gets none yet; an entry already signed
 * is left as it is — the rules let a signed entry take only the Master's review, and a zone
 * added later would not be the one it was signed in.
 */
export function zoneOnSign<T extends { draft?: boolean; shipOffset?: string; date: string; time: string }>(row: T, prev?: { draft?: boolean } | null): T {
  if (row.draft || row.shipOffset || (prev && !prev.draft)) return row;
  if (!row.date) return row;
  return { ...row, shipOffset: entryZone(row.date, row.time) };
}
