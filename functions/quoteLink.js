// ===================================
// A supplier quotes through a link (plan item 48, 8 Nov 2026) — no account.
//
//   quoteLinkSend    callable, an officer: a link for one quote on a purchase
//                    order, mailed to the supplier when an address is given.
//                    A new link for the same quote replaces the old one.
//   quoteLinkExtend  callable: the link opens for another LINK_DAYS from now.
//   quoteLinkRevoke  callable: the link stops (the quote was removed).
//   supplierQuote    public HTTP, behind app.ismpilot.com/quote/<token>
//                    (MSM Win Web/public/quote.html + quote.js):
//                    GET  ?t=TOKEN  → the request: vessel, PO, lines, machine
//                                     maker/model/serial, their earlier answer
//                    POST {t, …}    → their answer, written into the quote
//
// THE TOKEN is 128 random bits, shown once to the officer and in the mail; only
// its SHA-256 is kept: `quote_links/{hash}` → vessel, order, quote, expiry (the
// Admin SDK only, as `api_keys/{hash}`), and `safety_vessels/{v}/quote_links/{quoteId}`
// keeps which hash belongs to the quote, so a new link or a revoke can stop the old.
//
// THE ANSWER goes straight into `quotes` on the order in the cloud, in a
// transaction, with `link.answeredAt`; the app folds it over an older copy it
// may still hold (services/rfq.ts foldOrder). Prices are kept per the ORDER's
// unit — the supplier's own unit and price stay in `lineInfo`. The supplier may
// change the answer while the link is open and the order is not awarded or sent.
//
// WHAT THE PAGE SHOWS: the vessel's name, the PO number, port and dates, the
// lines (description, part no., IMPA, maker, quantity, unit) and the maker,
// model and serial of the machines a spare part fits. Never a person: not who
// raised the order, not the line notes.
// ===================================

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { liveCaller } = require('./access');
const { PUBLIC_MAX_INSTANCES, takeOne, capped, escHtml } = require('./publicLimits');

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const DAY = 86400000;
const LINK_DAYS = 7;
const PAGE_BASE = 'https://app.ismpilot.com/quote/';
const POSTS_PER_HOUR = 20;
// 6 MB: as base64 in JSON it stays under the 10 MB the functions framework parses.
const MAX_FILE = 6 * 1024 * 1024;
const FILE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
const KINDS = ['original', 'oem', 'replacement'];
const MAX = { ref: 60, notes: 1000, name: 80, unit: 20, partNo: 60, remark: 200, label: 60, charges: 6 };
const CORS_ORIGINS = ['https://app.ismpilot.com', 'http://localhost:8081', 'http://localhost:19006'];

const db = () => admin.firestore();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(16).toString('hex');
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---- pure: what the page shows, what it may write ----------------------------

/** services/orders.ts liveLines — a line the office struck out is not asked for. */
const liveLines = (o) => (o.lines || []).filter((l) => !(l.cut && l.qty === 0));

/** Why the link no longer takes an answer, or null. */
function closedWhy(o, q, link, now = Date.now()) {
  if (!o || o.deleted || !q) return 'removed';
  if (!link || link.expires <= now) return 'expired';
  if (o.award) return 'awarded';
  if (!['draft', 'standby'].includes(o.status)) return 'ordered';
  return null;
}

const CLOSED_TEXT = {
  removed: 'This request is no longer open.',
  expired: 'This link has expired. Ask the vessel for a new one.',
  awarded: 'The order has been placed. Thank you for quoting.',
  ordered: 'The order has been placed. Thank you for quoting.',
};

/** The supplier's earlier answer as the page edits it — prices back in THEIR unit. */
function earlierAnswer(o, q) {
  if (!q.link || !q.link.answeredAt) return null;
  const lines = {};
  for (const l of liveLines(o)) {
    const info = (q.lineInfo && q.lineInfo[l.id]) || {};
    const na = (q.unavailable || []).includes(l.id);
    const p = q.prices ? q.prices[l.id] : undefined;
    lines[l.id] = {
      na,
      price: info.unitPrice != null ? info.unitPrice : p,
      ...(info.kind ? { kind: info.kind } : {}),
      ...(info.leadDays != null ? { lead: info.leadDays } : {}),
      ...(info.unit ? { unit: info.unit, per: info.per || 1 } : {}),
      ...(info.partNo ? { partNo: info.partNo } : {}),
      ...(info.remark ? { remark: info.remark } : {}),
    };
  }
  return {
    at: q.link.answeredAt,
    declined: !!q.declined,
    currency: q.currency,
    ref: q.ref || '',
    validUntil: q.validUntil || '',
    delivery: q.delivery,
    discountPct: q.discountPct,
    charges: q.charges || [],
    notes: q.notes || '',
    name: q.link.answeredBy || '',
    file: q.file ? q.file.name : '',
    lines,
  };
}

