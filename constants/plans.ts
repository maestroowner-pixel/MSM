// ===================================
// Plans — the published per-vessel prices (21 Nov 2026).
//
// The package was "price on request" from 27 Oct 2026. On 21 Nov 2026 the owner
// moved to a published monthly price, the way Nauticai sells its e-logbook
// (€99 / €250 a month): a visible figure lowers the first step for a vessel that is
// only looking. Two plans, monthly or yearly; a year costs ten months, so the yearly
// bill is the one most vessels take — a laid-up yacht on monthly would simply stop
// paying for the winter.
//
// WEB ONLY. The prices and the buy links are shown on the web paywall and the site,
// never in the iOS/Android build (App Store 3.1.1 — see PaywallSc's footer note).
//
// BUY LINKS. Each is a Lemon Squeezy subscription variant of a product `LS_PRODUCT_IDS`
// accepts (Logbooks: monthly = product 1535056 / variant 2387735, yearly = product 1535063 / variant 2387746; Full: monthly = product 1535068 / variant 2387757, yearly = product 1535069 / variant 2387758), "Generate license keys" on. Until a link is
// pasted here, that plan's button falls back to the quote e-mail, so nothing breaks
// before the variants exist. Keep the figures here, on ismpilot.com and in MSM Fleet
// (PRICING_DEFAULTS) in step with the variants' prices in Lemon Squeezy.
//
// Which modules a Logbooks vessel gets is still set per vessel by us
// (`npm run modules`), not read off the licence.
// ===================================

export type PlanKey = 'logbooks' | 'full';
export type Billing = 'monthly' | 'yearly';

export interface Plan {
  key: PlanKey;
  /** EUR per vessel, VAT excluded. */
  monthly: number;
  yearly: number;
  /** Lemon Squeezy buy links (https://kuka-soft.lemonsqueezy.com/buy/…); '' = not yet made. */
  buy: Record<Billing, string>;
}

export const PLANS: Plan[] = [
  { key: 'logbooks', monthly: 89, yearly: 890, buy: { monthly: 'https://kuka-soft.lemonsqueezy.com/checkout/buy/36734de9-11c7-4e4a-8c61-92ba30e81ad9', yearly: 'https://kuka-soft.lemonsqueezy.com/checkout/buy/0d086115-9e33-4194-a8c1-5f29c1df23a3' } },
  { key: 'full', monthly: 199, yearly: 1990, buy: { monthly: 'https://kuka-soft.lemonsqueezy.com/checkout/buy/6ad05423-80ba-4dd6-87dc-ca30c55f15a8', yearly: 'https://kuka-soft.lemonsqueezy.com/checkout/buy/c54a5169-fad0-4269-87e6-07bd66dcb137' } },
];

/** From this many vessels the price is quoted, not bought by the link. */
export const FLEET_FROM = 5;

export const eur = (n: number) => `€${n.toLocaleString('en-GB')}`;

/**
 * The buy link carrying the vessel, so the order in Lemon Squeezy says which ship it
 * is for (custom data shows on the order and in the webhook). '' when not configured.
 */
export function buyUrl(plan: Plan, billing: Billing, vessel?: { imo?: string; name?: string }): string {
  const base = plan.buy[billing];
  if (!base) return '';
  const q = new URLSearchParams();
  if (vessel?.imo) q.set('checkout[custom][imo]', String(vessel.imo));
  if (vessel?.name) q.set('checkout[custom][vessel]', String(vessel.name));
  const s = q.toString();
  return s ? `${base}${base.includes('?') ? '&' : '?'}${s}` : base;
}
