import type { ModuleKey } from '../constants/modules';
// The person's screen order for the menu (components/NavMenu) — pure, so `npm run check:access` can test it.

/** The saved order applied to the screens this device shows; new ones go last. */
export function applyOrder(available: string[], saved: string[] | null): string[] {
  if (!saved?.length) return available;
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

export const MENU_GROUPS: MenuGroup[] = [
  { key: 'ops', label: 'Inspections & maintenance', routes: ['Dashboard', 'Equipment', 'Rounds', 'Maintenance', 'Spares', 'Reports'] },
  { key: 'env', label: 'Environment', routes: ['Fuel', 'OilRecord', 'Garbage', 'Sewage', 'Ballast', 'Sopep'] },
  { key: 'security', label: 'Safety & security', routes: ['Drills', 'Safety', 'Security'] },
  { key: 'crew', label: 'Crew', routes: ['Crew', 'Passengers', 'CrewMatrix', 'HoursOfRest', 'Hospital'] },
  { key: 'docs', label: 'Documents & permits', routes: ['Documents', 'Certificates', 'Surveys', 'Permits'] },
  { key: 'system', label: '', routes: ['Settings'] },
];

const OTHER = 'ops';
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
}
export const MENU_CHILDREN: Record<string, MenuChild[]> = {
  Security: [
    { view: 'gangway', label: 'Gangway logbook', icon: 'ferry' },
    { view: 'drills', label: 'ISPS drills', icon: 'run-fast' },
    { view: 'meetings', label: 'Monthly safety meeting', icon: 'account-group-outline', module: 'meetings' },
    { view: 'flashes', label: 'Safety flashes (IMCA)', icon: 'flash-alert-outline' },
  ],
  Hospital: [
    { view: 'register', label: 'Register', icon: 'clipboard-list-outline' },
    { view: 'orders', label: 'Orders', icon: 'truck-delivery-outline' },
    { view: 'archive', label: 'Orders archive', icon: 'archive-outline' },
    { view: 'inventory', label: 'Inventory', icon: 'counter' },
    { view: 'log', label: 'Medical log', icon: 'notebook-outline' },
    { view: 'reference', label: 'Medicine reference', icon: 'book-open-variant' },
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
