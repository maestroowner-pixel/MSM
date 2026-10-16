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

import { AsogStatus, DpCheck, DpDay, DpInfo, DpLine, DpResult, DpSlot, DpTemplate, DpWhere } from '../types/dp';

// ---- checklists ---------------------------------------------------------------

const t = (id: string, title: string, where: DpWhere, lines: string[]): DpTemplate => ({
  id,
  title,
  where,
  // Line ids are permanent: a signed record keys its results by them.
  lines: lines.map((text, i) => ({ id: `${id}.${String(i + 1).padStart(2, '0')}`, text })),
  updatedAt: 0,
});

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

/** Lines from text, one a line; a line that kept its text keeps its id (records are keyed by it). */
export function linesFromText(text: string, old: DpLine[], prefix: string, now = Date.now()): DpLine[] {
  const used = new Set<string>();
  let n = 0;
  return text
    .split('\n')
    .map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .map((s) => {
      const same = old.find((l) => l.text === s && !used.has(l.id));
      const id = same?.id ?? `${prefix}.${now.toString(36)}${(n++).toString(36)}`;
      used.add(id);
      return { id, text: s };
    });
}

export const ASOG_LABEL: Record<AsogStatus, string> = { green: 'Green', blue: 'Advisory', yellow: 'Yellow', red: 'Red' };

export function checkOutcome(c: Pick<DpCheck, 'lines' | 'results'>): { pass: number; fail: number; na: number; open: number } {
  const r = { pass: 0, fail: 0, na: 0, open: 0 };
  for (const l of c.lines) {
    const v: DpResult | undefined = c.results[l.id];
    if (v) r[v]++;
    else r.open++;
  }
  return r;
}

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
