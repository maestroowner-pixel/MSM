// ===================================
// Monthly safety digest — sent to owner / DPA on the 1st of each month (08:00
// UTC) and on demand from the app. Master-only: who gets it and when are stored
// in vessel.emailReport (firestore.rules puts it on the same restricted list as
// entitlement and signingPolicy).
//
// SMTP: any Gmail account with an App Password, or a transactional relay. Set
// credentials once:
//   cd functions && npm run secret:smtp:user   (e.g. reports@gmail.com)
//   cd functions && npm run secret:smtp:pass   (app password, 16 chars)
//
// What the digest covers (everything from the Firestore register):
//   • Equipment: expired + due in 30 days (register.categories)
//   • Vessel & crew certificates expiring in 60 days
//   • Open PMS defects
//   • Open ISM non-conformities
//   • Overdue drills
//   • Safety observations filed this month (QR + in-app)
// ===================================

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const DAY = 86400000;

// ---- data helpers -----------------------------------------------------------

function parseDate(d) {
  if (!d) return 0;
  const t = Date.parse(d);
  return isNaN(t) ? 0 : t;
}

/** Items expiring soon or already expired. */
function equipmentAlerts(register, now) {
  const expired = [], dueSoon = [];
  const cats = register.categories || {};
  for (const [key, items] of Object.entries(cats)) {
    if (!Array.isArray(items)) continue;
    const catLabel = key.replace(/_/g, ' ');
    for (const item of items) {
      const date = parseDate(item.nextInspection) || parseDate(item.expiry);
      if (!date) continue;
      const days = Math.round((date - now) / DAY);
      const label = [item.no, item.type, item.position].filter(Boolean).join(' ') || item.id;
      if (days < 0) expired.push({ catLabel, label, days: -days });
      else if (days <= 30) dueSoon.push({ catLabel, label, days });
    }
  }
  return { expired, dueSoon };
}

/** Vessel/equipment certificates expiring in 60 days. */
function certAlerts(register, now) {
  const result = [];
  for (const c of register.certificates || []) {
    const date = parseDate(c.expiryDate);
    if (!date) continue;
    const days = Math.round((date - now) / DAY);
    if (days <= 60) result.push({ name: c.name || 'Certificate', days });
  }
  return result;
}

/** Crew certificates expiring in 60 days (crew_private sub-key). */
function crewCertAlerts(register, now) {
  const result = [];
  for (const c of register.crew_private || []) {
    if (c.scope !== 'cert' && !c.expiryDate) continue;
    const date = parseDate(c.expiryDate);
    if (!date) continue;
    const days = Math.round((date - now) / DAY);
    if (days <= 60) result.push({ name: c.name || 'Certificate', holder: c.holderName || '', days });
  }
  return result;
}

/** Open PMS defects. */
function openPmsDefects(register) {
  return (register.pms_defects || [])
    .filter(d => !d.closed)
    .map(d => ({ desc: d.description || 'Defect', system: d.systemName || '' }));
}

/** Open non-conformities. */
function openNcs(register) {
  return (register.ncs || [])
    .filter(n => n.status !== 'closed')
    .map(n => ({ title: n.title || 'NC', category: n.category || '' }));
}

/** Drills overdue today. */
function overdueDrills(register, now) {
  const plans = register.drill_plans || [];
  const done = register.drills || [];
  const result = [];
  for (const plan of plans) {
    if (!plan.dueDate) continue;
    const due = parseDate(plan.dueDate);
    if (!due || due > now) continue;
    const lastDone = done
      .filter(d => d.drillType === plan.drillType)
      .map(d => parseDate(d.date))
      .filter(Boolean)
      .sort((a, b) => b - a)[0] || 0;
    if (!lastDone || lastDone < due) result.push({ type: plan.drillType || 'Drill' });
  }
  return result;
}

/** Safety observations filed this calendar month. */
function obsThisMonth(register, now) {
  const start = new Date(now);
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const ms = start.getTime();
  return (register.observations || []).filter(o => parseDate(o.date) >= ms).length;
}

// ---- HTML builder -----------------------------------------------------------

const CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;margin:0;padding:20px}
  .w{max-width:580px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hd{background:#0B2545;color:#fff;padding:22px 28px}
  .hd h1{margin:0;font-size:19px;font-weight:600}
  .hd p{margin:4px 0 0;font-size:12px;opacity:.65;letter-spacing:.2px}
  .bd{padding:18px 28px}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#7a8fa0;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid #e8f0f8}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:5px 6px;border-bottom:1px solid #f0f6fb;vertical-align:top}
  td:last-child{white-space:nowrap;text-align:right}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
  .red{background:#fdecea;color:#c0392b}
  .orange{background:#fff3e0;color:#d35400}
  .blue{background:#e8f4fd;color:#2980b9}
  .none{color:#9ab0c0;font-size:13px;padding:4px 0}
  .ft{background:#f4f8fb;padding:12px 28px;font-size:11px;color:#8090a0;text-align:center}
  a{color:#3a8fd4}
`;

function badge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function table(rows) {
  if (!rows.length) return '<p class="none">Nothing to report</p>';
  return `<table>${rows.join('')}</table>`;
}

function buildHtml(name, imo, date, eq, certs, crewCerts, pmsDefects, ncs, drills, obsCount) {
  const eqRows = [
    ...eq.expired.map(i => `<tr><td>${i.catLabel}</td><td>${i.label}</td><td>${badge(`Expired ${i.days}d ago`, 'red')}</td></tr>`),
    ...eq.dueSoon.map(i => `<tr><td>${i.catLabel}</td><td>${i.label}</td><td>${badge(`Due in ${i.days}d`, 'orange')}</td></tr>`),
  ];

  const certRows = [
    ...certs.map(c => `<tr><td>${c.name}</td><td>${badge(c.days < 0 ? `Expired ${-c.days}d ago` : `Exp in ${c.days}d`, c.days < 0 ? 'red' : 'orange')}</td></tr>`),
    ...crewCerts.map(c => `<tr><td>${c.name}${c.holder ? ` — ${c.holder}` : ''}</td><td>${badge(c.days < 0 ? `Expired ${-c.days}d ago` : `Exp in ${c.days}d`, c.days < 0 ? 'red' : 'orange')}</td></tr>`),
  ];

  const defRows = pmsDefects.map(d => `<tr><td>${d.system}</td><td>${d.desc}</td></tr>`);
  const ncRows = ncs.map(n => `<tr><td>${n.category}</td><td>${n.title}</td></tr>`);
  const drillRows = drills.map(d => `<tr><td>${badge('Overdue', 'red')}</td><td>${d.type}</td></tr>`);

  const obsLine = obsCount > 0
    ? `${badge(String(obsCount), 'blue')} safety observation${obsCount === 1 ? '' : 's'} filed this month`
    : '<span class="none">No safety observations this month</span>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="w">
<div class="hd"><h1>${name}</h1><p>Monthly Safety Report · ${date} · IMO ${imo}</p></div>
<div class="bd">
<h2>Equipment — expired or due in 30 days</h2>${table(eqRows)}
<h2>Certificates expiring in 60 days</h2>${table(certRows)}
<h2>Open PMS defects</h2>${table(defRows.length ? defRows : [])}
${!defRows.length ? '<p class="none">No open defects</p>' : ''}
<h2>Open non-conformities</h2>${table(ncRows.length ? ncRows : [])}
${!ncRows.length ? '<p class="none">No open non-conformities</p>' : ''}
<h2>Overdue drills</h2>${table(drillRows.length ? drillRows : [])}
${!drillRows.length ? '<p class="none">No overdue drills</p>' : ''}
<h2>Safety observations</h2><p style="font-size:13px;margin:4px 0">${obsLine}</p>
</div>
<div class="ft">ISM AI Pilot · <a href="https://app.ismpilot.com">app.ismpilot.com</a></div>
</div></body></html>`;
}

// ---- sender -----------------------------------------------------------------

function makeTransport(user, pass) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

async function sendForVessel(vesselId, db, smtpUser, smtpPass) {
  const ref = db.doc(`${ROOT}/${vesselId}`);
  const snap = await ref.get();
  if (!snap.exists) return { skipped: true, reason: 'not found' };

  const data = snap.data();
  const er = data.emailReport;
  if (!er?.enabled) return { skipped: true, reason: 'disabled' };

  const recipients = (er.recipients || []).filter(r => typeof r === 'string' && r.includes('@'));
  if (!recipients.length) return { skipped: true, reason: 'no recipients' };

  const now = Date.now();
  const register = (() => { try { return JSON.parse(data.register || '{}'); } catch { return {}; } })();

  const vesselInfo = register.vessel_info || {};
  const vesselName = vesselInfo.vessel_name || data.obsVesselName || vesselId;
  const imo = vesselInfo.imo || vesselId;

  const eq = equipmentAlerts(register, now);
  const certs = certAlerts(register, now);
  const crewCerts = crewCertAlerts(register, now);
  const pmsDefects = openPmsDefects(register);
  const ncs = openNcs(register);
  const drills = overdueDrills(register, now);
  const obsCount = obsThisMonth(register, now);

  const date = new Date(now).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const html = buildHtml(vesselName, imo, date, eq, certs, crewCerts, pmsDefects, ncs, drills, obsCount);

  const transport = makeTransport(smtpUser, smtpPass);
  await transport.sendMail({
    from: `ISM AI Pilot <${smtpUser}>`,
    to: recipients.join(', '),
    subject: `${vesselName} — Monthly Safety Report · ${date}`,
    html,
  });

  await ref.set({ emailReport: { ...er, lastSentAt: now } }, { merge: true });
  console.log(`[emailReport] sent for ${vesselId} → ${recipients.join(', ')}`);
  return { ok: true, recipients: recipients.length };
}

// ---- scheduled: 1st of each month, 08:00 UTC --------------------------------

exports.sendMonthlyReport = onSchedule(
  {
    schedule: '0 8 1 * *',
    timeZone: 'UTC',
    region: REGION,
    secrets: [SMTP_USER, SMTP_PASS],
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const vessels = await db.collection(ROOT).select('emailReport').get();
    let sent = 0, skipped = 0;
    for (const v of vessels.docs) {
      if (!/^\d{5,9}$/.test(v.id)) continue;
      try {
        const r = await sendForVessel(v.id, db, SMTP_USER.value(), SMTP_PASS.value());
        if (r.ok) sent++; else skipped++;
      } catch (e) {
        console.error(`[emailReport] ${v.id}: ${e && e.message ? e.message : e}`);
        skipped++;
      }
    }
    console.log(`[emailReport] monthly done: sent=${sent} skipped=${skipped}`);
  }
);

// ---- on demand: from the app (Master only) ----------------------------------

exports.sendReportNow = onCall(
  { region: REGION, secrets: [SMTP_USER, SMTP_PASS] },
  async (req) => {
    const t = req.auth?.token || {};
    const vessel = String(req.data?.vessel || '').replace(/\D/g, '');
    if (!vessel || t.vessel !== vessel || t.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Master only.');
    }
    const db = admin.firestore();
    const r = await sendForVessel(vessel, db, SMTP_USER.value(), SMTP_PASS.value());
    if (r.skipped) {
      throw new HttpsError(
        'failed-precondition',
        r.reason === 'no recipients' ? 'Add at least one recipient email first.' : 'Email report is disabled.'
      );
    }
    return { ok: true };
  }
);
