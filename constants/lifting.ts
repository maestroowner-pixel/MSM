// ===================================
// Lifting & Mooring — the fourth register.
//
// The categories and the checks a vessel asked for on 29 Sep 2026, in its own
// words: "our lifting and mooring equipment register alone covers a number of
// different areas", followed by the list below. Working Aloft Equipment was
// sitting in LSA because there was nowhere better for it — which is the clearest
// possible statement that this register was missing.
//
// It is switched off until `constants/modules.ts` says otherwise; see there.
//
// WHAT IS DELIBERATELY NOT HERE YET. Fields for SWL/WLL, the last proof test and
// the certificate that proves it. `EquipmentItem` can carry them today in
// `extra{}` (the Excel importer fills that from any column it does not recognise),
// and `nextInspection` already drives the reminder, so nothing is blocked. But
// typed fields with the right labels are worth getting right from the vessel's
// own register rather than inventing — the question is out with them.
//
// The checks below are ordinary seamanship, not a citation of LOLER or of any one
// vessel's SMS: a monthly look at the gear in service, and a quarterly round that
// asks the questions a thorough examination would be checked against. A vessel
// that words them differently edits them in Settings → Checklists like any other.
// ===================================

import { ChecklistLine, ChecklistTemplate } from './checklists';
import { InspectionPeriod } from '../types/inspection';
import { CategoryMeta } from './categories';
import { CategoryKey } from '../types/equipment';
import { COLORS } from '../theme';

// Every `icon` below is checked against BOTH icon sets — @mdi/js on web and the
// MaterialCommunityIcons font on the phones. A name that exists in neither draws
// the question-mark fallback, which is how "Engineering Lifting Equipment"
// shipped into the first test build with a "?" on its tile (29 Sep 2026); a name
// in only one of them is worse, because it looks right on the machine you are
// developing on. `npm run check:icons` fails the build rather than the tile.

/** The keys are permanent: they are written onto every item and every record. */
export const LIFTING_KEYS = [
  'mooring',
  'working_aloft',
  'cranes',
  'hooks_cables',
  'deck_slings',
  'eng_lifting',
  'aloft_anchors',
  'lifting_eyes',
] as const;

export const LIFTING_CATEGORIES: CategoryMeta[] = [
  {
    key: 'mooring' as CategoryKey,
    label: 'Mooring Equipment',
    short: 'Mooring',
    group: 'LIFTING',
    sheet: 'Mooring Equipment',
    color: COLORS.lifting,
    emoji: '🪢',
    // The badge is a drawn reef knot (assets/cat-icons/mooring-knot.png, wired in
    // components/ui.tsx) — no icon set has a knot. `anchor` stays as the name for
    // the few places that draw the glyph by name, e.g. the category editor.
    icon: 'anchor',
    dateField: 'nextInspection',
  },
  {
    key: 'working_aloft' as CategoryKey,
    label: 'Working Aloft Equipment',
    short: 'Working Aloft',
    group: 'LIFTING',
    sheet: 'Working Aloft',
    color: COLORS.lifting,
    emoji: '🪢',
    icon: 'ladder',
    dateField: 'nextInspection',
  },
  {
    key: 'cranes' as CategoryKey,
    label: 'Cranes',
    short: 'Cranes',
    group: 'LIFTING',
    sheet: 'Cranes',
    color: COLORS.lifting,
    emoji: '🏗️',
    icon: 'crane',
    dateField: 'nextInspection',
  },
  {
    key: 'hooks_cables' as CategoryKey,
    label: 'Hooks & Cables',
    short: 'Hooks & Cables',
    group: 'LIFTING',
    sheet: 'Hooks and Cables',
    color: COLORS.lifting,
    emoji: '🪝',
    icon: 'hook',
    dateField: 'nextInspection',
  },
  {
    key: 'deck_slings' as CategoryKey,
    label: 'Deck Slings & Shackles',
    short: 'Slings & Shackles',
    group: 'LIFTING',
    sheet: 'Deck Slings and Shackles',
    color: COLORS.lifting,
    emoji: '⛓️',
    icon: 'link-variant',
    dateField: 'nextInspection',
  },
  {
    key: 'eng_lifting' as CategoryKey,
    label: 'Engineering Lifting Equipment',
    short: 'Eng. Lifting',
    group: 'LIFTING',
    sheet: 'Engineering Lifting',
    color: COLORS.lifting,
    emoji: '🛠️',
    icon: 'gantry-crane',
    dateField: 'nextInspection',
  },
  {
    key: 'aloft_anchors' as CategoryKey,
    label: 'Working Aloft Anchors',
    short: 'Aloft Anchors',
    group: 'LIFTING',
    sheet: 'Working Aloft Anchors',
    color: COLORS.lifting,
    emoji: '⚓',
    // Not `anchor` — that is the mooring register's, and two identical badges in
    // one group is two categories a person has to read to tell apart.
    icon: 'screw-lag',
    dateField: 'nextInspection',
  },
  {
    key: 'lifting_eyes' as CategoryKey,
    label: 'Interior Lifting Eyes & Beams',
    short: 'Lifting Eyes',
    group: 'LIFTING',
    sheet: 'Lifting Eyes and Beams',
    color: COLORS.lifting,
    emoji: '🔩',
    icon: 'pillar',
    dateField: 'nextInspection',
  },
];

