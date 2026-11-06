// ===================================
// The AI on purchasing (plan AI-2, 6 Nov 2026): a supplier's quotation or invoice
// as a PDF or a photo. A quotation comes back as the prices of a quote, for the
// officer to check and save on screens/QuoteSc as if typed. An invoice is set
// against the order: what was ordered, what came aboard, the price agreed. Pure.
//
// The model sees the order's lines under short keys (L1, L2…) and answers with
// them; a key the order does not have is dropped, a document line it could not
// place is counted, never guessed onto a line. Prices are the document's own:
// nothing is converted, an invoice in another currency is not compared on price.
// ===================================

import { PurchaseOrder, Quote } from '../types/orders';
import { isoCurrency, round2 } from './finance';
import { liveLines } from './orders';

export interface AiOrderLine {
  key: string;
  description: string;
  qty: number;
  unit: string;
  partNo?: string;
  impa?: string;
  maker?: string;
}

/** What the AI is told about the order: the lines, no prices, no people. */
export function linesForAi(o: PurchaseOrder): AiOrderLine[] {
  return liveLines(o).map((l, i) => ({
    key: `L${i + 1}`,
    description: l.description,
    qty: l.qty,
    unit: l.unit,
    ...(l.partNo ? { partNo: l.partNo } : {}),
    ...(l.impa ? { impa: l.impa } : {}),
    ...(l.maker ? { maker: l.maker } : {}),
  }));
}

/** The line ids under L1, L2… when the document was sent: a job that waited keeps them, so a line added since cannot shift the keys. */
export const keyIds = (o: PurchaseOrder) => liveLines(o).map((l) => l.id);
const keyMap = (o: PurchaseOrder, sent?: string[]) => {
  const live = new Set(keyIds(o));
  return new Map((sent ?? keyIds(o)).map((id, i) => [`L${i + 1}`, id] as [string, string]).filter(([, id]) => live.has(id)));
};
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const iso = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const cur = (v: unknown): string | undefined => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : undefined);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// ---- a quotation ------------------------------------------------------------

export interface QuoteAiReply {
  currency?: string;
  ref?: string;
  validUntil?: string;
  leadDays?: number;
  delivery?: number;
  discountPct?: number;
  lines?: { key?: string; unitPrice?: number | null; unavailable?: boolean }[];
  /** Lines of the quotation that are not on the order. */
  other?: { description?: string }[];
  unreadable?: string;
}

export interface AiQuote {
  prices: Record<string, number>;
  unavailable: string[];
  currency?: string;
  ref?: string;
  validUntil?: string;
  leadDays?: number;
  delivery?: number;
  discountPct?: number;
  /** Lines of the quotation the AI did not place on the order. */
  other: string[];
  unreadable?: string;
}

/** The reply against the order as it is now. A line answered twice keeps its first answer. */
export function readQuote(o: PurchaseOrder, reply: QuoteAiReply, sent?: string[]): AiQuote {
  const ids = keyMap(o, sent);
  const out: AiQuote = { prices: {}, unavailable: [], other: [] };
  const seen = new Set<string>();
  for (const l of reply.lines ?? []) {
    const id = ids.get(String(l?.key ?? ''));
    if (!id || seen.has(id)) continue;
    const p = num(l.unitPrice);
    if (l.unavailable && p == null) { seen.add(id); out.unavailable.push(id); continue; }
    if (p == null) continue;
    seen.add(id);
    out.prices[id] = round2(p);
  }
  out.other = (reply.other ?? []).map((x) => text(x?.description)).filter(Boolean);
  const c = cur(reply.currency);
  if (c) out.currency = c;
  if (text(reply.ref)) out.ref = text(reply.ref);
  if (iso(reply.validUntil)) out.validUntil = reply.validUntil;
  const lead = num(reply.leadDays);
  if (lead != null) out.leadDays = Math.round(lead);
  const del = num(reply.delivery);
  if (del != null) out.delivery = round2(del);
  const disc = num(reply.discountPct);
  if (disc != null && disc < 100) out.discountPct = disc;
  if (text(reply.unreadable)) out.unreadable = text(reply.unreadable);
  return out;
}

// ---- an invoice -------------------------------------------------------------

export interface InvoiceAiReply {
  number?: string;
  date?: string;
  currency?: string;
  lines?: { key?: string | null; description?: string; qty?: number; unitPrice?: number; amount?: number }[];
  delivery?: number;
  discount?: number;
  tax?: number;
  total?: number;
  unreadable?: string;
}

export type InvoiceIssue = 'moreThanReceived' | 'moreThanOrdered' | 'price' | 'notInvoiced';

export interface InvoiceRow {
  lineId: string;
  description: string;
  unit: string;
  ordered: number;
  received: number;
  invoiced: number;
  /** The price on the order (written there by the award), in the order's currency. */
  agreed?: number;
  /** The invoice's unit price; several invoice lines on one order line → their average. */
  price?: number;
  issues: InvoiceIssue[];
}

