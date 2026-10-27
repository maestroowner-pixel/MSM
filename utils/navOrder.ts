import { moduleOn, type ModuleKey } from '../constants/modules';
import { t, tk } from './t';
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
/** A group whose heading follows the interface language. */
function group(key: string, labelKey: string | null, routes: string[]): MenuGroup {
  return Object.defineProperty({ key, routes } as MenuGroup, 'label', { get: () => (labelKey ? tk(labelKey) : ''), enumerable: true });
}
/** A sub-item whose name follows the interface language. */
function kid(labelKey: string, c: Omit<MenuChild, 'label'>): MenuChild {
  return Object.defineProperty({ ...c } as MenuChild, 'label', { get: () => tk(labelKey), enumerable: true });
}

export const MENU_GROUPS: MenuGroup[] = [
  group('home', null, ['Dashboard']),
  group('logs', 'menu.group.logs', ['DeckLog', 'WatchLog', 'Gmdss']),
  group('equipment', 'menu.group.equipment', ['Equipment', 'Rounds', 'Maintenance', 'Spares', 'Stores', 'Orders', 'Finance']),
  group('safety', 'menu.group.safety', ['Drills', 'Safety']),
  // The ship's hospital on its own, under Safety (17 Oct 2026: "out of Crew, its own section").
  group('medical', 'menu.group.medical', ['Hospital']),
  group('security', 'menu.group.security', ['Security']),
  group('env', 'menu.group.env', ['OilRecord', 'Garbage', 'Sewage', 'Ballast', 'FuelChangeover', 'Ods', 'Fuel', 'Sopep']),
  group('crew', 'menu.group.crew', ['Crew', 'CrewMatrix', 'HoursOfRest', 'Passengers']),
  group('ops', 'menu.group.ops', ['Watch', 'Familiar', 'Dp', 'Readiness']),
  group('docs', 'menu.group.docs', ['Certificates', 'Documents', 'Permits', 'Surveys', 'Reports']),
  group('system', null, ['Settings']),
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
export const MENU_GEAR: Record<string, string> = {
  get Stores() { return t('menu.gear.Stores'); },
  get Sopep() { return t('menu.gear.Sopep'); },
};
export const MENU_CHILDREN: Record<string, MenuChild[]> = {
  Security: [
    kid('menu.Security.gangway', { view: 'gangway', icon: 'ferry' }),
    kid('menu.Security.drills', { view: 'drills', icon: 'run-fast' }),
    kid('menu.Security.searches', { view: 'searches', icon: 'magnify-scan', module: 'searches' }),
    kid('menu.Security.patrols', { view: 'patrols', icon: 'walk', module: 'patrols' }),
    kid('menu.Security.keys', { view: 'keys', icon: 'key-chain-variant', module: 'keys' }),
    kid('menu.Security.ssp', { view: 'ssp', icon: 'shield-lock-outline', officers: true, module: 'ssp' }),
  ],
  // Safety (17 Oct 2026): the observations and NCs, and the safety meeting and IMCA flashes,
  // which used to sit under Security. The meeting and the flashes keep their pages (and their
  // Master's-page keys) on the Security screen.
  Safety: [
    kid('menu.Safety.cards', { view: 'cards', icon: 'eye-check-outline' }),
    kid('menu.Safety.ncs', { view: 'ncs', icon: 'alert-octagon-outline' }),
    kid('menu.Safety.meetings', { view: 'meetings', icon: 'account-group-outline', route: 'Security', module: 'meetings' }),
    kid('menu.Safety.flashes', { view: 'flashes', icon: 'flash-alert-outline', route: 'Security' }),
  ],
  Hospital: [
    kid('menu.Hospital.register', { view: 'register', icon: 'clipboard-list-outline' }),
    kid('menu.Hospital.orders', { view: 'orders', icon: 'truck-delivery-outline' }),
    kid('menu.Hospital.archive', { view: 'archive', icon: 'archive-outline' }),
    kid('menu.Hospital.inventory', { view: 'inventory', icon: 'counter' }),
    kid('menu.Hospital.log', { view: 'log', icon: 'notebook-outline' }),
    kid('menu.Hospital.reference', { view: 'reference', icon: 'book-open-variant' }),
  ],
  // Stores: built from the vessel's stores (components/NavMenu, types/stores.ts storeRooms) — these two until it adds its own.
  Stores: [
    kid('menu.Stores.ppe', { view: 'ppe', icon: 'hard-hat' }),
    kid('menu.Stores.provisions', { view: 'provisions', icon: 'food-apple-outline' }),
  ],
  // SOPEP (15 Oct 2026): the lockers and their checks, the drills, and the plan's documents for the officers.
  Sopep: [
    kid('menu.Sopep.inventory', { view: 'inventory', icon: 'archive-outline' }),
    kid('menu.Sopep.drills', { view: 'drills', icon: 'run-fast' }),
    kid('menu.Sopep.docs', { view: 'docs', icon: 'file-lock-outline', officers: true }),
  ],
  // Every drill in one place: the schedule, and the SOPEP and ISPS drills kept on their own pages.
  // Bridge and engine checklists (17 Oct 2026): two folders, the watch handover first.
  Watch: [
    kid('menu.Watch.bridge', { view: 'bridge', icon: 'ferry' }),
    kid('menu.Watch.engine', { view: 'engine', icon: 'engine-outline' }),
    kid('menu.Watch.emergency', { view: 'emergency', icon: 'alarm-light-outline' }),
  ],
  // Familiarisation on joining (17 Oct 2026): bridge and engine.
  Familiar: [
    kid('menu.Familiar.fam-safety', { view: 'fam-safety', icon: 'lifebuoy' }),
    kid('menu.Familiar.fam-bridge', { view: 'fam-bridge', icon: 'ferry' }),
    kid('menu.Familiar.fam-engine', { view: 'fam-engine', icon: 'engine-outline' }),
    kid('menu.Familiar.fam-project', { view: 'fam-project', icon: 'account-hard-hat' }),
    kid('menu.Familiar.fam-pax', { view: 'fam-pax', icon: 'account-group-outline' }),
  ],
  Dp: [
    kid('menu.Dp.checklists', { view: 'checklists', icon: 'clipboard-check-outline' }),
    kid('menu.Dp.time', { view: 'time', icon: 'timer-outline' }),
    kid('menu.Dp.letter', { view: 'letter', icon: 'email-outline' }),
  ],
  Drills: [
    kid('menu.Drills.list', { view: 'list', icon: 'format-list-checks' }),
    kid('menu.Drills.calendar', { view: 'calendar', icon: 'calendar-month-outline' }),
    kid('menu.Drills.drills.Sopep', { view: 'drills', icon: 'oil', route: 'Sopep', module: 'sopep' }),
    kid('menu.Drills.drills.Security', { view: 'drills', icon: 'shield-account-outline', route: 'Security', module: 'security' }),
  ],
  Fuel: [
    kid('menu.Fuel.sounding', { view: 'sounding', icon: 'ruler' }),
    kid('menu.Fuel.daily', { view: 'daily', icon: 'clipboard-text-clock-outline' }),
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

/** The menu's names for its entries (index.tsx, and the Master's page) — in the interface language. */
export const MENU_LABEL: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, r) => {
    if (typeof r !== 'string') return undefined;
    // `board` may be switched on for one vessel after this file loads.
    if (r === 'Dashboard') return tk(moduleOn('board') ? 'menu.Board' : 'menu.Dashboard');
    return MENU_ROUTES.includes(r) ? tk(`menu.${r}`) : undefined;
  },
  has: (_, r) => r === 'Dashboard' || MENU_ROUTES.includes(r as string),
  ownKeys: () => ['Dashboard', ...MENU_ROUTES],
  getOwnPropertyDescriptor: (_, r) => ({ enumerable: true, configurable: true, value: tk(r === 'Dashboard' ? 'menu.Dashboard' : `menu.${String(r)}`) }),
});

/** Every entry with a name in the menu (keys `menu.<route>` in constants/i18n/en.ts). */
export const MENU_ROUTES: string[] = ["DeckLog", "WatchLog", "Gmdss", "Equipment", "Certificates", "Documents", "Maintenance", "Spares", "HoursOfRest", "Crew", "CrewMatrix", "Permits", "Sopep", "Security", "Surveys", "Readiness", "Dp", "Watch", "Familiar", "Safety", "Drills", "Hospital", "Passengers", "Stores", "Orders", "Finance", "Rounds", "Fuel", "Garbage", "OilRecord", "Sewage", "Ballast", "FuelChangeover", "Ods", "Reports", "Settings"];
