// ===================================
// A ship's position, typed into cells (13 Oct 2026: "position or port — two
// separate fields, one or the other; for the position, prepared cells for the
// coordinates — in ballast, sewage, and everywhere a coordinate is needed").
//
// Written the way the record books write it — 38°45.2'N 002°10.6'E — and read
// back from that text, so every record keeps its `place` / `position` string
// and old entries open in the cells too. Pure: no React.
// ===================================

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
  if (filled < 4) return 'Fill in degrees and minutes of both latitude and longitude.';
  const ld = Number(c.latDeg);
  const lm = Number(c.latMin.replace(',', '.'));
  const od = Number(c.lonDeg);
  const om = Number(c.lonMin.replace(',', '.'));
  if (![ld, lm, od, om].every(Number.isFinite)) return 'Numbers only.';
  if (ld < 0 || ld > 90 || (ld === 90 && lm > 0)) return 'Latitude is 0–90°.';
  if (od < 0 || od > 180 || (od === 180 && om > 0)) return 'Longitude is 0–180°.';
  if (lm < 0 || lm >= 60 || om < 0 || om >= 60) return 'Minutes are 0–59.9.';
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
