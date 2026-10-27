// ===================================
// Finance reports — PDF through the shared table report (services/pmsHistoryReport)
// and the same tables as .xlsx (services/sheetFiles), for the owner's accountant.
//   APA statement  a fund over a period: opening, money in, payments, closing,
//                  every entry with its running balance, then by cost centre.
//   Budget         a year: budget, paid from the APA, received on orders,
//                  committed, left, per cost centre.
// English, as every report (screens are translated, papers are not).
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { saveSheet } from './sheetFiles';
import { BudgetYear, cancelledIds, fundSummary, inFund, money, round2 } from './finance';
import { ApaEntry, ApaFund, CENTRE_LABEL, CostCentre } from '../types/finance';

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const num = (n: number) => money(n, '').trim();
const METHOD: Record<string, string> = { cash: 'Cash', card: 'Card', transfer: 'Transfer' };

interface Line { e: ApaEntry; v: number; balance: number; note: string }

function statementLines(fund: ApaFund, entries: ApaEntry[], from: string, to: string) {
  const s = fundSummary(fund, entries, from, to);
  const gone = cancelledIds(entries);
  let bal = s.opening;
  const lines: Line[] = s.rows.map((e) => {
    const v = inFund(e, fund) ?? 0;
    if (!gone.has(e.id)) bal = round2(bal + (e.kind === 'in' ? v : -v));
    const note = e.reverses ? (e.reason ? `Reason: ${e.reason}` : '') : gone.has(e.id) ? 'REVERSED' : '';
    return { e, v, balance: bal, note };
  });
  return { s, lines };
}

const rowOf = (fund: ApaFund, l: Line) => [
  dmy(l.e.date),
  [l.e.description, l.e.poNo ? `PO ${l.e.poNo}` : '', l.note].filter(Boolean).join(' · '),
  l.e.supplier ?? '',
  l.e.centre ? CENTRE_LABEL[l.e.centre] : '',
  l.e.method ? METHOD[l.e.method] : '',
  l.e.receiptNo ?? (l.e.photos?.length ? 'photo' : ''),
  l.e.currency !== fund.currency ? `${l.e.currency} ${num(l.e.amount)} @ ${l.e.rate}` : '',
  l.e.kind === 'in' ? num(l.v) : '',
  l.e.kind === 'out' ? num(l.v) : '',
  num(l.balance),
  l.e.byRank ? `${l.e.by} (${l.e.byRank})` : l.e.by,
];
const HEAD = ['Date', 'Description', 'Supplier', 'Cost centre', 'Paid by', 'Receipt', 'Original', 'In', 'Out', 'Balance', 'Entered by'];

export function exportApaStatement(fund: ApaFund, entries: ApaEntry[], from: string, to: string, vessel: VesselInfo | null) {
  const { s, lines } = statementLines(fund, entries, from, to);
  const c = fund.currency;
  const facts = [`${fund.name} · ${c}`, `${dmy(from)} – ${dmy(to)}`, `Opening ${money(s.opening, c)}`, `Received ${money(s.received, c)}`, `Spent ${money(s.spent, c)}`, `Closing ${money(s.closing, c)}`];
  const centres = (Object.entries(s.byCentre) as [CostCentre, number][]).sort((a, b) => b[1] - a[1]);
  return exportPmsHistory('APA statement', `APA ${fund.name} ${from} ${to}`, vessel, [{
    title: `APA statement — ${fund.name}`,
    facts,
    tables: [
      { title: 'Entries', head: HEAD, rows: lines.map((l) => rowOf(fund, l)), widths: { 0: 17, 1: 62, 2: 30, 3: 28, 4: 15, 5: 18, 6: 25, 7: 18, 8: 18, 9: 20, 10: 22 } },
      { title: 'Spent by cost centre', head: ['Cost centre', `Spent (${c})`, 'Share'], rows: centres.map(([k, v]) => [CENTRE_LABEL[k], num(v), s.spent ? `${Math.round((v / s.spent) * 100)} %` : '—']), widths: { 0: 120, 1: 80, 2: 73 } },
      { title: 'Signed', head: ['Prepared by', 'Approved by the Master', 'Received by the owner / charterer'], rows: [['', '', '']], widths: { 0: 91, 1: 91, 2: 91 } },
    ],
  }]);
}

export function apaStatementSheet(fund: ApaFund, entries: ApaEntry[], from: string, to: string, vessel: VesselInfo | null) {
  const { s, lines } = statementLines(fund, entries, from, to);
  const rows: unknown[][] = [
    ['Date', 'Description', 'PO', 'Supplier', 'Cost centre', 'Paid by', 'Receipt no.', 'Currency', 'Amount', 'Rate', `In (${fund.currency})`, `Out (${fund.currency})`, 'Balance', 'Note', 'Entered by'],
    ['', 'Opening balance', '', '', '', '', '', '', '', '', '', '', s.opening, '', ''],
    ...lines.map((l) => [l.e.date, l.e.description, l.e.poNo ?? '', l.e.supplier ?? '', l.e.centre ? CENTRE_LABEL[l.e.centre] : '', l.e.method ? METHOD[l.e.method] : '', l.e.receiptNo ?? '', l.e.currency, l.e.amount, l.e.rate ?? '', l.e.kind === 'in' ? l.v : '', l.e.kind === 'out' ? l.v : '', l.balance, l.note, l.e.by]),
    ['', 'Closing balance', '', '', '', '', '', '', '', '', s.received, s.spent, s.closing, '', ''],
  ];
  return saveSheet(rows, 'APA', `APA ${fund.name} ${from} ${to}`, vessel);
}

const pct = (u: number | null) => (u == null ? '—' : `${Math.round(u * 100)} %`);

export function exportBudget(year: number, currency: string, y: BudgetYear, vessel: VesselInfo | null) {
  const row = (label: string, r: BudgetYear['total']) => [label, num(r.budget), num(r.apa), num(r.orders), num(r.spent), num(r.committed), num(r.left), pct(r.used)];
  const facts = [`${year} · ${currency}`, `Budget ${money(y.total.budget, currency)}`, `Spent ${money(y.total.spent, currency)}`, `Committed ${money(y.total.committed, currency)}`, `Left ${money(y.total.left, currency)}`, ...(y.skipped ? [`${y.skipped} amounts in another currency not counted`] : [])];
  return exportPmsHistory('Budget', `Budget ${year}`, vessel, [{
    title: `Budget ${year}`,
    facts,
    tables: [{ title: 'By cost centre', head: ['Cost centre', 'Budget', 'Paid from APA', 'Orders received', 'Spent', 'Committed (orders sent)', 'Left', 'Used'], rows: [...y.rows.map((r) => row(CENTRE_LABEL[r.centre], r)), row('TOTAL', y.total)], widths: { 0: 60, 1: 32, 2: 32, 3: 32, 4: 32, 5: 36, 6: 32, 7: 17 } }],
  }]);
}

export function budgetSheet(year: number, currency: string, y: BudgetYear, vessel: VesselInfo | null) {
  const row = (label: string, r: BudgetYear['total']) => [label, r.budget, r.apa, r.orders, r.spent, r.committed, r.left, r.used == null ? '' : round2(r.used * 100)];
  return saveSheet([[`Cost centre (${currency})`, 'Budget', 'Paid from APA', 'Orders received', 'Spent', 'Committed', 'Left', 'Used %'], ...y.rows.map((r) => row(CENTRE_LABEL[r.centre], r)), row('TOTAL', y.total)], `Budget ${year}`, `Budget ${year}`, vessel);
}
