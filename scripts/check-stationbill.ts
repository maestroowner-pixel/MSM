// npm run check:stationbill — the muster list (types/stationBill.ts): revisions, the standard list, who holds
// what, what is out of date, the paper per alarm, and that it is wired like every other synced record.
import { billAt, billGaps, currentBill, draftFrom, draftProblem, dutiesOf, fillFromCrew, issueBill, nextNo, rowsOf, standardBill, STANDARD_ROWS } from '../services/stationBill';
import { alarmSheet, billSheets, personLines } from '../services/stationBillRows';
import { ALARMS, DUTY_KEYS } from '../types/stationBill';
import { CrewMember } from '../types/crew';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const cm = (id: string, name: string, rank: string, onBoard = true): CrewMember => ({ id, name, rank, active: true, onBoard, addedAt: 1, updatedAt: 1 } as CrewMember);
const crew = [cm('c1', 'Anna Berg', 'Master'), cm('c2', 'Tom Hall', 'Chief Officer'), cm('c3', 'Lee Park', '2nd Officer'), cm('c4', 'Sam Ruiz', 'Deckhand'), cm('c5', 'Kim Ng', 'Deckhand'), cm('c6', 'Old Hand', 'Bosun', false), cm('c7', 'New Cook', 'Chef')];

// ---- the standard list --------------------------------------------------------------
const std = standardBill();
ok(std.rows.length === 11 && new Set(std.rows.map((r) => r.no)).size === 11 && STANDARD_ROWS.every((r) => r.id === `sb_std_${r.no}`), 'the standard list: 11 positions, numbered once, permanent ids');
ok(std.rows.every((r) => DUTY_KEYS.every((k) => r.duties[k]?.duty)), 'every standard position has a duty at every alarm and every security level');
const zoneIds = new Set(std.zones.map((z) => z.id));
ok(std.rows.every((r) => Object.values(r.duties).every((d) => !d?.zoneId || zoneIds.has(d.zoneId))), 'every standard area named by a duty exists');
std.rows[0].duties.fire!.duty = 'changed';
ok(STANDARD_ROWS[0].duties.fire!.duty !== 'changed', 'editing a draft from the standard list never edits the template');

// ---- filling from the crew ----------------------------------------------------------------
const filled = fillFromCrew(standardBill().rows, crew);
const at = (no: number) => filled.find((r) => r.no === no)!;
ok(at(1).crewId === 'c1' && at(2).crewId === 'c2' && at(3).crewId === 'c3', 'the same rank fills the same position');
ok(at(5).crewId === 'c4' && at(6).crewId === 'c5', 'a rank the position begins with fills the numbered ones in order (Deckhand → Deckhand 1, 2)');
ok(!at(4).crewId && at(11).crewId === 'c7', 'someone not aboard is not put on the list; the cook is');
ok(fillFromCrew(filled, crew).every((r, i) => r.crewId === filled[i].crewId), 'filling again changes nothing');

// ---- issuing --------------------------------------------------------------------------------
ok(draftProblem({ rows: [], zones: [], signals: {} }) === 'sb.p.empty', 'an empty list cannot be issued');
ok(draftProblem({ ...std, rows: [...std.rows, { ...std.rows[0], id: 'x' }] }) === 'sb.p.numbers', 'two positions with one number cannot be issued');
ok(draftProblem({ ...std, rows: [{ ...std.rows[0], position: ' ' }] }) === 'sb.p.position', 'a position without a name cannot be issued');
const d1 = { ...standardBill(), rows: filled, note: 'First list' };
d1.rows[2] = { ...d1.rows[2], duties: { ...d1.rows[2].duties, mob: { duty: '  ', station: 'x' }, fire: { duty: 'Bridge watch', zoneId: 'z_gone' } } };
const r1 = issueBill(d1, [], crew, 'Anna Berg', 1000);
ok(r1.id === 'sb_r1' && r1.rev === 1 && r1.issuedBy === 'Anna Berg' && r1.note === 'First list', 'the first revision: sb_r1, who and why');
const row3 = r1.rows.find((r) => r.no === 3)!;
ok(!row3.duties.mob && row3.duties.fire!.duty === 'Bridge watch' && !row3.duties.fire!.zoneId, 'a duty with no words is dropped; an area that is gone is not kept');
ok(r1.rows.find((r) => r.no === 1)!.name === 'Anna Berg' && !r1.rows.find((r) => r.no === 4)!.name, 'the holder’s name is written in; an empty position has none');
const shuffled = { ...d1, rows: [...d1.rows].reverse() };
ok(issueBill(shuffled, [], crew, 'A', 1).rows.map((r) => r.no).join() === r1.rows.map((r) => r.no).join(), 'rows print in number order however they were edited');
const r2 = issueBill(draftFrom(r1), [r1], crew, 'Anna Berg', 5000);
ok(r2.id === 'sb_r2' && currentBill([r1, r2]) === r2 && billAt([r1, r2], 3000) === r1 && !billAt([r1, r2], 500), 'the next revision; what was in force on a date');
ok(draftFrom(r1).from === 1 && draftFrom(undefined).from === 0 && draftFrom(undefined).rows.length === 11, 'a draft from the revision in force, or from the standard list');
ok(nextNo(r1.rows) === 12, 'a new position takes the next number');

