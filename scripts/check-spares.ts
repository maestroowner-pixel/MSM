// npm run check:spares — stock as the sum of movements (services/spares.ts).
import { makeMove, movesForJob, stockByPart, stockStatus, toOrderCounts } from '../services/spares';
import { SparePart } from '../types/spares';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const S = { by: 'Ana' };
const D = '2026-10-09';
const imp: SparePart = { id: 'p1', name: 'Impeller', minQty: 2, updatedAt: 0 };
const oil: SparePart = { id: 'p2', name: 'Oil', unit: 'l', updatedAt: 0 };

const m1 = makeMove(imp, 'received', 5, 0, S, D);
ok(m1.delta === 5, 'received 5 → +5');
const m2 = makeMove(imp, 'used', 1, 5, S, D);
ok(m2.delta === -1, 'used 1 → −1 (sign forced)');
ok(stockByPart([m1, m2]).get('p1') === 4, '5 in, 1 out → 4 on hand');

// Two devices offline: A takes one, B counts the shelf at 4 before seeing it.
const a = makeMove(imp, 'used', 1, 4, S, D);
const b = makeMove(imp, 'count', 4, 4, S, D);
ok(b.delta === 0 && b.counted === 4, 'count equal to the book → 0 difference');
ok(stockByPart([m1, m2, a, b]).get('p1') === 3, 'concurrent use + count: neither is lost');

const c = makeMove(imp, 'count', 1, 3, S, D);
ok(c.delta === -2 && stockByPart([m1, m2, a, b, c]).get('p1') === 1, 'stocktake 1 when book says 3 → −2, now 1');

ok(stockStatus(imp, 0) === 'out' && stockStatus(imp, 2) === 'low' && stockStatus(imp, 3) === 'ok', 'out / low at re-order level / ok');
ok(stockStatus(oil, 1) === 'ok', 'no re-order level → ok while any on hand');
ok(stockStatus(imp, -1) === 'out', 'negative book → out');

const l1 = makeMove(oil, 'received', 20, 0, S, D);
const l2 = makeMove(oil, 'used', 6.7, 20, S, D);
ok(stockByPart([l1, l2]).get('p2') === 13.3, 'litres: 20 − 6.7 = 13.3 exactly');

const byId = new Map([[imp.id, imp], [oil.id, oil]]);
const jm = movesForJob([{ partId: 'p1', qty: 1 }, { partId: 'p2', qty: 0 }, { partId: 'gone', qty: 2 }], byId, new Map(), S, D,
  { doneId: 'd1', jobTitle: 'Impeller change', machineName: 'ME PS' });
ok(jm.length === 1 && jm[0].delta === -1 && jm[0].doneId === 'd1' && jm[0].machineName === 'ME PS',
  'job: qty 0 skipped, removed part skipped, used move tied to the completion');

const t = toOrderCounts([imp, oil], new Map([['p1', 2], ['p2', 0]]));
ok(t.low === 1 && t.out === 1, 'to-order counts: 1 low, 1 out');

import { upcomingNeeds } from '../services/sparesNeed';
{
  const parts: any[] = [{ id: 'f', name: 'Oil filter', minQty: 1, updatedAt: 0 }, { id: 'i', name: 'Impeller', updatedAt: 0 }, { id: 'g', name: 'Gasket', updatedAt: 0 }];
  const ms: any[] = [{ id: 'me', name: 'Main engine', hours: 1000, updatedAt: 0 }];
  const js: any[] = [
    { id: 'j1', machineId: 'me', title: 'Oil change', intervalDays: 30, lastDoneDate: '2026-09-20', parts: [{ partId: 'f', qty: 2 }], updatedAt: 0 },
    { id: 'j2', machineId: 'me', title: 'Impeller', intervalDays: 365, lastDoneDate: '2026-06-01', parts: [{ partId: 'i', qty: 1 }], updatedAt: 0 },
    { id: 'j3', machineId: 'me', title: 'Overhaul', intervalDays: 30, lastDoneDate: '2026-08-01', parts: [{ partId: 'g', qty: 4 }], updatedAt: 0 },
  ];
  const stock = new Map([['f', 1], ['g', 4]]);
  const n = upcomingNeeds(js, ms, [], parts, stock, 30, '2026-10-11');
  const by = new Map(n.map((x) => [x.part.id, x]));
  ok(by.get('f')?.order === 2 && /in 9 d/.test(by.get('f')!.forJobs[0]), 'due in 9 d: need 2, have 1, keep 1 on the shelf → order 2');
  ok(!by.has('i'), 'a job far ahead is not counted');
  ok(!by.has('g'), 'overdue job but enough on hand → nothing to order');
  const n90 = upcomingNeeds(js, ms, [], parts, stock, 365, '2026-10-11');
  ok(n90.some((x) => x.part.id === 'i' && x.order === 1), 'a longer horizon brings the impeller in');
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