/** The request for the page. `fits` = line id → [{maker, model, serial}]. */
function pageData(o, q, link, vesselName, fits = {}, now = Date.now()) {
  const closed = closedWhy(o, q, link, now);
  return {
    vessel: vesselName || 'Vessel',
    supplier: q ? q.supplier : '',
    po: o ? o.no : '',
    port: (o && o.deliveryPort) || '',
    deliveryDate: (o && o.deliveryDate) || '',
    quoteBy: (o && o.quoteBy) || '',
    urgency: (o && o.urgency) || 'routine',
    currency: (q && q.currency) || 'EUR',
    expires: link ? link.expires : 0,
    closed,
    closedText: closed ? CLOSED_TEXT[closed] : '',
    lines: o && q ? liveLines(o).map((l, i) => ({
      id: l.id,
      n: i + 1,
      description: l.description || '',
      qty: l.qty,
      unit: l.unit || 'pcs',
      ...(l.partNo ? { partNo: l.partNo } : {}),
      ...(l.impa ? { impa: l.impa } : {}),
      ...(l.maker ? { maker: l.maker } : {}),
      ...(fits[l.id] && fits[l.id].length ? { fits: fits[l.id] } : {}),
    })) : [],
    answer: o && q ? earlierAnswer(o, q) : null,
  };
}

/** A number from the page — a number, or a string with a dot or a comma. */
function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The supplier's answer as fields of the quote, or { error }. Pure. Unit prices
 * are turned into prices per the ORDER's unit (their price ÷ how many of ours
 * their unit holds); what they typed stays in lineInfo.
 */
