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

import { AsogStatus, DpCheck, DpCol, DpConditions, DpDay, DpInfo, DpLine, DpPosition, DpSlot, DpTemplate, DpWhere } from '../types/dp';

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
  const kind = /^@(field|text|sketch)\s+(.+)$/i.exec(s);
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

/** A checklist's own items: one table, answered and remarked line by line. */
const OWN = (title: string) => `## ${title} | Checked {Yes|!No|N/A} | Remarks`;

export const DP_TEMPLATES: DpTemplate[] = [
  // A copy of the handover sheet — the base (the owner, 16 Oct 2026: "this is the base").
  t('dp.arrival.bridge', 'Field arrival — bridge (before the 500 m zone)', 'bridge', [
    ...HANDOVER,
    // The DP trials data goes here next (the owner, 16 Oct 2026).
  ]),
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

/** What the vessel works to: the built-ins as reworded, the vessel's own, without the switched-off. */
export function templatesNow(own: DpTemplate[]): DpTemplate[] {
  const byId = new Map(own.map((x) => [x.id, x]));
  const builtIn = DP_TEMPLATES.map((b) => byId.get(b.id) ?? b);
  const extra = own.filter((x) => !DP_TEMPLATES.some((b) => b.id === x.id));
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
