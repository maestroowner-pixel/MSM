// ===================================
// Garbage Record Book — the MARPOL Annex V rules on what may go into the sea,
// and the month's totals, as pure functions (types/garbage.ts).
//
// Discharge into the sea (Annex V, regs 4 and 6; the Mediterranean, Baltic,
// North Sea and other special areas are at least as strict for food):
//   A plastics, C domestic, D cooking oil, E incinerator ash, F operational
//   wastes, H fishing gear, I e-waste  → prohibited
//   B food waste                       → at least 12 nm from land (3 nm if
//                                        comminuted to < 25 mm), en route
//   G animal carcasses                 → as far as possible, at least 100 nm
// The app warns; it does not stop an officer recording what actually happened —
// an accidental loss must be entered whatever it was.
// ===================================

import { GarbageCategory, GarbageEntry, GarbageMethod } from '../types/garbage';

export function seaDischargeProblem(e: Pick<GarbageEntry, 'category' | 'method' | 'distanceNm' | 'comminuted'>): string | null {
  if (e.method !== 'sea') return null;
  const prohibited: GarbageCategory[] = ['A', 'C', 'D', 'E', 'F', 'H', 'I'];
  if (prohibited.includes(e.category)) return 'Discharge of this category into the sea is prohibited (MARPOL Annex V). If it was lost or discharged by accident, record it as accidental.';
  if (e.distanceNm == null) return 'Give the distance from the nearest land.';
  if (e.category === 'B') {
    const min = e.comminuted ? 3 : 12;
    if (e.distanceNm < min) return `Food waste may be discharged only ${min} nm or more from land${e.comminuted ? ' (comminuted)' : ''}.`;
  }
  if (e.category === 'G' && e.distanceNm < 100) return 'Animal carcasses: at least 100 nm from land.';
  return null;
}

export interface GarbageMonth {
  entries: GarbageEntry[];
  /** m³ by category and method. */
  totals: Record<GarbageCategory, Record<GarbageMethod, number>>;
  total: number;
}

const empty = (): Record<GarbageMethod, number> => ({ shore: 0, sea: 0, incineration: 0, accidental: 0 });

export function garbageMonth(entries: GarbageEntry[], month: string): GarbageMonth {
  const list = entries.filter((e) => e.date.startsWith(month)).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const totals = Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as GarbageCategory[]).map((c) => [c, empty()])) as GarbageMonth['totals'];
  let total = 0;
  for (const e of list) {
    totals[e.category][e.method] = Math.round((totals[e.category][e.method] + e.volume) * 1000) / 1000;
    total += e.volume;
  }
  return { entries: list, totals, total: Math.round(total * 1000) / 1000 };
}

/** "Palma de Mallorca" or "38°45.2'N 002°10.6'E, 14 nm from land". */
export function placeText(e: GarbageEntry): string {
  if (e.port) return e.port;
  return [e.position, e.distanceNm != null ? `${e.distanceNm} nm from land` : null].filter(Boolean).join(', ');
}
