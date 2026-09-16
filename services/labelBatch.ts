// ===================================
// Label batches — which stickers to print when the answer is "all of them".
//
// Setting a vessel up means labelling a few hundred items in an afternoon, and
// the multi-select on a category list makes that a category at a time, with a
// thumb. This module answers the question the Label screen never had to ask:
// GIVEN a group, some categories and some decks, which items are that? Pure on
// purpose — the picker screen shows the count this function returns and the
// Label screen prints exactly that list, so the two cannot disagree.
//
// Decks are the vessel's own words ("Sun Deck", "sun deck", "SUN DECK " are one
// deck), and an item with no deck recorded is still an item that needs a sticker,
// so it gets a bucket of its own rather than vanishing from every filter.
// ===================================

import { EquipmentItem, CategoryKey, Group } from '../types/equipment';
import { CATEGORIES } from '../constants/categories';
import { typeWithSize } from '../utils/itemText';

/** The deck key for an item with none recorded. Never a real deck name. */
export const NO_DECK = '';

/** Case- and space-insensitive key for a deck, so two spellings are one chip. */
export function deckKey(deck?: string | null): string {
  return (deck ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface DeckOption {
  /** What the filter matches on (deckKey). NO_DECK for items without one. */
  key: string;
  /** The first spelling seen in the register — what the chip says. */
  label: string;
  count: number;
}

/**
 * Every deck the register mentions, most-populated first, plus the "no deck"
 * bucket LAST if any item lacks one. Empty when nothing carries a deck at all —
 * a register with no decks should not show a deck filter with one chip on it.
 */
export function listDecks(items: EquipmentItem[]): DeckOption[] {
  const seen = new Map<string, DeckOption>();
  for (const it of items) {
    const key = deckKey(it.deck);
    const cur = seen.get(key);
    if (cur) cur.count += 1;
    else seen.set(key, { key, label: key === NO_DECK ? 'No deck' : (it.deck ?? '').trim().replace(/\s+/g, ' '), count: 1 });
  }
  const named = [...seen.values()].filter((d) => d.key !== NO_DECK).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (!named.length) return [];
  const none = seen.get(NO_DECK);
  return none ? [...named, none] : named;
}

export interface LabelBatchQuery {
  /** Restrict to one group; undefined = every group. */
  group?: Group;
  /** Restrict to these categories; undefined = every category in the group. */
  categories?: CategoryKey[];
  /** Restrict to these deck keys (see deckKey); undefined = every deck. */
  decks?: string[];
}

const numberOf = (it: EquipmentItem): number => {
  const n = typeof it.no === 'number' ? it.no : parseFloat(String(it.no ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

/**
 * The items a batch covers, in the order they should come off the printer:
 * deck by deck (a person sticking labels walks a deck, not a category), then
 * category in the app's own order, then item number, then name. Items with no
 * deck print last — they are the ones somebody has to go and find.
 */
export function selectLabelItems(items: EquipmentItem[], q: LabelBatchQuery): EquipmentItem[] {
  const catOrder = new Map<CategoryKey, number>(CATEGORIES.map((c, i) => [c.key, i]));
  const groupOf = new Map<CategoryKey, Group>(CATEGORIES.map((c) => [c.key, c.group]));
  const cats = q.categories ? new Set(q.categories) : null;
  const decks = q.decks ? new Set(q.decks) : null;

  const picked = items.filter((it) => {
    if (q.group && groupOf.get(it.category) !== q.group) return false;
    if (cats && !cats.has(it.category)) return false;
    if (decks && !decks.has(deckKey(it.deck))) return false;
    return true;
  });

  const deckRank = new Map<string, number>(listDecks(picked).map((d, i) => [d.key, i]));
  return picked.sort((a, b) => {
    const da = deckRank.get(deckKey(a.deck)) ?? 0;
    const db = deckRank.get(deckKey(b.deck)) ?? 0;
    if (da !== db) return da - db;
    const ca = catOrder.get(a.category) ?? 999;
    const cb = catOrder.get(b.category) ?? 999;
    if (ca !== cb) return ca - cb;
    const na = numberOf(a);
    const nb = numberOf(b);
    if (na !== nb) return na - nb;
    return typeWithSize(a).localeCompare(typeWithSize(b));
  });
}
