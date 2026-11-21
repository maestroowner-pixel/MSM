// npm run check:entryorigin — late entries and entries from the paper record book (services/entryOrigin.ts):
// out of order against the book (zones, no time, cancelled), the reason rule, the printed line, and that every
// record book writes the fields BEFORE the seal and prints them.
import { readFileSync } from 'fs';
import { laterEntry, originFields, originNote, originProblem } from '../services/entryOrigin';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const book = [
  { id: 'a', date: '2026-11-20', time: '10:00', shipOffset: '+00:00' },
  { id: 'b', date: '2026-11-20', time: '14:00', shipOffset: '+00:00' },
  { id: 'c', date: '2026-11-20', time: '18:00', shipOffset: '+00:00', cancelled: true },
];
ok(laterEntry({ date: '2026-11-20', time: '12:00', shipOffset: '+00:00' }, book)?.id === 'b', 'between two entries → late, against the latest later one');
ok(laterEntry({ date: '2026-11-20', time: '09:00', shipOffset: '+00:00' }, book)?.id === 'b', 'before both → the latest is named');
ok(laterEntry({ date: '2026-11-20', time: '15:00', shipOffset: '+00:00' }, book) === undefined, 'after the last standing entry → in order (a cancelled one does not count)');
ok(laterEntry({ date: '2026-11-20', time: '14:00', shipOffset: '+00:00' }, book) === undefined, 'the same minute is not late');
ok(laterEntry({ date: '2026-11-20', shipOffset: '+00:00' }, book) === undefined, 'no time on the same day → benefit of the doubt');
ok(laterEntry({ date: '2026-11-19', shipOffset: '+00:00' }, book)?.id === 'b', 'no time on an earlier day → late');
ok(laterEntry({ date: '2026-11-20', time: '13:00', shipOffset: '+00:00' }, [{ id: 'z', date: '2026-11-20', time: '14:00', shipOffset: '+02:00' }]) === undefined, 'zones: 14:00 at UTC+2 is 12:00 UTC, so 13:00 UTC is after it');
ok(laterEntry({ date: 'bad', time: '13:00' }, book) === undefined, 'no date → nothing judged');
ok(laterEntry({ date: '2026-11-20', time: '12:00' }, []) === undefined, 'an empty book → in order');

ok(originProblem(true, '', false) === 'late', 'late with no reason cannot be signed');
ok(originProblem(true, 'ok', false) === 'late', 'two letters are not a reason');
ok(originProblem(true, 'Watch busy with arrival', false) === null, 'late with a reason signs');
ok(originProblem(true, '', true) === null, 'from the paper book: no other reason needed');
ok(originProblem(false, '', false) === null, 'in order: nothing asked');

ok(JSON.stringify(originFields(false, 'typed then not late', false, '')) === '{}', 'in order: no field written, a stale reason dropped');
ok(JSON.stringify(originFields(true, ' Busy ', false, '')) === '{"late":"Busy"}', 'late: the reason, trimmed');
ok(JSON.stringify(originFields(true, '', true, ' 12 ')) === '{"fromPaper":true,"paperPage":"12"}', 'paper: the flag and page, no empty late');
ok(JSON.stringify(originFields(false, '', true, '  ')) === '{"fromPaper":true}', 'paper without a page');

ok(originNote({}) === '', 'nothing to print');
ok(originNote({ late: 'Busy' }) === 'LATE ENTRY — Busy', 'late printed');
ok(originNote({ fromPaper: true, paperPage: '12' }) === 'Entered from the paper record book, page 12', 'paper printed with the page');
ok(originNote({ fromPaper: true, late: 'x' }) === 'Entered from the paper record book; LATE ENTRY — x', 'both, paper first');

// The screens write the fields inside the object that is sealed, and show the line.
const src = (p: string) => readFileSync(p, 'utf8');
const orb = src('screens/OrbSc.tsx'), log = src('screens/LogBookSc.tsx'), grb = src('screens/GarbageSc.tsx');
ok(/withSeal\(\{ id: uid\('orb'\), \.\.\.\(draft as any\), \.\.\.originFields\(/.test(orb), 'ORB: fields inside withSeal');
ok(/withSeal\(\{ id: uid\(bookKey\), book: bookKey, \.\.\.\(draft as any\), \.\.\.originFields\(/.test(log), 'Sewage / Ballast / Fuel changeover / ODS: fields inside withSeal');
ok(/withSeal\(\{[\s\S]{0,900}\.\.\.origin,[\s\S]{0,400}\}, sig\);/.test(grb), 'Garbage: fields inside withSeal');
ok(/editing \? \{ \.\.\.\(editing\.late/.test(grb), 'Garbage: an amendment keeps the original late mark');
for (const [n, s] of [['ORB', orb], ['LogBook', log], ['Garbage', grb]] as const) {
  ok(s.includes('<EntryOriginFields') && s.includes('originNote(e)'), `${n}: form fields and the line on the entry`);
  ok(s.includes('...ORIGIN_BLANK'), `${n}: the values live in the form (kept in its draft)`);
}
for (const p of ['services/orbReport.ts', 'services/logbookReport.ts', 'services/garbageReport.ts']) ok(/originNote\(e\)/.test(src(p)), `${p}: printed on every copy`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
