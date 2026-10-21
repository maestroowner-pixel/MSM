// ===================================
// Calendar subscription — ICS feed (#26, 18 Oct 2026).
//
// GET /icsCalendar?t=TOKEN → text/calendar (iCalendar .ics)
//
// A permanent webcal:// link the Master issues from Settings → Calendar.
// iOS Calendar, Google Calendar and Outlook subscribe to it and auto-refresh.
// Includes:
//   • Equipment: nextInspection and expiry events for every item in the register
//   • Vessel surveys / certificates: due-date events
//   • Drills: next-due dates
//
// The token is stored as `icsToken` (string) on the vessel document.
// Only the Master can write it (firestore.rules master-only list).
// The function runs with admin credentials — no IMO reaches the client URL.
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

// ISO YYYY-MM-DD → compact YYYYMMDD for ICS DATE values.
function icsDate(iso) {
  return iso.replace(/-/g, '');
}

// One calendar day after the given ISO date (for DTEND on all-day events).
function dayAfter(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// Fold long lines at 75 octets (RFC 5545 §3.1).
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const limit = first ? 75 : 74;
    parts.push(bytes.slice(start, start + limit).toString('utf8'));
    start += limit;
    first = false;
  }
  return parts.join('\r\n ');
}

function icsText(s) {
  // Escape special characters in text values.
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function vevent({ uid, dtstart, summary, description, alarm30 = true }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${icsDate(dtstart)}`,
    `DTEND;VALUE=DATE:${dayAfter(dtstart)}`,
    fold(`SUMMARY:${icsText(summary)}`),
  ];
  if (description) lines.push(fold(`DESCRIPTION:${icsText(description)}`));
  if (alarm30) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${icsText(summary)}`),
      'TRIGGER:-P30D',
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function buildIcs({ vesselName, imo, events }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//ISM AI Pilot//Equipment Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:ISM AI Pilot — ${icsText(vesselName)}`),
    'X-WR-TIMEZONE:UTC',
    'X-PUBLISHED-TTL:PT12H',
    ...events,
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

// Cutoff: only events within the past 30 days and next 365 days.
function inWindow(iso) {
  const ms = new Date(iso + 'T00:00:00Z').getTime();
  const now = Date.now();
  return ms >= now - 30 * 86400000 && ms <= now + 365 * 86400000;
}

module.exports = {
  icsCalendar: onRequest({ region: REGION }, async (req, res) => {
    res.set('Cache-Control', 'public, max-age=43200'); // 12-hour browser cache
    const token = String(req.query.t ?? '');
    if (!token || token.length < 8) {
      res.status(400).send('No token');
      return;
    }

    const db = admin.firestore();
    const snap = await db.collection(ROOT)
      .where('icsToken', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).send('Link not found or has been revoked.');
      return;
    }

    const doc = snap.docs[0];
    const d = doc.data();
    const imo = doc.id;
    const vesselName = d.vessel_name || `IMO ${imo}`;

    const events = [];

    // ---- Equipment items ----
    let items = [];
    try { items = JSON.parse(d.register || '[]'); } catch { /* empty */ }

    for (const item of items) {
      if (item.deleted) continue;
      const cat = CAT_LABELS[item.category] || item.category || 'Equipment';
      const label = [item.no, item.type || item.description].filter(Boolean).join(' — ');
      const pos = item.position ? ` · ${item.position}` : '';
      const desc = `${cat}${pos}${item.serial ? ` · SN ${item.serial}` : ''}`;

      if (item.nextInspection && inWindow(item.nextInspection)) {
        events.push(vevent({
          uid: `${item.id}-insp@ismpilot`,
          dtstart: item.nextInspection,
          summary: `${label || cat} — inspection`,
          description: desc,
        }));
      }
      if (item.expiry && inWindow(item.expiry)) {
        events.push(vevent({
          uid: `${item.id}-exp@ismpilot`,
          dtstart: item.expiry,
          summary: `${label || cat} — expiry`,
          description: desc,
        }));
      }
    }

    // ---- Surveys / vessel certificates ----
    try {
      const survSnap = await db.collection(ROOT).doc(imo).collection('surveys').get();
      for (const s of survSnap.docs) {
        const sv = s.data();
        if (sv.deleted) continue;
        const next = sv.nextDue || sv.expiry;
        if (next && inWindow(next)) {
          events.push(vevent({
            uid: `${s.id}-surv@ismpilot`,
            dtstart: next,
            summary: `${sv.title || sv.type || 'Survey'} — due`,
            description: sv.notes || '',
          }));
        }
      }
    } catch { /* surveys module not in use */ }

    // ---- Drills ----
    try {
      const drillSnap = await db.collection(ROOT).doc(imo).collection('drills').get();
      for (const dr of drillSnap.docs) {
        const dv = dr.data();
        if (dv.deleted) continue;
        const next = dv.nextDue;
        if (next && inWindow(next)) {
          events.push(vevent({
            uid: `${dr.id}-drill@ismpilot`,
            dtstart: next,
            summary: `${dv.type || 'Drill'} — due`,
            description: dv.notes || '',
          }));
        }
      }
    } catch { /* drills module not in use */ }

    // Sort events by start date.
    events.sort((a, b) => {
      const da = (a.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1] || '';
      const db2 = (b.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1] || '';
      return da < db2 ? -1 : da > db2 ? 1 : 0;
    });

    const ics = buildIcs({ vesselName, imo, events });

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="ismpilot-${imo}.ics"`);
    res.status(200).send(ics);
  }),
};
