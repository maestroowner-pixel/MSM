/*
 * Checks for "Update from Excel" (services/registerUpdate.ts).
 *
 * What matters here is not taste: a register exported and imported straight back
 * must change NOTHING, an edited cell must change exactly that item and keep its
 * id (the id is its QR label and its inspection history), and nothing may be
 * removed that the user did not tick. Built on the same rows the XLSX export
 * writes (services/registerSheet.ts), through the real parser.
 *
 * Pass the reference workbook to also check that the ordinary import of it is
 * untouched:  npm run check:register -- "/path/LSA FFE Inventories.xlsx"
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { parseWorkbookBytes, ImportPreview } from '../services/excelImport';
import { registerSheetRows } from '../services/registerSheet';
import { applyPlan, planUpdate, storable } from '../services/registerUpdate';
import { CATEGORY_MAP, sheetSafeName } from '../constants/categories';
import { EquipmentItem } from '../types/equipment';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

/** A workbook exactly as exportXlsx builds it (minus the tab colours). */
function exportBook(byCat: Record<string, EquipmentItem[]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [cat, items] of Object.entries(byCat)) {
    if (!items.length) continue;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(registerSheetRows(items, 'MV Test · IMO 9967093', '14/09/2026')), sheetSafeName(CATEGORY_MAP[cat].label));
  }
  return wb;
}
const parse = (wb: XLSX.WorkBook): ImportPreview =>
  parseWorkbookBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
const rowsOf = (pv: ImportPreview) => Object.values(pv.byCategory).flat() as EquipmentItem[];
const flat = (byCat: Record<string, EquipmentItem[]>) => Object.values(byCat).flat();

const register: Record<string, EquipmentItem[]> = {
  liferafts: [
    { id: 'lif_1', category: 'liferafts', no: 1, type: 'Viking 16DK', serial: 'VK-1001', persons: 16, deck: 'Boat Deck', position: 'PS', nextInspection: '2027-03-01', updatedAt: 1,
      attachments: [{ id: 'a1', kind: 'photo', uri: 'file:///x.jpg', addedAt: 1 }] },
    { id: 'lif_2', category: 'liferafts', no: 2, type: 'Viking 16DK', serial: 'VK-1002', persons: 16, deck: 'Boat Deck', position: 'SB', nextInspection: '2027-03-01', updatedAt: 1 },
  ],
  lifejackets: Array.from({ length: 4 }, (_, i) => ({
    id: `lif_j${i}`, category: 'lifejackets', type: 'Adult 150N', position: 'Bridge locker', expiry: '2028-01-01', updatedAt: 1,
  })),
  fire_extinguishers: [
    { id: 'fir_1', category: 'fire_extinguishers', no: '01-FE', type: 'Dry powder', make: 'Gloria', size: '6kg', serial: 'G-77', deck: 'Main', position: 'Galley', nextInspection: '2026-12-01', remarks: 'Bracket loose', updatedAt: 1, flagged: true },
  ],
};
const ids = (list: EquipmentItem[]) => list.map((i) => i.id).sort().join(',');

// --- 1. straight round trip changes nothing ---
{
  const pv = parse(exportBook(register));
  ok('round trip: every row parsed', pv.total === 7, String(pv.total));
  ok('round trip: exported sheets land in their own categories',
     pv.byCategory.liferafts?.length === 2 && pv.byCategory.lifejackets?.length === 4 && pv.byCategory.fire_extinguishers?.length === 1,
     JSON.stringify(pv.counts.filter((c) => c.count)));
  ok('round trip: nothing is "sorted by description"', pv.sortedSheets.length === 0, pv.sortedSheets.join(','));
  const plan = planUpdate(flat(register), rowsOf(pv));
  ok('round trip: all matched by MSM ID', plan.matchedBy.id === 7, JSON.stringify(plan.matchedBy));
  ok('round trip: nothing changed', plan.changed.length === 0,
     plan.changed.map((c) => `${c.before.id}: ${c.fields.join('/')}`).join('; '));
  ok('round trip: nothing added or missing', !plan.added.length && !plan.missing.length);
  ok('round trip: "Status" is not imported as an extra', rowsOf(pv).every((r) => !r.extra || !('Status' in r.extra)));
  ok('round trip: "Due" of a next-inspection category stays next inspection',
     pv.byCategory.liferafts?.[0].nextInspection === '2027-03-01' && !pv.byCategory.liferafts?.[0].expiry);
}

