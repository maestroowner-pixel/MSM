// ===================================
// IMO signs (types/imoSigns.ts) — which signs must be posted where, read from
// the LSA/FFE register; the state of each from the latest round; and what to
// fit from the spare signs in stock and what to order. Pure — checked by
// `npm run check:imosigns`.
//
// One sign per place: three extinguishers in one locker want one extinguisher
// sign there, so the register's items are grouped by sign, deck and position.
// An item with no position cannot be found on a round, so it stands alone,
// named by its number — the list says where the register is incomplete.
// ===================================

import type { CategoryKey, EquipmentItem } from '../types/equipment';
import type { SignCheck, SignLook, SignPlace, SignState } from '../types/imoSigns';
import type { StoreItem } from '../types/stores';
import type { Batch } from './hospital';
import { SIGN_MAP } from './imoSignCatalogue';

const low = (s: unknown) => String(s ?? '').toLowerCase();
const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/** The sign an item of the register needs, or null — a PLB, a harness, a detector want none. */
export function signFor(category: CategoryKey, item: Pick<EquipmentItem, 'type' | 'make' | 'size' | 'remarks'>): string | null {
  const text = low(`${item.type ?? ''} ${item.size ?? ''} ${item.remarks ?? ''}`);
  switch (category) {
    case 'liferafts': return has(text, 'davit') ? 'davit_liferaft' : 'liferaft';
    case 'lifebuoys': return has(text, 'smoke', 'mob signal') ? 'lifebuoy_smoke' : has(text, 'light') ? 'lifebuoy_light' : has(text, 'line') ? 'lifebuoy_line' : 'lifebuoy';
    case 'lifejackets':
    case 'inflatable_lifejackets': return has(text, 'infant', 'baby') ? 'infant_lifejacket' : has(text, 'child', 'kid') ? 'child_lifejacket' : 'lifejacket';
    case 'immersion_suits': return 'immersion_suit';
    case 'mob': return has(text, 'lifeboat') ? 'lifeboat' : 'rescue_boat';
    case 'gmdss_pyro':
      if (has(text, 'epirb')) return 'epirb';
      if (has(text, 'sart')) return 'sart';
      if (has(text, 'line throw', 'line-throw', 'linethrow')) return 'line_throwing';
      if (has(text, 'rocket', 'parachute')) return 'rocket';
      if (has(text, 'flare', 'smoke', 'pyro', 'hand')) return 'pyro';
      if (has(text, 'vhf', 'radio', 'two-way', 'two way', 'gmdss')) return 'radio';
      return null;
    case 'emergency_escapes': return 'exit';
    case 'fire_extinguishers': return 'extinguisher';
    case 'hydrants_fireboxes': return has(text, 'hose', 'box', 'reel') || !has(text, 'hydrant') ? 'fire_hose' : 'hydrant';
    case 'fifi_ba': return has(text, 'bottle', 'cylinder', 'spare') ? null : 'fireman';
    case 'eebd': return 'eebd';
    case 'first_aid': return 'first_aid';
    case 'eye_wash': return 'eye_wash';
    default: return null;
  }
}

const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** The same place on every phone: sign, deck and position, case- and space-blind. */
export const placeKey = (sign: string, deck?: string, position?: string, itemId?: string) =>
  norm(position) ? `${sign}|${norm(deck)}|${norm(position)}` : `${sign}|item:${itemId ?? ''}`;

export interface SignSpot {
  key: string;
  sign: string;
  deck?: string;
  position?: string;
  /** How many signs at the place. */
  qty: number;
  /** The register's items it marks (empty = added by the vessel). */
  itemIds: string[];
  /** The item's No. when the register gives no position. */
  itemNo?: string;
  /** The vessel's own row (SignPlace id). */
  placeId?: string;
}

/**
 * Every place a sign must be: worked out from the register, less the ones the
 * vessel hides, plus the vessel's own. Sorted deck by deck, then position, then sign.
 */
