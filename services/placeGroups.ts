// ===================================
// The headings a category list is walked by — "sort by Position".
//
// A vessel keeps its equipment as Deck → Location → item ("Main Deck → Main Deck
// Aft → Lifebuoy No. 1") and asked for the list to read the same way (3 Oct
// 2026): the DECK is the heading, and the location says where on that deck. The
// list used to group by the Location column alone, which on a register with forty
// locations is forty headings of one or two items and no decks anywhere.
//
// A register that records no deck at all — the reference workbook has no such
// column — keeps grouping by location exactly as before; a heading per item-less
// "— No deck" would be worse than what it replaced.
//
// Pure on purpose: scripts/check-place-groups.ts runs it without a phone.
// ===================================

import { EquipmentItem } from '../types/equipment';
import { deckKey } from './labelBatch';

export const NO_DECK_LABEL = '— No deck';
export const NO_POSITION_LABEL = '— No position';

/**
 * Names in the order a person would put them: "Deck 2" before "Deck 10",
 * "01 Sun Deck" before "02 Bridge Deck", case ignored. Written out rather than
 * left to `localeCompare(…, { numeric: true })` so the order is the same in a
 * browser and under Hermes on both phones.
 */
export function comparePlace(a: string, b: string): number {
  const split = (s: string) => s.trim().toLowerCase().match(/\d+|\D+/g) ?? [];
  const pa = split(a);
  const pb = split(b);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    const nx = /^\d/.test(x);
    const ny = /^\d/.test(y);
    if (nx && ny) {
      const d = parseInt(x, 10) - parseInt(y, 10);
      if (d) return d;
    } else if (x !== y) {
      // A number sorts before a word, so "1 Sun Deck" leads "Bridge Deck".
      if (nx !== ny) return nx ? -1 : 1;
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

/**
 * The vessel's item numbers in walking order: 1, 2, 10 — "01-SD", "02-SD" — with
 * an unnumbered item last. Under a location this is the order the crew ticks
 * the round off in (asked for, 5 Oct 2026: once the Expiry column was filled in,
 * the soonest date led and the numbers came out shuffled).
 */
/**
 * "17-BD" compared as "BD 17": a series code written AFTER the number still names
 * the series, so the Bridge Deck extinguishers run 01-BD … 18-BD together and the
 * fire blankets 01-FB … follow as their own run, rather than interleaving by the
 * number alone (01-BD, 01-FB, 02-BD …). "SD-01" and plain numbers are unchanged.
 */
function numberKey(no: string): string {
  const m = no.match(/^(\d+)\s*[-/. ]\s*([A-Za-z].*)$/);
  return m ? `${m[2]} ${m[1]}` : no;
}

export function compareNumber(a?: number | string | null, b?: number | string | null): number {
  const x = a == null ? '' : String(a).trim();
  const y = b == null ? '' : String(b).trim();
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  return comparePlace(numberKey(x), numberKey(y));
}

/** Does this list record decks at all? Decides which column the headings come from. */
export function usesDecks(items: EquipmentItem[]): boolean {
  return items.some((it) => deckKey(it.deck) !== '');
}

export interface PlaceGroup<T> {
  key: string;
  /** The first spelling seen — "Sun Deck" and "sun deck " are one heading. */
  label: string;
  rows: T[];
}

/**
 * Rows under their headings: decks when `byDeck`, locations otherwise. Headings
 * in `comparePlace` order with the "none recorded" group last. Under a heading
 * rows run by item number (`compareNumber`); unnumbered rows follow, location by
 * location under a deck, and `tie` settles the rest.
 */
export function groupByPlace<T>(
  rows: T[],
  itemOf: (row: T) => EquipmentItem,
  byDeck: boolean,
  tie: (a: T, b: T) => number = () => 0
): PlaceGroup<T>[] {
  const none = byDeck ? NO_DECK_LABEL : NO_POSITION_LABEL;
  const groups = new Map<string, PlaceGroup<T>>();
  for (const row of rows) {
    const raw = (byDeck ? itemOf(row).deck : itemOf(row).position) ?? '';
    const key = deckKey(raw);
    const hit = groups.get(key);
    if (hit) hit.rows.push(row);
    else groups.set(key, { key, label: key ? raw.trim().replace(/\s+/g, ' ') : none, rows: [row] });
  }
  const out = [...groups.values()].sort((a, b) => {
    if (!a.key) return 1;
    if (!b.key) return -1;
    return comparePlace(a.label, b.label);
  });
  for (const g of out) {
    // The vessel's item number first: on a vessel that numbers its gear, the
    // number IS the walking order ("14-BD, 15-BD … 18-BD" along the Bridge Deck),
    // and the location names sorted A–Z are not (5 Oct 2026, from a screenshot:
    // 17, 16, 15, 14, 18 because Aft Tech Locker < Cinema < Guest Lift < Office).
    // Location, then `tie`, order only what the numbers leave equal — unnumbered
    // items, which come after the numbered ones.
    g.rows.sort((a, b) => {
      const n = compareNumber(itemOf(a).no, itemOf(b).no);
      if (n) return n;
      if (byDeck) {
        const pa = (itemOf(a).position ?? '').trim();
        const pb = (itemOf(b).position ?? '').trim();
        if (deckKey(pa) !== deckKey(pb)) {
          // An item with no location on its deck is the one to go and find — last.
          if (!pa) return 1;
          if (!pb) return -1;
          return comparePlace(pa, pb);
        }
      }
      return tie(a, b);
    });
  }
  return out;
}
