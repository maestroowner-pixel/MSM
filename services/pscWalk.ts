// ===================================
// PSC walk-round — the findings a port State inspector writes most often, as a
// list to walk the vessel with before the visit (plan item 46, 13 Nov 2026).
// Inspection readiness (services/readiness.ts) answers from the records the app
// holds; this answers from the ship itself — a fire door wedged open, an air
// pipe seized — which no record shows. Grouped by place, the way it is walked.
//
// Each check names the regulation and, where the regions publish one, the
// figure that put it on the list. FIGURES COME ONLY FROM THE MOUs' OWN ANNUAL
// REPORTS (PSC_STATS.source) — never estimated; when a new report is out,
// replace the year's block, do not mix years. USCG is left out: its report
// site refuses automated reading, and a figure we cannot check is not shown.
//
// The marks are a draft on this device (`msm:psc_walk`, like the handover
// notes) — nothing syncs; the PDF is what goes to the Master. Check ids are
// PERMANENT: they key the stored marks. Pure, checked by `npm run check:pscwalk`.
// ===================================

import { ModuleKey } from '../constants/modules';

export const PSC_WALK_KEY = 'msm:psc_walk';

export type PscPlace = 'fire' | 'lsa' | 'deck' | 'bridge' | 'engine' | 'accommodation' | 'papers';

export const PLACE_LABEL: Record<PscPlace, string> = {
  fire: 'Fire safety — throughout the ship',
  lsa: 'Life-saving appliances and drills',
  deck: 'Open deck — weathertight and emergency',
  bridge: 'Bridge and radio',
  engine: 'Engine room',
  accommodation: 'Accommodation, galley and the crew (MLC)',
  papers: 'Papers and the ISM system',
};
export const PLACES = Object.keys(PLACE_LABEL) as PscPlace[];

export interface PscCheck {
  /** Permanent — the key of the stored mark. */
  id: string;
  place: PscPlace;
  text: string;
  ref: string;
  /** Why it is on the list — from PSC_STATS, with the region and year. */
  stat?: string;
  /** Where the app keeps the records that prove it; shown only when its module is on. */
  route?: string;
  params?: Record<string, unknown>;
  module?: ModuleKey;
}

const T25 = 'Tokyo MOU 2025';
const P25 = 'Paris MoU 2025';

