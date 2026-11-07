// ===================================
// The vessel's API (28 Oct 2026) — for the owner's office, a fleet BI, a
// management company's own system, or a script on the ship's AMS computer.
//
//   GET  /api/v1                     what is here
//   GET  /api/v1/vessel              name, IMO, flag, call sign
//   GET  /api/v1/due?days=90         everything falling due in N days, and all overdue
//   GET  /api/v1/equipment           the LSA / FFE / lifting register with its dates
//   GET  /api/v1/certificates        vessel and equipment certificates (never crew)
//   GET  /api/v1/surveys             surveys and audits with their windows
//   GET  /api/v1/defects             open defects — PMS and inspection
//   GET  /api/v1/machines            PMS machines and their running hours
//   POST /api/v1/machines/hours      running hours from the AMS     (a key allowed to write)
//
// Base: https://europe-west1-marine-safety-manager.cloudfunctions.net/api
// Key:  `Authorization: Bearer ismp_…` (or `X-API-Key: ismp_…`).
//
// KEYS. The Master issues one in Settings → API access (apiKeyCreate below); it is
// shown ONCE. Only its SHA-256 is stored, under `api_keys/{hash}` → the vessel
// and the key's record `safety_vessels/{v}/api_keys/{keyId}` (label, may it
// write, who issued it, last used, revoked). Revoking deletes the hash, so the
// key stops at once. Clients cannot read or write either collection's secrets:
// the vessel's records are readable by the Master only, the hash index by nobody.
//
// WHAT IT NEVER RETURNS. Crew: names, certificates, hours of rest, the people
// who signed — personal data stays aboard. The API answers about the vessel and
// its equipment; who did a round is the vessel's business.
//
// WRITING HOURS goes through the same rules as an AMS file in the app
// (vesselData.decideReadings): a figure lower than the last, or more hours than
// the calendar allows, is NOT taken — it is returned as `doubt` and waits for a
// reason on the machine's screen. A components' hours follow its parent's. Each
// write is journalled in `safety_vessels/{v}/api_log`. `?dryRun=1` decides
// without writing, for testing an integration against the real register.
//
// 60 requests a minute per key.
// ===================================

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { liveCaller } = require('./access');
const admin = require('firebase-admin');
const crypto = require('crypto');
const V = require('./vesselData');
const { PUBLIC_MAX_INSTANCES } = require('./publicLimits');

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';
const PER_MINUTE = 60;
const MAX_KEYS = 10;
const MAX_READINGS = 200;

const db = () => admin.firestore();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const today = () => V.isoDay(Date.now());

/** `ismp_` + 32 url-safe characters (24 random bytes). */
function newKey() {
  return `ismp_${crypto.randomBytes(24).toString('base64url')}`;
}

// ---- issuing and revoking: the Master, from the app --------------------------

async function master(req) {
  const t = (req.auth && req.auth.token) || {};
  if (!t.vessel || t.approved !== true || t.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only the Master can manage API keys.');
  }
  await liveCaller(t, ['superadmin']);
  return t;
}