// ---- the checks ------------------------------------------------------------
//
// THE FREQUENCIES ARE THE VESSEL'S, NOT A GUESS (30 Sep 2026).
//
// The first draft gave all eight categories a monthly round and a quarterly one.
// The vessel that asked for the module read it and said plainly how they work:
//
//   "most of this equipment is not something we need to inspect weekly or
//    monthly. Working Aloft Equipment and Mooring Lines — primarily quarterly.
//    Most other lifting equipment — annual inspection/certification, with
//    additional checks as required."
//
// They also harmonise: they want as much of the ship's certification as possible
// falling due in the same annual period rather than scattered through the year.
//
// So: every category gets an ANNUAL round, which is the examination and the
// certificate. Mooring and working aloft get a QUARTERLY round on top, which is
// the hands-on look at gear in constant use. Nothing is monthly. A vessel that
// works differently adds a round in Settings → Checklists — including a monthly
// one — exactly as it edits any wording.

const t = (
  category: string,
  period: InspectionPeriod,
  title: string,
  lines: ChecklistLine[]
): ChecklistTemplate => ({
  id: `${category}.${period}`,
  version: 1,
  category: category as CategoryKey,
  period,
  title,
  lines,
});

/** Asked of every piece of gear that carries a load. */
const LOAD: ChecklistLine[] = [
  { id: 'marking', text: 'SWL / WLL marking legible' },
  { id: 'cert', text: 'Test certificate on file and in date' },
  { id: 'damage', text: 'No damage, deformation or excessive wear' },
];

/** The hands-on look, per category — what a keeper sees without dismantling. */
const CONDITION: Record<string, ChecklistLine[]> = {
  mooring: [
    { id: 'lines', text: 'Lines free of cuts, chafe and heat damage' },
    { id: 'eyes', text: 'Eyes, splices and whippings sound' },
    { id: 'bitts', text: 'Bitts, fairleads and rollers free and greased' },
    { id: 'winch', text: 'Winch brake set and holding' },
    { id: 'stoppers', text: 'Stoppers present and serviceable' },
  ],
  working_aloft: [
    { id: 'harness', text: 'Harness webbing, stitching and buckles sound' },
    { id: 'lanyard', text: 'Lanyard and shock absorber undamaged, indicator not deployed' },
    { id: 'karabiner', text: 'Karabiners and connectors lock and close fully' },
    { id: 'rope', text: 'Ropes and fall-arrest lines free of glazing, cuts and swelling' },
  ],
  cranes: [
    { id: 'controls', text: 'Controls, limits and emergency stop operate' },
    { id: 'wire', text: 'Wire rope free of broken strands, kinks and corrosion' },
    { id: 'sheaves', text: 'Sheaves, drums and bearings sound and greased' },
    { id: 'hydraulics', text: 'No hydraulic leaks; oil level correct' },
    { id: 'hook', text: 'Hook, safety catch and swivel free and undamaged' },
  ],
  hooks_cables: [
    { id: 'catch', text: 'Safety catch present and closing' },
    { id: 'throat', text: 'Throat opening within tolerance, no stretch' },
    { id: 'cable', text: 'Cable free of broken wires, birdcaging and corrosion' },
    { id: 'terminations', text: 'Terminations, ferrules and thimbles sound' },
  ],
  deck_slings: [
    { id: 'webbing', text: 'Webbing free of cuts, abrasion and chemical damage' },
    { id: 'pins', text: 'Shackle pins correct, seated and secured' },
    { id: 'tags', text: 'Identification tags legible and attached' },
    { id: 'stowage', text: 'Stowed clean, dry and out of sunlight' },
  ],
  eng_lifting: [
    { id: 'chain', text: 'Chain and load chain free of stretch, nicks and twist' },
    { id: 'brake', text: 'Brake holds the load' },
    { id: 'operation', text: 'Raises and lowers smoothly through full travel' },
    { id: 'hookblock', text: 'Hook block and suspension undamaged' },
  ],
  aloft_anchors: [
    { id: 'fixing', text: 'Anchor point secure, no movement in the structure' },
    { id: 'corrosion', text: 'No corrosion, cracking or deformation' },
    { id: 'paint', text: 'Paint and sealant intact around the fixing' },
  ],
  lifting_eyes: [
    { id: 'weld', text: 'Welds and fixings sound, no cracking' },
    { id: 'beam', text: 'Beam and trolley run true, end stops in place' },
    { id: 'corrosion', text: 'No corrosion or deformation' },
  ],
};

/** The examination the certificate rests on — asked of everything, once a year. */
const EXAMINATION: ChecklistLine[] = [
  { id: 'register', text: 'Item matches the lifting register: id, SWL/WLL, location' },
  { id: 'cert_date', text: 'Thorough examination / proof test in date' },
  { id: 'cert_copy', text: 'Certificate attached in ISMpilot and readable' },
  { id: 'wear', text: 'Measured wear within the maker\'s limits' },
  { id: 'condition', text: 'Full visual examination: no cracks, deformation or corrosion' },
  { id: 'withdrawn', text: 'Anything doubtful withdrawn from service and tagged' },
  { id: 'next', text: 'Next examination date recorded and harmonised with the annual period' },
];

const labelOf = (key: string) => LIFTING_CATEGORIES.find((c) => c.key === (key as string))!.label;

/** Quarterly, for the gear in constant use — the vessel named these two. */
const QUARTERLY_KEYS = ['mooring', 'working_aloft'] as const;

export const LIFTING_CHECKLISTS: ChecklistTemplate[] = [
  ...QUARTERLY_KEYS.map((key) =>
    t(key, 'quarterly', `${labelOf(key)} — quarterly`, [...CONDITION[key], ...LOAD])
  ),
  ...LIFTING_KEYS.map((key) =>
    t(key, 'annual', `${labelOf(key)} — annual`, [...CONDITION[key], ...EXAMINATION])
  ),
];
