// ===================================
// Dynamic positioning — the checklists the app ships, DP time, and the
// confirmation letter for a DPO's certificate (types/dp.ts).
//
// THE CHECKLISTS are a starting point drawn from common practice — IMCA M 103
// (design and operation of DP vessels), IMO MSC.1/Circ.1580 (DP guidelines) and
// the MTS DP Operations Guidance (ASOG / CAM / TAM). They are NOT the vessel's:
// every DP vessel works to its own DP Operations Manual and the ASOG of the
// operation, so each line can be reworded, added or removed (Settings → DP
// checklists), and a signed record keeps the lines it was signed against.
//
// DP TIME AND THE LETTER come from the seafarer's app SDM (screens/DPScreen.tsx
// there): 48 half-hours a day, each Active or Passive; a day counts as a DP day
// with 2 hours or more; the letter to the Nautical Institute in the New Scheme
// (active and passive dates listed; only active time counts for revalidation)
// or the Old Scheme (logbooks issued before 1 Jan 2015). On a vessel the
// company signs it, so the DP time of every DPO lives here, kept by the bridge.
//
// Pure: `npm run check:dp` runs it in node.
// ===================================

import { AsogStatus, DpCheck, DpConditions, DpDay, DpInfo, DpLine, DpPosition, DpSlot, DpTemplate, DpWhere } from '../types/dp';

// ---- checklists ---------------------------------------------------------------

/**
 * A line as the officers write it, one a line:
 *   Thrusters tested on DP              → Yes / No / N/A
 *   GPS 1 {Not used|Monitor|Selected}   → one of the options
 *   Gyro 1 {Available|Priority} [Hdg]   → an option and a reading
 *   Position gain [setting]             → a reading only
 *   ## Position references              → a heading
 */
export function parseLine(raw: string): Omit<DpLine, 'id'> {
  let s = raw.trim();
  if (s.startsWith('#')) return { text: s.replace(/^#+\s*/, ''), head: true };
  const out: Omit<DpLine, 'id'> = { text: '' };
  const opt = /\{([^}]*)\}/.exec(s);
  if (opt) {
    const o = opt[1].split('|').map((x) => x.trim()).filter(Boolean);
    if (o.length) out.options = o;
    s = s.replace(opt[0], ' ');
  }
  const val = /\[([^\]]*)\]/.exec(s);
  if (val) {
    out.value = val[1].trim() || 'value';
    s = s.replace(val[0], ' ');
  }
  out.text = s.replace(/\s+/g, ' ').replace(/\s*[—:-]\s*$/, '').trim();
  return out;
}

/** The line back as it is written — what the editor shows. */
export const lineSource = (l: Omit<DpLine, 'id'>): string =>
  l.head ? `## ${l.text}` : `${l.text}${l.options?.length ? ` {${l.options.join('|')}}` : ''}${l.value ? ` [${l.value}]` : ''}`;

const t = (id: string, title: string, where: DpWhere, lines: string[]): DpTemplate => ({
  id,
  title,
  where,
  // Line ids are permanent: a signed record keys its results by them.
  lines: lines.map((text, i) => ({ id: `${id}.${String(i + 1).padStart(2, '0')}`, ...parseLine(text) })),
  updatedAt: 0,
});

const SENSOR = '{Available|Priority|Not available}';
const PRS = '{Not used|Monitor|Selected}';
const PRS_M = '{Not used|Monitor|Selected|Mobile}';
const THR = '{Activated – Auto|Activated – Manual|Ready|Not available}';
const GEN = '{Running – on bus|Running – breaker open|Stopped}';
const COMMS = '{Good|No good}';