async function deviceName(vessel, deviceId) {
  if (!deviceId) return 'Master';
  const s = await db().doc(`${ROOT}/${vessel}/devices/${deviceId}`).get().catch(() => null);
  const d = s && s.exists ? s.data() : {};
  return [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Master';
}

const apiKeyCreate = onCall({ region: REGION }, async (req) => {
  const t = await master(req);
  const label = String((req.data && req.data.label) || '').trim().slice(0, 60);
  const write = !!(req.data && req.data.write);
  if (!label) throw new HttpsError('invalid-argument', 'Name the key — who or what will use it.');

  const keys = db().collection(`${ROOT}/${t.vessel}/api_keys`);
  const active = (await keys.get()).docs.filter((d) => !d.data().revokedAt);
  if (active.length >= MAX_KEYS) throw new HttpsError('resource-exhausted', `A vessel can have ${MAX_KEYS} keys. Revoke one first.`);

  const key = newKey();
  const hash = sha256(key);
  const ref = keys.doc();
  const by = await deviceName(t.vessel, t.deviceId);
  const batch = db().batch();
  batch.set(db().doc(`api_keys/${hash}`), { vessel: t.vessel, keyId: ref.id });
  batch.set(ref, {
    label,
    write,
    hint: `${key.slice(0, 9)}…${key.slice(-4)}`,
    hash,
    createdAt: Date.now(),
    createdBy: by,
    calls: 0,
  });
  await batch.commit();
  return { key, keyId: ref.id };
});

const apiKeyRevoke = onCall({ region: REGION }, async (req) => {
  const t = await master(req);
  const keyId = String((req.data && req.data.keyId) || '');
  if (!keyId) throw new HttpsError('invalid-argument', 'Which key?');
  const ref = db().doc(`${ROOT}/${t.vessel}/api_keys/${keyId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such key on this vessel.');
  const k = snap.data();
  if (k.revokedAt) return { ok: true };
  const batch = db().batch();
  if (k.hash) batch.delete(db().doc(`api_keys/${k.hash}`));
  batch.update(ref, { revokedAt: Date.now(), revokedBy: await deviceName(t.vessel, t.deviceId) });
  await batch.commit();
  return { ok: true };
});

// ---- the API ---------------------------------------------------------------

class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

function keyFrom(req) {
  const h = String(req.get('authorization') || '');
  const m = h.match(/^Bearer\s+(\S+)$/i);
  return (m ? m[1] : String(req.get('x-api-key') || '')).trim();
}

/** The key's vessel and record, counted against the minute's allowance. */
async function authorise(req) {
  const key = keyFrom(req);
  if (!/^ismp_[A-Za-z0-9_-]{32}$/.test(key)) throw new ApiError(401, 'Send the vessel\'s API key: Authorization: Bearer ismp_…');
  const idx = await db().doc(`api_keys/${sha256(key)}`).get();
  if (!idx.exists) throw new ApiError(401, 'Unknown or revoked key.');
  const { vessel, keyId } = idx.data();
  const ref = db().doc(`${ROOT}/${vessel}/api_keys/${keyId}`);
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const rec = await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().revokedAt) throw new ApiError(401, 'Unknown or revoked key.');
    const k = s.data();
    const n = k.minute === minute ? (k.inMinute || 0) + 1 : 1;
    if (n > PER_MINUTE) throw new ApiError(429, `More than ${PER_MINUTE} requests a minute.`, { retryAfter: 60 - Math.floor((now / 1000) % 60) });
    tx.update(ref, { minute, inMinute: n, lastUsedAt: now, calls: (k.calls || 0) + 1 });
    return k;
  });
  return { vessel, keyId, label: rec.label, write: !!rec.write };
}

async function vesselDoc(vessel) {
  const s = await db().doc(`${ROOT}/${vessel}`).get();
  return s.exists ? s.data() : {};
}

async function sub(vessel, name) {
  const s = await db().collection(`${ROOT}/${vessel}/${name}`).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null && o[k] !== '').map((k) => [k, o[k]]));

function equipmentRows(reg, day) {
  return reg.items.map((it) => ({
    ...pick(it, ['id', 'category', 'no', 'type', 'make', 'size', 'serial', 'deck', 'position', 'quantity', 'nextInspection', 'expiry']),
    inspectionStatus: V.statusOf(it.nextInspection, day),
    expiryStatus: V.statusOf(it.expiry, day),
  }));
}

function certificateRows(reg, day) {
  return reg.certificates
    .filter((c) => (c.scope || 'equipment') !== 'crew')
    .map((c) => ({
      ...pick(c, ['id', 'name', 'number', 'issuer', 'issueDate', 'expiryDate']),
      scope: c.scope || 'equipment',
      items: Array.isArray(c.itemIds) ? c.itemIds.length : 0,
      status: V.statusOf(c.expiryDate, day),
    }));
}

async function surveyRows(vessel, day) {
  const [plans, done] = await Promise.all([sub(vessel, 'surveys'), sub(vessel, 'surveys_done')]);
  return plans
    .filter((s) => !s.deleted && V.isIso(s.due))
    .map((s) => ({ ...pick(s, ['id', 'name', 'due', 'by', 'kind', 'certId']), ...V.surveyStatus(s, day, done) }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

async function due(vessel, q) {
  const days = Math.min(Math.max(parseInt(q.days, 10) || 90, 0), 730);
  const day = today();
  const until = V.isoDay(Date.now() + days * 86400000);
  const reg = V.readRegister(await vesselDoc(vessel));
  const out = [];
  const add = (row) => { if (row.date <= until) out.push({ ...row, daysLeft: V.daysBetween(day, row.date) }); };
  for (const it of reg.items) {
    const title = [it.no, it.type].filter((x) => x != null && x !== '').join(' — ') || it.category;
    if (V.isIso(it.nextInspection)) add({ kind: 'equipment', what: 'inspection', id: it.id, category: it.category, title, date: it.nextInspection, status: V.statusOf(it.nextInspection, day) });
    if (V.isIso(it.expiry)) add({ kind: 'equipment', what: 'expiry', id: it.id, category: it.category, title, date: it.expiry, status: V.statusOf(it.expiry, day) });
  }
  for (const c of certificateRows(reg, day)) {
    if (V.isIso(c.expiryDate)) add({ kind: 'certificate', what: 'expiry', id: c.id, scope: c.scope, title: c.name, date: c.expiryDate, status: c.status });
  }
  for (const s of await surveyRows(vessel, day)) {
    if (s.state === 'done') continue;
    // A survey is late only once its window has closed; it is listed from the day it opens.
    const status = s.state === 'overdue' ? 'expired' : s.state === 'open' || s.state === 'soon' ? 'due' : 'ok';
    add({ kind: 'survey', what: 'window', id: s.id, title: s.name, date: s.opens, due: s.due, closes: s.closes, state: s.state, status });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { days, today: day, items: out };
}

async function defects(vessel) {
  const [pms, insp] = await Promise.all([
    sub(vessel, 'pms_defects').catch(() => []),
    db().collection(`${ROOT}/${vessel}/inspections`).where('defect.open', '==', true).get()
      .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
  ]);
  const rows = [
    ...pms.filter((d) => !d.deleted && !d.closed).map((d) => ({ source: 'pms', ...pick(d, ['id', 'machineId', 'machineName', 'jobTitle', 'category', 'description', 'date']) })),
    ...insp.map((r) => ({ source: 'inspection', id: r.id, itemId: r.itemId, category: r.category, description: r.defect.note, date: typeof r.at === 'number' ? V.isoDay(r.at) : undefined })),
  ];
  return rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function machineRow(m) {
  return {
    ...pick(m, ['id', 'name', 'dept', 'location', 'maker', 'model', 'serial', 'parentId', 'hours', 'hoursDate']),
    ...(m.amsTag ? { tag: m.amsTag } : {}),
    counter: V.hasCounter(m),
    ...(m.followsParent ? { followsParent: true } : {}),
    ...(m.critical ? { critical: true } : {}),
  };
}

async function postHours(auth, body, dryRun) {
  if (!auth.write) throw new ApiError(403, 'This key may only read. The Master can issue one that may write running hours.');
  const rows = body && Array.isArray(body.readings) ? body.readings : null;
  if (!rows || !rows.length) throw new ApiError(400, 'Send {"readings": [{"tag" or "machineId", "counter": hours, "date": "yyyy-mm-dd"}]}');
  if (rows.length > MAX_READINGS) throw new ApiError(400, `At most ${MAX_READINGS} readings a request.`);
  const day = today();
  const col = db().collection(`${ROOT}/${auth.vessel}/pms_machines`);
  const by = `API · ${auth.label}`;

  const results = await db().runTransaction(async (tx) => {
    const all = (await tx.get(col)).docs.map((d) => ({ id: d.id, ...d.data() }));
    const decided = V.decideReadings(rows, all, day);
    if (dryRun) return decided;
    const now = Date.now();
    const changed = new Map();
    for (const r of decided) {
      if (r.status !== 'ok') continue;
      const cur = changed.get(r.machineId) || all.find((m) => m.id === r.machineId);
      const next = V.withReading(cur, r.date, r.hours, { by }, now);
      changed.set(next.id, next);
      const pool = all.map((m) => changed.get(m.id) || m);
      for (const f of V.followerReadings(cur, next, pool, r.date, now)) changed.set(f.id, f);
    }
    for (const m of changed.values()) {
      tx.update(col.doc(m.id), { hours: m.hours, hoursDate: m.hoursDate, readings: m.readings, updatedAt: m.updatedAt });
    }
    tx.set(db().collection(`${ROOT}/${auth.vessel}/api_log`).doc(), {
      at: now,
      keyId: auth.keyId,
      label: auth.label,
      action: 'hours',
      taken: decided.filter((r) => r.status === 'ok').map((r) => ({ machineId: r.machineId, name: r.name || '', date: r.date, hours: r.hours })),
      refused: decided.filter((r) => r.status !== 'ok' && r.status !== 'same').length,
      followers: [...changed.keys()].filter((id) => !decided.some((r) => r.status === 'ok' && r.machineId === id)).length,
    });
    return decided;
  });

  const count = (s) => results.filter((r) => r.status === s).length;
  return { dryRun: !!dryRun, taken: dryRun ? 0 : count('ok'), wouldTake: dryRun ? count('ok') : undefined, results };
}

const INDEX = {
  endpoints: [
    'GET /v1/vessel',
    'GET /v1/due?days=90',
    'GET /v1/equipment',
    'GET /v1/certificates',
    'GET /v1/surveys',
    'GET /v1/defects',
    'GET /v1/machines',
    'POST /v1/machines/hours  {"readings":[{"tag":"ME1_RH","counter":12345.6,"date":"2026-10-28"}]}  ?dryRun=1',
  ],
  docs: 'https://ismpilot.com/api',
};

async function route(req, auth) {
  const path = req.path.replace(/\/+$/, '') || '/';
  const q = req.query || {};
  const day = today();
  if (req.method === 'GET') {
    switch (path) {
      case '/':
      case '/v1':
        return INDEX;
      case '/v1/vessel': {
        const d = await vesselDoc(auth.vessel);
        return pick({ imo: d.imo || auth.vessel, name: d.vessel_name, flag: d.flag, callSign: d.call_sign }, ['imo', 'name', 'flag', 'callSign']);
      }
      case '/v1/due':
        return due(auth.vessel, q);
      case '/v1/equipment':
        return { today: day, items: equipmentRows(V.readRegister(await vesselDoc(auth.vessel)), day) };
      case '/v1/certificates':
        return { today: day, items: certificateRows(V.readRegister(await vesselDoc(auth.vessel)), day) };
      case '/v1/surveys':
        return { today: day, items: await surveyRows(auth.vessel, day) };
      case '/v1/defects':
        return { items: await defects(auth.vessel) };
      case '/v1/machines':
        return { items: (await sub(auth.vessel, 'pms_machines')).filter(V.live).map(machineRow).sort((a, b) => String(a.name).localeCompare(String(b.name))) };
    }
  }
  if (req.method === 'POST' && path === '/v1/machines/hours') {
    return postHours(auth, req.body, q.dryRun === '1' || q.dryRun === 'true');
  }
  throw new ApiError(404, `No ${req.method} ${path}. GET /v1 lists what there is.`);
}

const api = onRequest({ region: REGION, maxInstances: PUBLIC_MAX_INSTANCES }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  try {
    const auth = await authorise(req);
    const data = await route(req, auth);
    res.status(200).json({ vessel: auth.vessel, generatedAt: new Date().toISOString(), ...data });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.extra && e.extra.retryAfter) res.set('Retry-After', String(e.extra.retryAfter));
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[api]', e);
    res.status(500).json({ error: 'Something went wrong on our side.' });
  }
});

module.exports = { api, apiKeyCreate, apiKeyRevoke, newKey, sha256 };
