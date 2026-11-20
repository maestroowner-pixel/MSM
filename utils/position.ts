// ===================================
// A ship's position, typed into cells (13 Oct 2026: "position or port — two
// separate fields, one or the other; for the position, prepared cells for the
// coordinates — in ballast, sewage, and everywhere a coordinate is needed").
//
// Written the way the record books write it — 38°45.2'N 002°10.6'E — and read
// back from that text, so every record keeps its `place` / `position` string
// and old entries open in the cells too. Pure: no React.
// ===================================

import { t } from './t';

export interface Coords {
  latDeg: string;
  latMin: string;
  ns: 'N' | 'S';
  lonDeg: string;
  lonMin: string;
  ew: 'E' | 'W';
}

export const EMPTY_COORDS: Coords = { latDeg: '', latMin: '', ns: 'N', lonDeg: '', lonMin: '', ew: 'E' };

const RE = /^\s*(\d{1,2})\s*°\s*(\d{1,2}(?:[.,]\d+)?)\s*['′]?\s*([NS])\s*[,; ]?\s*(\d{1,3})\s*°\s*(\d{1,2}(?:[.,]\d+)?)\s*['′]?\s*([EW])\s*$/i;

/** The cells of a position written as text; null when the text is not one (a port). */
export function parsePosition(text?: string): Coords | null {
  const m = RE.exec(text ?? '');
  if (!m) return null;
  return { latDeg: String(Number(m[1])), latMin: m[2].replace(',', '.'), ns: m[3].toUpperCase() as 'N' | 'S', lonDeg: String(Number(m[4])), lonMin: m[5].replace(',', '.'), ew: m[6].toUpperCase() as 'E' | 'W' };
}

/** What is wrong with the cells, or null when they make a position. All empty is not an error. */
export function coordsError(c: Coords): string | null {
  const filled = [c.latDeg, c.latMin, c.lonDeg, c.lonMin].filter((x) => x.trim() !== '').length;
  if (!filled) return null;
  if (filled < 4) return t('pos.errFill');
  const ld = Number(c.latDeg);
  const lm = Number(c.latMin.replace(',', '.'));
  const od = Number(c.lonDeg);
  const om = Number(c.lonMin.replace(',', '.'));
  if (![ld, lm, od, om].every(Number.isFinite)) return t('pos.errNum');
  if (ld < 0 || ld > 90 || (ld === 90 && lm > 0)) return t('pos.errLat');
  if (od < 0 || od > 180 || (od === 180 && om > 0)) return t('pos.errLon');
  if (lm < 0 || lm >= 60 || om < 0 || om >= 60) return t('pos.errMin');
  return null;
}

/** "38°45.2'N 002°10.6'E"; '' when the cells are empty or wrong. */
export function formatPosition(c: Coords): string {
  if (coordsError(c) || [c.latDeg, c.latMin, c.lonDeg, c.lonMin].some((x) => x.trim() === '')) return '';
  const min = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return `${n < 10 ? '0' : ''}${n.toFixed(1)}`;
  };
  return `${String(Number(c.latDeg)).padStart(2, '0')}°${min(c.latMin)}'${c.ns} ${String(Number(c.lonDeg)).padStart(3, '0')}°${min(c.lonMin)}'${c.ew}`;
}

/** A place as kept: the position when there is one, else the port. */
export const placeText = (position?: string, port?: string) => position?.trim() || port?.trim() || '';

// ─── The position from the Deck log (20 Nov 2026, Panama MMC-193 §4.2.4/4.4.4:
// the position in a record book entry agrees with the bridge logbook). The
// Deck log entry nearest the record's date and time (both ship's time), within
// `withinH` hours, if it has a position. Offered to the officer, never filled
// in silently: the officer sees which entry and when, and takes it.

/** What a Deck log entry needs for this (types/deckLog DeckEntry). */
export interface DeckFixSource {
  date: string;
  time: string;
  draft?: boolean;
  latDeg?: number;
  latMin?: number;
  latHem?: 'N' | 'S';
  lonDeg?: number;
  lonMin?: number;
  lonHem?: 'E' | 'W';
}

export interface DeckFix {
  position: string;
  date: string;
  time: string;
  /** Minutes from the record's time to the Deck log entry's (negative: before). */
  minutes: number;
  draft: boolean;
}

export function deckFix(entries: DeckFixSource[], date: string, time: string | undefined, withinH = 4): DeckFix | null {
  // No time, no match: a day has six watches and six positions.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time ?? '')) return null;
  const at = Date.parse(`${date}T${time}:00Z`);
  let best: DeckFix | null = null;
  for (const e of entries) {
    if (e.latDeg == null || e.latMin == null || e.lonDeg == null || e.lonMin == null) continue;
    const t2 = Date.parse(`${e.date}T${e.time}:00Z`);
    if (!Number.isFinite(t2)) continue;
    const minutes = Math.round((t2 - at) / 60000);
    if (Math.abs(minutes) > withinH * 60) continue;
    const position = formatPosition({ latDeg: String(e.latDeg), latMin: String(e.latMin), ns: e.latHem ?? 'N', lonDeg: String(e.lonDeg), lonMin: String(e.lonMin), ew: e.lonHem ?? 'E' });
    if (!position) continue;
    // Nearest wins; at the same distance, the earlier; a signed entry over a draft.
    const better = !best || Math.abs(minutes) < Math.abs(best.minutes) || (Math.abs(minutes) === Math.abs(best.minutes) && (minutes < best.minutes || (best.draft && !e.draft)));
    if (better) best = { position, date: e.date, time: e.time, minutes, draft: !!e.draft };
  }
  return best;
}
