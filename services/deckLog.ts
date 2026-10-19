import { DeckEntry, Visibility, WatchPeriod, WindDir } from '../types/deckLog';

export const PERIOD_LABEL: Record<WatchPeriod, string> = {
  '00-04': '00:00 – 04:00',
  '04-08': '04:00 – 08:00',
  '08-12': '08:00 – 12:00',
  '12-16': '12:00 – 16:00',
  '16-20': '16:00 – 20:00',
  '20-00': '20:00 – 00:00',
  noon: 'Noon',
  other: 'Other',
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

/** Today in YYYY-MM-DD. */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current local time as HH:MM. */
export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

/** Guess the current watch period from the local time. */
export function currentPeriod(): WatchPeriod {
  const h = new Date().getHours();
  if (h < 4) return '00-04';
  if (h < 8) return '04-08';
  if (h < 12) return '08-12';
  if (h < 16) return '12-16';
  if (h < 20) return '16-20';
  return '20-00';
}
