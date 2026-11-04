// ===================================
// Critical equipment — the office hears at once (plan item 34, 29 Oct 2026).
//
// A machinery defect (pms_defects) on a CRITICAL machine, or a safety-critical
// one on any machine, is mailed to the office the moment it reaches the cloud;
// so is a critical machine going out of service, and coming back. The
// recipients are the monthly report's (vessel.emailReport.recipients, set by
// the Master in Settings) — one list of who in the office hears about the
// vessel. Whether the monthly digest itself is switched on does not matter here.
//
// No crew names: the mail carries the rank of whoever raised it, never the
// name (services/critEq, the app's own rule is `alertWorthy` — keep the two in
// step; `npm run check:criteq` compares them).
//
// Each mail is sent once: a marker document crit_alerts/{vessel}_{defect}_{event}
// is created first, and a second delivery of the same trigger finds it there.
//
// Until the module is released for everybody, only a vessel with
// `modules.critEq` gets mail — flip CRIT_EQ_RELEASED with constants/modules.ts.
//
// SMTP: the same secrets as the monthly report (emailReport.js).
// ===================================

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const ROOT = 'safety_vessels';
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

/** Flip to true when critEq is on in the build (constants/modules.ts). */
const CRIT_EQ_RELEASED = false;

const CATEGORY = { safety: 'Safety-critical', class: 'Class-affecting', operational: 'Operational' };

/** The app's alertWorthy (services/critEq.ts). */
function alertWorthy(defect, machine) {
  return defect.category === 'safety' || !!(machine && machine.critical);
}

const isOut = (d) => !!(d && d.outOfService && !d.outOfService.to && !d.closed);

/**
 * What to mail for one write: 'raised' when an alert-worthy defect appears,
 * 'out' when an existing one takes the machine out of service, 'back' when the
 * machine is back (or the defect closed while it was out). Pure.
 */
function alertEvents(before, after, machine) {
  if (!after || !alertWorthy(after, machine)) return [];
  if (!before) return ['raised'];
  const ev = [];
  if (!before.outOfService && after.outOfService && !after.outOfService.to) ev.push('out');
  if (isOut(before) && !isOut(after)) ev.push('back');
  return ev;
}

const dmy = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Subject and HTML for one event — English, as every paper the office gets. Pure. */
function buildMail(event, d, machine, vesselName, imo) {
  const name = (machine && machine.name) || d.machineName || 'Machine';
  const crit = machine && machine.critical ? 'Critical equipment' : CATEGORY[d.category] || '';
  const oos = d.outOfService;
  const head = {
    raised: `${crit} defect — ${name}`,
    out: `Out of service — ${name}`,
    back: `Back in service — ${name}`,
  }[event];
  const rows = [
    ['Vessel', `${vesselName} · IMO ${imo}`],
    ['Machine', `${name}${machine && machine.critical ? ' (critical equipment)' : ''}`],
    ['Category', CATEGORY[d.category] || d.category],
    ['Defect', d.description],
    ['Raised', `${dmy(d.date)}${d.byRank ? ` by the ${d.byRank}` : ''}`],
  ];
  if (oos) rows.push(['Out of service', `${dmy(oos.from)}${oos.to ? ` – back ${dmy(oos.to)}` : ' — still out'}`]);
  else if (d.closed && event === 'back') rows.push(['Closed', dmy(d.closed.date)]);
  if (d.closed && d.closed.note) rows.push(['Done', d.closed.note]);
  if (d.responsible) rows.push(['Responsible', d.responsible]);
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0B2545">
<h2 style="margin:0 0 8px;color:${event === 'back' ? '#1b7f3b' : '#b3261e'}">${esc(head)}</h2>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#5b6b82;vertical-align:top">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>
<p style="font-size:13px">Open the vessel in Fleet: <a href="https://app.ismpilot.com">app.ismpilot.com</a> → Fleet → ${esc(vesselName)} → Critical equipment.</p>
<p style="font-size:12px;color:#5b6b82">ISM AI Pilot · sent to the vessel's report recipients (Settings → Email report).</p>
</body></html>`;
  return { subject: `${vesselName} — ${head}`, html };
}

exports.alertWorthy = alertWorthy;
exports.alertEvents = alertEvents;
exports.buildMail = buildMail;

// The trigger runs where the database is (nam5 — the US multi-region), as roundsDedupOnCreate.
exports.critAlert = onDocumentWritten(
  { document: `${ROOT}/{vessel}/pms_defects/{id}`, region: 'us-central1', secrets: [SMTP_USER, SMTP_PASS] },
  async (event) => {
    const { vessel, id } = event.params;
    const before = event.data && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after.exists ? event.data.after.data() : null;
    if (!after) return;
    const db = admin.firestore();
    const mSnap = after.machineId ? await db.doc(`${ROOT}/${vessel}/pms_machines/${after.machineId}`).get() : null;
    const machine = mSnap && mSnap.exists ? mSnap.data() : null;
    const events = alertEvents(before, after, machine);
    if (!events.length) return;

    const vSnap = await db.doc(`${ROOT}/${vessel}`).get();
    if (!vSnap.exists) return;
    const v = vSnap.data();
    if (v.modules && v.modules.critEq === false) return;
    if (!CRIT_EQ_RELEASED && !(v.modules && v.modules.critEq === true)) return;
    const recipients = ((v.emailReport && v.emailReport.recipients) || []).filter((r) => typeof r === 'string' && r.includes('@'));
    if (!recipients.length) {
      console.log(`[critAlert] ${vessel}/${id}: ${events.join(',')} — no recipients`);
      return;
    }
    const register = (() => { try { return JSON.parse(v.register || '{}'); } catch { return {}; } })();
    const vesselName = (register.vessel_info && register.vessel_info.vessel_name) || v.obsVesselName || vessel;

    const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() } });
    for (const ev of events) {
      const marker = db.doc(`crit_alerts/${vessel}_${id}_${ev}`);
      try {
        await marker.create({ vessel, defectId: id, event: ev, at: Date.now() });
      } catch (e) {
        continue; // already sent by an earlier delivery of this trigger
      }
      const mail = buildMail(ev, after, machine, vesselName, vessel);
      try {
        await transport.sendMail({ from: `ISM AI Pilot <${SMTP_USER.value()}>`, to: recipients.join(', '), subject: mail.subject, html: mail.html });
        console.log(`[critAlert] ${vessel}/${id}: ${ev} → ${recipients.length} recipient(s)`);
      } catch (e) {
        await marker.delete().catch(() => {});
        throw e;
      }
    }
  }
);