export function signSpots(byCategory: Partial<Record<CategoryKey, EquipmentItem[]>>, places: SignPlace[]): SignSpot[] {
  const live = places.filter((p) => !p.removed);
  const hidden = new Set(live.map((p) => p.hides).filter(Boolean) as string[]);
  const map = new Map<string, SignSpot>();
  for (const [cat, items] of Object.entries(byCategory) as [CategoryKey, EquipmentItem[]][]) {
    for (const it of items ?? []) {
      const sign = signFor(cat, it);
      if (!sign) continue;
      const key = placeKey(sign, it.deck, it.position, it.id);
      if (hidden.has(key)) continue;
      const s = map.get(key);
      if (s) s.itemIds.push(it.id);
      else map.set(key, {
        key, sign, qty: 1, itemIds: [it.id],
        ...(it.deck?.trim() ? { deck: it.deck.trim() } : {}),
        ...(it.position?.trim() ? { position: it.position.trim() } : { itemNo: it.no != null && String(it.no).trim() ? String(it.no).trim() : undefined }),
      });
    }
  }
  for (const p of live) {
    if (!p.sign || !SIGN_MAP[p.sign]) continue;
    const key = `own:${p.id}`;
    map.set(key, { key, sign: p.sign, qty: Math.max(1, Math.round(p.qty ?? 1)), itemIds: [], placeId: p.id, ...(p.deck?.trim() ? { deck: p.deck.trim() } : {}), ...(p.position?.trim() ? { position: p.position.trim() } : {}) });
  }
  // Empty last: '~' would sort first under localeCompare.
  const by = (a: string | undefined, b: string | undefined) => (!a ? 1 : 0) - (!b ? 1 : 0) || (a ?? '').localeCompare(b ?? '', undefined, { numeric: true });
  return [...map.values()].sort((a, b) => by(a.deck, b.deck) || by(a.position, b.position) || by(SIGN_MAP[a.sign]?.name, SIGN_MAP[b.sign]?.name));
}

export interface SpotState {
  state: SignState | 'unseen';
  /** How many of the place's signs to replace (faded or missing). */
  bad: number;
  look?: SignLook;
  check?: SignCheck;
}

/** The latest look at each place, from the rounds and the replacements. */
export function spotStates(spots: SignSpot[], checks: SignCheck[]): Map<string, SpotState> {
  const latest = new Map<string, { look: SignLook; check: SignCheck }>();
  for (const c of [...checks].sort((a, b) => a.at - b.at)) {
    for (const l of c.looks) latest.set(l.key, { look: l, check: c });
  }
  const out = new Map<string, SpotState>();
  for (const s of spots) {
    const x = latest.get(s.key);
    // A look at another sign at the same key (the item's sign changed) does not count.
    if (!x || x.look.sign !== s.sign) { out.set(s.key, { state: 'unseen', bad: 0 }); continue; }
    const bad = x.look.state === 'ok' ? 0 : Math.min(s.qty, Math.max(1, x.look.bad ?? s.qty));
    out.set(s.key, { state: x.look.state, bad, look: x.look, check: x.check });
  }
  return out;
}

export interface SignNeed {
  sign: string;
  /** Faded or missing at the places, in signs. */
  replace: number;
  spots: SignSpot[];
  /** Where the order is received: the first of `stocks`. */
  stock?: StoreItem;
  /** The sign's spares in every IMO signs store aboard (services/imoSigns sparesOf). */
  stocks: StoreItem[];
  /** Serviceable spares on board, all stores together. */
  spare: number;
  /** On an open order already. */
  onOrder: number;
  /** Fit from stock now. */
  fit: number;
  /** To order: what the spares do not cover, and the store back to its minimum. */
  order: number;
}

/**
 * A sign's spares in the IMO signs stores — the item made from the catalogue
 * (`signId`) or one typed or imported under the sign's name. A vessel may keep
 * them in more than one store; all count, the catalogue's items first.
 */
export function sparesOf(sign: string, storeItems: StoreItem[]): StoreItem[] {
  const name = norm(SIGN_MAP[sign]?.name);
  const mine = storeItems.filter((i) => i.store === 'signs' && !i.deleted && (i.signId ? i.signId === sign : !!name && norm(i.name) === name));
  return mine.sort((a, b) => (a.signId ? 0 : 1) - (b.signId ? 0 : 1) || a.order - b.order);
}

/**
 * Per sign: what to replace, what the spares cover, what to order. `usable` and
 * `onOrder` are by store item id (services/stores storeStatus, sparesNeed onOrder).
 * Ordering also brings the store back to its minimum after the spares are fitted,
 * so the store's own list to order does not ask again.
 */