// --- 2. edit, delete, add in Excel ---
{
  const wb = exportBook(register);
  const ws = wb.Sheets[sheetSafeName(CATEGORY_MAP.fire_extinguishers.label)];
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  aoa[4][6] = 'Mess room';   // Location
  aoa[4][12] = '';           // Comments emptied
  aoa[4][10] = '01/06/2027'; // Due
  aoa.push(['02-FE', 'CO2', 'Gloria', '5kg', 'G-78', 'Main', 'Engine room', '', '', '', '01/01/2027', '', '', '']);
  wb.Sheets[sheetSafeName(CATEGORY_MAP.fire_extinguishers.label)] = XLSX.utils.aoa_to_sheet(aoa);
  const lr = wb.Sheets[sheetSafeName(CATEGORY_MAP.liferafts.label)];
  const lra = XLSX.utils.sheet_to_json<any[]>(lr, { header: 1, defval: '' });
  lra.splice(5, 1); // liferaft 2 removed from the list
  wb.Sheets[sheetSafeName(CATEGORY_MAP.liferafts.label)] = XLSX.utils.aoa_to_sheet(lra);

  const plan = planUpdate(flat(register), rowsOf(parse(wb)));
  const ch = plan.changed.find((c) => c.before.id === 'fir_1');
  ok('edit: exactly one item changed', plan.changed.length === 1, plan.changed.map((c) => c.before.id).join(','));
  ok('edit: location, due date and comment all applied',
     ch?.after.position === 'Mess room' && ch?.after.nextInspection === '2027-06-01' && ch?.after.remarks === undefined,
     JSON.stringify(ch?.after));
  ok('edit: the id is kept (label + history intact)', ch?.after.id === 'fir_1');
  ok('edit: app-only fields survive (flag)', ch?.after.flagged === true);
  ok('edit: change is listed by field', ch?.fields.join(',') === 'Location,Comments,Next inspection', ch?.fields.join(','));
  ok('add: the new row is new', plan.added.length === 1 && plan.added[0].serial === 'G-78');
  ok('add: parser notes are not stored', plan.added.every((a) => !('_fields' in a) && !('_msmId' in a)));
  ok('delete: the removed row is reported missing', ids(plan.missing) === 'lif_2', ids(plan.missing));

  const kept = applyPlan(register, plan, false);
  ok('apply without removal keeps the missing item', flat(kept as any).some((i) => i.id === 'lif_2'));
  ok('apply keeps attachments on untouched items', (kept.liferafts ?? []).find((i) => i.id === 'lif_1')?.attachments?.length === 1);
  const pruned = applyPlan(register, plan, true);
  ok('apply with removal drops only the missing item',
     flat(pruned as any).length === 7 && !flat(pruned as any).some((i) => i.id === 'lif_2'));
}

// --- 3. a vessel's own list: no MSM ID, match by serial then details ---
{
  const own = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(own, XLSX.utils.aoa_to_sheet([
    ['#', 'Deck', 'Location', 'Description', 'Make', 'Type', 'Size', 'Serial', 'Exp / Inspc.'],
    ['01-FE', 'Main', 'Galley', 'Fire extinguisher', 'Gloria', 'Dry powder', '6kg', 'G-77', '01/12/2026'],
  ]), 'Deck list');
  const plan = planUpdate(flat(register), rowsOf(parse(own)), (c) => c === 'fire_extinguishers');
  ok('own list: matched by serial', plan.matchedBy.serial === 1, JSON.stringify(plan.matchedBy));
  ok('own list: a list without a Comments column keeps the comment',
     plan.changed.every((c) => c.after.remarks === 'Bracket loose') && plan.unchanged.length + plan.changed.length === 1);
  ok('own list: categories the file does not cover are not "missing"', plan.missing.length === 0, ids(plan.missing));
}
{
  // four identical lifejackets, file now lists three
  const rows: EquipmentItem[] = Array.from({ length: 3 }, (_, i) => ({
    id: `new${i}`, category: 'lifejackets', type: 'Adult 150N', position: 'Bridge locker', expiry: '2029-01-01', updatedAt: 2,
    _fields: ['type', 'position', 'expiry'],
  } as any));
  const plan = planUpdate(flat(register), rows, (c) => c === 'lifejackets');
  ok('identical items: paired, not duplicated', plan.matchedBy.details === 3 && plan.added.length === 0, JSON.stringify(plan.matchedBy));
  ok('identical items: one reported missing', plan.missing.length === 1 && plan.missing[0].category === 'lifejackets');
  ok('identical items: new expiry applied', plan.changed.length === 3 && plan.changed.every((c) => c.after.expiry === '2029-01-01'));
}
{
  // a serial shared by two items is not matched by serial
  const dup = [
    { id: 'a', category: 'plb', serial: 'X1', updatedAt: 1 },
    { id: 'b', category: 'plb', serial: 'X1', updatedAt: 1 },
  ] as EquipmentItem[];
  const plan = planUpdate(dup, [{ id: 'r', category: 'plb', serial: 'X1', updatedAt: 2, _fields: ['serial'] } as any]);
  // Still no guess BY SERIAL. But the two items are the same in every field the
  // sheet has, so the row is one of them and the other is the copy — it used to
  // be added as a third, which is how a register tripled (see 3b).
  ok('ambiguous serial: no guess by serial, and no third copy',
     plan.matchedBy.serial === 0 && plan.added.length === 0 && plan.missing.length === 1,
     `${plan.added.length} added, ${plan.missing.length} missing`);
}
{
  // Replace all keeps MSM IDs, once each
  const seen = new Set<string>();
  const a = storable({ id: 'gen1', category: 'plb', updatedAt: 1, _msmId: 'plb_keep' } as any, seen);
  const b = storable({ id: 'gen2', category: 'plb', updatedAt: 1, _msmId: 'plb_keep' } as any, seen);
  ok('replace: an MSM ID is kept', a.id === 'plb_keep');
  ok('replace: a pasted-twice row does not share the id', b.id === 'gen2');
}