function readAnswer(o, body) {
  const b = body || {};
  const name = capped(b.name, MAX.name);
  if (b.declined === true) {
    return { quote: { declined: true, prices: {}, unavailable: [], ...(capped(b.notes, MAX.notes) ? { notes: capped(b.notes, MAX.notes) } : {}) }, name };
  }
  const currency = String(b.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Choose the currency of your quotation.' };
  const lines = b.lines && typeof b.lines === 'object' ? b.lines : {};
  const prices = {};
  const unavailable = [];
  const lineInfo = {};
  let lead = 0;
  for (const l of liveLines(o)) {
    const a = lines[l.id];
    if (!a || typeof a !== 'object') continue;
    if (a.na === true) { unavailable.push(l.id); continue; }
    const price = toNum(a.price);
    if (price == null) continue;
    if (price < 0 || price >= 1e9) return { error: `Line ${liveLines(o).indexOf(l) + 1}: the price is not a price.` };
    const unit = capped(a.unit, MAX.unit);
    const per = unit ? toNum(a.per) : 1;
    if (unit && (per == null || per <= 0 || per > 1e6)) return { error: `Line ${liveLines(o).indexOf(l) + 1}: say how many ${l.unit || 'pcs'} one ${unit} holds.` };
    prices[l.id] = round(price / per, 4);
    const info = {};
    if (KINDS.includes(a.kind)) info.kind = a.kind;
    const ld = toNum(a.lead);
    if (ld != null && ld >= 0 && ld <= 999) { info.leadDays = Math.round(ld); lead = Math.max(lead, info.leadDays); }
    if (unit && per !== 1) { info.unit = unit; info.per = per; info.unitPrice = price; }
    const partNo = capped(a.partNo, MAX.partNo);
    if (partNo) info.partNo = partNo;
    const remark = capped(a.remark, MAX.remark);
    if (remark) info.remark = remark;
    if (Object.keys(info).length) lineInfo[l.id] = info;
  }
  if (!Object.keys(prices).length && !unavailable.length) return { error: 'Enter a price for at least one line, or mark what you cannot supply.' };
  const delivery = toNum(b.delivery);
  if (delivery != null && (delivery < 0 || delivery >= 1e9)) return { error: 'The delivery charge is not a charge.' };
  const discountPct = toNum(b.discountPct);
  if (discountPct != null && (discountPct < 0 || discountPct > 100)) return { error: 'The discount is a per cent between 0 and 100.' };
  const charges = [];
  for (const c of Array.isArray(b.charges) ? b.charges.slice(0, MAX.charges) : []) {
    const label = capped(c && c.label, MAX.label);
    const amount = toNum(c && c.amount);
    if (!label && amount == null) continue;
    if (!label || amount == null || amount < 0 || amount >= 1e9) return { error: 'Each other charge needs what it is for and its amount.' };
    charges.push({ label, amount: round(amount, 2) });
  }
  const validUntil = typeof b.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : '';
  const quote = {
    declined: false,
    currency,
    prices,
    unavailable,
    lineInfo,
    charges,
    ...(delivery != null ? { delivery: round(delivery, 2) } : {}),
    ...(discountPct != null ? { discountPct } : {}),
    ...(lead ? { leadDays: lead } : toNum(b.leadDays) != null ? { leadDays: Math.max(0, Math.round(toNum(b.leadDays))) } : {}),
    ...(validUntil ? { validUntil } : {}),
    ...(capped(b.ref, MAX.ref) ? { ref: capped(b.ref, MAX.ref) } : {}),
    ...(capped(b.notes, MAX.notes) ? { notes: capped(b.notes, MAX.notes) } : {}),
  };
  return { quote, name };
}

/** The quote with the answer in it — the fields the page owns replaced, the rest kept. Pure. */
function withAnswer(q, quote, name, now, file) {
  const owned = ['declined', 'prices', 'unavailable', 'lineInfo', 'charges', 'delivery', 'discountPct', 'leadDays', 'validUntil', 'ref', 'notes'];
  const out = { ...q };
  for (const k of owned) delete out[k];
  Object.assign(out, quote, { receivedAt: isoDay(now) });
  if (!out.currency) out.currency = q.currency;
  if (file) out.file = file;
  out.link = { ...(q.link || {}), answeredAt: now, ...(name ? { answeredBy: name } : {}) };
  if (!name) delete out.link.answeredBy;
  return out;
}

// ---- reading the order and the vessel ------------------------------------------

const orderRef = (v, id) => db().doc(`${ROOT}/${v}/purchase_orders/${id}`);

async function vesselName(v) {
  // A vessel document carries the whole register: read the one field.
  const s = await db().collection(ROOT).where(FieldPath.documentId(), '==', v).select('vessel_name').get();
  return s.empty ? '' : s.docs[0].get('vessel_name') || '';
}

/** Maker, model and serial of the machines each spare-part line fits. */
async function machinesFor(v, o) {
  const out = {};
  const lines = liveLines(o).filter((l) => l.spareId).slice(0, 100);
  for (const l of lines) {
    const sp = await db().doc(`${ROOT}/${v}/spares/${l.spareId}`).get().catch(() => null);
    const ids = sp && sp.exists ? (sp.get('machineIds') || []).slice(0, 5) : [];
    const fits = [];
    for (const id of ids) {
      const m = await db().doc(`${ROOT}/${v}/pms_machines/${id}`).get().catch(() => null);
      if (!m || !m.exists || m.get('deleted')) continue;
      const f = { maker: m.get('maker') || '', model: m.get('model') || '', serial: m.get('serial') || '' };
      if (f.maker || f.model || f.serial) fits.push(f);
    }
    if (fits.length) out[l.id] = fits;
  }
  return out;
}

// ---- the officer's side: make, extend, stop -----------------------------------

async function officer(req) {
  const t = (req.auth && req.auth.token) || {};
  if (!t.vessel || t.approved !== true || !['admin', 'superadmin'].includes(t.role)) {
    throw new HttpsError('permission-denied', 'Only an officer or the Master can send a request for quotation.');
  }
  await liveCaller(t, ['admin', 'superadmin']);
  return t;
}

async function openQuote(v, orderId, quoteId) {
  const snap = await orderRef(v, orderId).get();
  const o = snap.exists ? snap.data() : null;
  const q = o && (o.quotes || []).find((x) => x.id === quoteId);
  if (!o || !q) throw new HttpsError('not-found', 'The order is not on the vessel yet. Sync and try again.');
  if (o.award || !['draft', 'standby'].includes(o.status)) throw new HttpsError('failed-precondition', 'The order is already placed.');
  return { o, q };
}

/** Puts `link` on the quote in the cloud, in a transaction (the supplier may be answering). */
async function setLink(v, orderId, quoteId, patch) {
  const ref = orderRef(v, orderId);
  return db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'No such order.');
    const o = s.data();
    let link = null;
    const quotes = (o.quotes || []).map((q) => {
      if (q.id !== quoteId) return q;
      link = { ...(q.link || {}), ...patch };
      if (!link.to) delete link.to;
      return { ...q, link };
    });
    if (!link) throw new HttpsError('not-found', 'No such quote on the order.');
    tx.update(ref, { quotes, updatedAt: Math.max(Date.now(), (o.updatedAt || 0) + 1) });
    return link;
  });
}

