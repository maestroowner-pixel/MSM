// ===================================
// Galley purchase orders — food & beverage requisitions.
//
// Different from department POs: no supplier focus, products grouped by
// food category, stock-on-hand tracked per line, total value shown at top.
// ===================================

export const GALLEY_GROUPS = [
  'Meat',
  'Fish & Seafood',
  'Dairy & Eggs',
  'Dry Goods',
  'Vegetables',
  'Fruit',
  'Frozen',
  'Beverages',
  'Bakery',
  'Spices & Condiments',
  'Oils & Fats',
  'Canned & Preserved',
  'Cleaning',
  'Other',
] as const;

export type GalleyGroup = typeof GALLEY_GROUPS[number];

export interface GalleyLine {
  id: string;
  group: GalleyGroup | string;
  name: string;
  /** Pack description: "6 kg", "bag 20 kg", "24 × 0.5 L" */
  pack?: string;
  /** Stock currently on board */
  stock: number;
  /** Quantity to order */
  orderQty: number;
  /** Price per pack/unit */
  price?: number;
  currency?: string;
  notes?: string;
}

export interface GalleyOrder {
  id: string;
  /** GO-001-2026 */
  no: string;
  date: string;
  by: string;
  byRank?: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  sentAt?: string;
  sentBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  cancelledAt?: string;
  lines: GalleyLine[];
  notes?: string;
  deleted?: boolean;
  at: number;
  updatedAt: number;
}
