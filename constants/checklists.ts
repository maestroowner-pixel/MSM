// ===================================
// Checklist templates — the questions a crew member is actually asked.
//
// One template per (category, period). The lines are deliberately short enough
// to read on a phone in a machinery space with gloves on, and each is a plain
// pass / fail / n-a: an inspection that needs a paragraph gets one, in the
// comment field, but the round itself must stay tappable.
//
// **Line ids are permanent.** They are written into every stored inspection
// (`results` is keyed by them), so a line may be re-worded freely — the record
// still reads back correctly — but an id must never be re-used for a different
// question, and a retired line must not have its id given to another. Bump the
// template `version` whenever the set of lines changes, so a record can say
// which set of questions was actually asked.
//
// Content is standard weekly/monthly LSA/FFE practice, not a citation of any one
// vessel's SMS. It is a sound default; a vessel whose SMS words a check
// differently should be able to say so, which is why the version and the line
// ids are on the record rather than assumed.
// ===================================

import { CategoryKey } from '../types/equipment';
import { InspectionPeriod } from '../types/inspection';

export interface ChecklistLine {
  /** Permanent within a template — see the header. */
  id: string;
  text: string;
  /** Longer prompt shown under the line when the crew member needs it. */
  hint?: string;
}

export interface ChecklistTemplate {
  /** `<category>.<period>` for a built-in; `v.<category>.<period>.<uid>` for one
   *  a vessel wrote. Stored on every inspection record. */
  id: string;
  version: number;
  category: CategoryKey;
  period: InspectionPeriod;
  title: string;
  lines: ChecklistLine[];
  /** Set only on vessel templates — the merge key when two devices edited one. */
  updatedAt?: number;
}

/**
 * A vessel's own template NEVER reuses a built-in id, and that is not cosmetic.
 *
 * Records signed before line snapshots existed (see types/inspection.ts) still
 * resolve their wording through `templateById`. Had a vessel's edited template
 * taken the id `fire_extinguishers.monthly`, every one of those older records
 * would silently start displaying the NEW wording under the OLD signature — the
 * precise retro-active edit this app exists to make impossible. A separate id
 * keeps the built-in reachable for ever, so history reads as it was signed.
 */
export const VESSEL_TEMPLATE_PREFIX = 'v.';

export function isVesselTemplate(t: ChecklistTemplate): boolean {
  return t.id.startsWith(VESSEL_TEMPLATE_PREFIX);
}

const t = (
  category: CategoryKey,
  period: InspectionPeriod,
  title: string,
  lines: ChecklistLine[],
  version = 1
): ChecklistTemplate => ({ id: `${category}.${period}`, version, category, period, title, lines });

// Lines every stowed item is checked for. Spread first so the specific checks
// that follow read as the interesting part of the round.
const STOWAGE: ChecklistLine[] = [
  { id: 'position', text: 'In its marked position' },
  { id: 'access', text: 'Access clear and unobstructed' },
];

