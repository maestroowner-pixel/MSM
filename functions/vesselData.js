// ===================================
// What the server reads from a vessel, read the way the app writes it
// (28 Oct 2026, with the API).
//
// WHY THIS EXISTS. The vessel document holds the register as ONE JSON string
// (`register`), and since the Firestore move that string is an OBJECT —
// `{ categories: { liferafts: [...], ... }, vessel_info, certificates }`
// (services/firebaseService.ts RegisterBlob). inspectView and icsCalendar were
// written against an older idea of it, a flat array, and iterating the object
// threw before either page was drawn. Every function that reads the register
// now goes through `readRegister`, so there is one place that knows its shape.
//
// The hours rules below are COPIES of the app's, and must stay in step with them:
//   checkReading, withReading     services/pms.ts
//   followerReadings              services/pmsMachines.ts
//   AMS row statuses              services/amsHours.ts (readAms)
//   surveyStatus, addMonths       services/surveys.ts
//   DUE_SOON_DAYS                 types/equipment.ts
// `node functions/scripts/check-api.js` runs them through the same cases.
// ===================================

const DUE_SOON_DAYS = 60;
const READINGS_KEPT = 30;

const DAY = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const isIso = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);

/** The register blob, or an empty one when there is none or it cannot be read. */
function readRegister(vesselDoc) {
  const raw = vesselDoc && vesselDoc.register;
  let blob = null;
  if (typeof raw === 'string' && raw) {
    try { blob = JSON.parse(raw); } catch { blob = null; }
  }
  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) blob = {};
  const items = [];
  for (const [category, list] of Object.entries(blob.categories || {})) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      if (!it || it.deleted) continue;
      items.push({ ...it, category: it.category || category });
    }
  }
  const certificates = (Array.isArray(blob.certificates) ? blob.certificates : []).filter((c) => c && !c.deleted);
  return { items, certificates, vesselInfo: blob.vessel_info || {} };
}

/** expired / due (within 60 days) / ok / none — utils/dates statusFromDate. */
function statusOf(iso, today) {
  if (!isIso(iso)) return 'none';
  const d = daysBetween(today, iso);
  if (d < 0) return 'expired';
  if (d <= DUE_SOON_DAYS) return 'due';
  return 'ok';
}

// ---- surveys (services/surveys.ts) -------------------------------------------

function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

function surveyStatus(s, today, done = []) {
  const opens = addMonths(s.due, -(s.before || 0));
  const closes = addMonths(s.due, s.after || 0);
  if (!s.repeat && done.some((d) => d.surveyId === s.id && d.forDue === s.due)) return { state: 'done', opens, closes, days: 0 };
  if (today > closes) return { state: 'overdue', opens, closes, days: -daysBetween(closes, today) };
  if (today >= opens) return { state: 'open', opens, closes, days: daysBetween(today, closes) };
  const d = daysBetween(today, opens);
  return { state: d <= 60 ? 'soon' : 'planned', opens, closes, days: d };
}

// ---- running hours (services/pms.ts, services/pmsMachines.ts) ----------------

const hasCounter = (m) => (m.counter != null ? !!m.counter : (m.dept || 'engineering') === 'engineering');
const live = (m) => m && !m.deleted && !m.scrapped;

/** null when the reading may be taken; otherwise why not. */
function checkReading(m, date, total) {
  if (m.hours == null || !m.hoursDate) return null;
  if (total < m.hours) return `lower than the last reading (${m.hours} h on ${m.hoursDate})`;
  const days = Math.max(0, daysBetween(m.hoursDate, date));
  const most = (days + 1) * 24 + 12;
  if (total - m.hours > most) return `${Math.round(total - m.hours)} h in ${days} day(s) is more than the calendar allows`;
  return null;
}

function withReading(m, date, hours, note = {}, now = Date.now()) {
  const readings = [...(m.readings || []).filter((r) => r.date !== date || r.reason), { date, hours, ...(note.reason ? { reason: note.reason } : {}), ...(note.by ? { by: note.by } : {}) }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-READINGS_KEPT);
  const latest = readings[readings.length - 1];
  return { ...m, hours: latest.hours, hoursDate: latest.date, readings, updatedAt: now };
}

function followerReadings(prev, next, all, date, now = Date.now()) {
  const diff = (next.hours ?? 0) - (prev?.hours ?? next.hours ?? 0);
  if (!diff || next.hours == null) return [];
  const out = [];
  const step = (parentId, seen) => {
    for (const c of all.filter((m) => m.parentId === parentId && m.followsParent && live(m))) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(withReading(c, date, Math.max(0, Math.round(((c.hours ?? 0) + diff) * 10) / 10), {}, now));
      step(c.id, seen);
    }
  };
  step(next.id, new Set([next.id]));
  return out;
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');

/**
 * Decide each posted reading against the machines, like an AMS file row:
 *   ok        taken
 *   same      already the machine's figure for that day
 *   older     before the machine's last reading — not taken
 *   doubt     fails checkReading — not taken; a reason is entered on the machine's screen
 *   follows   the machine's hours follow its parent — post the parent's
 *   nocounter the machine has no running-hours counter
 *   dup       the same machine twice in one request
 *   unmatched no machine with that id or tag
 *   invalid   the row itself is wrong (why says what)
 * `counter` is what the counter shows; the machine's hours are counter + counterOffset.
 */
function decideReadings(rows, machines, today) {
  const usable = machines.filter(live);
  const taken = new Set();
  return rows.map((row, i) => {
    const r = row && typeof row === 'object' ? row : {};
    const ref = { index: i, ...(r.machineId ? { machineId: String(r.machineId) } : {}), ...(r.tag ? { tag: String(r.tag) } : {}) };
    const counter = typeof r.counter === 'number' ? r.counter : Number.NaN;
    if (!r.machineId && !r.tag) return { ...ref, status: 'invalid', why: 'machineId or tag is required' };
    if (!Number.isFinite(counter) || counter < 0) return { ...ref, status: 'invalid', why: 'counter must be a number of hours, 0 or more' };
    const date = r.date == null ? today : String(r.date);
    if (!isIso(date)) return { ...ref, status: 'invalid', why: 'date must be yyyy-mm-dd' };
    if (date > today) return { ...ref, status: 'invalid', why: 'date is in the future' };
    let m = r.machineId ? usable.find((x) => x.id === String(r.machineId)) : undefined;
    if (!m && r.tag) m = usable.find((x) => x.amsTag && norm(x.amsTag) === norm(r.tag));
    if (!m) return { ...ref, status: 'unmatched' };
    const base = { ...ref, machineId: m.id, name: m.name, date };
    if (taken.has(m.id)) return { ...base, status: 'dup' };
    taken.add(m.id);
    if (m.followsParent) return { ...base, status: 'follows' };
    if (!hasCounter(m)) return { ...base, status: 'nocounter' };
    const hours = Math.round((counter + (m.counterOffset ?? 0)) * 10) / 10;
    const out = { ...base, hours };
    if (m.hoursDate && date < m.hoursDate) return { ...out, status: 'older', why: `the machine already has a reading of ${m.hoursDate}` };
    if (m.hours === hours && m.hoursDate === date) return { ...out, status: 'same' };
    const why = checkReading(m, date, hours);
    if (why) return { ...out, status: 'doubt', why };
    return { ...out, status: 'ok' };
  });
}

module.exports = {
  DUE_SOON_DAYS, isoDay, daysBetween, isIso,
  readRegister, statusOf, addMonths, surveyStatus,
  hasCounter, live, checkReading, withReading, followerReadings, decideReadings,
};
