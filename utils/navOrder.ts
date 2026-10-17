import { moduleOn, type ModuleKey } from '../constants/modules';
// The person's screen order for the menu (components/NavMenu) — pure, so `npm run check:access` can test it.

/** The saved order applied to the screens this device shows; new ones go last. */
export function applyOrder(available: string[], saved: string[] | null): string[] {
  // Nobody has ordered them: the order the menu's groups list them in.
  if (!saved?.length) return [...available].sort((a, b) => rank(a) - rank(b));
  const known = saved.filter((r) => available.includes(r));
  return [...known, ...available.filter((r) => !known.includes(r))];
}

export function move(order: string[], name: string, dir: -1 | 1): string[] {
  const i = order.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const out = [...order];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}


// ---- groups (9 Oct 2026: "split the screens in the menu by meaning") ------------

export interface MenuGroup {
  key: string;
  /** Heading in the menu; empty = no heading (Settings at the foot). */
  label: string;
  routes: string[];
}

// By the ship's own work (17 Oct 2026: "the side menu is chaos"): the board on
// top, then equipment, safety, security, MARPOL, crew, operations, papers.
export const MENU_GROUPS: MenuGroup[] = [
  { key: 'home', label: '', routes: ['Dashboard'] },
  { key: 'equipment', label: 'Equipment & maintenance', routes: ['Equipment', 'Rounds', 'Maintenance', 'Spares', 'Stores'] },
  { key: 'safety', label: 'Safety', routes: ['Drills', 'Safety'] },
  // The ship's hospital on its own, under Safety (17 Oct 2026: "out of Crew, its own section").
  { key: 'medical', label: 'Medical', routes: ['Hospital'] },
  { key: 'security', label: 'Security', routes: ['Security'] },
  { key: 'env', label: 'Environment (MARPOL)', routes: ['OilRecord', 'Garbage', 'Sewage', 'Ballast', 'Fuel', 'Sopep'] },
  { key: 'crew', label: 'Crew', routes: ['Crew', 'CrewMatrix', 'HoursOfRest', 'Passengers'] },
  { key: 'ops', label: 'Operations', routes: ['Watch', 'Familiar', 'Dp', 'Readiness'] },
  { key: 'docs', label: 'Documents & compliance', routes: ['Certificates', 'Documents', 'Permits', 'Surveys', 'Reports'] },
  { key: 'system', label: '', routes: ['Settings'] },
];

const OTHER = 'equipment';
/** A screen's place in MENU_GROUPS (group, then its place in the group); unknown ones last. */
function rank(route: string): number {
  for (let g = 0; g < MENU_GROUPS.length; g++) {
    const i = MENU_GROUPS[g].routes.indexOf(route);
    if (i >= 0) return g * 100 + i;
  }
  return 10_000;
}
/**
 * Sub-items under a menu entry: tapping the entry opens them, each opens the
 * screen on one of its pages (route params `view`). Add pages here as they come.
 */
export interface MenuChild {
  view: string;
  label: string;
  icon: string;
  /** Shown only when this module is on (constants/modules.ts). */
  module?: ModuleKey;
  /** Opens another screen than its entry's — the SOPEP and ISPS drills under Drills. */
  route?: string;
  /** For the Master and the officers only — the SOPEP documents, the Ship Security Plan. */
  officers?: boolean;
}

