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

import { AsogStatus, CheckBook, DpCheck, DpCol, DpConditions, DpDay, DpInfo, DpLine, DpPosition, DpSlot, DpTemplate, DpWhere } from '../types/dp';

// ---- checklists ---------------------------------------------------------------

/**
 * A line as the officers write it, one a line:
 *   Thrusters tested on DP              → Yes / No / N/A
 *   GPS 1 {Not used|Monitor|Selected}   → one of the options
 *   Crane {Good|!No good}               → "!" marks the answer that is wrong
 *   Gyro 1 {Available|Priority} [Hdg]   → an option and a reading
 *   Position gain [setting]             → a reading only
 *   ## Position references              → a heading
 *   ## Sensors | Available {Yes|!No} | Priority {Yes|No} | Value | Deviation
 *                                       → a TABLE: each line below is a row
 *                                         with these cells, as on paper
 */
const opts = (inner: string) => {
  const raw = inner.split('|').map((x) => x.trim()).filter(Boolean);
  const options = raw.map((x) => x.replace(/^!\s*/, ''));
  const bad = raw.filter((x) => x.startsWith('!')).map((x) => x.replace(/^!\s*/, ''));
  return { options: options.length ? options : undefined, bad: bad.length ? bad : undefined };
};

/** Split on "|" outside braces. */
const splitCols = (s: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === '|' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
};