export const DP_TEMPLATES: DpTemplate[] = [
  t('dp.arrival.bridge', 'Field arrival — bridge (before the 500 m zone)', 'bridge', [
    'DP Operations Manual and the ASOG / WSOG for this operation on the bridge, read by the DPOs on watch',
    'Critical / task activity mode (CAM / TAM) agreed with the engine room and set up',
    'DP control system: all operator stations online, no unaccepted alarms',
    'Position references: the number the DP class and the ASOG require online, of different principles, compared and weighted',
    'DGNSS: corrections received, age and HDOP within limits',
    'Gyros, MRUs / VRUs and wind sensors online and agreeing with each other',
    'Each thruster tested in manual and on DP — response to command checked',
    'Independent joystick and manual levers tested',
    'Consequence analysis active with no alarm — enough power and thrust for the worst-case failure',
    'Capability plot checked against the weather; forecast received and within the ASOG limits',
    'DP alert lights (green / yellow / red) and communications with the engine room, deck and installation tested',
    'Permission to enter the 500 m zone received; SIMOPS agreed with the installation',
    'Set-up position held on DP outside the 500 m zone for the time the ASOG requires',
    'Approach route, escape route and drift-off direction agreed',
    'DP status Green — logged',
  ]),
  t('dp.arrival.engine', 'Field arrival — engine room', 'engine', [
    'Machinery set up as agreed for the operation (CAM / TAM) — bus tie breakers as required',
    'Generators online as required; stand-by generators available on automatic start',
    'Fuel: service tanks full, purifiers running, no fuel change-over planned during the operation',
    'Cooling water, lube oil and starting air normal; stand-by pumps on automatic',
    'UPS for DP control, position references and communications on line and charged — no UPS alarm',
    'No maintenance or isolation on DP-critical equipment; work permits suspended for the operation',
    'Thruster drives and motors: no alarms; hydraulic / lube oil systems normal',
    'Engine room manned as the ASOG requires; communications with the bridge tested',
    'Fire, flooding and machinery alarms clear',
  ]),
  // The owner's Arrival DP Checklist (simulator course PR-33, annex 42), 16 Oct 2026:
  // the state of every sensor, reference, thruster and generator, line by line.
  t('dp.arrival.systems', 'Arrival DP checklist — sensors, references, thrusters, power', 'bridge', [
    '## Operator stations',
    'OS1 online',
    'OS2 online',
    '## Sensors',
    `Gyro 1 ${SENSOR} [Hdg]`,
    `Gyro 2 ${SENSOR} [Hdg]`,
    `Gyro 3 ${SENSOR} [Hdg]`,
    `VRS 1 ${SENSOR} [Pitch/Roll]`,
    `VRS 2 ${SENSOR} [Pitch/Roll]`,
    `MRU ${SENSOR} [Pitch/Roll]`,
    `Wind 1 ${SENSOR} [Speed/dir]`,
    `Wind 2 ${SENSOR} [Speed/dir]`,
    `Wind 3 ${SENSOR} [Speed/dir]`,
    '## DP settings',
    'Fore-aft speed [kn]',
    'Athwartships speed [kn]',
    'Position gain [setting]',
    'Position limit [m]',
    'Speed vector gain [setting]',
    'Heading limit [°]',
    'Heading gain [setting]',
    'Rate of turn (ROT) [°/min]',
    'Use shortest turn {Yes|No}',
    'Origin reference system [system]',
    '## Position references',
    `GPS 1 ${PRS} [Noise / weight]`,
    `GPS 2 ${PRS} [Noise / weight]`,
    `GPS 3 ${PRS} [Noise / weight]`,
    `Laser reference (LR) ${PRS_M} [Noise / weight]`,
    `RadaScan / RADius ${PRS_M} [Noise / weight]`,
    `Light taut wire (LTW) ${PRS_M} [Noise / weight]`,
    `HPR 1 ${PRS_M} [Noise / weight]`,
    `HPR 2 ${PRS_M} [Noise / weight]`,
    `HPR 3 ${PRS_M} [Noise / weight]`,
    `HPR 4 ${PRS_M} [Noise / weight]`,
    '## Consequence analysis',
    'Consequence analysis {On|Off}',
    'Automatic wind compensation (AWC) {On|Off}',
    '## Thrusters and rudders',
    `Stbd propeller ${THR}`,
    `Port propeller ${THR}`,
    `Stbd rudder ${THR}`,
    `Port rudder ${THR}`,
    `Bow thruster A ${THR}`,
    `Bow thruster B ${THR}`,
    `Stern thruster A ${THR}`,
    `Stern thruster B ${THR}`,
    '## Power',
    'Stbd main engine {On|Off}',
    'Port main engine {On|Off}',
    `Generator 1 ${GEN}`,
    `Generator 2 ${GEN}`,
    `Generator 3 ${GEN}`,
    'Bus tie breaker {Closed|Open}',
    '## Communications',
    `Crane ${COMMS}`,
    `Engine control room ${COMMS}`,
    `Captain ${COMMS}`,
    `Deck ${COMMS}`,
    `Diving station ${COMMS}`,
    `ROV station ${COMMS}`,
    `Offshore unit ${COMMS}`,
  ]),
  t('dp.handover', 'DP watch handover', 'bridge', [
    'DP status and ASOG condition (Green / Advisory / Yellow / Red)',
    'Position and heading set-points; position and heading error within limits',
    'Position references in use, their weighting, any rejected or deselected',
    'Gyros, MRUs and wind sensors — any deselected or in fault',
    'Thrusters in use and their load; any thruster not available',
    'Power: generators on line, load, consequence analysis status',
    'Wind, current and sea — trend and forecast',
    'Operation in progress and the next steps; SIMOPS; vessels in the 500 m zone',
    'Alarms since the last watch and what was done; open defects',
    'Communications with the installation / client representative confirmed',
    'DP logbook up to date',
  ]),
  t('dp.departure', 'Leaving the field', 'bridge', [
    'Operation complete; lines, hoses, ROV and crane loads clear of the vessel and the installation',
    'Installation informed; permission to leave the 500 m zone',
    'Moved off on DP along the agreed route, away from the installation',
    'Change-over from DP to manual / autopilot made outside the 500 m zone',
    'Engine room informed; machinery returned to the transit set-up',
    'DP logbook and DP time completed',
  ]),
];