// --- 3b. rows with no number and no location do not multiply ---
{
  // What a vessel's own list often is: a description, a make, sometimes a serial
  // typed twice. Loading it again must change nothing, and the copies an older
  // build made must come out as "not in the file" so one switch removes them.
  const row = (i: number, over: Partial<EquipmentItem> = {}): EquipmentItem =>
    ({ id: `row${i}`, category: 'lifejackets', type: 'Adult 150N', make: 'Crewsaver', updatedAt: 1, ...over } as EquipmentItem);
  const held = [0, 1, 2].map((i) => row(i, { id: `held${i}` }));
  const same = planUpdate(held, [0, 1, 2].map((i) => row(i)));
  ok('no number, no location: the same file again adds nothing',
     !same.added.length && !same.missing.length && same.unchanged.length === 3,
     `${same.added.length} added, ${same.missing.length} missing`);
  const tripled = [...held, ...[3, 4, 5, 6, 7, 8].map((i) => row(i, { id: `dup${i}` }))];
  const fix = planUpdate(tripled, [0, 1, 2].map((i) => row(i)));
  ok('tripled register: the copies are missing, nothing is added',
     !fix.added.length && fix.missing.length === 6, `${fix.added.length} added, ${fix.missing.length} missing`);
  ok('tripled register: the ORIGINALS are the ones kept',
     ids(fix.unchanged) === 'held0,held1,held2', ids(fix.unchanged));
  // A serial that the copies made non-unique still finds its item.
  const sn = [row(0, { id: 'a', serial: 'X1' }), row(1, { id: 'b', serial: 'X1' })];
  const snPlan = planUpdate(sn, [row(9, { serial: 'X1' })]);
  ok('copied serial: one kept, one missing, none added',
     !snPlan.added.length && snPlan.missing.length === 1 && ids(snPlan.unchanged) === 'a',
     `${snPlan.added.length} added, ${snPlan.missing.length} missing`);
  // A genuinely new, different item is still added.
  const more = planUpdate(held, [...[0, 1, 2].map((i) => row(i)), row(3, { type: 'Child 100N' })]);
  ok('a different un-numbered item is still new', more.added.length === 1 && !more.missing.length);
}

// --- 4. the reference workbook still imports as before ---
const ref = process.argv[2];
if (ref && fs.existsSync(ref)) {
  const pv = parseWorkbookBytes(fs.readFileSync(ref));
  ok('reference workbook: 627 items', pv.total === 627, String(pv.total));
  ok('reference workbook: no row carries an MSM ID', rowsOf(pv).every((r) => !(r as any)._msmId));
  // …and a register built from it survives its own export untouched.
  const stored: Record<string, EquipmentItem[]> = {};
  for (const [k, list] of Object.entries(pv.byCategory)) stored[k] = (list ?? []).map((r) => storable(r));
  const plan = planUpdate(flat(stored), rowsOf(parse(exportBook(stored))));
  ok('reference register: export → import changes nothing',
     plan.changed.length === 0 && !plan.added.length && !plan.missing.length && plan.matchedBy.id === 627,
     `${plan.changed.length} changed (${plan.changed.slice(0, 3).map((c) => `${c.before.category}/${c.before.type}: ${c.fields}`).join('; ')}), ` +
     `${plan.added.length} added, ${plan.missing.length} missing, ${JSON.stringify(plan.matchedBy)}`);
} else {
  console.log('skip  reference workbook (pass its path to check it)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
// The compiled copy lives in .check-reg (see package.json); it is only scaffolding.
try { fs.rmSync(require('path').resolve(__dirname, '..'), { recursive: true, force: true }); } catch { /* leave it */ }
process.exit(fails ? 1 : 0);
