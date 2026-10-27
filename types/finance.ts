// ===================================
// Finance — the APA and the yearly budget (27 Oct 2026; the one row of the
// competitor matrix where IDEA, Seahub, Helm and Sertica have it and we had
// nothing — the captain and the purser kept it in Excel).
//
//   ApaFund    one pot of money the vessel spends from and accounts for: the
//              owner's account, or a charter's Advance Provisioning Allowance.
//              Its currency is the one the statement is in.
//   ApaEntry   money in (from the owner / charterer) or out (a payment), with
//              the receipt photographed. Written once, never changed: a mistake
//              is taken out by a reversing entry (`reverses`), the way an
//              accountant does it, so the statement the owner saw stays true.
//   BudgetLine the year's budget for one cost centre, in the budget currency.
//              Spent = APA payments + purchase orders received; committed = what
//              is still to come on orders sent (services/finance.ts).
//
// Officers and the Master only, aboard and in the cloud; the shore may read.
// ===================================

import { Attachment } from './equipment';

export type CostCentre = 'bridge' | 'engine' | 'deck' | 'interior' | 'galley' | 'medical' | 'fuel' | 'port' | 'crew' | 'guests' | 'admin' | 'other';

export const COST_CENTRES: CostCentre[] = ['bridge', 'engine', 'deck', 'interior', 'galley', 'medical', 'fuel', 'port', 'crew', 'guests', 'admin', 'other'];

/** Reports stay English; screens use t('fin.cc.<key>'). */
export const CENTRE_LABEL: Record<CostCentre, string> = {
  bridge: 'Bridge & navigation',
  engine: 'Engine',
  deck: 'Deck',
  interior: 'Interior',
  galley: 'Galley & provisions',
  medical: 'Medical',
  fuel: 'Fuel & lubricants',
  port: 'Port, marina & agency',
  crew: 'Crew',
  guests: 'Guests & charter',
  admin: 'Office, comms & IT',
  other: 'Other',
};

export type PayMethod = 'cash' | 'card' | 'transfer';
export const PAY_METHODS: PayMethod[] = ['cash', 'card', 'transfer'];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'AUD', 'AED', 'TRY', 'MXN', 'XCD'];

export interface ApaFund {
  id: string;
  /** "Owner's account", "Charter 12–19 Jul" — no guest's name: it goes to the cloud. */
  name: string;
  currency: string;
  /** yyyy-mm-dd */
  opened: string;
  /** yyyy-mm-dd — closed: no new entries; the statement stays. */
  closed?: string;
  notes?: string;
  deleted?: boolean;
  updatedAt: number;
}

export interface ApaEntry {
  id: string;
  fundId: string;
  /** yyyy-mm-dd — the day of the payment, not of the entry. */
  date: string;
  kind: 'in' | 'out';
  /** Always positive, in `currency`. */
  amount: number;
  currency: string;
  /** Units of the fund's currency for one unit of `currency` — needed when they differ. */
  rate?: number;
  /** Payments only. */
  centre?: CostCentre;
  description: string;
  supplier?: string;
  method?: PayMethod;
  /** The invoice or receipt number. */
  receiptNo?: string;
  /** The purchase order this paid — its value then counts once, here. */
  poId?: string;
  poNo?: string;
  photos?: Attachment[];
  /** This entry takes out the one with this id (a mistake); `reason` says why. */
  reverses?: string;
  reason?: string;
  by: string;
  byRank?: string;
  at: number;
  updatedAt: number;
}

export interface BudgetLine {
  /** `${year}:${centre}` — one line per centre per year. */
  id: string;
  year: number;
  centre: CostCentre;
  amount: number;
  currency: string;
  updatedAt: number;
}