export const PSC_CHECKS: PscCheck[] = [
  { id: 'fire.doors', place: 'fire', text: 'Fire doors close and latch on their own; no hooks, wedges or tie-backs; self-closers, seals and hold-back magnets work', ref: 'SOLAS II-2/9', stat: `${P25}: fire doors are 3.1% of all deficiencies — the single most frequent` },
  { id: 'fire.fixed', place: 'fire', text: 'Fixed fire-extinguishing system: cylinders and valves within service date, release instructions posted, the alarm sounds before release', ref: 'FSS Code ch. 5', stat: `${T25}: the most frequent detainable deficiency (215)`, route: 'Equipment' },
  { id: 'fire.pumps', place: 'fire', text: 'Emergency fire pump starts and gives pressure at the highest hydrant; hydrants, hoses and nozzles complete and not leaking', ref: 'SOLAS II-2/10.2', stat: `${T25}: detainable 118 times`, route: 'Equipment' },
  { id: 'fire.detection', place: 'fire', text: 'Fire detection: a detector tested in front of you, the panel shows no faults or zones switched off', ref: 'SOLAS II-2/7', stat: `${T25}: detainable 114 times` },
  { id: 'fire.remote', place: 'fire', text: 'Remote stops of fuel pumps and fans, and quick-closing valves, work from outside the machinery space', ref: 'SOLAS II-2/5', stat: `${T25}: detainable 109 times` },
  { id: 'fire.dampers', place: 'fire', text: 'Fire dampers move freely, are marked open / closed, and close from where the plan says', ref: 'SOLAS II-2/9.7', stat: `${T25}: detainable 106 times` },
  { id: 'fire.plan', place: 'fire', text: 'Fire control plan posted and current; a copy in the weathertight box outside the accommodation', ref: 'SOLAS II-2/15.2.4' },
  { id: 'fire.outfits', place: 'fire', text: "Firefighter's outfits complete; breathing apparatus charged, spare cylinders full, EEBDs in place and in date", ref: 'SOLAS II-2/10.10, 13.3.4', route: 'Equipment' },
  { id: 'lsa.lifeboats', place: 'lsa', text: 'Lifeboats and rescue boat: engine starts, release gear and on-load hooks serviced, falls turned or renewed in date', ref: 'SOLAS III/20; MSC.402(96)', stat: `${T25}: detainable 152 times; life-saving appliances are 13.1% of all deficiencies`, route: 'Equipment' },
  { id: 'lsa.liferafts', place: 'lsa', text: 'Liferafts and hydrostatic release units within service date; painters made fast to the weak link, not the ship', ref: 'SOLAS III/20.8', route: 'Equipment' },
  { id: 'lsa.lifebuoys', place: 'lsa', text: 'Lifebuoys with their lights, smoke signals and lines; lifejacket lights in date; markings with the ship\'s name', ref: 'SOLAS III/7, 32; LSA Code', route: 'Equipment' },
  { id: 'lsa.drills', place: 'lsa', text: 'Abandon-ship and fire drills held and recorded at the intervals; asked, each crew member can show their muster duty', ref: 'SOLAS III/19', route: 'Drills', module: 'drills' },
  { id: 'lsa.muster', place: 'lsa', text: 'Muster list posted, matching the crew aboard today; emergency instructions in the cabins', ref: 'SOLAS III/8, 37' },
  { id: 'deck.vents', place: 'deck', text: 'Air pipes and ventilator closing devices move freely, seals and floats intact, marked', ref: 'Load Line Convention, reg. 19–20', stat: `${T25}: detainable 138 times` },
  { id: 'deck.closures', place: 'deck', text: 'Weathertight doors and hatch covers: gaskets, dogs and cleats complete and tight', ref: 'Load Line Convention, reg. 12–16' },
  { id: 'deck.emergency', place: 'deck', text: 'Emergency generator starts and takes the load; emergency lighting on the escape routes works', ref: 'SOLAS II-1/42–43', stat: `${T25}: emergency systems 5,950 deficiencies` },
  { id: 'bridge.charts', place: 'bridge', text: 'Charts and nautical publications corrected to date, or ECDIS with current updates and its back-up', ref: 'SOLAS V/19, 27', stat: `${T25}: safety of navigation is 9.9% of all deficiencies` },
  { id: 'bridge.passage', place: 'bridge', text: 'Passage plan berth to berth for the voyage in hand', ref: 'SOLAS V/34' },
  { id: 'bridge.equipment', place: 'bridge', text: 'Radar, AIS, BNWAS and the VDR work; VDR annual performance test certificate aboard', ref: 'SOLAS V/18–20' },
  { id: 'bridge.gmdss', place: 'bridge', text: 'GMDSS tests logged daily, weekly and monthly; EPIRB and SART batteries and releases in date', ref: 'SOLAS IV', route: 'Gmdss', module: 'gmdss' },
  { id: 'engine.ows', place: 'engine', text: 'Oily water separator and its 15 ppm alarm work; no bypass or loose hose to overboard', ref: 'MARPOL Annex I, reg. 14', stat: `${T25}: detainable 92 times`, route: 'OilRecord', module: 'orb' },
  { id: 'engine.orb', place: 'engine', text: 'Oil Record Book complete, each page signed by the Master, figures agreeing with the tanks', ref: 'MARPOL Annex I, reg. 17', route: 'OilRecord', module: 'orb' },
  { id: 'engine.clean', place: 'engine', text: 'No oil leaks or oil-soaked lagging round engines and purifiers; hot surfaces insulated; bilges clean', ref: 'SOLAS II-2/4.2' },
  { id: 'engine.maintenance', place: 'engine', text: 'Planned maintenance up to date; every overdue job has a reason or a deferral', ref: 'ISM Code 10', stat: `${T25}: maintenance of the ship and equipment detainable 104 times`, route: 'Maintenance', module: 'pms' },
  { id: 'mlc.sea', place: 'accommodation', text: "Seafarers' employment agreements signed, a copy aboard, wages paid as agreed", ref: 'MLC 2.1, 2.2', stat: `${P25}: 1.3% of all deficiencies` },
  { id: 'mlc.rest', place: 'accommodation', text: 'Hours of rest recorded for everyone and within the limits; the table of working arrangements posted', ref: 'MLC 2.3; STCW VIII/1', route: 'HoursOfRest', module: 'rest' },
  { id: 'mlc.medical', place: 'accommodation', text: "Medicine chest stocked to the flag's scale, nothing out of date; the medical guide aboard", ref: 'MLC 4.1', stat: `${P25}: health, medical care and welfare (MLC Title IV) are 10.0% of all deficiencies`, route: 'Hospital', module: 'hospital' },
  { id: 'mlc.galley', place: 'accommodation', text: 'Galley and provision stores clean; fridge and freezer temperatures logged; grease filters and ducts clean', ref: 'MLC 3.2; SOLAS II-2/4' },
  { id: 'papers.certificates', place: 'papers', text: "Ship's certificates valid and endorsed; officers' certificates of competency and medicals in date", ref: 'SOLAS I/12; STCW I/2', route: 'Certificates' },
  { id: 'papers.garbage', place: 'papers', text: 'Garbage record book, placards and the garbage management plan', ref: 'MARPOL Annex V, reg. 10', route: 'Garbage', module: 'garbage' },
  { id: 'papers.ism', place: 'papers', text: 'ISM: defects raised and acted on, non-conformities closed, internal audit and Master\'s review done — a detainable finding with no record behind it is written up as an ISM failure too', ref: 'ISM Code 9, 10, 12', stat: `${T25}: ISM detainable 200 times; ${P25}: ISM 4.5% of all deficiencies`, route: 'Safety', module: 'qhse' },
];

