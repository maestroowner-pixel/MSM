/*
 * "Set dates" on several items at once (services/bulkEdit.ts).
 *
 *   npm run check:bulk
 */
import { applyBulk, isEmptyPatch } from '../services/bulkEdit';
import { EquipmentItem } from '../types/equipment';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const att = [{ id: 'p1', uri: 'file:///a.jpg', name: 'a.jpg', type: 'image' }] as any;
const items: EquipmentItem[] = [
  { id: 'a', category: 'fire_extinguishers', no: '01-BD', nextInspection: '2026-10-01', expiry: '2030-01-01', remarks: 'Bracket loose', attachments: att, flagged: true, updatedAt: 1 } as EquipmentItem,
  { id: 'b', category: 'fire_extinguishers', no: '02-BD', nextInspection: '2026-10-01', updatedAt: 1 } as EquipmentItem,
  { id: 'c', category: 'fire_extinguishers', no: '03-BD', nextInspection: '2026-10-01', updatedAt: 1 } as EquipmentItem,
];
const NOW = 99;

const r = applyBulk(items, new Set(['a', 'b']), { nextInspection: '2027-10-01' }, NOW);
const [a, b, c] = r.items;
ok('the chosen items get the new next inspection', a.nextInspection === '2027-10-01' && b.nextInspection === '2027-10-01');
ok('an item not chosen is untouched (same object)', c === items[2]);
ok('a date left blank keeps each item\'s own', a.expiry === '2030-01-01' && b.expiry === undefined);
ok('ids, order and count unchanged', r.items.map((x) => x.id).join() === 'a,b,c');
ok('attachments, flags and comments stay', a.attachments === att && a.flagged === true && a.remarks === 'Bracket loose');
ok('changed items are stamped for sync, two of them', a.updatedAt === NOW && b.updatedAt === NOW && r.changed === 2);
ok('input not mutated', items[0].nextInspection === '2026-10-01' && items[0].updatedAt === 1);

const again = applyBulk(r.items, new Set(['a', 'b']), { nextInspection: '2027-10-01' }, 200);
ok('applying the same date again changes nothing', again.changed === 0 && again.items[0].updatedAt === NOW);

const n = applyBulk(items, new Set(['a', 'b']), { expiry: '2031-05-01', note: 'Serviced by Seafire 05 Oct 2026' }, NOW);
ok('expiry set, next inspection kept', n.items[0].expiry === '2031-05-01' && n.items[0].nextInspection === '2026-10-01');
ok('the note goes under existing comments', n.items[0].remarks === 'Bracket loose\nServiced by Seafire 05 Oct 2026', JSON.stringify(n.items[0].remarks));
ok('…or becomes the comment', n.items[1].remarks === 'Serviced by Seafire 05 Oct 2026');
const twice = applyBulk(n.items, new Set(['a']), { note: '  Serviced by Seafire 05 Oct 2026 ' }, 300);
ok('the same note twice is one note', twice.changed === 0 && twice.items[0].remarks === n.items[0].remarks);

ok('nothing filled in is an empty patch', isEmptyPatch({}) && isEmptyPatch({ note: '   ' }) && !isEmptyPatch({ expiry: '2027-01-01' }));

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
