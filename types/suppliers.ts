// ===================================
// Supplier directory — who the vessel buys from (screens/SuppliersSc, SupplierSc).
//
// The record is the contact card only. Everything measured about a supplier —
// quotes asked and won, how fast they answer, deliveries on time and complete,
// the prices they last charged — is worked out from the purchase orders
// (services/rfq.ts supplierStats), so it can never disagree with them.
// Orders keep the supplier's NAME as a snapshot; `supplierId` links back here.
// ===================================

import { OrderDept } from './orders';

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  /** Country or region they cover. */
  country?: string;
  /** Ports they deliver to, free text. */
  ports?: string;
  /** Departments they usually supply. */
  depts?: OrderDept[];
  /** ISO code they quote in. */
  currency?: string;
  /** Payment terms, e.g. "30 days net". */
  terms?: string;
  notes?: string;
  deleted?: boolean;
  updatedAt: number;
}
