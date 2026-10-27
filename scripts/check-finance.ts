// npm run check:finance — the APA's balance and statement, and the budget against spending.
import { budgetYear, entryProblem, fundSummary, isoCurrency, lineCentre, money, overBudget } from '../services/finance';
import { ApaEntry, ApaFund, BudgetLine } from '../types/finance';
import { PurchaseOrder } from '../types/orders';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const fund: ApaFund = { id: 'f1', name: 'Charter Jul', currency: 'EUR', opened: '2026-07-01', updatedAt: 0 };
const e = (id: string, p: Partial<ApaEntry>): ApaEntry => ({ id, fundId: 'f1', date: '2026-07-02', kind: 'out', amount: 100, currency: 'EUR', description: 'x', by: 'Sven', at: Number(id.slice(1)), updatedAt: 0, ...p });
const entries: ApaEntry[] = [
  e('e1', { kind: 'in', amount: 50000, date: '2026-07-01', description: 'APA from charterer' }),
  e('e2', { amount: 1200, centre: 'galley', description: 'Provisions' }),
  e('e3', { amount: 800, currency: 'USD', rate: 0.9, centre: 'port', date: '2026-07-05', description: 'Marina' }),
  e('e4', { amount: 300, centre: 'deck', date: '2026-07-06' }),
  e('e5', { amount: 300, centre: 'deck', date: '2026-07-06', reverses: 'e4', reason: 'entered twice', kind: 'in' }),
];

ok(money(12345.6, 'EUR') === 'EUR 12,345.60', 'money formats with thousands');
ok(money(-5, 'USD') === '−USD 5.00', 'negative money');
ok(entryProblem({ date: '2026-07-02', amount: 10, description: 'x', kind: 'out', currency: 'EUR' }, fund) === 'fin.p.centre', 'a payment needs a cost centre');
ok(entryProblem({ date: '2026-07-02', amount: 10, description: 'x', kind: 'out', centre: 'deck', currency: 'USD' }, fund) === 'fin.p.rate', 'another currency needs the rate');
ok(entryProblem({ date: '2026-06-30', amount: 10, description: 'x', kind: 'in', currency: 'EUR' }, fund) === 'fin.p.beforeOpened', 'not before the fund opened');
ok(entryProblem({ date: '2026-07-02', amount: 0, description: 'x', kind: 'in', currency: 'EUR' }, fund) === 'fin.p.amount', 'the amount is positive');
ok(entryProblem({ date: '2026-07-02', amount: 10, description: 'x', kind: 'in', currency: 'EUR' }, { ...fund, closed: '2026-07-20' }) === 'fin.p.closed', 'a closed fund takes no entries');
ok(entryProblem({ date: '2026-07-02', amount: 10, description: 'x', kind: 'in', currency: 'EUR' }, fund) === null, 'money in is fine');

const s = fundSummary(fund, entries);
ok(s.received === 50000, 'received');
ok(s.spent === 1200 + 720, 'spent: the reversed payment is out, USD at 0.9');
ok(s.closing === 50000 - 1920, 'closing balance');
ok(s.byCentre.port === 720 && s.byCentre.deck === undefined, 'by cost centre');
ok(s.rows.length === 5, 'the reversal and the reversed stay on the statement');
const p = fundSummary(fund, entries, '2026-07-03', '2026-07-31');
ok(p.opening === 48800 && p.spent === 720 && p.closing === 48080, 'a period: opening balance carried');

const po = (id: string, p: Partial<PurchaseOrder>): PurchaseOrder => ({ id, no: id, dept: 'engine', status: 'sent', date: '2026-03-01', by: 'x', lines: [], at: 0, updatedAt: 0, ...p });
const orders: PurchaseOrder[] = [
  po('p1', { status: 'partial', lines: [{ id: 'l1', description: 'Filters', qty: 10, unit: 'pcs', unitPrice: 20, currency: '€', qtyReceived: 6 }] }),
  po('p2', { status: 'draft', lines: [{ id: 'l2', description: 'Oil', qty: 1, unit: 'drum', unitPrice: 900 }] }),
  po('p3', { status: 'received', dept: 'accommodation', lines: [{ id: 'l3', description: 'Linen', qty: 2, unit: 'set', unitPrice: 150, qtyReceived: 2, budget: 'Guests' }] }),
  po('p4', { status: 'received', lines: [{ id: 'l4', description: 'Pump', qty: 1, unit: 'pcs', unitPrice: 500, currency: '$', qtyReceived: 1 }] }),
  po('p5', { status: 'received', lines: [{ id: 'l5', description: 'Paid by APA', qty: 1, unit: 'pcs', unitPrice: 400, qtyReceived: 1 }] }),
];
ok(isoCurrency('€') === 'EUR' && isoCurrency(undefined) === 'EUR', 'order symbols read as ISO codes');
ok(lineCentre(orders[2].lines[0], orders[2]) === 'guests', 'a line\'s Budget field names the centre');
ok(lineCentre(orders[0].lines[0], orders[0]) === 'engine', 'else the order\'s department');

const budgets: BudgetLine[] = [
  { id: '2026:engine', year: 2026, centre: 'engine', amount: 1000, currency: 'EUR', updatedAt: 0 },
  { id: '2026:galley', year: 2026, centre: 'galley', amount: 1000, currency: 'EUR', updatedAt: 0 },
];
const withPo = [...entries, e('e6', { amount: 400, centre: 'engine', poId: 'p5', poNo: 'p5', date: '2026-07-07' })];
const b = budgetYear(2026, 'EUR', budgets, [fund], withPo, orders);
const eng = b.rows.find((r) => r.centre === 'engine')!;
ok(eng.orders === 120 && eng.committed === 80, 'order: received is spent, the rest committed; drafts not counted');
ok(eng.apa === 400 && eng.spent === 520, 'an order paid by the APA counts once, as the payment');
ok(eng.left === 1000 - 520 - 80, 'left = budget − spent − committed');
ok(b.rows.find((r) => r.centre === 'guests')!.spent === 300, 'received order on its line\'s centre');
ok(b.skipped === 1, 'the USD order is left out and counted');
const gal = b.rows.find((r) => r.centre === 'galley')!;
ok(gal.spent === 1200 && overBudget(b).map((r) => r.centre).join() === 'galley', 'galley over budget');
ok(b.total.budget === 2000, 'total budget');
ok(budgetYear(2025, 'EUR', budgets, [fund], withPo, orders).rows.length === 0, 'another year: nothing');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