// ---- people ---------------------------------------------------------------------------------
ok(rowsOf(r1, { id: 'c3' })[0].no === 3 && rowsOf(r1, { name: ' tom  HALL ' })[0].no === 2 && !rowsOf(r1, { id: 'nobody' }).length, 'a person found by id, else by name');
const mine = dutiesOf(r1, { id: 'c2' });
ok(mine.length === 7 && mine[0].key === 'fire' && mine.find((x) => x.key === 'abandon')!.zone?.name === 'Liferaft PS', 'the Chief Officer: a line per alarm and level, the area named');
const lines = personLines(r1, rowsOf(r1, { id: 'c2' }));
ok(lines.length === 7 && /Muster station · .*Liferaft PS/.test(lines.find((l) => l.key === 'abandon')!.text), 'their lines: station · duty · area');

// ---- out of date -------------------------------------------------------------------------------
const g = billGaps(r1, [...crew, cm('c8', 'Joe New', 'Deckhand')]);
ok(g.notOnList.map((c) => c.id).join() === 'c8' && g.unfilled.map((r) => r.no).join() === '4,7,8,9,10', 'aboard and not on it; positions no one holds');
const left = billGaps(r1, crew.map((c) => (c.id === 'c3' ? { ...c, onBoard: false } : c)));
ok(left.gone.map((r) => r.no).join() === '3', 'someone signed off is still on the list: said');
const twice = issueBill({ ...draftFrom(r1), rows: draftFrom(r1).rows.map((r) => (r.no === 4 ? { ...r, crewId: 'c2', name: 'Tom Hall' } : r)) }, [r1], crew, 'A', 9);
ok(billGaps(twice, crew).twice.map((c) => c.id).join() === 'c2', 'one person on two positions: said');

// ---- paper ----------------------------------------------------------------------------------------
const fire = alarmSheet(r1, 'fire', '2026-11-21');
ok(fire.title === 'Muster list — Fire' && fire.facts.some((f) => f.startsWith('Signal: ')) && fire.tables[0].rows.length === 11, 'a sheet per alarm: its signal, every position with a fire duty');
ok(fire.tables[0].rows.find((r) => r[0] === '4')![2] === '— not filled —', 'an empty position prints as not filled');
const sec = alarmSheet(r1, 'security', '2026-11-21');
ok(sec.tables.length === 4 && sec.tables[2].title === 'ISPS security level 3', 'security: a table per ISPS level, then the Master');
const all = billSheets(r1, '2026-11-21');
ok(all.length === 1 + ALARMS.length && all[0].tables.some((t) => t.title === 'Areas of responsibility') && all[0].tables.some((t) => t.title === 'What changed'), 'the whole list: roster, signals, areas, then every alarm');
ok(billSheets(r1, '2026-11-21', false)[0].facts.includes('SUPERSEDED'), 'an older revision prints as superseded');
ok(!/[★−]/.test(JSON.stringify(all)), 'nothing the PDF font cannot draw');

// ---- wiring ----------------------------------------------------------------------------------------
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'station_bills', key: storage.STATION_BILLS_KEY, appendOnly: true, module: 'stationBill'/.test(fb), 'synced with the module, append-only');
ok(!/STATION_BILL_DRAFT_KEY/.test(fb), 'the draft stays on the device');
const bk = readFileSync('services/backup.ts', 'utf8');
ok(/STATION_BILLS_KEY/.test(bk), 'in the backup');
ok(/    STATION_BILLS_KEY,\n    STATION_BILL_DRAFT_KEY,/.test(readFileSync('services/storage.ts', 'utf8')), 'both wiped with the rest on reset');
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/station_bills\/\{id\}[\s\S]{0,200}allow read: if reader\(v\);[\s\S]{0,120}allow create: if isSuper\(v\)[\s\S]{0,500}allow update, delete: if false;/.test(rules), 'rules: everyone reads; only the Master issues; never changed');
const idx = readFileSync('index.tsx', 'utf8');
ok(/StationBill: \['stationBill'\]/.test(idx) && /name="StationBill" component=\{gated\('StationBill'/.test(idx), 'the screen gated by its module');
const manual = readFileSync('constants/manual.ts', 'utf8');
ok(/title: "Muster list"/.test(manual) && /\{ title: 'Muster list', module: 'stationBill' \}/.test(manual), 'the manual has the section, gone with the module');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
