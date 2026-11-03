// npm run check:replacements — equipment replaced (services/replacements.ts) and its place in the report.
import { auditSections } from '../services/reportData';
import { changeLine, changesOf, formProblem, replace, replacedIn, whatLine, ReplaceForm } from '../services/replacements';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
let seq = 0;
const newId = (p: string) => `${p}_${++seq}`;

const eebd: any = { id: 'e4', category: 'eebd', no: 4, type: 'Dräger Saver CF', make: 'Dräger', serial: 'ARCK-1001', manufactureDate: '2016-03-01', expiry: '2026-11-01', position: 'Cabin 4', updatedAt: 1 };
const base: ReplaceForm = { what: 'unit', reason: 'expired', date: '2026-11-03', after: {} };

ok(formProblem(eebd, base) === 'nothing', 'a whole unit with nothing about the new one is refused');
ok(formProblem(eebd, { ...base, after: { serial: 'ARCK-1001' } }) === 'nothing', 'the same serial again is not a change');
ok(formProblem(eebd, { ...base, what: 'part', after: {} }) === 'part', 'a part must be named');
ok(formProblem(eebd, { ...base, what: 'part', part: 'Battery', after: {} }) === null, 'a part with no new dates may be recorded (a light bulb)');
ok(formProblem(eebd, { ...base, date: '3.11', after: { serial: 'X' } }) === 'date', 'a date is required');

const f: ReplaceForm = { ...base, note: ' Survitec, cert 77 ', after: { serial: ' ARCK-2055 ', manufactureDate: '2026-06-01', expiry: '2036-06-01', type: '' } };
const c = changesOf(eebd, f.after);
ok(c.after.serial === 'ARCK-2055' && c.before.serial === 'ARCK-1001' && !('type' in c.after), 'changes: trimmed, blank fields unchanged');
const r = replace(eebd, f, { name: 'Sven Larsen', rank: '3rd Officer' }, 100, newId, { method: 'pin' } as any);
ok(r.movement.dir === 'replaced' && r.movement.itemId === 'e4' && r.movement.date === '2026-11-03' && r.movement.reason === 'Expired', 'the record: replaced, the item, the date, the reason');
ok(r.movement.before!.expiry === '2026-11-01' && r.movement.after!.expiry === '2036-06-01', 'before → after kept on the record');
ok(r.movement.by === 'Sven Larsen' && r.movement.byRank === '3rd Officer' && !!r.movement.signedWith && r.movement.notes === 'Survitec, cert 77', 'signed, with the note');
ok(r.item.id === 'e4' && r.item.serial === 'ARCK-2055' && r.item.expiry === '2036-06-01' && r.item.type === 'Dräger Saver CF' && r.item.position === 'Cabin 4', 'the item keeps its id and place, takes the new details');
ok(changeLine(r.movement) === 'serial ARCK-1001 → ARCK-2055; made 01.03.2016 → 01.06.2026; expiry 01.11.2026 → 01.06.2036', `change line: ${changeLine(r.movement)}`);
ok(whatLine(r.movement) === 'Unit replaced', 'what: unit');

const light: any = { id: 'b1', category: 'lifebuoys', no: 2, updatedAt: 1 };
const p = replace(light, { what: 'part', part: ' Light ', reason: 'defect', date: '2026-11-02', after: { expiry: '2030-01-01' }, defectInspId: 'insp9' }, { name: 'C/O' }, 5, newId);
ok(whatLine(p.movement) === 'Light replaced' && p.movement.defectInspId === 'insp9' && !p.movement.before, 'a part: named, closes the defect, no "before" where there was nothing');
ok(changeLine(p.movement) === 'expiry — → 01.01.2030', 'a date set for the first time reads "— →"');

let threw = false;
try { replace(eebd, base, { name: 'x' }, 1, newId); } catch { threw = true; }
ok(threw, 'replace refuses an incomplete form');

const moves: any[] = [r.movement, p.movement, { ...r.movement, id: 'old', date: '2026-10-31' }, { ...r.movement, id: 'del', deleted: true }, { id: 'w', itemId: 'e4', dir: 'decommissioned', date: '2026-11-05', updatedAt: 0 }];
const inNov = replacedIn(moves, new Set(['e4', 'b1']), '2026-11-01', '2026-11-30');
ok(inNov.map((m) => m.id).join() === `${p.movement.id},${r.movement.id}`, 'in the period: replacements only, oldest first, deleted and other months out');
ok(replacedIn(moves, new Set(['b1']), '2026-11-01', '2026-11-30').length === 1, 'only the items in scope');

// The monthly report: what was put right and what was replaced in the month.
const at = (d: number) => new Date(2026, 10, d, 10).getTime();
const flat: any[] = [eebd, light];
const trail: any[] = [
  { id: 'i1', itemId: 'e4', category: 'eebd', at: at(1), by: 'S', period: 'monthly', templateId: 'x', templateVersion: 1, results: {}, outcome: 'fail', defect: { note: 'red', open: false, closedAt: at(3), closedBy: 'Sven Larsen (3rd Officer)', closedNote: 'Unit replaced' }, updatedAt: 1 },
  { id: 'i2', itemId: 'e4', category: 'eebd', at: at(1), by: 'S', period: 'monthly', templateId: 'x', templateVersion: 1, results: {}, outcome: 'fail', defect: { note: 'old', open: false, closedAt: new Date(2026, 9, 20).getTime() }, updatedAt: 1 },
];
const from = new Date(2026, 10, 1).getTime();
const to = new Date(2026, 11, 1).getTime();
const rep = auditSections({ inScope: flat }, trail, from, to, moves);
ok(!!rep.rectified && rep.rectified.length === 1 && rep.rectified[0].id === 'i1', 'report: the defect put right this month, not last month\'s');
ok(!!rep.replaced && rep.replaced.length === 2, 'report: both replacements of the month');
ok(auditSections({ inScope: flat }, trail, from, to).replaced === undefined, 'report without the lifecycle: no replaced section');
ok(auditSections({ inScope: [light] }, trail, from, to, moves).replaced!.length === 1 && auditSections({ inScope: [light] }, trail, from, to).rectified!.length === 0, 'report narrowed to one category: only its items');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