/** What the vessel works to: the built-ins as reworded, the vessel's own, without the switched-off. */
export function templatesNow(own: DpTemplate[]): DpTemplate[] {
  const byId = new Map(own.map((x) => [x.id, x]));
  const builtIn = DP_TEMPLATES.map((b) => byId.get(b.id) ?? b);
  const extra = own.filter((x) => !DP_TEMPLATES.some((b) => b.id === x.id));
  return [...builtIn, ...extra].filter((x) => !x.off);
}

/** Lines from text, one a line; a line written the same keeps its id (records are keyed by it). */
export function linesFromText(text: string, old: DpLine[], prefix: string, now = Date.now()): DpLine[] {
  const used = new Set<string>();
  let n = 0;
  return text
    .split('\n')
    .map((s) => (s.trim().startsWith('#') ? s.trim() : s.replace(/^\s*[-•*\d.)]+\s*/, '').trim()))
    .filter((s) => s && s.replace(/^#+/, '').trim())
    .map((s) => {
      const line = parseLine(s);
      const src = lineSource(line);
      const same = old.find((l) => lineSource(l) === src && !used.has(l.id));
      const id = same?.id ?? `${prefix}.${now.toString(36)}${(n++).toString(36)}`;
      used.add(id);
      return { id, ...line };
    });
}

/** Answers that mean something is wrong — counted as "no" and marked red. */
export const BAD_ANSWERS = ['fail', 'No', 'No good', 'Not available'];

/** What a line's answer prints as. */
export function answerText(l: DpLine, c: Pick<DpCheck, 'results' | 'values'>): string {
  const r = c.results[l.id];
  const a = r === 'pass' ? 'Yes' : r === 'fail' ? 'No' : r === 'na' ? 'N/A' : r ?? '';
  const v = c.values?.[l.id]?.trim();
  return [a, v ? `${l.value}: ${v}` : ''].filter(Boolean).join(' · ');
}

export const ASOG_LABEL: Record<AsogStatus, string> = { green: 'Green', blue: 'Advisory', yellow: 'Yellow', red: 'Red' };

export function checkOutcome(c: Pick<DpCheck, 'lines' | 'results'> & { values?: Record<string, string> }): { pass: number; fail: number; na: number; open: number } {
  const r = { pass: 0, fail: 0, na: 0, open: 0 };
  for (const l of c.lines) {
    if (l.head) continue;
    const v = c.results[l.id];
    if (!l.options && l.value) {
      // A reading only: done when written.
      if (c.values?.[l.id]?.trim()) r.pass++;
      else r.open++;
    } else if (!v) r.open++;
    else if (v === 'na' || v === 'N/A') r.na++;
    else if (BAD_ANSWERS.includes(v)) r.fail++;
    else r.pass++;
  }
  return r;
}

// ---- where -------------------------------------------------------------------

/**
 * A latitude or longitude as a navigator writes it: "57 12.345 N", "57°12.345'N",
 * "-57.2058", "001 23.4 W". Undefined when it is not one.
 */
export function parseCoord(text: string, kind: 'lat' | 'lon'): number | undefined {
  const s = (text ?? '').trim().toUpperCase().replace(/,/g, '.');
  if (!s) return undefined;
  const hemi = /[NSEW]/.exec(s)?.[0];
  if (hemi && (kind === 'lat' ? !/[NS]/.test(hemi) : !/[EW]/.test(hemi))) return undefined;
  const nums = s.replace(/[NSEW°'"′″]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!nums.length || nums.length > 3 || nums.some((x) => !/^[-+]?\d+(\.\d+)?$/.test(x))) return undefined;
  const [d, m = '0', sec = '0'] = nums;
  const neg = d.startsWith('-');
  const mm = Number(m), ss = Number(sec);
  if (mm >= 60 || ss >= 60 || (nums.length > 1 && /\./.test(d))) return undefined;
  let v = Math.abs(Number(d)) + mm / 60 + ss / 3600;
  if (neg || hemi === 'S' || hemi === 'W') v = -v;
  if (neg && hemi) return undefined;
  if (Math.abs(v) > (kind === 'lat' ? 90 : 180)) return undefined;
  return Math.round(v * 1e6) / 1e6;
}

/** 57°12.345′N */
export function coordText(v: number, kind: 'lat' | 'lon'): string {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60 * 1000) / 1000;
  if (m >= 60) { d += 1; m = 0; }
  const h = kind === 'lat' ? (v < 0 ? 'S' : 'N') : v < 0 ? 'W' : 'E';
  return `${String(d).padStart(kind === 'lat' ? 2 : 3, '0')}°${m.toFixed(3).padStart(6, '0')}′${h}`;
}

/** "depth 85 m · wind 15 kn / 270° · current 0.8 kn / 045° · waves 1.5 m / 260°" */
export function conditionsText(c?: DpConditions): string {
  if (!c) return '';
  const pair = (a?: string, b?: string) => [a?.trim(), b?.trim()].filter(Boolean).join(' / ');
  return [
    c.waterDepth?.trim() ? `water depth ${c.waterDepth.trim()}` : '',
    pair(c.windSpeed, c.windDir) ? `wind ${pair(c.windSpeed, c.windDir)}` : '',
    pair(c.currentSpeed, c.currentDir) ? `current ${pair(c.currentSpeed, c.currentDir)}` : '',
    pair(c.waveHeight, c.waveDir) ? `waves ${pair(c.waveHeight, c.waveDir)}` : '',
  ].filter(Boolean).join(' · ');
}

export const positionText = (p?: DpPosition) => (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? `${coordText(p.lat, 'lat')} ${coordText(p.lon, 'lon')}` : '—');

// ---- DP time -------------------------------------------------------------------

export const SLOTS = 48;
export const MIN_HOURS = 2;

export const emptySlots = (): DpSlot[] => Array(SLOTS).fill(0) as DpSlot[];
export const dayId = (crewId: string, date: string) => `${crewId}_${date}`;

export function hours(slots: DpSlot[], kind: 1 | 2 | 'all'): number {
  return slots.filter((s) => (kind === 'all' ? s > 0 : s === kind)).length * 0.5;
}
/** A DP day: 2 hours or more at the desk, active and passive together (as SDM counts it). */
export const isDpDay = (slots: DpSlot[]) => hours(slots, 'all') >= MIN_HOURS;

/** Set the half-hours [from, to) to one value — a watch entered as "08:00–12:00 Active". */
export function setRange(slots: DpSlot[], from: number, to: number, v: DpSlot): DpSlot[] {
  const out = [...slots];
  for (let i = Math.max(0, from); i < Math.min(SLOTS, to); i++) out[i] = v;
  return out;
}

export interface DpoTotals {
  crewId: string;
  name: string;
  rank?: string;
  days: DpDay[];
  dpDays: number;
  active: number;
  passive: number;
  first?: string;
  last?: string;
}

/** Each DPO's DP time between two dates (inclusive), newest name and rank. */
export function dpoTotals(all: DpDay[], from = '0000-00-00', to = '9999-99-99'): DpoTotals[] {
  const by = new Map<string, DpDay[]>();
  for (const d of all) {
    if (d.deleted || d.date < from || d.date > to) continue;
    by.set(d.crewId, [...(by.get(d.crewId) ?? []), d]);
  }
  return [...by.entries()]
    .map(([crewId, ds]) => {
      const days = ds.sort((a, b) => a.date.localeCompare(b.date));
      const latest = days[days.length - 1];
      return {
        crewId,
        name: latest.name,
        rank: latest.rank,
        days,
        dpDays: days.filter((d) => isDpDay(d.slots)).length,
        active: days.reduce((s, d) => s + hours(d.slots, 1), 0),
        passive: days.reduce((s, d) => s + hours(d.slots, 2), 0),
        first: days[0]?.date,
        last: latest?.date,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- the confirmation letter --------------------------------------------------

export type Scheme = 'new' | 'old';
const dmy = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso ?? '');

export interface LetterInput {
  scheme: Scheme;
  today: string;
  name: string;
  dob?: string;
  rank?: string;
  vesselName?: string;
  imo?: string;
  info: Partial<DpInfo>;
  from: string;
  to: string;
  days: DpDay[];
}

export interface Letter {
  fileName: string;
  address: string[];
  date: string;
  heading: string;
  subheading: string;
  paras: string[];
  notes: string[];
  head: string[];
  row: string[];
  /** New scheme: the active and the passive dates under the table. */
  dates: [string, string][];
  footnote?: string;
  closing: string[];
  signature: string[];
  /** What is missing for a letter that can be sent — shown before it is made. */
  missing: string[];
}

export function buildLetter(x: LetterInput): Letter {
  const inRange = x.days.filter((d) => !d.deleted && d.date >= x.from && d.date <= x.to).sort((a, b) => a.date.localeCompare(b.date));
  const valid = inRange.filter((d) => isDpDay(d.slots));
  const active = valid.filter((d) => hours(d.slots, 1) > 0).map((d) => dmy(d.date));
  const passive = valid.filter((d) => hours(d.slots, 1) === 0 && hours(d.slots, 2) > 0).map((d) => dmy(d.date));
  const i = x.info;
  const rank = x.rank || 'DPO';
  const old = x.scheme === 'old';
  const missing = [
    !x.dob && 'date of birth (Crew → the person)',
    !i.company && 'company',
    !i.dpClass && 'DP class',
    !i.signatoryName && 'who signs',
    !valid.length && 'a DP day (2 hours or more) in the period',
  ].filter(Boolean) as string[];
  const surname = (x.name.trim().split(/\s+/).pop() || 'DPO').replace(/[^\w-]+/g, '_');
  return {
    fileName: `Confirmation_letter_${rank.replace(/[^\w-]+/g, '_')}_${surname}_${x.today.replace(/-/g, '')}.pdf`,
    address: ['DP Department', 'The Nautical Institute', '202 Lambeth Road', 'LONDON SE1 7LQ', 'United Kingdom'],
    date: dmy(x.today),
    heading: `Application for the Revalidation of a DP Certificate – Offshore ${old ? 'Old' : 'New'} Scheme`,
    subheading: old
      ? '(Holders of the original blue/green/black/NI Revalidation logbook issued before 1st January 2015)'
      : '(Holders of the grey/NI Revalidation logbook issued after 1st January 2015)',
    paras: [
      `We hereby certify that ${x.name}${x.dob ? ` (DOB: ${dmy(x.dob)})` : ''} is employed by ${i.company || '—'} as a ${rank} / DPO on board our vessel.`,
      `We have checked the DP sea time against our records and verify that the entries below meet the minimum requirements of the DP Offshore ${old ? 'Old' : 'New'} Scheme; that for each day confirmed as a day on DP, the applicant has performed as a DPO/TDPO for a minimum of 2 hours per day.`,
    ],
    notes: old ? ['NOTES FOR REVALIDATION:', 'Confirmed DP time dated before 01/01/2015 – minimum 1 hour per day', 'Confirmed DP time dated after 01/01/2015 – minimum 2 hours per day'] : [],
    head: ['Vessel Name', 'GRT', 'IMO No.', 'DP Class', 'From', 'To', 'Days on DP', 'Rank'],
    row: [x.vesselName ?? '', i.grt ?? '', x.imo ?? '', i.dpClass ?? '', dmy(x.from), dmy(x.to), String(valid.length), rank],
    dates: old ? [] : [['Active Dates on DP', active.join(', ') || '—'], ['Passive Dates on DP', passive.join(', ') || '—']],
    footnote: old ? undefined : 'NOTE: For revalidation applications, only active DP time can be counted.',
    closing: ['This letter is provided in support of the application for a DP certificate.', 'Yours faithfully,', i.company || ''],
    signature: [i.signatoryName || '', i.signatoryRank || '', ...(i.contacts ? i.contacts.split('\n') : [])].filter(Boolean),
    missing,
  };
}

const h = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The letter as HTML for expo-print — a 35 mm space at the top for the company's letterhead paper. */
export function letterHtml(l: Letter): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  @page { size: A4; margin: 15mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.35; color: #000; margin: 0; }
  .letterhead { height: 35mm; } p { margin: 4px 0; } h2 { font-size: 10pt; margin: 8px 0 2px; }
  .sub { font-size: 7.5pt; color: #555; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8pt; }
  th { background: #002147; color: #fff; padding: 4px 6px; text-align: left; font-size: 7.5pt; } td { border: 1px solid #bbb; padding: 3px 6px; }
  .note { font-size: 7.5pt; color: #555; font-style: italic; } .sigline { border-top: 1px solid #555; width: 180px; margin: 18px 0 3px; }
</style></head><body>
<div class="letterhead"></div>
<p>${l.address.map(h).join('<br>')}</p>
<p style="text-align:right">${h(l.date)}</p>
<h2>${h(l.heading)}</h2><p class="sub">${h(l.subheading)}</p>
${l.paras.map((p) => `<p>${h(p)}</p>`).join('')}
${l.notes.length ? `<p><b>${h(l.notes[0])}</b><br>${l.notes.slice(1).map(h).join('<br>')}</p>` : ''}
<table><thead><tr>${l.head.map((c) => `<th>${h(c)}</th>`).join('')}</tr></thead><tbody>
<tr>${l.row.map((c) => `<td>${h(c)}</td>`).join('')}</tr>
${l.dates.map(([k, v]) => `<tr><td><b>${h(k)}</b></td><td colspan="${l.head.length - 1}" style="font-size:7.5pt">${h(v)}</td></tr>`).join('')}
</tbody></table>
${l.footnote ? `<p class="note">${h(l.footnote)}</p>` : ''}
<p>${h(l.closing[0])}</p>
<p style="margin-top:14px">${h(l.closing[1])}<br>${h(l.closing[2])}</p>
<div class="sigline"></div>
<p>${l.signature.map((s, k) => (k === 0 ? `<b>${h(s)}</b>` : h(s))).join('<br>')}</p>
</body></html>`;
}
