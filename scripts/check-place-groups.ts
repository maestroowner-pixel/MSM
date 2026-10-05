/*
 * Position headings (services/placeGroups.ts) and the blank template's columns
 * (services/registerSheet.ts), through the real importer.
 *
 *   npm run check:places
 */
import * as XLSX from 'xlsx';
import { comparePlace, groupByPlace, usesDecks, NO_DECK_LABEL, NO_POSITION_LABEL } from '../services/placeGroups';
import { templateHeadings } from '../services/registerSheet';
import { parseWorkbookBytes } from '../services/excelImport';
import { planUpdate } from '../services/registerUpdate';
import { complianceDate } from '../utils/dates';
import { EquipmentItem } from '../types/equipment';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const it = (id: string, deck?: string, position?: string): EquipmentItem =>
  ({ id, category: 'lifebuoys', deck, position, updatedAt: 1 } as EquipmentItem);
const self = (x: EquipmentItem) => x;
const shape = (gs: Array<{ label: string; rows: EquipmentItem[] }>) =>
  gs.map((g) => `${g.label}[${g.rows.map((r) => r.id).join(',')}]`).join(' ');

// ---- headings --------------------------------------------------------------

const reg = [
  it('a', 'Main Deck', 'Main Deck Fwd'),
  it('b', 'Sun Deck', 'Mast'),
  it('c', 'main deck ', 'Main Deck Aft'),
  it('d', undefined, 'Tender garage'),
  it('e', 'Main Deck'),
  it('f', 'Bridge Deck', 'Wing PS'),
];
ok('a list with decks is headed by them', usesDecks(reg));
ok('a list with none is not', !usesDecks([it('x', undefined, 'Locker'), it('y', '  ', 'Locker')]));

const decks = groupByPlace(reg, self, true);
ok('decks are the headings, locations in order under them, no-deck last',
  shape(decks) === `Bridge Deck[f] Main Deck[c,a,e] Sun Deck[b] ${NO_DECK_LABEL}[d]`, shape(decks));

const locs = groupByPlace([it('x', undefined, 'Locker B'), it('y', undefined, 'locker b'), it('z'), it('w', undefined, 'Locker A')], self, false);
ok('no decks: location headings as before, spellings united, none last',
  shape(locs) === `Locker A[w] Locker B[x,y] ${NO_POSITION_LABEL}[z]`, shape(locs));

const numbered = ['10 Lower Deck', '2 Bridge Deck', '1 Sun Deck', 'Tank Deck'].sort(comparePlace);
ok('numbered decks sort by number, not by digit', numbered.join('|') === '1 Sun Deck|2 Bridge Deck|10 Lower Deck|Tank Deck', numbered.join('|'));
ok('"Deck 2" before "Deck 10"', comparePlace('Deck 2', 'Deck 10') < 0 && comparePlace('deck 10', 'Deck 2') > 0);
ok('zero-padded numbers too', comparePlace('01 - Sun Deck', '02 - Bridge Deck') < 0);

const tied = groupByPlace(
  [{ ...it('late', 'Main Deck', 'Aft'), no: 2 }, { ...it('soon', 'Main Deck', 'Aft'), no: 1 }],
  self, true, (a, b) => Number(a.no) - Number(b.no));
ok('same deck and location: the caller decides the order', shape(tied) === 'Main Deck[soon,late]', shape(tied));
ok('input not mutated', reg.map((x) => x.id).join() === 'a,b,c,d,e,f');

// ---- template columns ------------------------------------------------------

const raft = templateHeadings('liferafts');
ok('Liferafts sheet has Expiry beside Next Inspection', raft.includes('Expiry') && raft.includes('Next Inspection'));
ok('Liferafts sheet has Quantity beside Persons', raft.includes('Quantity') && raft.includes('Persons'));
ok('a category without rated persons has no Persons column', !templateHeadings('fire_extinguishers').includes('Persons'));
ok('every sheet has Deck then Location', raft.indexOf('Deck') + 1 === raft.indexOf('Location'));

// A filled-in Liferafts sheet from the template: a raft and its HRU on rows of their own.
const row = (v: Record<string, any>) => raft.map((h) => v[h] ?? null);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  raft,
  row({ No: 1, Type: 'Viking 16DK', Serial: 'VK-1001', Deck: 'Boat Deck', Location: 'PS', Persons: 16, Quantity: 1, 'Next Inspection': '01/03/2027', Expiry: '01/11/2028' }),
  row({ No: 2, Type: 'Hammar H20 HRU', Deck: 'Boat Deck', Location: 'PS', Quantity: 2, Expiry: '01/06/2027' }),
]), 'Liferafts');
const rows = parseWorkbookBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })).byCategory.liferafts ?? [];
const [r, hru] = rows;
ok('both rows import as liferaft items', rows.length === 2, String(rows.length));
ok('every template heading maps to a field — nothing lands in extras', rows.every((x) => !x.extra), JSON.stringify(rows.map((x) => x.extra)));
ok('raft keeps both dates', r?.nextInspection === '2027-03-01' && r?.expiry === '2028-11-01', `${r?.nextInspection} ${r?.expiry}`);
ok('raft is judged by its next inspection', !!r && complianceDate(r) === '2027-03-01');
ok('HRU carries its expiry and quantity', hru?.expiry === '2027-06-01' && hru?.quantity === 2, `${hru?.expiry} ${hru?.quantity}`);
ok('HRU with only an expiry is judged by it', !!hru && complianceDate(hru) === '2027-06-01');
ok('deck and location stay apart', r?.deck === 'Boat Deck' && r?.position === 'PS');

// Adding the Expiry column to a register imported without one: an update, not copies.
const before: EquipmentItem[] = rows.map((x, i) => {
  const { expiry, quantity, _fields, _msmId, ...rest } = x as any;
  return { ...rest, id: `lif_${i}` };
});
const plan = planUpdate(before, rows);
ok('loading the sheet with the new columns updates the same items', plan.added.length === 0 && plan.missing.length === 0 && plan.changed.length === 2,
  `added ${plan.added.length} missing ${plan.missing.length} changed ${plan.changed.length}`);
ok('…and keeps their ids', plan.changed.map((c) => c.after.id).join() === 'lif_0,lif_1');
ok('…and the raft’s next inspection', plan.changed[0]?.after.nextInspection === '2027-03-01' && plan.changed[0]?.after.expiry === '2028-11-01');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
