// ===================================
// Purchase orders — requisitions from the vessel to a supplier.
//
//   Department  who is ordering: bridge, engine, deck, accommodation, galley.
//   PurchaseOrder  one PO: a list of lines, a supplier, a status.
//   OrderLine   one item requested: description, quantity, unit, any references.
//
// Status flow: draft → standby (on hold) → sent → partial (first delivery short) → received | cancelled.
// A sent order can still be edited (add lines, update supplier) until received.
// Lines record how many arrived, so a short delivery reads "6 of 10" until the
// rest comes. Append-only movement records are overkill here — the PO itself is
// the register; an edit before sending is expected and not audited.
// ===================================

export type OrderDept = 'bridge' | 'engine' | 'deck' | 'accommodation' | 'galley' | 'medical';
export type OrderStatus = 'draft' | 'standby' | 'sent' | 'partial' | 'received' | 'cancelled';

export const ORDER_DEPTS: OrderDept[] = ['bridge', 'engine', 'deck', 'accommodation', 'galley', 'medical'];

export const ORDER_DEPT_LABEL: Record<OrderDept, string> = {
  bridge:        'Bridge',
  engine:        'Engine',
  deck:          'Deck',
  accommodation: 'Accommodation',
  galley:        'Galley',
  medical:       'Medical',
};

export const ORDER_DEPT_CODE: Record<OrderDept, string> = {
  bridge:        'BR',
  engine:        'EN',
  deck:          'DK',
  accommodation: 'AC',
  galley:        'GL',
  medical:       'MD',
};

export const ORDER_DEPT_ICON: Record<OrderDept, string> = {
  bridge:        'ferry',
  engine:        'engine-outline',
  deck:          'anchor',
  accommodation: 'bed-outline',
  galley:        'silverware-fork-knife',
  medical:       'medical-bag',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft:     'Draft',
  standby:   'Standby',
  sent:      'Sent',
  partial:   'Partial',
  received:  'Received',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, 'muted' | 'warn' | 'accent' | 'green' | 'red'> = {
  draft:     'muted',
  standby:   'warn',
  sent:      'accent',
  partial:   'warn',
  received:  'green',
  cancelled: 'red',
};

export interface OrderLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  partNo?: string;
  impa?: string;
  maker?: string;
  unitPrice?: number;
  currency?: string;
  /** Stock on board at time of order */
  stockQty?: number;
  /** Budget / cost centre */
  budget?: string;
  /** Cumulative received — updated on each delivery. */
  qtyReceived?: number;
  notes?: string;
  /** Link to a spare part in the spares register, if the line came from there. */
  spareId?: string;
}

/** One delivery event — appended on each "Record delivery" confirmation. */
export interface Delivery {
  /** yyyy-mm-dd */
  date: string;
  by: string;
  /** Quantity received IN THIS delivery per line id. */
  lines: Record<string, number>;
}

/**
 * A named collection of purchase orders — e.g. "Drydock Oct 2026" or "Charter #4".
 * The orders themselves are unchanged; a group is just a label + a list of ids.
 */
export interface OrderGroup {
  id: string;
  name: string;
  /** Optional: yyyy-mm-dd */
  date?: string;
  notes?: string;
  /** Ids of PurchaseOrders belonging to this group. */
  orderIds: string[];
  deleted?: boolean;
  updatedAt: number;
}

/**
 * A supplier's answer to the request for quotation (screens/QuoteSc, services/rfq.ts).
 * One per supplier asked; `receivedAt` empty = asked, no answer yet.
 */
export interface Quote {
  id: string;
  /** Name snapshot; `supplierId` links the directory (types/suppliers.ts) and may dangle. */
  supplier: string;
  supplierId?: string;
  /** yyyy-mm-dd the request went to them. */
  askedAt: string;
  /** yyyy-mm-dd their quote came in. */
  receivedAt?: string;
  /** They answered that they will not quote. */
  declined?: boolean;
  /** ISO code (EUR, USD…) — quotes in different currencies are not ranked against each other. */
  currency: string;
  /** Unit price per order line id. */
  prices: Record<string, number>;
  /** Line ids they cannot supply. */
  unavailable?: string[];
  /** Delivery / freight charge for the whole order. */
  delivery?: number;
  /** Discount on the goods, per cent. */
  discountPct?: number;
  /** Days from order to delivery aboard. */
  leadDays?: number;
  /** yyyy-mm-dd the prices hold until. */
  validUntil?: string;
  /** Their quotation number. */
  ref?: string;
  notes?: string;
}

/** Who won the quotation and why — kept on the order for the audit. */
export interface Award {
  quoteId: string;
  supplier: string;
  /** yyyy-mm-dd */
  at: string;
  by: string;
  total: number;
  currency: string;
  /** It was the lowest complete quote in its currency. */
  cheapest: boolean;
  /** Complete quotes compared. */
  compared: number;
  /** Required when it was not the cheapest. */
  reason?: string;
}

export interface PurchaseOrder {
  id: string;
  /** Sequential: PO-2026-001 */
  no: string;
  dept: OrderDept;
  status: OrderStatus;
  /** yyyy-mm-dd */
  date: string;
  /** Name snapshot */
  by: string;
  byRank?: string;
  /** Supplier this order is sent to */
  supplier?: string;
  supplierRef?: string;
  /** yyyy-mm-dd */
  sentAt?: string;
  sentBy?: string;
  /** yyyy-mm-dd of full receipt */
  receivedAt?: string;
  receivedBy?: string;
  /** yyyy-mm-dd when cancelled */
  cancelledAt?: string;
  /** Append-only log of every delivery event. */
  deliveries?: Delivery[];
  lines: OrderLine[];
  notes?: string;
  /** yyyy-mm-dd requested delivery date */
  deliveryDate?: string;
  /** Port or place of delivery */
  deliveryPort?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
  /** The directory entry of `supplier`, when chosen from it (types/suppliers.ts). */
  supplierId?: string;
  /** Request for quotation: suppliers asked and their answers, then the choice. */
  quotes?: Quote[];
  /** yyyy-mm-dd quotes are wanted by. */
  quoteBy?: string;
  award?: Award;
  deleted?: boolean;
  /** Epoch ms */
  at: number;
  updatedAt: number;
}