// ---- Regions -----------------------------------------------------------------

export interface PscRegion {
  key: 'tokyo' | 'paris';
  name: string;
  year: number;
  /** Headline facts, as the report gives them. */
  facts: string[];
  /** Areas by share of all deficiencies, largest first. */
  areas: { label: string; pct: number }[];
  /** Most frequent detainable deficiencies, with the count — where published. */
  detainable: { label: string; n: number }[];
  source: string;
}

export const PSC_STATS: PscRegion[] = [
  {
    key: 'tokyo',
    name: 'Tokyo MOU',
    year: 2025,
    facts: ['35,546 inspections', '90,168 deficiencies', '1,255 detentions (3.53%)'],
    areas: [
      { label: 'Fire safety', pct: 19.98 },
      { label: 'Life-saving appliances', pct: 13.11 },
      { label: 'Working and living conditions', pct: 10.1 },
      { label: 'Safety of navigation', pct: 9.91 },
      { label: 'Pollution prevention', pct: 9.72 },
      { label: 'Load lines', pct: 7.38 },
      { label: 'Stability, structure and equipment', pct: 3.62 },
      { label: 'ISM', pct: 1.48 },
    ],
    detainable: [
      { label: 'Fixed fire-extinguishing installation', n: 215 },
      { label: 'ISM', n: 200 },
      { label: 'Lifeboats', n: 152 },
      { label: 'Ventilators, air pipes, casings', n: 138 },
      { label: 'Fire pumps and their pipes', n: 118 },
      { label: 'Fire detection and alarm system', n: 114 },
      { label: 'Remote means of control, machinery spaces', n: 109 },
      { label: 'Fire dampers', n: 106 },
      { label: 'Maintenance of the ship and equipment (ISM)', n: 104 },
      { label: 'Oil filtering equipment (MARPOL Annex I)', n: 92 },
    ],
    source: 'Tokyo MOU Annual Report 2025 — tokyo-mou.org',
  },
  {
    key: 'paris',
    name: 'Paris MoU',
    year: 2025,
    facts: ['16,474 inspections', 'detention rate 4.18% (4.03% in 2024)'],
    areas: [
      { label: 'Fire safety (SOLAS II-2)', pct: 16.8 },
      { label: 'Structure and electrical (SOLAS II-1)', pct: 11.6 },
      { label: 'Health, medical care, welfare (MLC Title IV)', pct: 10.0 },
      { label: 'ISM', pct: 4.5 },
      { label: 'Fire doors', pct: 3.1 },
      { label: "Seafarers' employment agreements", pct: 1.3 },
    ],
    detainable: [],
    source: 'Paris MoU Annual Report 2025 — parismou.org',
  },
];