export const CHECKLISTS: ChecklistTemplate[] = [
  // ----- LSA ---------------------------------------------------------------
  t('liferafts', 'weekly', 'Liferaft — weekly', [
    { id: 'cradle', text: 'Cradle and lashings secure' },
    { id: 'hru', text: 'HRU correctly rigged and in date', hint: 'Weak link and release cutter fitted the right way round.' },
    { id: 'painter', text: 'Painter made fast to the weak link' },
    { id: 'container', text: 'Container undamaged, bands intact' },
    { id: 'freefloat', text: 'Float-free path clear of obstruction' },
    { id: 'embarkation', text: 'Embarkation area clear and lit' },
  ]),
  t('liferafts', 'monthly', 'Liferaft — monthly', [
    { id: 'service', text: 'Servicing date in date' },
    { id: 'hru_expiry', text: 'HRU expiry date in date' },
    { id: 'markings', text: 'Markings and capacity legible' },
    { id: 'cradle', text: 'Cradle, senhouse slip and lashings free to render' },
    { id: 'container', text: 'Container undamaged, no water ingress' },
  ]),
  t('lifebuoys', 'monthly', 'Lifebuoy — monthly', [
    ...STOWAGE,
    { id: 'quick_release', text: 'Quick-release arrangement free to operate' },
    { id: 'body', text: 'Body undamaged, grab lines sound' },
    { id: 'light', text: 'Self-igniting light fitted and in date' },
    { id: 'smoke', text: 'Self-activating smoke fitted and in date', hint: 'Where required for this buoy.' },
    { id: 'line', text: 'Buoyant lifeline attached and serviceable', hint: 'Where required for this buoy.' },
    { id: 'markings', text: "Vessel's name and port of registry legible" },
    { id: 'retro', text: 'Retro-reflective tape intact' },
  ]),
  t('lifejackets', 'monthly', 'Lifejacket — monthly', [
    ...STOWAGE,
    { id: 'condition', text: 'Jacket clean, undamaged, no perishing' },
    { id: 'straps', text: 'Straps, buckles and stitching sound' },
    { id: 'whistle', text: 'Whistle attached' },
    { id: 'light', text: 'Light attached, battery in date' },
    { id: 'retro', text: 'Retro-reflective tape intact' },
  ]),
  t('inflatable_lifejackets', 'monthly', 'Inflatable lifejacket — monthly', [
    ...STOWAGE,
    { id: 'indicator', text: 'Status indicator green' },
    { id: 'cylinder', text: 'Gas cylinder charged and screwed fully home', hint: 'Weigh if in any doubt.' },
    { id: 'cartridge', text: 'Auto-inflation cartridge in date' },
    { id: 'bladder', text: 'Bladder and cover undamaged' },
    { id: 'oral', text: 'Oral inflation tube and cap serviceable' },
    { id: 'light', text: 'Light fitted, battery in date' },
  ]),
  t('immersion_suits', 'monthly', 'Immersion suit — monthly', [
    ...STOWAGE,
    { id: 'condition', text: 'Suit undamaged, no tears or perishing' },
    { id: 'zip', text: 'Zip runs freely, waxed' },
    { id: 'seals', text: 'Face, wrist and ankle seals intact' },
    { id: 'light', text: 'Light fitted, battery in date' },
    { id: 'whistle', text: 'Whistle attached' },
    { id: 'retro', text: 'Retro-reflective tape intact' },
  ]),
  t('mob', 'weekly', 'MOB boat / davit — weekly', [
    { id: 'engine', text: 'Engine started and run ahead and astern' },
    { id: 'fuel', text: 'Fuel sufficient and clean' },
    { id: 'hull', text: 'Boat and fittings visually sound' },
    { id: 'falls', text: 'Falls, hooks and release gear inspected' },
    { id: 'brake', text: 'Davit and winch brake tested' },
    { id: 'painter', text: 'Painter secured and clear' },
    { id: 'inventory', text: 'Boat equipment inventory complete' },
  ]),
  t('mob', 'monthly', 'MOB boat / davit — monthly', [
    { id: 'inventory', text: 'Full equipment inventory checked against list' },
    { id: 'lowering', text: 'Boat swung out and lowered to embarkation level', hint: 'Where the SMS requires it and it is safe to do so.' },
    { id: 'wires', text: 'Falls end-for-ended / renewal date in date' },
    { id: 'greasing', text: 'Davit, sheaves and moving parts greased' },
    { id: 'battery', text: 'Engine battery charged and terminals clean' },
  ]),
  t('plb', 'monthly', 'PLB — monthly', [
    ...STOWAGE,
    { id: 'selftest', text: 'Self-test performed and passed' },
    { id: 'battery', text: 'Battery expiry in date' },
    { id: 'registration', text: 'Registration current' },
    { id: 'casing', text: 'Casing and lanyard undamaged' },
  ]),
  t('harnesses', 'monthly', 'Harness / fall arrest — monthly', [
    { id: 'webbing', text: 'Webbing free of cuts, abrasion, burns, chemical damage' },
    { id: 'stitching', text: 'All stitching intact' },
    { id: 'hardware', text: 'Buckles, D-rings and adjusters undamaged' },
    { id: 'hooks', text: 'Karabiner / snap hook gates and locks operate' },
    { id: 'lanyard', text: 'Lanyard and energy absorber unused and sound' },
    { id: 'label', text: 'Identification label legible, inspection in date' },
  ]),
  t('gmdss_pyro', 'weekly', 'EPIRB / SART / pyrotechnics — weekly', [
    { id: 'epirb_test', text: 'EPIRB self-test performed and passed' },
    { id: 'epirb_mount', text: 'EPIRB in float-free bracket, path clear' },
    { id: 'sart_test', text: 'SART self-test performed and passed' },
    { id: 'sart_stow', text: 'SART stowed in its bracket, ready for use' },
    { id: 'pyro_stow', text: 'Pyrotechnics stowed dry and secure' },
  ]),
  t('gmdss_pyro', 'monthly', 'EPIRB / SART / pyrotechnics — monthly', [
    { id: 'epirb_battery', text: 'EPIRB battery expiry in date' },
    { id: 'epirb_hru', text: 'EPIRB HRU expiry in date' },
    { id: 'epirb_reg', text: 'EPIRB registration current' },
    { id: 'sart_battery', text: 'SART battery expiry in date' },
    { id: 'pyro_expiry', text: 'Pyrotechnic expiry dates in date' },
    { id: 'quantity', text: 'Quantities correct against the outfit list' },
  ]),

  // ----- FFE ---------------------------------------------------------------
  t('fire_extinguishers', 'monthly', 'Fire extinguisher — monthly', [
    ...STOWAGE,
    { id: 'pressure', text: 'Pressure gauge reading in the green' },
    { id: 'pin', text: 'Safety pin fitted and seal unbroken' },
    { id: 'body', text: 'Body, hose and nozzle undamaged, no corrosion' },
    { id: 'nozzle_clear', text: 'Nozzle and horn clear of obstruction' },
    { id: 'instructions', text: 'Operating instructions legible and facing outward' },
    { id: 'service', text: 'Service / recharge date in date' },
  ]),
  t('fire_dampers', 'monthly', 'Fire damper — monthly', [
    { id: 'operate', text: 'Damper operates fully closed and reopens' },
    { id: 'linkage', text: 'Linkage and hinges free, greased' },
    { id: 'remote', text: 'Remote release functions' },
    { id: 'seal', text: 'Blade and seal undamaged' },
    { id: 'marking', text: 'Identification marking legible' },
  ]),
  t('fire_vents', 'monthly', 'Fire vent / closing appliance — monthly', [
    { id: 'operate', text: 'Closes fully and reopens' },
    { id: 'remote', text: 'Remote closing functions from outside the space' },
    { id: 'obstruction', text: 'Free of obstruction and corrosion' },
    { id: 'marking', text: 'Identification marking legible' },
  ]),
  t('hydrants_fireboxes', 'weekly', 'Hydrant / firebox — weekly', [
    ...STOWAGE,
    { id: 'hose', text: 'Hose present and correctly stowed' },
    { id: 'nozzle', text: 'Nozzle present, jet/spray operates' },
    { id: 'spanner', text: 'Hydrant spanner present' },
    { id: 'couplings', text: 'Couplings and washers sound' },
    { id: 'valve', text: 'Valve free to operate, no leaks' },
    { id: 'box', text: 'Box / cabinet undamaged and marked' },
  ]),
  t('hydrants_fireboxes', 'monthly', 'Hydrant / firebox — monthly', [
    { id: 'pressure_test', text: 'Hose run out and pressure tested' },
    { id: 'reflake', text: 'Hose drained, re-flaked and restowed' },
    { id: 'valve_grease', text: 'Hydrant valve operated and greased' },
    { id: 'corrosion', text: 'No corrosion or wastage at the hydrant' },
    { id: 'hose_condition', text: 'Hose lining and jacket free of splits' },
  ]),
  t('fixed_co2', 'monthly', 'Fixed CO₂ system — monthly', [
    { id: 'room', text: 'Bottle room secure, ventilated and lit' },
    { id: 'bottles', text: 'Bottles secure in racks, no corrosion' },
    { id: 'weight', text: 'Contents check (weight / level) satisfactory' },
    { id: 'cabinet', text: 'Release cabinet sealed, accessible and marked' },
    { id: 'pilot', text: 'Pilot lines and pull cables free' },
    { id: 'alarm', text: 'Discharge alarm tested' },
    { id: 'instructions', text: 'Operating instructions posted and legible' },
  ]),
  t('fifi_ba', 'weekly', 'BA set / fireman’s outfit — weekly', [
    { id: 'pressure', text: 'Cylinder pressure at or above 80% full' },
    { id: 'mask', text: 'Face mask clean, visor and seal undamaged' },
    { id: 'harness', text: 'Harness, straps and buckles sound' },
    { id: 'demand', text: 'Demand valve operates correctly' },
    { id: 'whistle', text: 'Low-pressure warning whistle sounds' },
    { id: 'leak', text: 'Leak test satisfactory' },
    { id: 'outfit', text: "Fireman's outfit complete and stowed with the set", hint: 'Boots, gloves, helmet, lifeline, axe, torch.' },
  ]),
  t('fifi_ba', 'monthly', 'BA set / fireman’s outfit — monthly', [
    { id: 'function', text: 'Full function test carried out' },
    { id: 'hydro', text: 'Cylinder hydrostatic test date in date' },
    { id: 'spare', text: 'Spare cylinder charged and available' },
    { id: 'torch', text: 'Safety torch tested, battery serviceable' },
    { id: 'lifeline', text: 'Lifeline and belt inspected' },
    { id: 'stowage', text: 'Stowage clean, dry and marked' },
  ]),
  t('bottle_pressure', 'monthly', 'BA bottle pressure — monthly', [
    { id: 'pressure', text: 'Pressure at or above 80% of working pressure', hint: 'Record the actual reading in the comment.' },
    { id: 'hydro', text: 'Hydrostatic test date in date' },
    { id: 'valve', text: 'Valve, threads and O-ring sound' },
    { id: 'body', text: 'Cylinder free of corrosion, dents and gouges' },
    { id: 'marking', text: 'Cylinder markings legible' },
  ]),
  t('eebd', 'monthly', 'EEBD — monthly', [
    ...STOWAGE,
    { id: 'seal', text: 'Tamper seal / indicator intact' },
    { id: 'pressure', text: 'Pressure gauge reading in the green' },
    { id: 'case', text: 'Case and carrying strap undamaged' },
    { id: 'service', text: 'Service / expiry date in date' },
    { id: 'instructions', text: 'Donning instructions legible' },
    { id: 'signage', text: 'Stowage position signed and lit' },
  ]),
  t('fire_detectors', 'monthly', 'Fire detector — monthly', [
    { id: 'function', text: 'Detector function tested at the head' },
    { id: 'panel', text: 'Correct zone and address shown at the panel' },
    { id: 'clean', text: 'Head clean, free of dust and paint' },
    { id: 'lamp', text: 'Indicator lamp operates' },
    { id: 'restore', text: 'Panel restored to normal, no isolations left in' },
  ]),

  // ----- OTHER -------------------------------------------------------------
  t('eye_wash', 'monthly', 'Eye wash station — monthly', [
    ...STOWAGE,
    { id: 'flush', text: 'Flushed and run for the required time' },
    { id: 'flow', text: 'Water clear, flow to both eyepieces adequate' },
    { id: 'caps', text: 'Nozzle caps in place and clean' },
    { id: 'signage', text: 'Station signed and lit' },
    { id: 'solution', text: 'Eye wash solution in date', hint: 'Bottled stations only.' },
  ]),
  t('first_aid', 'monthly', 'First aid kit — monthly', [
    ...STOWAGE,
    { id: 'seal', text: 'Seal intact / contents undisturbed' },
    { id: 'inventory', text: 'Contents checked against the inventory list' },
    { id: 'expiry', text: 'Nothing expired' },
    { id: 'condition', text: 'Case clean, dry and undamaged' },
  ]),
  t('chemical_suits', 'monthly', 'Chemical suit — monthly', [
    ...STOWAGE,
    { id: 'suit', text: 'Suit undamaged, material not perished' },
    { id: 'zip', text: 'Zip and seals serviceable' },
    { id: 'gloves', text: 'Gloves and boots present and sound' },
    { id: 'inventory', text: 'Outfit complete against the list' },
    { id: 'stowage', text: 'Stored clean and dry' },
  ]),
  t('gas_detection', 'monthly', 'Gas detection meter — monthly', [
    { id: 'bump', text: 'Bump / function test passed' },
    { id: 'calibration', text: 'Calibration in date' },
    { id: 'alarms', text: 'Audible and visual alarms operate' },
    { id: 'battery', text: 'Battery charged, charger serviceable' },
    { id: 'sensors', text: 'Sensors and filters clean' },
    { id: 'sample', text: 'Sample line, probe and aspirator serviceable' },
  ]),
  t('sopep', 'monthly', 'SOPEP locker — monthly', [
    ...STOWAGE,
    { id: 'inventory', text: 'Contents checked against the SOPEP inventory' },
    { id: 'absorbent', text: 'Absorbents dry and serviceable' },
    { id: 'condition', text: 'Equipment undamaged, no perished items' },
    { id: 'signage', text: 'Locker marked and unlocked / key available' },
  ]),
];

