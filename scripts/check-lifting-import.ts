/*
 * The vessel's own lifting register, through the real importer.
 *
 * It is a sample rather than a fixture on purpose: the columns, the units and
 * the blanks are the ship's, not ones invented here, and a mapper that works on
 * invented data is worth nothing. Run after touching FIELD_PATTERNS or rowToItem:
 *
 *   npx tsx scripts/check-lifting-import.ts          (or via check:lifting)
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { parseWorkbookBytes } from '../services/excelImport';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const buf = fs.readFileSync(process.argv[2] || '/tmp/jez-lifting.xlsx');
const res = parseWorkbookBytes(new Uint8Array(buf));
const items = Object.values(res.byCategory).flat().filter(Boolean) as any[];

console.log(`\nпрочитано ${res.total} позиций; по категориям: ` +
  res.counts.map((c) => `${c.label} ${c.count}`).join(', ') + '\n');

const aloft = items.filter((i) => /Axis|Grillon|Absorbica/i.test(i.type ?? ''));
const cranes = items.filter((i) => /Crane|HOOK|Garage/i.test(i.type ?? ''));
const moor = items.filter((i) => /Mooring Line/i.test(i.type ?? ''));

ok('все 24 строки стали позициями', items.length === 24, String(items.length));
ok('working aloft: 10', aloft.length === 10, String(aloft.length));
ok('cranes: 6', cranes.length === 6, String(cranes.length));
ok('mooring: 8', moor.length === 8, String(moor.length));

const axis = aloft.find((i) => i.serial === '25L0699660607');
ok('серийник прочитан', !!axis);
if (axis) {
  ok('type = Equipment Name', axis.type === 'Axis 11mm (Sewn Eye) 10m', axis.type);
  ok('make = Manufacturer', axis.make === 'Petzl', axis.make);
  ok('position = Location', axis.position === 'Sundeck Wash locker', axis.position);
  ok('marking = ID / Markings / Whipping', axis.marking === 'White Line', axis.marking);
  ok('SWL как размечено', axis.swl === '22 kN', axis.swl);
  ok('MBL как размечено', axis.mbl === '22 kN', axis.mbl);
  ok('diameter', axis.diameter === '11mm', axis.diameter);
  ok('N/A не становится значением', axis.material === undefined && axis.mfrCertNo === undefined);
  ok('annual cert no.', axis.testCertNo === 'Y726 -2026', axis.testCertNo);
  ok('installed "Nov-25" -> ISO', axis.installedDate === '2025-11-01', axis.installedDate);
  ok('last annual "Sep-26" -> ISO', axis.lastInspection === '2026-09-01', axis.lastInspection);
  ok('next annual -> nextInspection', axis.nextInspection === '2027-09-01', axis.nextInspection);
  ok('expiry "23 April 2035" -> ISO', axis.expiry === '2035-04-23', axis.expiry);
}

const crane = cranes.find((i) => i.serial === 'DNV N1430TKB');
if (crane) {
  ok('кран: SWL', crane.swl === '2200kg', crane.swl);
  ok('кран: производитель', crane.make === 'Vandriel', crane.make);
  ok('кран: размер как написано', (crane.size ?? '').includes('5100'), crane.size);
  ok('кран: дат нет — и поля пустые', !crane.nextInspection && !crane.expiry);
}

const line = moor[0];
if (line) {
  ok('швартов: материал', line.material === 'Polyester / nylon', line.material);
  ok('швартов: MBL в кН', line.mbl === '487.4 kN', line.mbl);
  ok('швартов: маркировка цветом', ['BLUE', 'RED'].includes(line.marking ?? ''), line.marking);
  ok('швартов: производителя нет (колонка очищена)', !line.make, line.make);
}
ok('одинаковый EN/SN на восьми концах не помешал', new Set(moor.map((m) => m.serial)).size === 1);

console.log(fails ? `\n${fails} FAILED` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
