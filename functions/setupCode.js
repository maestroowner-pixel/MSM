// ===================================
// Each vessel's own setup code (16 Oct 2026: "the default codes for joining as
// Master must be different on every vessel"). It was ONE code for every ship:
// whoever held DreamBoat's could take over any vessel whose IMO they knew, and
// an IMO is public. Now the code is derived from the vessel's IMO and the
// BOOTSTRAP_CODE secret (HMAC-SHA256 → 12 digits): nothing new to store, a
// vessel's code is reproduced on demand (`npm run code -- <IMO>`), and one
// vessel's code says nothing about another's. Pure.
// ===================================

const crypto = require('crypto');

const DIGITS = 12;

/** The setup code of vessel `imo` (digits only), from the server's secret. */
function setupCodeFor(imo, secret) {
  const key = String(imo || '').replace(/\D/g, '');
  if (!key || !secret) throw new Error('setupCodeFor needs an IMO and the secret.');
  const h = crypto.createHmac('sha256', String(secret)).update(`vessel-setup:${key}`).digest();
  return (h.readBigUInt64BE(0) % 10n ** BigInt(DIGITS)).toString().padStart(DIGITS, '0');
}

/** Is `pin` this vessel's setup code? Compared in constant time. */
function isSetupCode(pin, imo, secret) {
  const want = Buffer.from(setupCodeFor(imo, secret));
  const got = Buffer.from(String(pin ?? '').trim());
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

module.exports = { setupCodeFor, isSetupCode, DIGITS };