// ---- Marks -------------------------------------------------------------------

export type PscMark = { s: 'ok' | 'fix'; note?: string; at: number };

export interface PscWalk {
  /** When this walk began, ms. */
  started: number;
  marks: Record<string, PscMark>;
}

export const emptyWalk = (now: number): PscWalk => ({ started: now, marks: {} });

/** A stored walk, read defensively: unknown ids and malformed marks are dropped. */
export function readWalk(raw: unknown, now: number): PscWalk {
  const w = raw as Partial<PscWalk> | null;
  if (!w || typeof w !== 'object' || typeof w.started !== 'number') return emptyWalk(now);
  const ids = new Set(PSC_CHECKS.map((c) => c.id));
  const marks: Record<string, PscMark> = {};
  for (const [id, m] of Object.entries(w.marks ?? {})) {
    if (!ids.has(id) || !m || (m.s !== 'ok' && m.s !== 'fix')) continue;
    marks[id] = { s: m.s, at: typeof m.at === 'number' ? m.at : w.started, ...(typeof m.note === 'string' && m.note.trim() ? { note: m.note } : {}) };
  }
  return { started: w.started, marks };
}

/** Tap the same answer again to clear it; a note survives a change of answer. */
export function mark(w: PscWalk, id: string, s: PscMark['s'], now: number): PscWalk {
  const cur = w.marks[id];
  const marks = { ...w.marks };
  if (cur?.s === s) delete marks[id];
  else marks[id] = { s, at: now, ...(cur?.note ? { note: cur.note } : {}) };
  return { ...w, marks };
}

export function noteOn(w: PscWalk, id: string, note: string, now: number): PscWalk {
  const cur = w.marks[id];
  if (!cur) return w;
  const { note: _old, ...rest } = cur;
  return { ...w, marks: { ...w.marks, [id]: { ...rest, at: now, ...(note.trim() ? { note } : {}) } } };
}

export function walkCount(w: PscWalk) {
  const v = Object.values(w.marks);
  return { done: v.length, total: PSC_CHECKS.length, fix: v.filter((m) => m.s === 'fix').length };
}

const dmy = (ms: number) => new Date(ms).toISOString().slice(0, 10).split('-').reverse().join('.');

/** The PDF's pages, pure — the same table per place, to fill in by hand when printed unmarked. */
export function walkPages(w: PscWalk, now: number) {
  const c = walkCount(w);
  const facts = [
    `walk started ${dmy(w.started)}`,
    `printed ${dmy(now)}`,
    c.done ? `${c.done} of ${c.total} checked, ${c.fix} to put right` : 'not yet marked — tick by hand',
    `figures: ${PSC_STATS.map((r) => `${r.name} ${r.year}`).join(', ')}`,
  ];
  const tables = PLACES.map((p) => ({
    title: PLACE_LABEL[p],
    head: ['Check', 'Reference', 'Why it is here', 'Result', 'Note'],
    rows: PSC_CHECKS.filter((x) => x.place === p).map((x) => {
      const m = w.marks[x.id];
      return [x.text, x.ref, x.stat ?? '', m ? (m.s === 'ok' ? 'OK' : 'TO FIX') : '', m?.note ?? ''];
    }),
    widths: { 0: 95, 1: 34, 2: 70, 3: 16, 4: 50 },
  }));
  // What to put right goes first, so the Master reads it without turning pages.
  const fix = PSC_CHECKS.filter((x) => w.marks[x.id]?.s === 'fix');
  if (fix.length) tables.unshift({ title: 'To put right before the inspection', head: ['Check', 'Reference', 'Why it is here', 'Result', 'Note'], rows: fix.map((x) => [x.text, x.ref, x.stat ?? '', 'TO FIX', w.marks[x.id]?.note ?? '']), widths: { 0: 95, 1: 34, 2: 70, 3: 16, 4: 50 } });
  return [{ title: 'PSC walk-round — the most frequent findings', facts, tables }];
}
