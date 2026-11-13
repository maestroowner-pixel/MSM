// npm run check:pscwalk — the PSC walk-round: permanent ids, stored marks read safely, the PDF's order.
import { PLACES, PSC_CHECKS, PSC_STATS, emptyWalk, mark, noteOn, readWalk, walkCount, walkPages } from '../services/pscWalk';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const ids = PSC_CHECKS.map((c) => c.id);
ok(new Set(ids).size === ids.length, `${ids.length} checks, ids unique`);
ok(PLACES.every((p) => PSC_CHECKS.some((c) => c.place === p)), 'every place has checks');
ok(PSC_CHECKS.every((c) => c.text && c.ref), 'every check has text and a reference');
// A figure on a check must name a region and year we hold the report for.
const held = PSC_STATS.map((r) => `${r.name} ${r.year}`);
ok(PSC_CHECKS.filter((c) => c.stat).every((c) => held.some((h) => c.stat!.includes(h))), 'every figure names a held report');
ok(PSC_STATS.every((r) => r.source && r.areas.length && r.areas.every((a, i, l) => !i || l[i - 1].pct >= a.pct)), 'regions sourced, areas largest first');
const tokyo = PSC_STATS.find((r) => r.key === 'tokyo')!;
ok(tokyo.detainable.every((d, i, l) => !i || l[i - 1].n >= d.n), 'Tokyo detainable list in order');

let w = emptyWalk(1000);
w = mark(w, 'fire.doors', 'fix', 2000);
w = noteOn(w, 'fire.doors', 'Galley door wedged', 2001);
w = mark(w, 'lsa.lifeboats', 'ok', 2002);
ok(walkCount(w).done === 2 && walkCount(w).fix === 1, 'counts: 2 marked, 1 to fix');
w = mark(w, 'fire.doors', 'ok', 3000);
ok(w.marks['fire.doors'].s === 'ok' && w.marks['fire.doors'].note === 'Galley door wedged', 'changing the answer keeps the note');
w = mark(w, 'fire.doors', 'ok', 3001);
ok(!w.marks['fire.doors'], 'same answer again clears it');
ok(noteOn(w, 'fire.doors', 'x', 1) === w, 'no note on an unmarked check');

const r = readWalk({ started: 5, marks: { 'lsa.lifeboats': { s: 'fix', note: ' ' }, gone: { s: 'ok' }, 'fire.pumps': { s: 'maybe' } } }, 9);
ok(r.started === 5 && Object.keys(r.marks).join() === 'lsa.lifeboats' && r.marks['lsa.lifeboats'].note === undefined && r.marks['lsa.lifeboats'].at === 5, 'stored walk: unknown ids and bad marks dropped, blank note dropped');
ok(readWalk(null, 9).started === 9 && readWalk('x', 9).started === 9, 'nothing stored → a new walk');

const pages = walkPages(mark(emptyWalk(0), 'engine.ows', 'fix', 1), 86400000);
ok(pages[0].tables[0].title.startsWith('To put right') && pages[0].tables[0].rows.length === 1, 'PDF: to put right first');
ok(pages[0].tables.length === PLACES.length + 1 && pages[0].tables.slice(1).reduce((n, t) => n + t.rows.length, 0) === PSC_CHECKS.length, 'PDF: every check once by place');
const blank = walkPages(emptyWalk(0), 0)[0];
ok(blank.tables.length === PLACES.length && blank.facts.some((f) => f.includes('tick by hand')), 'blank walk prints to tick by hand');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