/** Entries with a gear beside them (15 Oct 2026): it opens the page that keeps their places — `view: 'manage'`. */
export const MENU_GEAR: Record<string, string> = { Stores: 'Manage stores', Sopep: 'Manage SOPEP lockers' };
export const MENU_CHILDREN: Record<string, MenuChild[]> = {
  Security: [
    { view: 'gangway', label: 'Gangway logbook', icon: 'ferry' },
    { view: 'drills', label: 'ISPS drills', icon: 'run-fast' },
    { view: 'searches', label: 'Searches — stowaway, bomb', icon: 'magnify-scan', module: 'searches' },
    { view: 'patrols', label: 'Security rounds', icon: 'walk', module: 'patrols' },
    { view: 'keys', label: 'Key register', icon: 'key-chain-variant', module: 'keys' },
    { view: 'ssp', label: 'Ship Security Plan', icon: 'shield-lock-outline', officers: true, module: 'ssp' },
  ],
  // Safety (17 Oct 2026): the observations and NCs, and the safety meeting and IMCA flashes,
  // which used to sit under Security. The meeting and the flashes keep their pages (and their
  // Master's-page keys) on the Security screen.
  Safety: [
    { view: 'cards', label: 'Safety observations', icon: 'eye-check-outline' },
    { view: 'ncs', label: 'Non-conformities', icon: 'alert-octagon-outline' },
    { view: 'meetings', label: 'Monthly safety meeting', icon: 'account-group-outline', route: 'Security', module: 'meetings' },
    { view: 'flashes', label: 'Safety flashes (IMCA)', icon: 'flash-alert-outline', route: 'Security' },
  ],
  Hospital: [
    { view: 'register', label: 'Register', icon: 'clipboard-list-outline' },
    { view: 'orders', label: 'Orders', icon: 'truck-delivery-outline' },
    { view: 'archive', label: 'Orders archive', icon: 'archive-outline' },
    { view: 'inventory', label: 'Inventory', icon: 'counter' },
    { view: 'log', label: 'Medical log', icon: 'notebook-outline' },
    { view: 'reference', label: 'Medicine reference', icon: 'book-open-variant' },
  ],
  // Stores: built from the vessel's stores (components/NavMenu, types/stores.ts storeRooms) — these two until it adds its own.
  Stores: [
    { view: 'ppe', label: 'PPE store', icon: 'hard-hat' },
    { view: 'provisions', label: 'Provisions', icon: 'food-apple-outline' },
  ],
  // SOPEP (15 Oct 2026): the lockers and their checks, the drills, and the plan's documents for the officers.
  Sopep: [
    { view: 'inventory', label: 'SOPEP stores (inventory)', icon: 'archive-outline' },
    { view: 'drills', label: 'SOPEP drills', icon: 'run-fast' },
    { view: 'docs', label: 'SOPEP docs', icon: 'file-lock-outline', officers: true },
  ],
  // Every drill in one place: the schedule, and the SOPEP and ISPS drills kept on their own pages.
  // Bridge and engine checklists (17 Oct 2026): two folders, the watch handover first.
  Watch: [
    { view: 'bridge', label: 'Bridge checklists', icon: 'ferry' },
    { view: 'engine', label: 'Engine checklists', icon: 'engine-outline' },
    { view: 'emergency', label: 'Emergency cards', icon: 'alarm-light-outline' },
  ],
  // Familiarisation on joining (17 Oct 2026): bridge and engine.
  Familiar: [
    { view: 'fam-safety', label: 'Safety familiarisation', icon: 'lifebuoy' },
    { view: 'fam-bridge', label: 'Bridge familiarisation', icon: 'ferry' },
    { view: 'fam-engine', label: 'Engine familiarisation', icon: 'engine-outline' },
    { view: 'fam-project', label: 'Project crew familiarisation', icon: 'account-hard-hat' },
    { view: 'fam-pax', label: 'Passenger familiarisation', icon: 'account-group-outline' },
  ],
  Dp: [
    { view: 'checklists', label: 'DP checklists', icon: 'clipboard-check-outline' },
    { view: 'time', label: 'DP time', icon: 'timer-outline' },
    { view: 'letter', label: 'Confirmation letter', icon: 'email-outline' },
  ],
  Drills: [
    { view: 'list', label: 'Drills & schedule', icon: 'format-list-checks' },
    { view: 'calendar', label: 'Drill calendar', icon: 'calendar-month-outline' },
    { view: 'drills', label: 'SOPEP drills', icon: 'oil', route: 'Sopep', module: 'sopep' },
    { view: 'drills', label: 'ISPS drills', icon: 'shield-account-outline', route: 'Security', module: 'security' },
  ],
  Fuel: [
    { view: 'sounding', label: 'Sounding', icon: 'ruler' },
    { view: 'daily', label: 'Daily report', icon: 'clipboard-text-clock-outline' },
  ],
};

export function groupOf(route: string): string {
  return MENU_GROUPS.find((g) => g.routes.includes(route))?.key ?? OTHER;
}

/** The person's order, laid out group by group (groups in their fixed order). */
export function grouped(order: string[]): { group: MenuGroup; routes: string[] }[] {
  return MENU_GROUPS.map((g) => ({ group: g, routes: order.filter((r) => groupOf(r) === g.key) })).filter((x) => x.routes.length);
}

/** The flat order the bottom bar and swipes follow: groups first, the person's order inside each. */
export function flatGrouped(order: string[]): string[] {
  return grouped(order).flatMap((x) => x.routes);
}

/** ↑ / ↓ within a group: swap with the nearest neighbour of the same group. */
export function moveInGroup(order: string[], name: string, dir: -1 | 1): string[] {
  const g = groupOf(name);
  const same = order.filter((r) => groupOf(r) === g);
  const i = same.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= same.length) return order;
  const a = order.indexOf(name);
  const b = order.indexOf(same[j]);
  const out = [...order];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

/** The menu's names for its entries (index.tsx, and the Master's page). */
export const MENU_LABEL: Record<string, string> = {
  // A getter: `board` may be switched on for one vessel after this file loads.
  get Dashboard() { return moduleOn('board') ? 'Board' : 'Dashboard'; },
  Equipment: 'Equipment',
  Certificates: 'Certificates',
  Documents: 'Documents',
  Maintenance: 'Maintenance (PMS)',
  Spares: 'Spare parts',
  HoursOfRest: 'Hours of rest',
  Crew: 'Crew list',
  CrewMatrix: 'Crew matrix',
  Permits: 'Permits, TBT & RA',
  Sopep: 'SOPEP',
  Security: 'Security (ISPS)',
  Surveys: 'Surveys & audits',
  Readiness: 'Inspection readiness',
  Dp: 'Dynamic positioning',
  Watch: 'Bridge & engine checklists',
  Familiar: 'Familiarisation',
  Safety: 'Safety observations & NC',
  Drills: 'Drills',
  Hospital: 'Hospital',
  Passengers: 'Passengers',
  Stores: 'Stores',
  Rounds: 'Inspection rounds',
  Fuel: 'Fuel',
  Garbage: 'Garbage record book',
  OilRecord: 'Oil record book',
  Sewage: 'Sewage record',
  Ballast: 'Ballast water',
  Reports: 'Reports',
  Settings: 'Settings',
};