export function signNeeds(spots: SignSpot[], states: Map<string, SpotState>, storeItems: StoreItem[], usable: Map<string, number>, onOrder: Map<string, number>): SignNeed[] {
  const by = new Map<string, SignSpot[]>();
  for (const s of spots) if ((states.get(s.key)?.bad ?? 0) > 0) by.set(s.sign, [...(by.get(s.sign) ?? []), s]);
  const out: SignNeed[] = [];
  for (const [sign, list] of by) {
    const replace = list.reduce((n, s) => n + (states.get(s.key)?.bad ?? 0), 0);
    const stocks = sparesOf(sign, storeItems);
    const sum = (f: (i: StoreItem) => number) => stocks.reduce((n, i) => n + f(i), 0);
    const spare = sum((i) => usable.get(i.id) ?? 0);
    const coming = sum((i) => onOrder.get(i.id) ?? 0);
    const fit = Math.min(replace, spare);
    const min = sum((i) => i.min ?? 0);
    const stock = stocks[0];
    // What the places still lack after the fitting, plus the store back up to its minimum, less what is coming.
    const order = Math.max(0, replace - fit + Math.max(0, min - (spare - fit)) - coming);
    out.push({ sign, replace, spots: list, ...(stock ? { stock } : {}), stocks, spare, onOrder: coming, fit, order });
  }
  return out.sort((a, b) => (SIGN_MAP[a.sign]?.name ?? a.sign).localeCompare(SIGN_MAP[b.sign]?.name ?? b.sign));
}

/** "Main deck · Fwd corridor" / "No. 7 (no position)" */
export const spotPlace = (s: Pick<SignSpot, 'deck' | 'position' | 'itemNo'>, noPosition = 'no position') =>
  [s.deck, s.position].filter(Boolean).join(' · ') || (s.itemNo ? `No. ${s.itemNo} (${noPosition})` : `(${noPosition})`);

/**
 * The places fitted from stock, in list order until the spares run out: a place
 * fully fitted reads fine again, one fitted in part keeps the rest to replace.
 */
export function fittedLooks(needs: SignNeed[], states: Map<string, SpotState>): SignLook[] {
  const out: SignLook[] = [];
  for (const n of needs) {
    let left = n.fit;
    for (const s of n.spots) {
      if (left <= 0) break;
      const st = states.get(s.key);
      const bad = st?.bad ?? 0;
      if (!bad) continue;
      const put = Math.min(bad, left);
      left -= put;
      const rest = bad - put;
      out.push({
        key: s.key, sign: s.sign, qty: s.qty, ...(s.deck ? { deck: s.deck } : {}), ...(s.position ? { position: s.position } : {}),
        state: rest ? (st!.state as SignState) : 'ok', ...(rest ? { bad: rest } : {}), note: `${put} fitted from stock`,
      });
    }
  }
  return out;
}

export interface SignOrderLine {
  description: string;
  qty: number;
  unit: string;
  storeItemId?: string;
  notes: string;
}

/** The order's lines (English — the order goes to the supplier): the sign, its standard, where it goes. */
export function signOrderLines(needs: SignNeed[], noPosition = 'no position'): SignOrderLine[] {
  return needs.filter((n) => n.order > 0).map((n) => {
    const s = SIGN_MAP[n.sign];
    const where = n.spots.map((p) => spotPlace(p, noPosition));
    const places = where.length > 4 ? `${where.slice(0, 4).join('; ')} and ${where.length - 4} more` : where.join('; ');
    const restock = n.order - Math.max(0, n.replace - n.fit);
    return {
      description: `IMO sign — ${s?.name ?? n.sign}, photoluminescent${n.stock?.size ? `, ${n.stock.size}` : ''}`,
      qty: n.order,
      unit: n.stock?.unit ?? 'pcs',
      ...(n.stock ? { storeItemId: n.stock.id } : {}),
      notes: [s?.ref, n.replace - n.fit > 0 ? `faded or missing at: ${places}` : '', restock > 0 ? `${restock} to keep as spare` : ''].filter(Boolean).join(' — '),
    };
  });
}

/**
 * Taking `qty` spares off the shelf: batch by batch, new first, then good — never
 * poor. Each part carries its batch's wear (and date, lot) so the stock comes off
 * the right batch. Fewer than asked when there are not enough.
 */
export function spareTakes(batches: Batch[], qty: number): { qty: number; wear?: Batch['wear']; expiry?: string; batchNo?: string }[] {
  const rank = (b: Batch) => (b.wear === 'new' ? 0 : 1);
  const out: { qty: number; wear?: Batch['wear']; expiry?: string; batchNo?: string }[] = [];
  let left = qty;
  for (const b of batches.filter((x) => x.qty > 0 && x.wear !== 'poor').sort((a, b2) => rank(a) - rank(b2))) {
    if (left <= 0) break;
    const n = Math.min(left, b.qty);
    left -= n;
    out.push({ qty: n, ...(b.wear ? { wear: b.wear } : {}), ...(b.expiry ? { expiry: b.expiry } : {}), ...(b.batchNo ? { batchNo: b.batchNo } : {}) });
  }
  return out;
}