async function dropOld(v, quoteId) {
  const rec = await db().doc(`${ROOT}/${v}/quote_links/${quoteId}`).get();
  if (rec.exists && rec.get('hash')) await db().doc(`quote_links/${rec.get('hash')}`).delete();
}

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

function mailFor(o, q, name, url, expires) {
  const n = liveLines(o).length;
  const subject = `Request for quotation ${o.no} — ${name}`;
  const facts = [
    `${n} item${n === 1 ? '' : 's'}`,
    o.quoteBy ? `quote by ${o.quoteBy.split('-').reverse().join('.')}` : '',
    o.deliveryPort ? `delivery to ${o.deliveryPort}` : '',
  ].filter(Boolean).join(' · ');
  const until = new Date(expires).toISOString().slice(0, 16).replace('T', ' ');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0B2545;max-width:560px">
<p>Dear ${escHtml(q.supplier)},</p>
<p><b>${escHtml(name)}</b> asks you to quote for purchase order <b>${escHtml(o.no)}</b> (${escHtml(facts)}).</p>
<p><a href="${url}" style="display:inline-block;background:#1A6FD4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Open the request and quote</a></p>
<p>Enter your prices on the page — no account is needed. You can change your answer until the link closes on ${until} UTC.</p>
<p style="color:#666;font-size:12px">If the button does not work, copy this address into your browser:<br>${url}<br>The link is for you only; do not forward it.</p>
<p style="color:#666;font-size:12px">Sent through ISMpilot on behalf of the vessel.</p>
</div>`;
  return { subject, html };
}

const quoteLinkSend = onCall({ region: REGION, secrets: [SMTP_USER, SMTP_PASS] }, async (req) => {
  const t = await officer(req);
  const v = String(t.vessel);
  const orderId = String((req.data && req.data.orderId) || '');
  const quoteId = String((req.data && req.data.quoteId) || '');
  const email = String((req.data && req.data.email) || '').trim();
  if (!orderId || !quoteId) throw new HttpsError('invalid-argument', 'Which quote?');
  if (email && !EMAIL.test(email)) throw new HttpsError('invalid-argument', 'That e-mail address does not look right.');
  const { o, q } = await openQuote(v, orderId, quoteId);

  await dropOld(v, quoteId);
  const token = newToken();
  const hash = sha256(token);
  const now = Date.now();
  const expires = now + LINK_DAYS * DAY;
  const batch = db().batch();
  batch.set(db().doc(`quote_links/${hash}`), { vessel: v, orderId, quoteId, expires });
  batch.set(db().doc(`${ROOT}/${v}/quote_links/${quoteId}`), { hash, orderId, sentAt: now, expires, ...(email ? { to: email } : {}) });
  await batch.commit();
  const link = await setLink(v, orderId, quoteId, { sentAt: now, expires, to: email || undefined });

  const url = PAGE_BASE + token;
  let mailed = false;
  if (email) {
    const mail = mailFor(o, q, await vesselName(v), url, expires);
    try {
      const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() } });
      await transport.sendMail({ from: `ISMpilot <${SMTP_USER.value()}>`, to: email, subject: mail.subject, html: mail.html });
      mailed = true;
    } catch (e) {
      console.error(`[quoteLink] ${v} ${o.no}: mail not sent:`, e && e.message);
    }
  }
  return { url, link, mailed };
});

const quoteLinkExtend = onCall({ region: REGION }, async (req) => {
  const t = await officer(req);
  const v = String(t.vessel);
  const orderId = String((req.data && req.data.orderId) || '');
  const quoteId = String((req.data && req.data.quoteId) || '');
  await openQuote(v, orderId, quoteId);
  const rec = await db().doc(`${ROOT}/${v}/quote_links/${quoteId}`).get();
  if (!rec.exists || !rec.get('hash')) throw new HttpsError('not-found', 'This quote has no link. Send a new one.');
  const expires = Date.now() + LINK_DAYS * DAY;
  const batch = db().batch();
  batch.set(db().doc(`quote_links/${rec.get('hash')}`), { vessel: v, orderId, quoteId, expires });
  batch.update(rec.ref, { expires });
  await batch.commit();
  return { link: await setLink(v, orderId, quoteId, { expires }) };
});

const quoteLinkRevoke = onCall({ region: REGION }, async (req) => {
  const t = await officer(req);
  const v = String(t.vessel);
  const quoteId = String((req.data && req.data.quoteId) || '');
  if (!quoteId) throw new HttpsError('invalid-argument', 'Which quote?');
  await dropOld(v, quoteId);
  await db().doc(`${ROOT}/${v}/quote_links/${quoteId}`).set({ revokedAt: Date.now() }, { merge: true });
  return { ok: true };
});

// ---- the supplier's side: the page ------------------------------------------------

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (CORS_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'no-store');
}

async function findLink(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) return null;
  const hash = sha256(token);
  const s = await db().doc(`quote_links/${hash}`).get();
  return s.exists ? { hash, ...s.data() } : null;
}

/** Their file into the vessel's attachments folder (storage.rules: members read it). */
async function saveFile(v, quoteId, f, old) {
  if (!f || typeof f !== 'object' || !f.data) return null;
  const ext = FILE_TYPES[f.type];
  if (!ext) throw new Error('Attach a PDF, a JPEG or PNG picture, or an Excel file.');
  const bytes = Buffer.from(String(f.data), 'base64');
  if (!bytes.length || bytes.length > MAX_FILE) throw new Error('The file is too large — 6 MB at most.');
  const bucket = admin.storage().bucket();
  const path = `${ROOT}/${v}/attachments/${quoteId}/supplier-${Date.now()}.${ext}`;
  const dl = crypto.randomUUID();
  await bucket.file(path).save(bytes, { contentType: f.type, metadata: { metadata: { firebaseStorageDownloadTokens: dl } } });
  if (old && old.uri) {
    const m = /\/o\/([^?]+)/.exec(old.uri);
    const prev = m ? decodeURIComponent(m[1]) : '';
    if (prev.startsWith(`${ROOT}/${v}/attachments/${quoteId}/supplier-`)) await bucket.file(prev).delete({ ignoreNotFound: true }).catch(() => {});
  }
  const name = capped(f.name, 120) || `quotation.${ext}`;
  return { uri: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${dl}`, name, type: f.type };
}

