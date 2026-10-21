// ===================================
// Inspector read-only view (#19, 18 Oct 2026) — a time-limited URL the Master
// shares with a PSC inspector, flag-state surveyor or class surveyor.
//
// GET /inspectView?t=TOKEN  →  styled HTML page showing:
//   • vessel name, flag, IMO, call sign
//   • LSA / FFE / OTHER compliance summary (red / amber / green per category)
//   • open PMS defects count (if the vessel uses PMS)
//   • open non-conformities count (if the vessel uses QHSE)
//   • generated date, valid until
//
// The token is stored as `inspectToken` (string) + `inspectTokenExpiry` (epoch ms)
// on the vessel document. Only the Master can write these fields (firestore.rules).
// The function uses admin credentials — no vessel IMO ever reaches the client.
// ===================================

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';

const CAT_LABELS = {
  liferafts: 'Liferafts / HRU', lifebuoys: 'Lifebuoys', lifejackets: 'Lifejackets',
  immersion_suits: 'Immersion Suits', inflatable_lifejackets: 'Inflatable Lifejackets',
  mob: 'MOB Boat / Davit', plb: "PLB's", harnesses: 'Harnesses / Fall Arrest',
  gmdss_pyro: 'GMDSS / SART / EPIRB / Pyro', thermal_protective: 'Thermal Protective Aids',
  rescue_boats: 'Rescue Boats / Davits', emergency_escapes: 'Emergency Escapes',
  fire_extinguishers: 'Fire Extinguishers', fire_dampers: 'Fire Dampers',
  fire_vents: 'Fire Vents', hydrants_fireboxes: 'Hydrants / Fireboxes',
  fixed_co2: 'Fixed CO₂', fifi_ba: 'FIFI Outfit & BA Sets',
  bottle_pressure: 'BA Bottle Pressure', eebd: 'EEBD',
  fire_detectors: 'Fire Detectors', eye_wash: 'Eye Wash Stations',
  first_aid: 'First Aid Kits', chemical_suits: 'Chemical Suits',
  gas_detection: 'Gas Detection Meters', sopep: 'SOPEP Locker',
  other_safety: 'Other Safety Equipment',
};

const CAT_GROUP = {
  liferafts: 'LSA', lifebuoys: 'LSA', lifejackets: 'LSA', immersion_suits: 'LSA',
  inflatable_lifejackets: 'LSA', mob: 'LSA', plb: 'LSA', harnesses: 'LSA',
  gmdss_pyro: 'LSA', thermal_protective: 'LSA', rescue_boats: 'LSA', emergency_escapes: 'LSA',
  fire_extinguishers: 'FFE', fire_dampers: 'FFE', fire_vents: 'FFE',
  hydrants_fireboxes: 'FFE', fixed_co2: 'FFE', fifi_ba: 'FFE',
  bottle_pressure: 'FFE', eebd: 'FFE', fire_detectors: 'FFE',
  eye_wash: 'OTHER', first_aid: 'OTHER', chemical_suits: 'OTHER',
  gas_detection: 'OTHER', sopep: 'OTHER', other_safety: 'OTHER',
};

const GROUP_TITLE = {
  LSA: 'Life-Saving Appliances (LSA)',
  FFE: 'Fire-Fighting Equipment (FFE)',
  OTHER: 'Other Safety Equipment',
};

const CAT_ORDER = Object.keys(CAT_LABELS);

function dmy(iso) {
  return iso ? iso.split('-').reverse().join('.') : '—';
}

function computeCompliance(items, today, soon) {
  const byCat = {};
  for (const item of items) {
    if (item.deleted) continue;
    const key = item.category;
    if (!CAT_LABELS[key]) continue; // lifting / custom categories not in the standard list
    if (!byCat[key]) byCat[key] = { total: 0, red: 0, amber: 0 };
    byCat[key].total++;
    // Use the earlier of expiry / nextInspection — conservative for an inspector view.
    const dates = [item.expiry, item.nextInspection].filter(Boolean);
    if (!dates.length) continue;
    const worst = dates.reduce((w, d) => (!w || d < w) ? d : w, null);
    if (worst < today) byCat[key].red++;
    else if (worst <= soon) byCat[key].amber++;
  }
  return byCat;
}