/**
 * Fallback for a category with no template of its own. Better than refusing the
 * round: the crew member can still sign that they looked at the thing, and say
 * what they found. Its id carries the category so a record still says what was
 * inspected, and `generic` so a report can tell it apart from a written check.
 */
export function genericTemplate(category: CategoryKey, period: InspectionPeriod): ChecklistTemplate {
  return {
    id: `${category}.${period}.generic`,
    version: 1,
    category,
    period,
    title: period === 'weekly' ? 'General check — weekly' : 'General check — monthly',
    lines: [
      ...STOWAGE,
      { id: 'condition', text: 'Undamaged, clean and serviceable' },
      { id: 'markings', text: 'Markings and instructions legible' },
      { id: 'dates', text: 'Service / expiry dates in date' },
    ],
  };
}

const BY_ID = new Map(CHECKLISTS.map((c) => [c.id, c]));

/** Every period this category has a written checklist for, weekly first. */
export function templatesFor(
  category: CategoryKey,
  vessel: ChecklistTemplate[] = []
): ChecklistTemplate[] {
  // A vessel template REPLACES the built-in for its category and period rather
  // than sitting beside it: two checklists offered for one monthly round is a
  // question about which one the round means, and the officer on deck is the
  // worst placed person to answer it.
  const own = vessel.filter((t) => t.category === category);
  const overridden = new Set(own.map((t) => t.period));
  return [...own, ...CHECKLISTS.filter((c) => c.category === category && !overridden.has(c.period))];
}

