/*
 * Label batches (services/labelBatch.ts) — which stickers "print them all" prints.
 *
 *   npm run check:labels
 */
import { deckKey, listDecks, selectLabelItems, NO_DECK } from '../services/labelBatch';
import { EquipmentItem } from '../types/equipment';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const it = (id: string, category: any, deck: string | undefined, no?: number | string, type?: string): EquipmentItem =>
  ({ id, category, deck, no, type, updatedAt: 1 } as EquipmentItem);

const reg: EquipmentItem[] = [
  it('a', 'extinguishers', 'Sun Deck', 3, 'CO2'),
  it('b', 'extinguishers', 'sun deck ', 1, 'Powder'),
  it('c', 'extinguishers', 'Main Deck', 2, 'Foam'),
  it('d', 'lifejackets', 'Main Deck', '01-MD'),
  it('e', 'lifejackets', undefined, 'x'),
  it('f', 'liferafts', 'Bridge Deck', 1),
];

const decks = listDecks(reg);
ok('two spellings of one deck are one chip', decks.filter((d) => d.label.toLowerCase() === 'sun deck').length === 1);
ok('first spelling wins the label', decks.some((d) => d.label === 'Sun Deck'));
ok('decks most-populated first', decks[0].label === 'Main Deck' && decks[0].count === 2);
ok('no-deck bucket last', decks[decks.length - 1].key === NO_DECK && decks[decks.length - 1].count === 1);
ok('no decks at all → no deck filter', listDecks([it('z', 'extinguishers', undefined)]).length === 0);

const all = selectLabelItems(reg, {});
ok('no filter = everything', all.length === reg.length);
ok('deck by deck, no-deck last', all[all.length - 1].id === 'e');
ok('within a deck: category order (LSA before FFE) then item number',
  all.slice(0, 2).map((x) => x.id).join() === 'd,c', all.map((x) => x.id).join());
ok('numbers sort numerically within a category',
  selectLabelItems(reg, { decks: [deckKey('Sun Deck')] }).map((x) => x.id).join() === 'b,a');

ok('group filter', selectLabelItems(reg, { group: 'LSA' }).every((x) => x.category !== 'extinguishers'));
ok('category filter', selectLabelItems(reg, { categories: ['liferafts'] }).map((x) => x.id).join() === 'f');
ok('deck filter matches either spelling', selectLabelItems(reg, { decks: ['sun deck'] }).length === 2);
ok('no-deck bucket is selectable', selectLabelItems(reg, { decks: [NO_DECK] }).map((x) => x.id).join() === 'e');
ok('empty category list = nothing', selectLabelItems(reg, { categories: [] }).length === 0);
ok('input not mutated', reg[0].id === 'a' && reg[1].id === 'b');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