function htmlPage({ name, flag, imo, callSign, expiry, byCat, openDefects, openNcs, today }) {
  let totalRed = 0, totalAmber = 0, totalOk = 0;
  for (const v of Object.values(byCat)) {
    totalRed += v.red;
    totalAmber += v.amber;
    totalOk += v.total - v.red - v.amber;
  }
  const total = totalRed + totalAmber + totalOk;

  const tone = totalRed ? '#dc2626' : totalAmber ? '#d97706' : '#16a34a';
  const overallLabel = totalRed
    ? `${totalRed} item${totalRed === 1 ? '' : 's'} overdue — requires immediate attention`
    : totalAmber
    ? `${totalAmber} item${totalAmber === 1 ? '' : 's'} due within 30 days`
    : 'All items in order';

  let rows = '';
  for (const group of ['LSA', 'FFE', 'OTHER']) {
    const cats = CAT_ORDER.filter(k => CAT_GROUP[k] === group && byCat[k]);
    if (!cats.length) continue;
    rows += `<tr class="gh"><td colspan="4">${GROUP_TITLE[group]}</td></tr>`;
    for (const k of cats) {
      const c = byCat[k];
      const badge = c.red
        ? `<span class="b red">${c.red} overdue</span>`
        : c.amber
        ? `<span class="b amb">${c.amber} due soon</span>`
        : `<span class="b grn">&#10003; In order</span>`;
      rows += `<tr><td>${CAT_LABELS[k]}</td><td class="n">${c.total}</td><td class="n${c.red ? ' rd' : ''}">${c.red || '—'}</td><td>${badge}</td></tr>`;
    }
  }

  const defLine = openDefects > 0
    ? `<p class="info warn">Open maintenance defects: <strong>${openDefects}</strong></p>`
    : openDefects === 0
    ? `<p class="info good">No open maintenance defects</p>`
    : '';

  const ncLine = openNcs > 0
    ? `<p class="info warn">Open non-conformities: <strong>${openNcs}</strong></p>`
    : openNcs === 0
    ? `<p class="info good">No open non-conformities</p>`
    : '';

  const sub = [imo ? `IMO ${imo}` : null, flag, callSign ? `Call ${callSign}` : null].filter(Boolean).join(' \xb7 ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ISM AI Pilot — ${name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;font-size:15px;line-height:1.5}
header{background:#0b2545;color:#fff;padding:14px 20px}
header p{font-size:12px;font-weight:700;letter-spacing:.6px;color:#94a3b8;text-transform:uppercase}
.vessel{padding:20px;border-bottom:1px solid #e2e8f0}
.vessel h1{font-size:22px;font-weight:800;color:#0b2545}
.vessel p{color:#64748b;font-size:13px;margin-top:4px}
.banner{margin:16px 20px;padding:14px 16px;background:${tone}12;border-left:4px solid ${tone};border-radius:4px}
.banner h2{font-size:15px;font-weight:700;color:${tone}}
.banner p{font-size:13px;color:#475569;margin-top:3px}
table{width:calc(100% - 40px);margin:0 20px 20px;border-collapse:collapse;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
th{background:#f1f5f9;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748b}
.gh td{background:#f1f5f9;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#334155;padding:10px 10px 6px}
.n{text-align:center}.rd{color:#b91c1c;font-weight:700}
.b{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.b.red{background:#fee2e2;color:#b91c1c}.b.amb{background:#fef3c7;color:#92400e}.b.grn{background:#dcfce7;color:#15803d}
.info{margin:0 20px 12px;padding:10px 14px;border-radius:6px;font-size:13px;border:1px solid}
.info.warn{background:#fff7ed;color:#9a3412;border-color:#fed7aa}
.info.good{background:#f0fdf4;color:#15803d;border-color:#bbf7d0}
footer{padding:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
@media(max-width:480px){table{font-size:12px}th,td{padding:6px 7px}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<header><p>ISM AI Pilot · Compliance view</p></header>
<div class="vessel">
  <h1>${name}</h1>
  ${sub ? `<p>${sub}</p>` : ''}
</div>
<div class="banner">
  <h2>${overallLabel}</h2>
  <p>${total} item${total === 1 ? '' : 's'} in the register · ${dmy(today)}</p>
</div>
<table>
  <tr><th>Category</th><th class="n">Items</th><th class="n">Overdue</th><th>Status</th></tr>
  ${rows || '<tr><td colspan="4" style="color:#94a3b8;text-align:center">Register is empty</td></tr>'}
</table>
${defLine}${ncLine}
<footer>
  Read-only view · Generated ${dmy(today)} · Valid until ${dmy(expiry)} · ISM AI Pilot by Kuka Soft
</footer>
</body>
</html>`;
}

function htmlError(msg) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ISM AI Pilot</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#64748b;text-align:center;padding:20px}p{max-width:320px;line-height:1.6}</style></head><body><p>${msg}</p></body></html>`;
}

module.exports = {
  inspectView: onRequest({ region: REGION }, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const token = String(req.query.t ?? '');
    if (!token || token.length < 8) {
      res.status(400).send(htmlError('No token provided.'));
      return;
    }

    const db = admin.firestore();
    const snap = await db.collection(ROOT)
      .where('inspectToken', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).send(htmlError('Link not found or has been revoked.'));
      return;
    }

    const doc = snap.docs[0];
    const d = doc.data();
    const imo = doc.id;

    if (!d.inspectTokenExpiry || d.inspectTokenExpiry < Date.now()) {
      res.status(403).send(htmlError('This link has expired. The vessel can issue a new one.'));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const expiryIso = new Date(d.inspectTokenExpiry).toISOString().slice(0, 10);

    // Parse the register for compliance.
    let items = [];
    try { items = JSON.parse(d.register || '[]'); } catch { /* empty register */ }
    const byCat = computeCompliance(items, today, soon);

    // Open PMS defects.
    let openDefects = null;
    try {
      const defSnap = await db.collection(ROOT).doc(imo).collection('pms_defects').get();
      openDefects = defSnap.docs.filter(s => { const x = s.data(); return !x.deleted && !x.closed; }).length;
    } catch { /* module not in use */ }

    // Open non-conformities.
    let openNcs = null;
    try {
      const ncSnap = await db.collection(ROOT).doc(imo).collection('ncs').get();
      openNcs = ncSnap.docs.filter(s => { const x = s.data(); return !x.deleted && !x.closedAt; }).length;
    } catch { /* module not in use */ }

    const html = htmlPage({
      name: d.vessel_name || 'Vessel',
      flag: d.flag || '',
      imo: d.imo || imo,
      callSign: d.call_sign || '',
      expiry: expiryIso,
      byCat,
      openDefects,
      openNcs,
      today,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }),
};