/** The periods offered for a category — always at least monthly, via the fallback. */
export function periodsFor(
  category: CategoryKey,
  vessel: ChecklistTemplate[] = []
): InspectionPeriod[] {
  const own = templatesFor(category, vessel).map((c) => c.period);
  return own.length ? own : ['monthly'];
}

/**
 * The template a round should use: the vessel's own if it wrote one, else the
 * built-in, else the generic fallback. Never null.
 */
export function templateFor(
  category: CategoryKey,
  period: InspectionPeriod,
  vessel: ChecklistTemplate[] = []
): ChecklistTemplate {
  const own = vessel
    .filter((t) => t.category === category && t.period === period)
    // Two devices can each have written one before they ever met. Newest wins,
    // which is the same rule the merge uses, so both sides settle the same way.
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  return own ?? BY_ID.get(`${category}.${period}`) ?? genericTemplate(category, period);
}

/**
 * Look a stored record's template back up by its id — including a generic one,
 * which is rebuilt rather than stored. Returns null when the id is from a build
 * this one no longer has, so the reader can fall back to showing the raw results.
 *
 * Vessel templates are searched too, but only as a courtesy for records signed
 * before line snapshots: a vessel template can be edited, so what it says today
 * is not evidence of what was asked. The snapshot on the record always wins.
 */
export function templateById(
  id: string,
  vessel: ChecklistTemplate[] = []
): ChecklistTemplate | null {
  const known = BY_ID.get(id) ?? vessel.find((t) => t.id === id);
  if (known) return known;
  const m = /^(.+)\.(weekly|monthly|quarterly|annual)\.generic$/.exec(id);
  if (m) return genericTemplate(m[1] as CategoryKey, m[2] as InspectionPeriod);
  return null;
}

/** Line text for a report / history row; falls back to the bare id. */
export function lineText(template: ChecklistTemplate | null, lineId: string): string {
  return template?.lines.find((l) => l.id === lineId)?.text ?? lineId;
}
