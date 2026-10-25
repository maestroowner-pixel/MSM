// npm run check:watchlog — engine room log: readings, range, previous reading, trends.
import { defaultTemplate, history, num, normalStatus, outOfRange, previous, rangeText, sameParam, trend } from '../services/watchLog';
import { WatchEntry, WatchParam } from '../types/watchLog';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const a = defaultTemplate(), b = defaultTemplate();
ok(a.params.map((q) => q.id).join() === b.params.map((q) => q.id).join(), 'the default template has the same ids every time');

ok(num('12,5') === 12.5 && num(' 12.5 ') === 12.5 && num('1 250') === 1250 && isNaN(num('')) && isNaN(num('ok')), 'readings typed with a comma or a space are numbers');

const lo: WatchParam = { id: 'lo', name: 'ME Lube Oil Pressure', unit: 'bar', type: 'number', normalMin: 2, normalMax: 5 };
ok(normalStatus(lo, '1,8') === 'warn' && normalStatus(lo, '5') === 'ok' && normalStatus(lo, '') === 'none', 'out of range below / in range at the limit / nothing typed');
ok(normalStatus({ ...lo, type: 'text' }, '1') === 'none', 'text readings have no range');
ok(rangeText(lo) === '≥ 2 – ≤ 5' && rangeText({ ...lo, normalMin: undefined }) === '≤ 5' && rangeText({ ...lo, normalMin: undefined, normalMax: undefined }) === '', 'range text');
ok(outOfRange([lo], { lo: '6' }).length === 1 && outOfRange([lo], { lo: '3' }).length === 0, 'out-of-range list');

const e = (id: string, at: number, params: WatchParam[], values: Record<string, string>): WatchEntry =>
  ({ id, templateId: 'default', params, values, date: '2026-10-25', time: `0${at}:00`, by: 'Ann', at, updatedAt: at });
// Older rounds made from the default before its ids were fixed: same name and unit, another id.
const old = { ...lo, id: 'random-1' };
const log = [e('1', 1, [old], { 'random-1': '3' }), e('2', 2, [lo], { lo: '3,4' }), e('3', 3, [lo], { lo: '' }), e('4', 4, [lo], { lo: '4' })];
ok(sameParam(lo, [old]) === old && !sameParam({ ...lo, unit: 'psi' }, [old]), 'a reading is followed by id, else by name and unit');
const h = history(lo, log);
ok(h.map((r) => r.value).join() === '3,3.4,4', 'history: oldest first, blanks skipped, old ids followed');
ok(history(lo, log, 2).map((r) => r.value).join() === '3.4,4', 'history keeps the last N');
ok(previous(lo, log)?.value === 4 && previous(lo, log, 4)?.value === 3.4 && previous(lo, log, 1) === undefined, 'previous reading before a round');
ok(trend('4,5', previous(lo, log)) === 'up' && trend('3', previous(lo, log)) === 'down' && trend('4.01', previous(lo, log)) === 'same' && trend('', previous(lo, log)) === null, 'trend arrow');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
