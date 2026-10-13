// ===================================
// Where an inspection round stands — what it covers, what is done (signed in
// the round, latest per item), what is outstanding, in the vessel's walking
// order. Pure, tested (check:rounds).
// ===================================

import { EquipmentItem, CategoryKey } from '../types/equipment';
import { Inspection } from '../types/inspection';
import { InspectionRound } from '../types/round';
import { CATEGORIES } from '../constants/categories';
import { deckKey } from './labelBatch';
import { NO_DECK_LABEL, NO_POSITION_LABEL, comparePlace, compareNumber, usesDecks } from './placeGroups';
import { typeWithSize } from '../utils/itemText';

export interface RoundProgress {
  scope: EquipmentItem[];
  /** Item id → the inspection that did it in this round (the latest). */
  done: Map<string, Inspection>;
  outstanding: EquipmentItem[];
  /** Per category: in scope and done. */
  byCategory: Map<CategoryKey, { total: number; done: number }>;
  /** Signed in the round on an item no longer in scope (removed, or its category taken out). */
  stray: Inspection[];
}

export function roundProgress(round: InspectionRound, flat: EquipmentItem[], trail: Inspection[], only?: CategoryKey[]): RoundProgress {
  const cats = new Set(only?.length ? only.filter((c) => round.categories.includes(c)) : round.categories);
  const scope = walkGroups(flat.filter((it) => cats.has(it.category))).flatMap((d) => d.places.flatMap((pl) => pl.items));
  const inScope = new Set(scope.map((it) => it.id));
  const done = new Map<string, Inspection>();
  const stray: Inspection[] = [];
  for (const i of trail) {
    if (i.roundId !== round.id) continue;
    if (!inScope.has(i.itemId)) {
      if (!only?.length) stray.push(i);
      continue;
    }
    const have = done.get(i.itemId);
    if (!have || i.at > have.at) done.set(i.itemId, i);
  }
  const byCategory = new Map<CategoryKey, { total: number; done: number }>();
  for (const it of scope) {
    const c = byCategory.get(it.category) ?? { total: 0, done: 0 };
    c.total++;
    if (done.has(it.id)) c.done++;
    byCategory.set(it.category, c);
  }
  return { scope, done, outstanding: scope.filter((it) => !done.has(it.id)), byCategory, stray };
}

/** Can an inspection of this item, on this period, be signed into the round? */
export function roundTakes(round: InspectionRound | null | undefined, item: Pick<EquipmentItem, 'category'> | undefined, period: string): boolean {
  return !!round && !round.closedAt && !!item && round.categories.includes(item.category) && round.period === period;
}

/** "Monthly · October 2026 · Fire extinguishers, EEBD". */
export function roundTitle(r: Pick<InspectionRound, 'period' | 'label' | 'categories'>, labelOf: (c: CategoryKey) => string): string {
  const p = r.period[0].toUpperCase() + r.period.slice(1);
  const cats = r.categories.map(labelOf);
  return `${p} · ${r.label} · ${cats.length > 3 ? `${cats.slice(0, 3).join(', ')} +${cats.length - 3}` : cats.join(', ')}`;
}

export interface WalkPlace { key: string; label: string; items: EquipmentItem[] }
export interface WalkDeck { key: string; label: string; places: WalkPlace[] }

/**
 * Deck → Location → Equipment number, the way the Equipment section reads (Jez,
 * 13 Oct 2026). Decks as the Equipment headings (comparePlace, none last). On a
 * deck the items run as Equipment lists them — category, then the vessel's item
 * number — and each location comes in where its first item does, so a location
 * is walked once and in the vessel's own order. A register with no decks is one
 * deck-less group of locations.
 */
export function walkGroups(items: EquipmentItem[]): WalkDeck[] {
  const catOrder = new Map<CategoryKey, number>(CATEGORIES.map((c, i) => [c.key, i]));
  const byDeck = usesDecks(items);
  const decks = new Map<string, { label: string; items: EquipmentItem[] }>();
  for (const it of items) {
    const raw = byDeck ? it.deck ?? '' : '';
    const k = deckKey(raw);
    const d = decks.get(k);
    if (d) d.items.push(it);
    else decks.set(k, { label: k ? raw.trim().replace(/\s+/g, ' ') : byDeck ? NO_DECK_LABEL : '', items: [it] });
  }
  const order = (a: EquipmentItem, b: EquipmentItem) =>
    (catOrder.get(a.category) ?? 999) - (catOrder.get(b.category) ?? 999) ||
    compareNumber(a.no, b.no) ||
    comparePlace(a.position ?? '', b.position ?? '') ||
    typeWithSize(a).localeCompare(typeWithSize(b));
  return [...decks.entries()]
    .sort(([ka, a], [kb, b]) => (!ka ? 1 : !kb ? -1 : comparePlace(a.label, b.label)))
    .map(([key, d]) => {
      const places = new Map<string, WalkPlace>();
      for (const it of [...d.items].sort(order)) {
        const raw = it.position ?? '';
        const k = deckKey(raw);
        const pl = places.get(k);
        if (pl) pl.items.push(it);
        else places.set(k, { key: k, label: k ? raw.trim().replace(/\s+/g, ' ') : NO_POSITION_LABEL, items: [it] });
      }
      // Items with no location on the deck are the ones to go and find — last.
      const list = [...places.values()];
      return { key, label: d.label, places: [...list.filter((x) => x.key), ...list.filter((x) => !x.key)] };
    });
}

/**
 * The open round an inspection counts towards, wherever it was signed from — the
 * round screen, the Dashboard, the scanner or the widget (Jez, 13 Oct 2026). Only
 * a round of the SAME period that covers the item's category; if two do, the one
 * this device is working in, else the most recently started.
 */
export function roundFor(rounds: InspectionRound[], item: Pick<EquipmentItem, 'category'> | undefined, period: string, preferId?: string | null): InspectionRound | null {
  const fit = rounds.filter((r) => roundTakes(r, item, period));
  return fit.find((r) => r.id === preferId) ?? fit.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

/** An open round of this period already covering one of these categories — starting another would split the work. */
export function overlappingRound(rounds: InspectionRound[], period: string, cats: CategoryKey[]): InspectionRound | null {
  return rounds.find((r) => !r.closedAt && r.period === period && r.categories.some((c) => cats.includes(c))) ?? null;
}
