// ===================================
// Where an inspection round stands — what it covers, what is done (signed in
// the round, latest per item), what is outstanding, in the vessel's walking
// order. Pure, tested (check:rounds).
// ===================================

import { EquipmentItem, CategoryKey } from '../types/equipment';
import { Inspection } from '../types/inspection';
import { InspectionRound } from '../types/round';
import { sortByDeck } from './labelBatch';

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
  const scope = sortByDeck(flat.filter((it) => cats.has(it.category)));
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