const supplierQuote = onRequest({ region: REGION, maxInstances: PUBLIC_MAX_INSTANCES, memory: '512MiB' }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const token = req.method === 'GET' ? String(req.query.t || '') : String((req.body && req.body.t) || '');
  const link = await findLink(token);
  if (!link) { res.status(404).json({ error: 'This link is not valid. Ask the vessel for a new one.' }); return; }
  const v = link.vessel;
  const ref = orderRef(v, link.orderId);
  const snap = await ref.get();
  const o = snap.exists ? snap.data() : null;
  const q = o && (o.quotes || []).find((x) => x.id === link.quoteId);

  if (req.method === 'GET') {
    const fits = o && q && !closedWhy(o, q, link) ? await machinesFor(v, o) : {};
    res.json(pageData(o, q, link, await vesselName(v), fits));
    return;
  }

  const shut = closedWhy(o, q, link);
  if (shut) { res.status(410).json({ error: CLOSED_TEXT[shut] }); return; }
  if (!(await takeOne(`quote_guard/${link.hash}`, POSTS_PER_HOUR, 3600_000))) {
    res.status(429).json({ error: 'Too many answers from this link in the last hour. Try again later.' });
    return;
  }
  const read = readAnswer(o, req.body);
  if (read.error) { res.status(400).json({ error: read.error }); return; }

  let file = null;
  try {
    file = await saveFile(v, link.quoteId, req.body.file, q.file);
  } catch (e) {
    res.status(400).json({ error: e.message });
    return;
  }

  const now = Date.now();
  try {
    await db().runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const cur = s.exists ? s.data() : null;
      const cq = cur && (cur.quotes || []).find((x) => x.id === link.quoteId);
      const why = closedWhy(cur, cq, link, now);
      if (why) throw Object.assign(new Error(CLOSED_TEXT[why]), { closed: true });
      const quotes = cur.quotes.map((x) => (x.id === link.quoteId ? withAnswer(x, read.quote, read.name, now, file) : x));
      tx.update(ref, { quotes, updatedAt: Math.max(now, (cur.updatedAt || 0) + 1) });
    });
  } catch (e) {
    if (e.closed) { res.status(410).json({ error: e.message }); return; }
    throw e;
  }
  console.log(`[supplierQuote] ${v} ${o.no}: ${q.supplier} answered${read.quote.declined ? ' (declined)' : ''}`);
  res.json({ ok: true, at: now });
});

module.exports = {
  LINK_DAYS,
  closedWhy,
  pageData,
  readAnswer,
  withAnswer,
  liveLines,
  quoteLinkSend,
  quoteLinkExtend,
  quoteLinkRevoke,
  supplierQuote,
};