export function parseLine(raw: string): Omit<DpLine, 'id'> {
  let s = raw.trim();
  // "~Bow AZI": a row this vessel does not have — kept, so it can be shown again.
  if (s.startsWith('~')) return { ...parseLine(s.slice(1)), hidden: true };
  const kind = /^@(field|text|sketch|sign)\s+(.+)$/i.exec(s);
  if (kind) return { text: kind[2].trim(), kind: kind[1].toLowerCase() as DpLine['kind'] };
  if (s.startsWith('#')) {
    // "## > Alarm limits | …" — this table sits beside the one before it, as on the paper form.
    const beside = /^#+\s*>/.test(s);
    const [title, ...cells] = splitCols(s.replace(/^#+\s*>?\s*/, ''));
    const cols = cells.filter(Boolean).map((c) => {
      const m = /\{([^}]*)\}/.exec(c);
      const f = /\[([0.]+)\]/.exec(c);
      const name = c.replace(/\{[^}]*\}/, '').replace(/\[[0.]+\]/, '').trim();
      const one = !!m && m[1].trim().toLowerCase() === 'one';
      return { name, ...(one ? { options: ['Yes'], one: true } : m ? JSON.parse(JSON.stringify(opts(m[1]))) : {}), ...(f ? { format: f[1] } : {}) };
    });
    return { text: title, head: true, ...(cols.length ? { cols } : {}), ...(beside ? { beside } : {}) };
  }
  const out: Omit<DpLine, 'id'> = { text: '' };
  // "-[Mode]": no cell in that column for this row.
  const skip = [...s.matchAll(/-\[([^\]]+)\]/g)].map((m) => m[1].trim());
  if (skip.length) {
    out.skip = skip;
    s = s.replace(/-\[[^\]]+\]/g, ' ');
  }
  const opt = /\{([^}]*)\}/.exec(s);
  if (opt) {
    const o = opts(opt[1]);
    if (o.options) out.options = o.options;
    if (o.bad) out.bad = o.bad;
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

const optSource = (o?: string[], bad?: string[]) => (o?.length ? ` {${o.map((x) => (bad?.includes(x) ? `!${x}` : x)).join('|')}}` : '');

/** The line back as it is written — what the editor shows. */
export const lineSource = (l: Omit<DpLine, 'id'>): string =>
  l.hidden
    ? `~${lineSource({ ...l, hidden: false })}`
    : l.kind
    ? `@${l.kind} ${l.text}`
    : l.head
    ? `## ${l.beside ? '> ' : ''}${l.text}${(l.cols ?? []).map((c) => ` | ${c.name}${c.one ? ' {one}' : optSource(c.options, c.bad)}${c.format ? ` [${c.format}]` : ''}`).join('')}`
    : `${l.text}${optSource(l.options, l.bad)}${l.value ? ` [${l.value}]` : ''}${(l.skip ?? []).map((x) => ` -[${x}]`).join('')}`;

/** The table a line sits in — the columns of the last heading above it, if that heading has any. */
export function sectionCols(lines: DpLine[]): Map<string, DpCol[] | undefined> {
  const m = new Map<string, DpCol[] | undefined>();
  let cols: DpCol[] | undefined;
  for (const l of lines) {
    if (l.head) cols = l.cols;
    else m.set(l.id, l.kind ? undefined : cols);
  }
  return m;
}

export const cellKey = (lineId: string, col: number) => `${lineId}#${col}`;

/** A number to a column's pattern: "1,25" with "0.0" → "1.3"; not a number → as written. */
export function formatCell(v: string, format?: string): string {
  if (!format) return v;
  const n = Number(v.trim().replace(',', '.'));
  if (!v.trim() || !Number.isFinite(n)) return v;
  const dec = format.includes('.') ? format.split('.')[1].length : 0;
  return n.toFixed(dec);
}

const t = (id: string, title: string, where: DpWhere, lines: string[]): DpTemplate => ({
  id,
  title,
  where,
  // Line ids are permanent: a signed record keys its results by them.
  lines: lines.map((text, i) => ({ id: `${id}.${String(i + 1).padStart(2, '0')}`, ...parseLine(text) })),
  updatedAt: 0,
});

/**
 * Every DP checklist starts with the state of the DP system — sensors, position
 * references, thrusters, power, communications — and then its own items (16 Oct
 * 2026, the owner: "every checklist must have the sensors and all the rest — it
 * starts with that"), laid out as tables as on the paper Arrival DP Checklist.
 */
const SYSTEMS: string[] = [

    '## Operator stations | Online {Yes|!No}',
    'OS1',
    'OS2',
    '## Sensors | Available {Yes|!No} | Priority {Yes|No} | Value | Deviation',
    'Gyro 1 · Hdg',
    'Gyro 2 · Hdg',
    'Gyro 3 · Hdg',
    'VRS 1 · Pitch/Roll',
    'VRS 2 · Pitch/Roll',
    'MRU · Pitch/Roll',
    'Wind 1 · Speed/dir',
    'Wind 2 · Speed/dir',
    'Wind 3 · Speed/dir',
    '## DP settings | Value',
    'Speed',
    'Position gain',
    'Position limit',
    'Speed vector gain',
    'Heading limit',
    'Heading gain',
    'Rate of turn (ROT)',
    'Use shortest turn',
    '## Origin reference system | Status {Not used|Monitor|Selected|Mobile} | Noise | Weight',
    'GPS 1',
    'GPS 2',
    'GPS 3',
    'Laser reference (LR)',
    'RadaScan / RADius',
    'LTW',
    'HPR 1',
    'HPR 2',
    'HPR 3',
    'HPR 4',
    '## Consequence analysis | Status {On|!Off}',
    'Consequence analysis',
    'AWC',
    '## Thrusters and rudders | Run {Yes|No} | Ready {Yes|No} | Activated {Yes|No} | Mode {Auto|Manual}',
    'Stbd propeller',
    'Port propeller',
    'Stbd rudder',
    'Port rudder',
    'Bow A thruster',
    'Bow B thruster',
    'Stern A thruster',
    'Stern B thruster',
    '## Main engines | Status {On|Off}',
    'Stbd main engine',
    'Port main engine',
    '## Generators | Run {Yes|No} | On bus {Closed|Open}',
    'Generator 1',
    'Generator 2',
    'Generator 3',
    'Bus tie breaker',
    '## Communications | Status {Good|!No good}',
    'Crane',
    'Engine',
    'Captain',
    'Deck',
    'Diving station',
    'ROV station',
    'Offshore unit',
];

/**
 * DP watch handover / takeover — the owner's sample of a vessel's own form
 * (a DP Operations Manual attachment, 16 Oct 2026), laid out as it is on paper;
 * the form's revision block is left out. Vessel-specific by nature: the
 * officers word it to their own DPOM.
 */
const HANDOVER: string[] = [
  '@field Location',
  '@field Project',
  '@field Client',
  '## Vessel position | Value',
  'Compass heading (deg)',
  'Set heading (deg)',
  'Rate of turn (deg)',
  'Working side',
  '## > Alarm limits | Warning | Alarm',
  'Position (m)',
  'Heading (deg)',
  '## Operating station | OS on control {OS1|OS2|OS3} | Computer {C1|C2|C3} | Controller {A|B|C}',
  'In control',
  '## > Vessel mode | Mode | DP class {Off|1|2|3}',
  'Vessel',
  '## DP control | Blow {Off|On} | D.P. consequence alarm {Off|Class 2} | Rotation centre {Fwd|Midship|Aft|Other}',
  'Setting',
  '## DP current | Direction (deg) | Speed (kn)',
  'DP current',
  '## > Wind | Direction (deg) | Speed (kn)',
  'Wind',
  '## > Swell | Direction (deg) | Height (m) [0.0]',
  'Swell',
  '## Event printer | Power {On|!Off} | Paper {Flush|Refresh} | Print status {Yes|!No} | Panel lamp test {Yes|!No}',
  'Event printer',
  // Sensor by sensor: the sensor, whether it is preferred, then its readings (16 Oct 2026).
  '## Sensors — gyros | Preferred {one} | Heading (deg)',
  'Gyro 1',
  'Gyro 2',
  'Gyro 3',
  'Gyro 4',
  '## Sensors — wind | Preferred {one} | Direction (deg) | Speed (kn)',
  'Wind 1',
  'Wind 2',
  '## Sensors — MRU / VRS | Preferred {one} | Pitch (deg) | Roll (deg)',
  'MRU 1',
  'MRU 2',
  'VRS',
  '## Power management | On load {Yes|No} | Available (kW) | Consumed (kW)',
  // Every arrangement there is; each vessel hides what it does not have (~).
  'Main 1',
  'Main 2',
  'DG1',
  'DG2',
  'DG3',
  'DG4',
  '~DG5',
  '~DG6',
  '~Shaft gen 1 (SG1)',
  '~Shaft gen 2 (SG2)',
  '## Power | Value',
  'Total active power (kW)',
  'Spinning reserve power (kW)',
  'Maximum kW on bus A',
  'Maximum kW on bus B',
  'Consumed (kW)',
  // Up to six, named as on the vessel's switchboard — the officers rename or remove rows.
  '## > Bus ties | Breaker {Open|Closed|N/A}',
  'Bus tie 1',
  'Bus tie 2',
  '~Bus tie 3',
  '~Bus tie 4',
  '~Bus tie 5',
  '~Bus tie 6',
  // Mode is for Fanbeam (fixed / relative) and HiPAP (SSBL, LBL…); Beacon No. for HiPAP; HDOP and satellites for DGPS; Value is the weight, in %.
  '## Reference system settings | Setting {Enable|Disable|Monitor} | Beacon No. | Value (%) | Mode | HDOP [0.0] | Satellites',
  'DGPS 1 -[Beacon No.] -[Mode]',
  'DGPS 2 -[Beacon No.] -[Mode]',
  'DGPS 3 -[Beacon No.] -[Mode]',
  'DGPS 4 -[Beacon No.] -[Mode]',
  'HiPAP 1 -[HDOP] -[Satellites]',
  'HiPAP 2 -[HDOP] -[Satellites]',
  'Fanbeam -[Beacon No.] -[HDOP] -[Satellites]',
  'LTW -[Beacon No.] -[Mode] -[HDOP] -[Satellites]',
  '## Fanbeam | Range (m) | Bearing (deg)',
  'Fanbeam',
  '## Reference system details | Acceptance limits {Narrow|Normal|Wide} | Median test {Off|Warning|Warning & reject} | DGPS diff. correction | Redundant stations update offline {Yes|No}',
  'Setting',
  '## Joystick settings | Thrust {Full|Reduced} | Precision {High speed|General|Low speed} | Rotation centre {Fwd|Midship|Aft|Other}',
  'Joystick',
  // Every arrangement there is; each vessel hides what it does not have ("~Bow AZI").
  '## Thrusters enabled | Enabled {Yes|No}',
  'AZI 1',
  'AZI 2',
  'Bow thruster 1',
  'Bow thruster 2',
  'Bow thruster 3',
  '~Bow AZI',
  '~Stern thruster 1',
  '~Stern thruster 2',
  '~CPP 1',
  '~CPP 2',
  '~Port propeller',
  '~Stbd propeller',
  '~Rudder 1',
  '~Rudder 2',
  '~Port rudder',
  '~Stbd rudder',
  '## AutoPos settings | Value',
  'Low speed',
  'Surge (%)',
  'Sway (%)',
  'Yaw (%)',
  'Acceleration factor',
  'Retardation factor',
  'Increment (m)',
  'Speed set points (kn)',
  '## AutoPos mode | Controller mode {High precision|Green} | Gain {Low|Medium|High}',
  'AutoPos',
  '## Communication | VHF {Yes|!No} | ClearCom {Yes|!No} | Phone {Yes|!No}',
  'Bridge — ECR / deck',
  'Bridge — crane control',
  '## > Miscellaneous | Checked {Yes|!No}',
  'DP alert alarm / lights',
  'Lights / shapes displayed',
  '## Operation | Done {Yes|!No} | If No, why?',
  'Vessel set up as per ASOG',
  'JHA / RA prepared',
  'DP pre-operation checklist completed',
  'Capability plot verified',
  'Weather forecast received',
  '## Environmental condition | Value',
  'Water depth (m)',
  'Wave height (m)',
  'Period (s)',
  'Sea state',
  '@text Brief description of the operation in progress',
  '@sketch Schematic: own vessel, rig, direction of wind and current',
];

/**
 * DP field arrival trials — the DP verification part of a vessel's arrival
 * trials form (16 Oct 2026, the owner's sample), after the handover sheet.
 * Signed by the SDPO and the DPO.
 */
const DONE = 'Done {Yes|!No|N/A} | Comments';
const MOVES = [
  'Move 10 m ahead — monitor position track, check footprint or overshoot',
  'Move 10 m port — monitor position track, check footprint or overshoot',
  'Move 10 m astern — monitor position track, check footprint or overshoot',
  'Move 10 m stbd — monitor position track, check footprint or overshoot',
  'Alter heading 10° P/S, 20° S/S, 10° P/S — check footprint, confirm original position',
];
const TRIALS: string[] = [
  `## DP verification | ${DONE}`,
  'UPS 1 — fail main power supply, check DP alarm and battery take-over (by ETO)',
  'UPS 2 — fail main power supply, check DP alarm and battery take-over (by ETO)',
  'DGPS 1 — fail diff. correction, check alarm and rejection by DP',
  'DGPS 2 — fail diff. correction, check alarm and rejection by DP',
  'HiPAP — fail signal from APOS, check alarm and rejection by DP',
  `## Check DP positioning with DGPS 1 | ${DONE}`,
  ...MOVES,
  `## Check DP positioning with DGPS 2 | ${DONE}`,
  ...MOVES,
  `## Check DP positioning with HiPAP | ${DONE}`,
  ...MOVES,
  `## Check DP positioning with LTW | ${DONE}`,
  'Move vessel through a box of 5 m sides and confirm original position with offline sensors; monitor position track',
  'Move vessel to verify LTW out-of-range alarm on DP',
  `## Check DP positioning with Fanbeam | ${DONE}`,
  'Check parameters, adjust as necessary',
  'If possible, start tracking target — range (m) / bearing in Comments',
  'Tracking is stable (monitor for at least 10 min)',
  `## Check DP positioning with thrusters de-selected | Thrusters de-selected | ${DONE}`,
  'Move vessel through a box of 10 m sides; monitor position track; check maximum footprint / overshoot; confirm original position',
  'Alter heading 20° stbd and then 20° port; check footprint',
  '## Position dropout test (model test) | Done {Yes|!No|N/A} | Position deviation (m) [0.0] | Heading deviation (deg) [0.0]',
  'Stabilise vessel in Auto DP for 30 min, log position on the survey screen; deselect all reference systems and wait 5 min; verify alarms and that the vessel keeps position on the mathematical model',
  `## Additional checks | ${DONE}`,
  'Fail each thruster to DP and check alarms',
  'Switch on consequence analysis; deselect four thrusters; check DP alarm and position keeping; verify the consequence analysis warning',
  'Rotate heading 360°; check discrepancy between reference systems',
  `## Start-up settings | ${DONE}`,
  'Complete the 6-hour DP checklist and attach it to this checklist',
  'Complete the ER DP checklist and attach it to this checklist',
  '@sign SDPO',
  '@sign DPO',
];

/** A checklist's own items: one table, answered and remarked line by line. */
const OWN = (title: string) => `## ${title} | Checked {Yes|!No|N/A} | Remarks`;

export const DP_TEMPLATES: DpTemplate[] = [
  // A copy of the handover sheet — the base (the owner, 16 Oct 2026: "this is the base").
  t('dp.arrival.bridge', 'Field arrival — bridge (before the 500 m zone)', 'bridge', [...HANDOVER, ...TRIALS]),
  t('dp.arrival.engine', 'Field arrival — engine room', 'engine', [
    ...SYSTEMS,
    OWN('Field arrival — engine room'),

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
  t('dp.handover', 'DP watch handover / takeover', 'bridge', HANDOVER),
  t('dp.departure', 'Leaving the field', 'bridge', [
    ...SYSTEMS,
    OWN('Leaving the field'),

    'Operation complete; lines, hoses, ROV and crane loads clear of the vessel and the installation',
    'Installation informed; permission to leave the 500 m zone',
    'Moved off on DP along the agreed route, away from the installation',
    'Change-over from DP to manual / autopilot made outside the 500 m zone',
    'Engine room informed; machinery returned to the transit set-up',
    'DP logbook and DP time completed',
  ]),
];

// ---- bridge and engine checklists (17 Oct 2026) ----------------------------------
//
// The watch handover on the bridge and in the engine room, as STCW Code A-VIII/2
// lists what the relieving officer must know (part 4-1, navigational watch;
// part 4-2, engineering watch) — laid out as the DP sheet is. A starting point:
// each vessel's forms are set up from its own (the checklist editor, AI import).

const BRIDGE_HANDOVER: string[] = [
  '@field Voyage (from – to)',
  '@field Port / area',
  '## Position and track | Value',
  'Position fix — method and time',
  'Course to steer (deg)',
  'Course over ground (deg)',
  'Speed through water (kn)',
  'Speed over ground (kn)',
  'Next waypoint / ETA',
  'Cross-track distance (m)',
  'Draught fwd / aft (m)',
  '## > Weather | Value',
  'Wind (dir / force)',
  'Sea / swell',
  'Visibility (nm)',
  'Barometer (hPa) and trend',
  '## Compass errors | Error (deg)',
  'Gyro error',
  'Magnetic compass deviation',
  '## Steering | Mode {Auto|Manual|Track control} | Steering pumps {1|2|1 + 2}',
  'Steering',
  '## Navigational equipment | Status {In use|Standby|!Defective} | Remarks',
  'Radar 1 (X-band)',
  'Radar 2 (S-band)',
  'ECDIS 1',
  'ECDIS 2',
  'GNSS / GPS',
  'Gyro compass',
  'Autopilot',
  'AIS',
  'Echo sounder',
  'Speed log',
  'BNWAS',
  'VDR',
  'VHF / GMDSS',
  'Navigation lights / shapes',
  '## Traffic and hazards | Checked {Yes|!No|N/A} | Remarks',
  'Traffic around the vessel — targets, CPA / TCPA',
  'Navigational hazards and shallow water ahead',
  'TSS, VTS and reporting points ahead',
  'Tidal stream and current',
  'Under-keel clearance and squat',
  '## Orders and operations | Read {Yes|!No|N/A} | Remarks',
  "Master's standing orders",
  "Master's night orders",
  'Passage plan for the watch',
  'Ship operations in progress (cargo, ballast, deck work, drills)',
  'Lookout posted and fit for duty',
  'Engine room status / restrictions',
  'Navigational warnings / NAVTEX',
];

const ENGINE_HANDOVER: string[] = [
  '@field Voyage / port',
  '## Propulsion | Status {Running|Standby|Stopped} | RPM / load | Remarks',
  'Main engine 1',
  'Main engine 2',
  '~CPP / pitch',
  '~Shaft generator',
  '## Generators | On load {Yes|No} | Load (kW) | Running hours',
  'DG1',
  'DG2',
  'DG3',
  'DG4',
  '~DG5',
  '~DG6',
  '## > Emergency generator | Mode {Auto|!Manual|!Off}',
  'Emergency generator',
  '## Systems | Status {Normal|!Abnormal} | Remarks',
  'Fuel oil system — service tanks, purifiers',
  'Lube oil system',
  'Cooling water — HT / LT',
  'Starting air pressure',
  'Steering gear',
  'Bilges and bilge wells',
  'Sewage treatment plant',
  'Fresh water generator / tanks',
  'Boiler / incinerator',
  'HVAC and refrigeration',
  '## Tanks | Level (%) | Remarks',
  'Fuel service tank',
  'Fuel settling tank',
  'Bilge holding tank',
  'Sludge tank',
  'Sewage holding tank',
  'Fresh water',
  '## Alarms and safety | Checked {Yes|!No|N/A} | Remarks',
  'Alarms since the last watch — acknowledged and explained',
  'Fire detection system — no faults',
  'Fixed fire-fighting system — ready',
  'Watertight doors and openings',
  'Machinery space unattended (UMS) — conditions met',
  '## Orders and work | Read {Yes|!No|N/A} | Remarks',
  "Chief Engineer's standing / night orders",
  'Maintenance and repairs in progress — isolations and permits',
  'Fuel transfers / bunkering planned or in progress',
  'Restrictions on machinery from the bridge',
  'Oil record book entries up to date',
];

// Sign-on / sign-off: the officer leaving hands over to the one joining (17 Oct
// 2026) — the state of the job, the papers and keys, and the familiarisation the
// newcomer must have before taking duties (ISM Code 6.3, STCW I/14).
const CHK = 'Checked {Yes|!No|N/A} | Remarks';
const DECK_SIGNOFF: string[] = [
  '@field Rank / position handed over',
  '@field Port of handover',
  `## Vessel status | ${CHK}`,
  'Certificates and surveys due — dates explained',
  'Outstanding defects and repairs',
  'Open PSC / flag / class findings',
  'Planned maintenance — overdue and due this month',
  'LSA and FFE inspections — status',
  'Navigational equipment — defects and service due',
  'Charts and publications — corrections up to date',
  'Stores and spares on order',
  `## Documents, keys and accounts | ${CHK}`,
  'Keys handed over',
  'Passwords and accounts (ECDIS, company e-mail, devices)',
  'Logbooks and record books up to date and signed',
  'Reports due to the company',
  'Correspondence in progress',
  `## Familiarisation — ISM 6.3, STCW I/14 | ${CHK}`,
  'Emergency duties (muster list) explained',
  'LSA and FFE locations shown',
  'Bridge equipment familiarisation completed',
  "SMS manuals and Master's standing orders read",
  'Drills due in the coming weeks',
  `## People and contacts | ${CHK}`,
  'Crew matters — certificates expiring, sign-offs planned',
  'Contacts — agent, superintendent, DPA',
  '@text Notes for the relieving officer',
  '@sign Signing off',
  '@sign Signing on',
];
const ENGINE_SIGNOFF: string[] = [
  '@field Rank / position handed over',
  '@field Port of handover',
  `## Machinery status | ${CHK}`,
  'Main engines and generators — condition, running hours',
  'Planned maintenance — overdue and due this month',
  'Outstanding defects and repairs; class items',
  'Critical spares — on board and on order',
  'Steering gear, fire pumps and emergency generator — last tests',
  `## Bunkers and record books | Value | Remarks`,
  'Fuel oil remaining on board (m³)',
  'Lube oil remaining on board (l)',
  'Sludge / bilge holding (m³)',
  'Oil record book — up to date and signed',
  `## Work in hand | ${CHK}`,
  'Permits to work and isolations in force',
  'Repairs by contractors in progress',
  'Engine room keys handed over',
  'Reports due to the company / technical superintendent',
  `## Familiarisation — ISM 6.3, STCW I/14 | ${CHK}`,
  'Emergency duties (muster list) explained',
  'Emergency generator — start and changeover shown',
  'Fire pumps and emergency fire pump shown',
  'Quick-closing valves and emergency stops shown',
  'Fixed fire-fighting system release shown',
  "Chief Engineer's standing orders read",
  '@text Notes for the relieving engineer',
  '@sign Signing off',
  '@sign Signing on',
];

// Familiarisation on joining (17 Oct 2026: "a Familiarisation folder — bridge
// and engine"): what a newcomer is shown before taking duties — STCW I/14 and
// A-I/14, ISM Code 6.3, SOLAS — signed by the one familiarised and the one who
// familiarised them (ratings too).
const DONE3 = 'Done {Yes|!No|N/A} | Remarks';
const FAM_GENERAL: string[] = [
  '@field Name and rank familiarised',
  '@field Date joined',
  `## On joining — all | ${DONE3}`,
  "Ship's particulars, layout and accommodation",
  'Muster station and emergency duties (muster list)',
  'Alarm signals — general emergency, fire, abandon ship',
  'Lifeboats / liferafts, lifejackets and immersion suits — where and how',
  'Fire-fighting equipment — where and how',
  'Escape routes and emergency exits',
  'Company policies — drug and alcohol, environment, harassment',
  'Security duties (ISPS) and restricted areas',
  'Garbage management and MARPOL',
  'Hours of work and rest',
];
const FAM_BRIDGE: string[] = [
  ...FAM_GENERAL,
  `## Bridge equipment | Shown and operated {Yes|!No|N/A} | Remarks`,
  'Radars / ARPA',
  'ECDIS — type-specific familiarisation',
  'GNSS',
  'Gyro and magnetic compass',
  'Autopilot and steering change-over, emergency steering',
  'Echo sounder and speed log',
  'AIS',
  'BNWAS',
  'VDR — saving the data',
  'GMDSS — VHF DSC, MF/HF, NAVTEX, EPIRB, SART',
  'Navigation lights and sound signals',
  'Engine controls and emergency stop on the bridge',
  'Thrusters',
  'Internal communications',
  `## Procedures | Read and understood {Yes|!No|N/A} | Remarks`,
  "Master's standing orders",
  'Bridge procedures and passage planning',
  'When to call the Master',
  'Restricted visibility',
  'Anchoring and anchor watch',
  'Pilot boarding and master-pilot exchange',
  'Emergency procedures — fire, flooding, collision, grounding, man overboard',
  'Reporting — VTS, ship reporting systems',
  'Deck logbook keeping',
  '@sign Familiarised',
  '@sign Familiarised by',
];
const FAM_ENGINE: string[] = [
  ...FAM_GENERAL,
  `## Machinery | Shown and operated {Yes|!No|N/A} | Remarks`,
  'Main engines — remote and local control',
  'Generators and switchboard — synchronising, preferential trips',
  'Blackout recovery',
  'Emergency generator and emergency switchboard',
  'Fuel oil system and purifiers',
  'Lube oil system',
  'Cooling water systems',
  'Compressed air',
  'Steering gear — local and emergency steering',
  'Bilge and ballast pumps',
  'Oily water separator and 15 ppm alarm',
  'Sewage treatment plant and incinerator',
  'Fresh water generator and boiler',
  'Fire pumps and emergency fire pump',
  'Fixed fire-fighting system — release',
  'Quick-closing valves and emergency stops — fuel, ventilation',
  'Fire dampers and watertight doors',
  'Alarm and monitoring system, UMS',
  'Workshop tools and machinery safety',
  'Enclosed spaces in the engine room',
  `## Procedures | Read and understood {Yes|!No|N/A} | Remarks`,
  "Chief Engineer's standing orders",
  'Engine room watchkeeping and UMS rounds',
  'Permits to work and isolation (lock-out / tag-out)',
  'Bunkering procedure',
  'Oil record book',
  'Emergency procedures — engine room fire, blackout, flooding',
  '@sign Familiarised',
  '@sign Familiarised by',
];

// Project crew (IP Code, SPS Code — survey, ROV, construction people aboard for a
// project) and passengers / guests (SOLAS III/19.2 safety briefing), 17 Oct 2026.
const FAM_PROJECT: string[] = [
  '@field Company',
  '@field Role on the project',
  '@field Date joined',
  `## Safety induction | ${DONE3}`,
  'Vessel layout and restricted areas',
  'Muster station, alarm signals and what to do',
  'Lifejacket and immersion suit — donning demonstrated',
  'Lifeboats / liferafts and abandon ship',
  'Escape routes, fire alarm call points and extinguishers',
  'PPE required on deck and in work areas',
  'Permit to work system and toolbox talks',
  'Stop-work authority and reporting hazards',
  'Smoking, drug and alcohol policy',
  'Hours of work and rest',
  "Medical — ship's hospital, first aid, reporting injury",
  'Security (ISPS) — ID, visitors, restricted areas',
  'Garbage and environment rules',
  `## Project operations | ${DONE3}`,
  'Interfaces with the ship’s crew — SIMOPS, who to call',
  'Lifting operations and crane signals',
  'Working over the side and at height',
  'DP operations — ASOG awareness, DP alert lights',
  'ROV / survey spread hazards',
  'Radio channels and communications',
  `## Documents | ${CHK}`,
  'Offshore safety and medical certificates seen (BOSIET / GWO, medical)',
  'Next-of-kin details recorded',
  '@sign Familiarised',
  '@sign Familiarised by',
];
const FAM_PAX: string[] = [
  '@field Cabin',
  '@field Number of guests briefed',
  `## Safety briefing | Given {Yes|!No|N/A} | Remarks`,
  'Muster station and the way to it',
  'General emergency alarm — what to do',
  'Lifejackets — where they are, how to put one on (shown)',
  'Liferafts and abandon ship',
  'Fire — alarm, escape routes, no lifts',
  'Man overboard — shout, point, throw',
  'Restricted areas — bridge, engine room, crew areas',
  'Safety on deck — handrails, footwear, weather decks at sea',
  'Tender and water toys',
  'Swimming from the vessel',
  'Medical needs, allergies and mobility told to the crew',
  'Smoking policy',
  'Visitors and security on board',
  'Who to call on board in an emergency',
  '@sign Guest',
  '@sign Briefed by',
];

// After a DP operator's own familiarisation form (HLM-SOP-031-07, sent 17 Oct 2026): what
// everyone is told, then the DPOs' part and the engine room's — the part that is not the
// person's own is marked N/A. Each item names who instructed it.
const INSTR = 'Done {Yes|!No|N/A} | Instructed by';
const FAM_DP: string[] = [
  '@field Location',
  '@field Time (from – to)',
  `## All personnel (Master, DPOs, engine personnel, electricians) | ${INSTR}`,
  'Job descriptions',
  'DP familiarisation programme adhered to',
  'Standing orders',
  'Instruction on controlled documents',
  'Restricted practices — clear instructions on prohibited practices',
  'Charterer incident reporting requirements',
  'Personnel management systems',
  'Client / charterer procedures',
  'DP Operations Manual read and understood',
  'Latest DP trials report read and understood',
  'Latest FMEA report read and understood',
  'DP incident reports reviewed (branch and internal)',
  'DP experience logged in the IMCA DP logbook',
  'Good, clear and early communication with the bridge / control room on any change to the vessel’s operating capability',
  `## DP operators (Master and DPOs) | ${INSTR}`,
  'Master’s standing instructions for normal and emergency operations',
  'DP checklists and their retention',
  'General understanding of the DP system installed',
  'Control of the vessel about a set point — manual controls',
  'Control of the vessel about a set point — joystick',
  'Transfer to manual joystick',
  'Transfer to auto DP, setting the vessel up for the operation',
  'Transfer from auto DP to manual joystick and rotation',
  'Transfer to autopilot and main propulsion',
  'Setting the vessel up on DP — the reasons for the procedures',
  'Using the DP panel while on DP',
  'Desk facilities',
  'Position reference inputs and the vessel’s own limitations',
  'Power supplies for the DP computers and thruster control units',
  'Emergency power supplies',
  'Alarm sequence and signals (DP status lights, BOP controls)',
  'Loading and general use of the DP control computers',
  'Thruster / main engine / sensor configurations in normal and emergency situations — manual or automatic change-over',
  'Thruster failures creating unwanted forces — how to react',
  'Position reference sensors — use and location',
  'Gyros, VRUs / MRUs, anemometers, DGPS, HiPAP, taut wire, CyScan and other inputs — use and location',
  'Power generation, distribution and propulsion, with fire and watertight subdivision',
  'Functions, FMEA and limitations of the vessel, capability plots',
  'Consequence analysis — for the present operation and for planning',
  'Features of the DP control programme unique to the vessel',
  'Operating limits for all DP equipment (weather, power, rotation)',
  'Effect of the environment and the operation on the limits, with the machinery set-up',
  `## Engine personnel, incl. electricians | ${INSTR}`,
  'Engine room standing instructions for normal and emergency operations',
  'DP checklists and their retention',
  'DP reference systems — gyros, VRUs, anemometers, DGPS, HiPAP, taut wire, CyScan: technical understanding and location',
  'Equipment configuration for the normal mode of operation',
  'Configuration allowing change-over to auxiliary units on any single failure',
  'Alarm equipment and the consequences of the alarms',
  'DP power back-up systems and redundancy',
  'Open / closed bus',
  'Handling a blackout',
  'Handling an ESD (emergency shutdown)',
  'Emergency DP contingency drill (blackout, restart of critical functions)',
  'DP trials and FMEA',
  '@sign Instructed',
  '@sign Instructor',
];


// Safety familiarisation within 24 hours, before sailing (STCW A-VI/1 para 1, ISM 6.3) —
// after an operator's on-board form (VC-01, sent 17 Oct 2026). For everyone who boards to
// stay: a seafarer or a visitor, one person per sheet; Section 1 by the Safety Officer,
// Section 2 by the Safety Officer or the 2nd Engineer.
const TICK = 'Done {Yes|!No|N/A} | Remarks';
const FAM_SAFETY: string[] = [
  '@field Port',
  '@field Department (deck / engine / visitor)',
  `## Section 1 — Safety and environmental briefing (before sailing) | ${TICK}`,
  'Lifejackets — where they are and how to use one',
  'Lifeboats and liferafts — muster and embarkation stations, emergency escape routes',
  'Fire-fighting appliances — location',
  'Medical equipment — location',
  'Breathing apparatus — location',
  'Emergency radio equipment — location',
  'Escape routes',
  'Garbage disposal — arrangements and where it goes',
  'Fire and abandon ship — muster, man overboard, fire or smoke detected, the alarm sounded; raising the alarm, using a portable extinguisher, talking to others on elementary safety',
  'Emergency teams — the seafarer’s own duties in an emergency',
  'Muster list updated with the new arrival',
  `## Section 2 — Safety, cyber security and specific duties | ${TICK}`,
  'All personnel — safety arrangements; safety symbols, signs and alarm signals',
  'Deck — organisation of duties; pump room emergency alarms',
  'The seafarer’s routine duties and the equipment or installations they will use',
  'Engine — organisation of duties',
  'Engine room emergency alarms',
  'Oily water separator',
  'Protective clothing and work permits (enclosed space entry, hot work)',
  'Drug and alcohol policy',
  'Immediate action on an accident or medical emergency, before further medical help',
  'Closing and opening fire, weathertight and watertight doors (other than hull openings)',
  'Personal devices — USB sticks, phones, tablets — under the cyber security policy',
  '@sign Familiarised',
  '@sign Familiarised by',
];

// Routine bridge and engine checklists, added 17 Oct 2026 after STCW A-VIII/2
// Part 3 (watchkeeping at sea), SOLAS V/34 (safe navigation) and the IAMSAR /
// MERSAR muster-list cards for emergencies.
const PREP_SEA: string[] = [
  '@field From port',
  '@field Pilot station / sea area',
  `## Pre-departure | ${DONE}`,
  'Passage plan ready — berth to berth, approved by the Master (SOLAS V/34)',
  'Charts and publications corrected to date; ECDIS updated and route checked',
  'Weather and tide forecast obtained; UKC and air draught calculated for the passage',
  'NAVTEX / Inmarsat SafetyNET warnings and NAVAREA warnings read',
  'Ship’s clocks and GMDSS clocks synchronised',
  'Hours of rest for departure team confirmed (STCW VIII/1)',
  `## Bridge equipment | ${DONE}`,
  'Steering tested — manual, auto and emergency, both motors, hard-over times recorded',
  'Rudder angle, rate-of-turn and course indicators checked against repeaters',
  'Both gyros slaved and compared with magnetic compass; last error recorded',
  'Both radars tested, head-up / north-up, true motion, AIS overlay',
  'ECDIS tested, backup display on; paper fallback where carried',
  'Echo sounder, log, DGPS, AIS, VDR, BNWAS, SART and EPIRB tested',
  'Autopilot off-course and off-track alarms tested',
  'Internal communications — bridge to engine, mooring stations, bow and stern thruster, PA',
  'VHF channels 16 and 13 on; port and pilot channels set',
  'Navigation lights and signal shapes checked; day signals ready',
  'Whistle, bell and gong tested',
  'Bridge recorder (VDR / BNWAS) running',
  `## Deck and hull | ${DONE}`,
  'Decks and lashings secured for sea; derricks and cranes stowed',
  'Watertight doors, hatches, side ports and bow doors closed and reported',
  'Pilot ladder stowed; shell plugs in',
  'Anchors ready and clear',
  `## Engine room | ${DONE}`,
  'Main engine tested ahead and astern on air, then fuel; movements logged',
  'Steering and rudder tested from the engine room position',
  'Stand-by generator on auto-start; power management tested',
  'Fuel, lube oil and cooling systems lined up for sea',
  'Bilges checked and pumped as needed; OWS line-up as planned',
  'Starting air pressure full; emergency air available',
  'Boilers, incinerator and OWS secured as per sailing',
  `## Readiness | ${DONE}`,
  'Draughts fore, aft and midships recorded; trim and list acceptable',
  'Stability conditions and loadline marks within limits',
  'Pilot card completed; Master–Pilot information exchange ready',
  'Crew list, cargo and dangerous-goods documents ready for departure',
  'Garbage, oil and sewage records up to date',
  'Harbour and port State formalities completed',
  '@text Remarks',
  '@sign Checked by',
  '@sign Master',
];
const PREP_ARRIVAL: string[] = [
  '@field To port',
  '@field Pilot station / arrival time',
  `## Passage plan | ${DONE}`,
  'Pilot station, berth and anchorage marked; passage plan complete to the berth',
  'Latest weather, tide, UKC and air draught checked',
  'Port State and agent requirements known (restricted areas, tugs, line boat)',
  'NAVTEX and local notices checked; ETA sent as agreed',
  'Hours of rest for arrival team confirmed',
  `## Bridge | ${DONE}`,
  'Both radars on, scanners clear',
  'ECDIS set up for the arrival; alarms (UKC, safety contour, areas) checked',
  'Both gyros compared; magnetic compass checked and error recorded',
  'Steering tested — manual, auto and emergency; hard-over times recorded',
  'Autopilot off; manual steering ready; helmsman briefed',
  'Echo sounder on; depth alarms set',
  'Internal communications tested — bridge, engine, mooring stations and gangway',
  'VHF — 16 and the port and pilot channels on',
  'Nav lights on; signals ready; whistle tested',
  'Pilot card updated; Master–Pilot information exchange ready',
  'Pilot ladder rigged on correct side, pilot flag G/H as needed',
  `## Engine room | ${DONE}`,
  'Main engine on stand-by; thrusters tested',
  'Stand-by generator synchronised; power management set for manoeuvring',
  'Steering tested from engine room; rudder free',
  'Fuel system set for manoeuvring (change-over to low-sulphur or MGO where required)',
  'Boilers, cooling and lube oil systems lined up',
  'Compressed air bottles full; emergency air available',
  `## Deck | ${DONE}`,
  'Mooring stations manned and briefed; messengers and tails ready',
  'Anchors cleared, cable party briefed',
  'Line boat / tugs confirmed',
  'Garbage, ISPS and declaration paperwork ready for inspection',
  `## Ship security | ${DONE}`,
  'Current security level set; Declaration of Security if asked for',
  'Gangway watch briefed; ID cards ready for issue',
  '@text Remarks',
  '@sign Checked by',
  '@sign Master',
];
const PILOTAGE: string[] = [
  '@field Pilot name',
  '@field Pilot station',
  `## Master–Pilot exchange | ${DONE}`,
  'Pilot card and passage plan to the berth passed to the pilot',
  'Pilot briefed on draught, trim, list, air draught and manoeuvring characteristics',
  'Berthing side, tugs, line boat and ETA agreed',
  'Bridge team composition and roles agreed (Master in command of the vessel)',
  'Communications: VHF channels, English on the bridge, whistle signals',
  'Weather, tide and current for the passage reviewed',
  'Any defects or restrictions of the vessel told to the pilot',
  `## Bridge during pilotage | ${DONE}`,
  'Helmsman on the wheel; manual steering engaged',
  'ECDIS and radars on the pilot’s side, positions compared independently (SOLAS V/19)',
  'Depth and position monitored; UKC within limits',
  'VHF monitored; orders repeated back',
  'Chart position fixed at agreed intervals',
  'Changes to the plan agreed and recorded',
  'The Master or OOW challenges a dangerous order ("question the pilot")',
  'Pilot disembarkation / embarkation: ladder correctly rigged and manned',
  '@text Remarks (any disagreement with the pilot and how it was resolved)',
  '@sign Pilot',
  '@sign Master / OOW',
];
const RESTRICTED_VIS: string[] = [
  '@field Visibility',
  '@field Sea area',
  `## Actions on reduced visibility | ${DONE}`,
  'Master informed',
  'Engine room informed, engines on stand-by',
  'Manual steering engaged, extra helmsman called if needed',
  'Speed reduced to a safe speed (COLREG rule 6 and 19); ready to stop',
  'Lookouts posted (COLREG rule 5); listening watch kept outside the wheelhouse',
  'Navigation lights switched on',
  'Fog signals sounded as required (COLREG rule 35)',
  'Both radars on; ARPA used; VHF 16 monitored',
  'Watertight doors closed as per the Master’s standing orders',
  'Position fixed and plotted at closer intervals',
  'Entries made in the Bridge log — time of entry and exit of fog, actions',
  '@text Remarks',
  '@sign OOW',
  '@sign Master',
];
const HEAVY_WEATHER: string[] = [
  '@field Wind force / direction',
  '@field Sea state',
  `## Preparations for heavy weather | ${DONE}`,
  'Master informed; weather forecast and routing reviewed',
  'All deck openings secured — hatch covers, side ports, ventilators, doors',
  'Watertight doors closed; deadlights down',
  'Deck cargo, cranes, derricks, stores and anchors re-lashed and secured',
  'Mushroom and gooseneck vents turned downwind or closed',
  'Boats, davits and liferafts checked, secured, lashings tight',
  'Freeing ports clear and operative',
  'Loose gear on deck, in galley and in accommodation stowed',
  'Course and speed adjusted to the sea; synchronous rolling, slamming and pooping avoided',
  'Pumping and transfer stopped; free surfaces minimised',
  'Crew briefed; movement on deck restricted; lifelines rigged if used',
  'Stand-by generator on auto-start; emergency equipment ready',
  'Entries made in the Bridge and Engine log',
  '@text Remarks',
  '@sign OOW',
  '@sign Master',
];
// Emergency cards — IMO muster-list / SOLAS III/8: what the OOW DOES NOW. One
// book, one card per kind of emergency, signed on completion by the OOW.
const EMERGENCY_FIRE: string[] = [
  '@field Where (space / deck)',
  '@field What is on fire',
  `## On the bridge | ${DONE}`,
  'Fire alarm sounded (continuous ringing of the bells and the whistle)',
  'Master informed; Chief Engineer informed',
  'Position, time and nature noted; distress message prepared (not yet sent)',
  'Course altered to put wind astern of the fire if practicable',
  'Ventilation to the space stopped; dampers and fire flaps closed',
  'Watertight and fire doors closed as required',
  'ECDIS and GMDSS equipment manned; VHF 16 monitored',
  'Nearby traffic warned (Securité / Pan Pan if risk to others)',
  'DSC distress ready to be sent if the fire is out of control',
  `## Fire party and support | ${DONE}`,
  'Fire parties mustered at their stations; roles taken from the muster list',
  'Fire main pressurised; boundaries cooled',
  'Fixed systems ready (CO2 / foam / water mist); release only on the Master’s order after the space is evacuated and all openings closed',
  'BA sets, communications and backup teams ready',
  'Hospital stand-by; casualties accounted for',
  'Isolate fuel, electrical power and ventilation to the space',
  '@text Remarks (what was done, what worked, what did not)',
  '@sign OOW',
];
const EMERGENCY_MOB: string[] = [
  '@field Side (port / starboard)',
  '@field Person reported overboard',
  `## Immediate actions on the bridge | ${DONE}`,
  'Lifebuoy with light and smoke released on the side the person went over',
  'Williamson turn (or Scharnow / single turn) started; wheel hard over to the side the person fell',
  'Engines on stand-by; speed reduced',
  '"Oscar" flag raised in daylight; three long whistle blasts',
  'MOB button pressed on GPS / ECDIS; position marked',
  'Lookouts posted — person in the water kept in sight',
  'Master informed; Chief Engineer informed',
  'Muster rescue boat crew; rescue boat prepared for launching',
  'Mayday / Urgency broadcast on VHF 16 as appropriate',
  'Nearby vessels and shore authorities informed; AIS message',
  'Head count; cause and time logged',
  'Return to the position; recover the person; medical team on stand-by',
  '@text Remarks',
  '@sign OOW',
];
const EMERGENCY_ABANDON: string[] = [
  '@field Reason',
  '@field Position when abandoning',
  `## Before the order to abandon ship | ${DONE}`,
  'Only the Master orders abandon ship',
  'Mayday sent on DSC and VHF 16; EPIRB readied',
  'Position, time and nature confirmed; last known position written down',
  'All crew and persons on board mustered at their stations with lifejackets and immersion suits',
  'Rescue craft, SART and EPIRB taken to the survival craft',
  'Documents prepared (crew list, passenger list, logs) if time allows',
  `## Abandoning | ${DONE}`,
  'Order given on the PA and by the general alarm (seven short, one long)',
  'Boats and rafts launched into the lee side',
  'Head count at every craft; muster list signed off',
  'EPIRB activated; SART switched on in each craft',
  'Cold water precautions; stay together, stay with the ship until she goes',
  'Watch for other vessels and aircraft',
  '@text Remarks',
  '@sign Master',
];
const EMERGENCY_COLLISION: string[] = [
  '@field Other vessel',
  '@field Side struck / struck by',
  `## Immediately after a collision | ${DONE}`,
  'Both vessels stopped if safe; engines on stand-by',
  'General alarm; Master informed; Chief Engineer informed',
  'Watertight doors and fire doors closed; damage control party sent to inspect',
  'Position, time, course and speed of both vessels recorded; VDR saved',
  'Draughts and list checked; stability reviewed',
  'Fuel and oil spills checked; SOPEP ready; Oil Record Book entry prepared',
  'Casualties accounted for; hospital stand-by',
  'VHF 16 — communication with the other vessel; identity exchanged',
  'Flag State and shore authority notified; owners and P&I informed',
  'Decision whether to stay close for assistance (COLREG rule 2 and Convention on Salvage)',
  'If seaworthy and the other vessel does not need help, proceed to a port of refuge or continue',
  '@text Remarks',
  '@sign OOW',
  '@sign Master',
];
const EMERGENCY_GROUNDING: string[] = [
  '@field Position',
  '@field Bottom (rock / sand / mud)',
  `## Immediately after grounding | ${DONE}`,
  'Engines stopped; main engine not re-started until a damage assessment is made',
  'General alarm; Master informed; Chief Engineer informed',
  'Not Under Command / Aground signals shown; "D" flag by day',
  'Watertight doors closed; sounding of tanks, bilges and voids',
  'Draughts and list checked; hull inspection by the damage control party',
  'Position, time, course and speed recorded; VDR saved',
  'Fuel and oil leakage checked; SOPEP ready',
  'VHF 16; nearby traffic warned (Securité / Pan Pan as appropriate)',
  'Flag State, port authority and owners informed; salvage considered',
  'Any attempt to refloat only on the Master’s decision after assessment',
  '@text Remarks',
  '@sign OOW',
  '@sign Master',
];
const EMERGENCY_FLOODING: string[] = [
  '@field Where (compartment)',
  '@field Suspected cause',
  `## Immediately on flooding | ${DONE}`,
  'General alarm; Master informed; Chief Engineer informed',
  'Watertight and fire doors closed; the space isolated',
  'Damage control party sent to find and stop the ingress',
  'Bilge and ballast pumps on the affected space; cross-connections set',
  'Soundings of all tanks, bilges and voids; stability reviewed',
  'Draughts and list monitored; course and speed adjusted',
  'Fuel and oil leakage checked; SOPEP as needed',
  'Position, time, course and speed recorded; VDR saved',
  'VHF 16; nearest shore authority informed; Pan Pan / Mayday as appropriate',
  '@text Remarks',
  '@sign OOW',
  '@sign Master',
];

const tb = (book: CheckBook, id: string, title: string, where: DpWhere, lines: string[]): DpTemplate => ({ ...t(id, title, where, lines), book });

/** The bridge and engine checklists the app ships. */
export const WATCH_TEMPLATES: DpTemplate[] = [
  tb('bridge', 'bridge.handover', 'Bridge watch handover', 'bridge', BRIDGE_HANDOVER),
  tb('engine', 'engine.handover', 'Engine room watch handover', 'engine', ENGINE_HANDOVER),
  tb('bridge', 'bridge.signoff', 'Sign-on / sign-off handover — deck officer', 'bridge', DECK_SIGNOFF),
  tb('engine', 'engine.signoff', 'Sign-on / sign-off handover — engineer', 'engine', ENGINE_SIGNOFF),
  tb('fam-safety', 'fam.safety', 'Safety familiarisation — within 24 hours', 'bridge', FAM_SAFETY),
  tb('fam-bridge', 'fam.bridge', 'Bridge familiarisation', 'bridge', FAM_BRIDGE),
  tb('fam-engine', 'fam.engine', 'Engine familiarisation', 'engine', FAM_ENGINE),
  tb('fam-project', 'fam.project', 'Project crew familiarisation', 'bridge', FAM_PROJECT),
  tb('fam-pax', 'fam.pax', 'Passenger familiarisation — safety briefing', 'bridge', FAM_PAX),
  tb('fam-dp', 'fam.dp', 'DP familiarisation', 'bridge', FAM_DP),
  // Bridge checklists under STCW A-VIII/2 Part 3 and SOLAS V/34.
  tb('bridge-sea', 'bridge.prep.sea', 'Preparation for sea — bridge and engine', 'bridge', PREP_SEA),
  tb('bridge-arrival', 'bridge.prep.arrival', 'Preparation for arrival — bridge and engine', 'bridge', PREP_ARRIVAL),
  tb('bridge-pilot', 'bridge.pilotage', 'Pilotage — Master / Pilot information exchange', 'bridge', PILOTAGE),
  tb('bridge-vis', 'bridge.restricted', 'Navigation in restricted visibility', 'bridge', RESTRICTED_VIS),
  tb('bridge-weather', 'bridge.heavy', 'Heavy weather preparations', 'bridge', HEAVY_WEATHER),
  // Emergency cards (SOLAS III/8, IAMSAR): what the OOW does now, card by card.
  tb('emergency', 'emergency.fire', 'Emergency — fire on board', 'bridge', EMERGENCY_FIRE),
  tb('emergency', 'emergency.mob', 'Emergency — man overboard', 'bridge', EMERGENCY_MOB),
  tb('emergency', 'emergency.abandon', 'Emergency — abandon ship', 'bridge', EMERGENCY_ABANDON),
  tb('emergency', 'emergency.collision', 'Emergency — collision', 'bridge', EMERGENCY_COLLISION),
  tb('emergency', 'emergency.grounding', 'Emergency — grounding', 'bridge', EMERGENCY_GROUNDING),
  tb('emergency', 'emergency.flooding', 'Emergency — flooding', 'bridge', EMERGENCY_FLOODING),
];

/** What the vessel works to: the built-ins as reworded, the vessel's own, without the switched-off. */
export function templatesNow(own: DpTemplate[], book: CheckBook = 'dp'): DpTemplate[] {
  const shipped = book === 'dp' ? DP_TEMPLATES : WATCH_TEMPLATES.filter((x) => x.book === book);
  const byId = new Map(own.map((x) => [x.id, x]));
  const builtIn = shipped.map((b) => byId.get(b.id) ?? b);
  const extra = own.filter((x) => (x.book ?? 'dp') === book && !shipped.some((b) => b.id === x.id) && !DP_TEMPLATES.some((b) => b.id === x.id) && !WATCH_TEMPLATES.some((b) => b.id === x.id));
  return [...builtIn, ...extra].filter((x) => !x.off).map((x) => (x.lines.some((l) => l.hidden) ? { ...x, lines: x.lines.filter((l) => !l.hidden) } : x));
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

/** Answers that mean something is wrong when the line does not say ("!"): No, No good. */
export const BAD_ANSWERS = ['fail', 'No', 'No good', 'Not available'];

const isBad = (v: string | undefined, def: { options?: string[]; bad?: string[] }) =>
  !!v && (def.options ? (def.bad ?? []).includes(v) : BAD_ANSWERS.includes(v));
export const answerIsBad = isBad;

/** What a plain line's answer prints as. */
/** "Other" opens a cell to write in (16 Oct 2026); what is written is kept beside the answer. */
export const isOther = (v?: string) => !!v && /^other$/i.test(v.trim());
export const otherKey = (key: string) => `${key}#other`;
const withOther = (v: string | undefined, key: string, c: Pick<DpCheck, 'values'>) => (isOther(v) && c.values?.[otherKey(key)]?.trim() ? `${v}: ${c.values[otherKey(key)].trim()}` : v ?? '');

export function answerText(l: DpLine, c: Pick<DpCheck, 'results' | 'values'>): string {
  const r = c.results[l.id];
  const a = r === 'pass' ? 'Yes' : r === 'fail' ? 'No' : r === 'na' ? 'N/A' : withOther(r, l.id, c);
  const v = c.values?.[l.id]?.trim();
  return [a, v ? `${l.value}: ${v}` : ''].filter(Boolean).join(' · ');
}

/** A table row's cells as they print. */
/** Who signs: the checklist's own roles ("@sign SDPO", "@sign DPO"), else handing over and taking over. */
export function signRoles(c: Pick<DpCheck, 'lines'> & { byRole?: string; by2Role?: string }): [string, string] {
  if (c.byRole || c.by2Role) return [c.byRole ?? 'Signed', c.by2Role ?? 'Signed'];
  const own = c.lines.filter((l) => l.kind === 'sign').map((l) => l.text);
  return [own[0] ?? 'Handing over', own[1] ?? 'Taking over'];
}

/** Does this row have a cell in that column? */
export const hasCell = (l: DpLine, col: DpCol) => !(l.skip ?? []).some((x) => x.toLowerCase() === col.name.toLowerCase());

export const rowCells = (l: DpLine, cols: DpCol[], c: Pick<DpCheck, 'results' | 'values'>) =>
  cols.map((col, i) => !hasCell(l, col) ? ' ' : (col.options ? withOther(c.results[cellKey(l.id, i)], cellKey(l.id, i), c) : c.values?.[cellKey(l.id, i)]?.trim()) || '');

export const ASOG_LABEL: Record<AsogStatus, string> = { green: 'Green', blue: 'Advisory', yellow: 'Yellow', red: 'Red' };

export function checkOutcome(c: Pick<DpCheck, 'lines' | 'results'> & { values?: Record<string, string> }): { pass: number; fail: number; na: number; open: number } {
  const r = { pass: 0, fail: 0, na: 0, open: 0 };
  const table = sectionCols(c.lines);
  for (const l of c.lines) {
    if (l.head || l.kind) continue;
    const cols = table.get(l.id);
    if (cols) {
      // A row: answered when any cell is; wrong when a cell holds a "!" answer.
      const cells = rowCells(l, cols, c);
      if (cols.some((col, i) => col.options && isBad(cells[i], col))) r.fail++;
      else if (cells.some(Boolean)) r.pass++;
      else r.open++;
      continue;
    }
    const v = c.results[l.id];
    if (!l.options && l.value) {
      if (c.values?.[l.id]?.trim()) r.pass++;
      else r.open++;
    } else if (!v) r.open++;
    else if (v === 'na' || v === 'N/A') r.na++;
    else if (isBad(v, l)) r.fail++;
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

/** 57°12.3'N — written as the record books write it (utils/position.ts). */
export function coordText(v: number, kind: 'lat' | 'lon'): string {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 600) / 10;
  if (m >= 60) { d += 1; m = 0; }
  const h = kind === 'lat' ? (v < 0 ? 'S' : 'N') : v < 0 ? 'W' : 'E';
  return `${String(d).padStart(kind === 'lat' ? 2 : 3, '0')}°${m.toFixed(1).padStart(4, '0')}'${h}`;
}

/** "57°12.3'N 001°23.5'W" (PositionInput) → degrees; undefined unless both halves read. */
export function positionFromText(text: string): DpPosition | undefined {
  const [a, b] = (text ?? '').trim().split(/\s+(?=\d)/);
  const lat = parseCoord(a ?? '', 'lat');
  const lon = parseCoord(b ?? '', 'lon');
  return lat == null || lon == null ? undefined : { lat, lon };
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

/**
 * What a device keeps of a kept-for-days list (firebaseService keepDays): every
 * record from the cutoff on, and any older one not yet known to be in the cloud
 * (`sent` — id → updatedAt pushed). Pure.
 */
export function keepRecent<T extends { id: string; updatedAt: number; at?: number }>(list: T[], sent: Record<string, number>, cutoff: number): T[] {
  return list.filter((r) => (r.at ?? r.updatedAt ?? 0) >= cutoff || (sent[r.id] ?? -1) < (r.updatedAt ?? 0));
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
