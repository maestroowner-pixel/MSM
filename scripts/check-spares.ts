// npm run check:spares — stock as the sum of movements (services/spares.ts).
import { batchesOnHand, firstExpiry, makeMove, movesForJob, orderQty, stockByPart, stockStatus, toOrderCounts, usedByYear } from '../services/spares';
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
// Ordering to max, shelf life, consumption (TM Master comparison, item 3).
{
  ok(orderQty({ minQty: 2, maxQty: 6 }, 1) === 5 && orderQty({ minQty: 2, maxQty: 6 }, 2) === 4, 'at or below the re-order level: order up to the maximum');
  ok(orderQty({ minQty: 2, maxQty: 6 }, 3) === 0, 'above the re-order level: nothing to order');
  ok(orderQty({ minQty: 2 }, 1) === 2 && orderQty({}, 0) === 1, 'no maximum: one over the re-order level; out with no levels: one');
  let t = 0;
  const mv = (kind: any, amount: number, onHand: number, date: string, expiry?: string) => ({ ...makeMove(imp, kind, amount, onHand, S, date, expiry ? { expiry } : {}), at: ++t });
  const ms = [mv('received', 4, 0, '2025-03-01', '2027-06-30'), mv('received', 2, 4, '2026-01-10', '2026-12-31'), mv('used', 3, 6, '2026-05-01'), mv('count', 4, 3, '2026-09-01')];
  const b = batchesOnHand(ms);
  ok(JSON.stringify(b) === JSON.stringify([{ qty: 3, expiry: '2027-06-30' }, { qty: 1 }]), 'used comes off the batch that expires first; counted over is a batch with no date');
  ok(firstExpiry(ms)?.expiry === '2027-06-30' && firstExpiry(ms)?.qty === 3, 'first expiry still on the shelf');
  ok(firstExpiry([mv('received', 2, 0, '2026-01-01')]) === undefined, 'nothing dated: no expiry');
  const u = usedByYear([...ms, mv('used', 1, 4, '2024-02-02'), mv('used', 2, 3, '2026-10-01')], '2026-10-15');
  ok(u.map((x) => `${x.year}:${x.used}`).join() === '2026:5,2025:0,2024:1', 'used per year, the last three, newest first; counts are not use');
  ok(makeMove(imp, 'received', 2, 0, S, D, { expiry: '2028-01-01' }).expiry === '2028-01-01', 'a delivery keeps its expiry');
}
// Plan item 36: what is on the way, lead times, critical parts first.
import { criticalParts, leadTimes, onOrder, reorderList } from '../services/sparesNeed';
{
  const po = (id: string, status: any, lines: any[], extra: any = {}): any => ({ id, no: id, dept: 'engine', status, date: '2026-09-01', by: '', lines, updatedAt: 0, ...extra });
  const orders = [
    po('a', 'draft', [{ id: 'l1', description: 'F', qty: 3, unit: 'pcs', spareId: 'f' }]),
    po('b', 'partial', [{ id: 'l2', description: 'F', qty: 4, qtyReceived: 3, unit: 'pcs', spareId: 'f' }]),
    po('c', 'draft', [{ id: 'l3', description: 'F', qty: 9, unit: 'pcs', spareId: 'f' }], { approval: [{ kind: 'reject', by: 'O', at: 1, note: 'no' }] }),
    po('d', 'cancelled', [{ id: 'l4', description: 'F', qty: 9, unit: 'pcs', spareId: 'f' }]),
    po('e', 'received', [{ id: 'l5', description: 'F', qty: 9, qtyReceived: 9, unit: 'pcs', spareId: 'f' }]),
    po('g', 'draft', [{ id: 'l6', description: 'F', qty: 9, unit: 'pcs', spareId: 'f' }], { deleted: true }),
  ];
  ok(onOrder(orders).get('f') === 4, 'on order: draft 3 + partial 1 still to come; rejected, cancelled, received, deleted bring nothing');

  const hist = [
    po('h1', 'received', [{ id: 'x', description: 'I', qty: 1, unit: 'pcs', spareId: 'i' }], { sentAt: '2026-01-01', receivedAt: '2026-01-31' }),
    po('h2', 'received', [{ id: 'y', description: 'I', qty: 2, unit: 'pcs', spareId: 'i' }], { sentAt: '2026-03-01', receivedAt: '2026-04-30', deliveries: [{ date: '2026-03-11', by: '', lines: { y: 1 } }, { date: '2026-04-30', by: '', lines: { y: 1 } }] }),
    po('h3', 'sent', [{ id: 'z', description: 'I', qty: 1, unit: 'pcs', spareId: 'i' }], { sentAt: '2026-05-01' }),
  ];
  const parts: any[] = [{ id: 'i', name: 'Impeller', updatedAt: 0, suppliers: [{ name: 'S', leadDays: 60 }] }, { id: 's', name: 'Seal', updatedAt: 0, suppliers: [{ name: 'S', leadDays: 14 }] }, { id: 'n', name: 'Nut', updatedAt: 0 }];
  const lt = leadTimes(parts, hist);
  ok(lt.get('i')?.days === 20 && lt.get('i')?.from === 'history', 'lead from history: 30 d and 10 d (first delivery that brought the line) → 20; an order not delivered is no history');
  ok(lt.get('s')?.days === 14 && lt.get('s')?.from === 'supplier' && !lt.has('n'), 'no history: the supplier\'s lead time; neither: none');

  const ms: any[] = [{ id: 'me', name: 'Main engine', critical: true, updatedAt: 0 }, { id: 'gen', name: 'Generator', updatedAt: 0 }];
  const js: any[] = [
    { id: 'j1', machineId: 'gen', title: 'Pump', intervalDays: 365, lastDoneDate: '2025-11-30', parts: [{ partId: 'i', qty: 1 }], updatedAt: 0 },
    { id: 'j2', machineId: 'me', title: 'Seals', intervalDays: 365, lastDoneDate: '2025-01-01', parts: [{ partId: 's', qty: 2 }], updatedAt: 0 },
  ];
  const cp: any[] = [...parts, { id: 'b', name: 'Bolt', machineIds: ['me'], minQty: 2, updatedAt: 0 }, { id: 'a', name: 'Anode', minQty: 1, updatedAt: 0 }];
  const crit = criticalParts(cp, ms, js);
  ok(crit.has('s') && crit.has('b') && !crit.has('i') && !crit.has('a'), 'critical: fitted to a critical machine or used by its job');

  // Impeller job is 39 d ahead: outside 30 d, inside 30 + 20 d lead.
  const stock = new Map([['a', 0], ['b', 1]]);
  const r0 = reorderList(js, ms, [], cp.map((p) => (p.id === 'i' ? { ...p, suppliers: undefined } : p)), stock, [], 30, '2026-10-22');
  const r = reorderList(js, ms, [], cp, stock, hist.slice(0, 2), 30, '2026-10-22');
  ok(!r0.some((x) => x.part.id === 'i' && x.need) && r.some((x) => x.part.id === 'i' && x.need === 1), 'no lead time: a job 39 d ahead is outside 30 d; with 20 d from history it is in');
  ok(r[0].critical && r[1].critical && !r[r.length - 1].critical, 'critical lines first');
  ok(r.find((x) => x.part.id === 'b')?.qty === 2 && r.find((x) => x.part.id === 'a')?.qty === 2, 'below the re-order level: one over it');
  const withOrder = [...hist, po('o', 'draft', [{ id: 'q', description: 'B', qty: 2, unit: 'pcs', spareId: 'b' }])];
  const r2 = reorderList(js, ms, [], cp, stock, withOrder, 30, '2026-10-22');
  ok(!r2.some((x) => x.part.id === 'b'), 'already on a draft: not ordered again');
  ok(!r2.some((x) => x.part.id === 'i'), 'the impeller sent and not yet aboard covers its job: not ordered again');
  const r3 = reorderList(js, ms, [], cp, stock, [], 30, '2026-10-22', false);
  ok(r3.every((x) => x.need === 0) && r3.some((x) => x.part.id === 'b'), 'without PMS: only the re-order levels');
}
// Consumption-based levels (stocktake → draft, 2 Nov 2026).
import { dailyUse, levels, qtyFor } from '../services/sparesNeed';
{
  const mv = (partId: string, kind: any, delta: number, date: string): any => ({ id: `${partId}${date}${delta}`, partId, partName: partId, kind, delta, date, by: 'A', at: 1, updatedAt: 0 });
  const ms = [mv('f', 'received', 40, '2025-06-01'), ...Array.from({ length: 12 }, (_, i) => mv('f', 'used', -3, `2026-${String(i + 1).padStart(2, '0')}-05`)), mv('f', 'used', -10, '2025-07-01'), mv('n', 'received', 5, '2026-10-20'), mv('n', 'used', -1, '2026-10-28'), mv('f', 'count', -2, '2026-06-01'), mv('k', 'used', -1, '2026-12-25')];
  const u = dailyUse(ms, '2026-12-31');
  ok(Math.abs(u.get('f')! - 36 / 365) < 1e-9, 'use per day: last 365 days of used only — older use and counts left out');
  ok(Math.abs(u.get('n')! - 1 / 72) < 1e-9 && Math.abs(u.get('k')! - 1 / 30) < 1e-9, 'a part aboard 72 days is averaged over them; one aboard 6 days over at least 30');
  const L = levels({ minQty: 2 }, 36 / 365, 60);
  ok(L.rop === 8 && L.target === 17, 'min 2 + 5.9 used during a 60-day lead → order at 8; no max: up to 8 + 90 days of use (9)');
  ok(levels({ minQty: 2, maxQty: 20 }, 0.1, 30).target === 20 && levels({ minQty: 2, maxQty: 4 }, 0.1, 30).target === 5 + 9, 'a maximum below the re-order point is not a target');
  ok(qtyFor(L, 9) === 0 && qtyFor(L, 8) === 9 && qtyFor(L, 3) === 14, 'above the re-order point nothing; at it, back up to the target');
  ok(qtyFor(levels({}, 0, 0), 0) === 1 && qtyFor(levels({}, 0, 0), 2) === 0 && qtyFor(levels({ minQty: 2 }, 0, 0), 1) === 2, 'no use, no lead: the old re-order level rule');
  const parts: any[] = [{ id: 'f', name: 'Filter', minQty: 2, suppliers: [{ name: 'S', leadDays: 60 }], updatedAt: 0 }, { id: 'n', name: 'Nut', updatedAt: 0 }];
  const r = reorderList([], [], [], parts, new Map([['f', 6], ['n', 4]]), [], 30, '2026-12-31', true, ms);
  ok(r.length === 1 && r[0].part.id === 'f' && r[0].qty === 11 && r[0].rop === 8, '6 on hand is above the minimum but below the re-order point → 11 to the target');
  ok(reorderList([], [], [], parts, new Map([['f', 6], ['n', 0]]), [], 30, '2026-12-31', true, ms, new Set(['n'])).map((x) => x.part.id).join() === 'n', 'only the parts counted');
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
