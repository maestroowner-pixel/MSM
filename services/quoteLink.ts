// ===================================
// A supplier quotes through a link (plan item 48, functions/quoteLink.js).
// The link is made on the server from the order as the vessel holds it, so the
// order goes up first (firebaseService.pushOrderNow). The token comes back once,
// inside the URL; only its hash is kept.
// ===================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import * as fb from './firebaseService';
import { withLink } from './rfq';
import { PurchaseOrder, QuoteLink } from '../types/orders';

const REGION = 'europe-west1';

function callable<Q, A>(name: string) {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return httpsCallable<Q, A>(getFunctions(app, REGION), name);
}

export async function sendQuoteLink(o: PurchaseOrder, quoteId: string, email: string): Promise<{ url: string; mailed: boolean; order: PurchaseOrder }> {
  const up = await fb.pushOrderNow(o);
  const r = await callable<{ orderId: string; quoteId: string; email: string }, { url: string; link: QuoteLink; mailed: boolean }>('quoteLinkSend')({ orderId: o.id, quoteId, email });
  return { url: r.data.url, mailed: r.data.mailed, order: withLink(up, quoteId, r.data.link) };
}

export async function extendQuoteLink(o: PurchaseOrder, quoteId: string): Promise<PurchaseOrder> {
  const r = await callable<{ orderId: string; quoteId: string }, { link: QuoteLink }>('quoteLinkExtend')({ orderId: o.id, quoteId });
  return withLink(o, quoteId, r.data.link);
}

/** Best effort: a quote removed while offline keeps its link until it runs out. */
export async function revokeQuoteLink(quoteId: string): Promise<void> {
  await callable<{ quoteId: string }, { ok: boolean }>('quoteLinkRevoke')({ quoteId });
}
