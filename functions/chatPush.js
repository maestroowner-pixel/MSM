// ===================================
// Chat pushes (19 Nov 2026) — a message reaches the phones that are closed.
//
// The app's own chat notification is local (components/ChatNotifier): it comes
// only while the app is alive and has synced. Here, when a message is created
// in chat_crew / chat_officers / chat_office, every phone of that channel that
// gave the vessel a push token (services/pushToken → push_tokens/{deviceId})
// gets "New message in Officers".
//
// Who hears a channel is the rules' (firestore.rules, chat_*): crew — everyone
// aboard; officers and office — officers and the Master. A device switched off
// or retired, Marine Hospital Manager and the office's own devices never.
// The writer is left out by name (the message has no device id).
//
// The push carries the channel only: no text, no names — that is all that
// passes Expo, Google and Apple (feedback: personal data stays aboard).
// Sent through Expo's push service: the team's APNs key lives there.
// A token Expo says is gone (DeviceNotRegistered) is deleted.
// ===================================

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { readRegister } = require('./vesselData');

const ROOT = 'safety_vessels';
const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const CH_NAME = { crew: 'Crew', officers: 'Officers', office: 'Office' };
const OFFICER = ['admin', 'superadmin'];

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const nameOf = (d) => norm(`${d.firstName || ''} ${d.lastName || ''}`);

/** Approved, not switched off, not retired, an ISMPilot device aboard (not the office). Pure. */
function liveAboard(d) {
  return !!d && d.approved === true && d.disabled !== true && !d.retiredAt && d.app !== 'mhm' && d.role !== 'shore';
}

/** Does this device read the channel? The rules' chat_* read, aboard. Pure. */
function hears(ch, d) {
  return ch === 'crew' ? true : OFFICER.includes(d.role);
}

/**
 * The pushes for one message: one per token, the writer left out, a mention
 * said as such. `devices` and `tokens` are { id: data }. Pure.
 */
function pushesFor(m, devices, tokens, vesselName) {
  const by = norm(m.by);
  const named = new Set((m.mentions || []).map(norm));
  const seen = new Set();
  const out = [];
  for (const [id, t] of Object.entries(tokens)) {
    const d = devices[id];
    if (!t || t.on !== true || !t.token || seen.has(t.token)) continue;
    if (!liveAboard(d) || !hears(m.ch, d)) continue;
    if (by && nameOf(d) === by) continue;
    seen.add(t.token);
    const ch = CH_NAME[m.ch] || m.ch;
    out.push({
      to: t.token,
      title: vesselName || 'ISM AI Pilot',
      body: named.has(nameOf(d)) ? `You were mentioned in ${ch}` : `New message in ${ch}`,
      data: { kind: 'chat', ch: m.ch },
      sound: 'default',
      channelId: 'chat',
      priority: 'high',
      _device: id,
    });
  }
  return out;
}

async function send(vessel, pushes) {
  const db = admin.firestore();
  for (let i = 0; i < pushes.length; i += 100) {
    const chunk = pushes.slice(i, i + 100);
    const res = await fetch(EXPO_SEND, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(chunk.map(({ _device, ...p }) => p)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[chatPush] expo', res.status, JSON.stringify(json).slice(0, 300));
      continue;
    }
    const tickets = Array.isArray(json.data) ? json.data : [];
    await Promise.all(
      tickets.map((t, k) =>
        t && t.status === 'error' && t.details && t.details.error === 'DeviceNotRegistered'
          ? db.doc(`${ROOT}/${vessel}/push_tokens/${chunk[k]._device}`).delete().catch(() => {})
          : null
      )
    );
  }
}

function trigger(ch) {
  // Runs where the database is (nam5 — the US multi-region), as critAlert.
  return onDocumentCreated({ document: `${ROOT}/{vessel}/chat_${ch}/{id}`, region: 'us-central1' }, async (event) => {
    const m = event.data && event.data.data();
    if (!m || m.ch !== ch) return;
    const vessel = event.params.vessel;
    const db = admin.firestore();
    const [tok, dev, ves] = await Promise.all([
      db.collection(`${ROOT}/${vessel}/push_tokens`).get(),
      db.collection(`${ROOT}/${vessel}/devices`).get(),
      db.doc(`${ROOT}/${vessel}`).get(),
    ]);
    if (tok.empty) return;
    const tokens = Object.fromEntries(tok.docs.map((d) => [d.id, d.data()]));
    const devices = Object.fromEntries(dev.docs.map((d) => [d.id, d.data()]));
    const pushes = pushesFor(m, devices, tokens, String(readRegister(ves.data()).vesselInfo.vessel_name || ''));
    if (pushes.length) await send(vessel, pushes);
  });
}

exports.chatPushCrew = trigger('crew');
exports.chatPushOfficers = trigger('officers');
exports.chatPushOffice = trigger('office');
exports.pushesFor = pushesFor;