export interface InvoiceCheck {
  number?: string;
  date?: string;
  currency?: string;
  /** The order's currency, when its lines have prices. */
  orderCurrency?: string;
  /** False when the two differ: prices are then not compared. */
  sameCurrency: boolean;
  rows: InvoiceRow[];
  /** Invoice lines that are not on the order. */
  extra: { description: string; amount?: number }[];
  delivery?: number;
  /** The delivery charge of the quote the order was awarded on. */
  agreedDelivery?: number;
  total?: number;
  /** Lines − discount + delivery + tax, from the invoice's own figures. */
  computed: number;
  /** The invoice's total is not what its lines add up to. */
  totalOff: boolean;
  /** Lines with an issue, plus extras, plus a delivery above the quote, plus a total that does not add up. */
  problems: number;
  unreadable?: string;
}

const awardedQuote = (o: PurchaseOrder): Quote | undefined => (o.award ? o.quotes?.find((q) => q.id === o.award!.quoteId) : undefined);
/** More than a cent and more than half a per cent: rounding on the supplier's side is not a finding. */
const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(0.01, Math.abs(b) * 0.005);

export function checkInvoice(o: PurchaseOrder, reply: InvoiceAiReply, sent?: string[]): InvoiceCheck {
  const ids = keyMap(o, sent);
  const lines = liveLines(o);
  const priced = lines.find((l) => l.unitPrice != null);
  const orderCurrency = priced ? isoCurrency(priced.currency) : undefined;
  const currency = cur(reply.currency);
  const sameCurrency = !orderCurrency || !currency || orderCurrency === currency;

  const qty: Record<string, number> = {};
  const value: Record<string, number> = {};
  const extra: InvoiceCheck['extra'] = [];
  let goods = 0;
  for (const l of reply.lines ?? []) {
    const q = num(l?.qty);
    const p = num(l?.unitPrice);
    const amount = num(l?.amount) ?? (q != null && p != null ? round2(q * p) : undefined);
    if (amount != null) goods += amount;
    const id = ids.get(String(l?.key ?? ''));
    if (!id) {
      const d = text(l?.description);
      if (d || amount) extra.push({ description: d || '—', ...(amount != null ? { amount } : {}) });
      continue;
    }
    qty[id] = (qty[id] ?? 0) + (q ?? 0);
    value[id] = (value[id] ?? 0) + (amount ?? 0);
  }

  const rows: InvoiceRow[] = lines.map((l) => {
    const invoiced = qty[l.id] ?? 0;
    const received = l.qtyReceived ?? 0;
    const price = invoiced > 0 && value[l.id] ? round2(value[l.id] / invoiced) : undefined;
    const issues: InvoiceIssue[] = [];
    if (invoiced > l.qty) issues.push('moreThanOrdered');
    if (invoiced > received) issues.push('moreThanReceived');
    if (sameCurrency && price != null && l.unitPrice != null && differs(price, l.unitPrice)) issues.push('price');
    if (!invoiced && received > 0) issues.push('notInvoiced');
    return {
      lineId: l.id, description: l.description || l.impa || '', unit: l.unit, ordered: l.qty, received, invoiced,
      ...(l.unitPrice != null ? { agreed: l.unitPrice } : {}), ...(price != null ? { price } : {}), issues,
    };
  });

  const delivery = num(reply.delivery);
  const discount = num(reply.discount) ?? 0;
  const tax = num(reply.tax) ?? 0;
  const total = num(reply.total);
  const computed = round2(goods - discount + (delivery ?? 0) + tax);
  const totalOff = total != null && differs(computed, total);
  const agreedDelivery = awardedQuote(o)?.delivery;
  const deliveryUp = deliveryAbove({ sameCurrency, delivery, agreedDelivery });
  // "Not invoiced" is information, not a fault: a second invoice may follow.
  const problems = rows.filter((r) => r.issues.some((i) => i !== 'notInvoiced')).length + extra.length + (deliveryUp ? 1 : 0) + (totalOff ? 1 : 0);

  return {
    ...(text(reply.number) ? { number: text(reply.number) } : {}),
    ...(iso(reply.date) ? { date: reply.date } : {}),
    ...(currency ? { currency } : {}),
    ...(orderCurrency ? { orderCurrency } : {}),
    sameCurrency, rows, extra,
    ...(delivery != null ? { delivery } : {}),
    ...(agreedDelivery != null ? { agreedDelivery } : {}),
    ...(total != null ? { total } : {}),
    computed, totalOff, problems,
    ...(text(reply.unreadable) ? { unreadable: text(reply.unreadable) } : {}),
  };
}

/** The delivery on the invoice is above what the awarded quote said. */
export const deliveryAbove = (c: Pick<InvoiceCheck, 'sameCurrency' | 'delivery' | 'agreedDelivery'>) =>
  c.sameCurrency && c.delivery != null && c.delivery > 0 && c.delivery > (c.agreedDelivery ?? 0) && differs(c.delivery, c.agreedDelivery ?? 0);
