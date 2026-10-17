// ===================================
// Access — which tabs each device shows.
//
// WHY. A bosun has no use for the crew-certificate register, the engine room's
// maintenance plan or the monthly reports; a tab bar with them on is clutter he
// learns to ignore, and a tab bar he ignores is one he stops trusting. The Master
// asked to decide per handset, on one screen, with a dot per tab: green on, red
// off (9 Oct 2026). That screen was screens/AccessSc; since 15 Oct 2026 it is part
// of the Master's page (screens/MasterSc), with the pages, gears and ranks.
//
// WHERE IT LIVES. On the device's own record in the vessel's device list
// (`EnrolledDevice.tabs`), written by the Master. firestore.rules forbids a
// device from editing it on itself, the same as its role and its name.
//
// WHAT IT IS NOT. Without a password per person this is tidiness, not security:
// a deckhand handed the bridge tablet sees what the bridge tablet shows. What
// must not be done by the wrong person — changing settings, approving devices,
// rectifying defects — is still decided by the role in the token, not here.
//
// THE DEFAULTS, and why they lean open:
//   - no `tabs` on the record (every device enrolled before this existed, and a
//     device that is not connected to a vessel at all) → every tab. A tab must
//     never vanish from somebody's phone because of an update; only because the
//     Master switched it off.
//   - a Master's device → every tab, always. The Access screen lives under
//     Settings and Settings is always on, but a Master who could hide Reports
//     from himself would only find out when the auditor asked for one.
//   - Dashboard, Equipment and Settings are not optional: without them the app
//     has nothing to open on and no way to scan a label.
// ===================================

import { ModuleKey, moduleOn } from './modules';

export type TabKey = 'certificates' | 'documents' | 'permits' | 'fuel' | 'garbage' | 'sopep' | 'security' | 'surveys' | 'orb' | 'sewage' | 'ballast' | 'rounds' | 'qhse' | 'drills' | 'hospital' | 'passengers' | 'stores' | 'reports' | 'maintenance' | 'spares' | 'rest' | 'readiness' | 'dp' | 'watch';

export interface OptionalTab {
  key: TabKey;
  /** The module the tab belongs to; while it is off the tab does not exist. */
  module?: ModuleKey;
  /** Route name in the tab navigator (index.tsx). */
  route: string;
  /** Tab bar label — short, seven tabs share a phone's width. */
  label: string;
  /** Column header on the Access screen. */
  column: string;
  icon: string;
}

/** In tab-bar order. A new module adds its line here and its screen in index.tsx. */
export const OPTIONAL_TABS: OptionalTab[] = [
  { key: 'certificates', route: 'Certificates', label: 'Certificates', column: 'Certs', icon: 'certificate' },
  { key: 'permits', module: 'ptw', route: 'Permits', label: 'Permits', column: 'PTW', icon: 'clipboard-alert-outline' },
  { key: 'documents', module: 'docs', route: 'Documents', label: 'Docs', column: 'Docs', icon: 'book-open-page-variant' },
  { key: 'maintenance', module: 'pms', route: 'Maintenance', label: 'PMS', column: 'PMS', icon: 'engine' },
  { key: 'fuel', module: 'fuel', route: 'Fuel', label: 'Fuel', column: 'Fuel', icon: 'gas-station' },
  { key: 'garbage', module: 'garbage', route: 'Garbage', label: 'Garbage', column: 'GRB', icon: 'trash-can-outline' },
  { key: 'orb', module: 'orb', route: 'OilRecord', label: 'Oil Record Book', column: 'ORB', icon: 'oil' },
  { key: 'sewage', module: 'sewage', route: 'Sewage', label: 'Sewage record', column: 'Sew', icon: 'water-pump' },
  { key: 'ballast', module: 'ballast', route: 'Ballast', label: 'Ballast water', column: 'BW', icon: 'waves' },
  { key: 'rounds', module: 'rounds', route: 'Rounds', label: 'Inspection rounds', column: 'RND', icon: 'clipboard-check-outline' },
  { key: 'surveys', module: 'surveys', route: 'Surveys', label: 'Surveys', column: 'SRV', icon: 'calendar-check-outline' },
  { key: 'hospital', module: 'hospital', route: 'Hospital', label: 'Hospital', column: 'MED', icon: 'medical-bag' },
  { key: 'stores', module: 'stores', route: 'Stores', label: 'Stores', column: 'STO', icon: 'warehouse' },
  { key: 'passengers', module: 'passengers', route: 'Passengers', label: 'Passengers', column: 'PAX', icon: 'account-group-outline' },
  { key: 'drills', module: 'drills', route: 'Drills', label: 'Drills', column: 'DRL', icon: 'run-fast' },
  { key: 'qhse', module: 'qhse', route: 'Safety', label: 'Safety', column: 'QHSE', icon: 'shield-check-outline' },
  { key: 'sopep', module: 'sopep', route: 'Sopep', label: 'SOPEP', column: 'SOPEP', icon: 'oil' },
  { key: 'security', module: 'security', route: 'Security', label: 'Security', column: 'ISPS', icon: 'shield-account' },
  { key: 'spares', module: 'spares', route: 'Spares', label: 'Spares', column: 'Spares', icon: 'package-variant-closed' },
  { key: 'rest', module: 'rest', route: 'HoursOfRest', label: 'Rest', column: 'Rest', icon: 'bed-clock' },
  { key: 'readiness', module: 'readiness', route: 'Readiness', label: 'Readiness', column: 'RDY', icon: 'clipboard-search-outline' },
  { key: 'dp', module: 'dp', route: 'Dp', label: 'DP', column: 'DP', icon: 'crosshairs-gps' },
  { key: 'watch', module: 'watchChecks', route: 'Watch', label: 'Bridge & engine', column: 'B&E', icon: 'clipboard-text-outline' },
  { key: 'reports', route: 'Reports', label: 'Reports', column: 'Reports', icon: 'file-document' },
];

export const ALL_TABS: TabKey[] = OPTIONAL_TABS.map((t) => t.key);

/** The optional tabs this build offers at all — those whose module is on. */
export function releasedTabs(): OptionalTab[] {
  return OPTIONAL_TABS.filter((t) => !t.module || moduleOn(t.module));
}

/**
 * What a device shows. `tabs` is the record's field, `isMaster` its role.
 * Unknown keys (a tab a newer app version added) are kept but ignored here.
 */
export function visibleTabs(tabs: string[] | undefined | null, isMaster: boolean): Set<TabKey> {
  if (isMaster || !Array.isArray(tabs)) return new Set(ALL_TABS);
  return new Set(ALL_TABS.filter((k) => tabs.includes(k)));
}

// ---- Managing places (15 Oct 2026: "the gears — only for whom the Master allows") ----
//
// The gear beside Stores and SOPEP in the menu opens the places themselves —
// adding a store or a locker, its ID, its label, loading its list. Unlike a tab
// this is closed by default: nobody but the Master has it until the Master
// switches it on for a device (`EnrolledDevice.manage`, set on the Access
// screen; firestore.rules keeps a device from setting it on itself). A device
// on its own, not joined to a vessel, is its own Master.

export type ManageKey = 'stores' | 'sopep';

export const MANAGE_COLUMNS: { key: ManageKey; module: ModuleKey; label: string; column: string; icon: string }[] = [
  { key: 'stores', module: 'stores', label: 'Manage stores', column: 'STO ⚙', icon: 'cog-outline' },
  { key: 'sopep', module: 'sopep', label: 'Manage SOPEP lockers', column: 'SOPEP ⚙', icon: 'cog-outline' },
];

/** The menu entry whose gear each key opens. */
export const MANAGE_ROUTE: Record<string, ManageKey> = { Stores: 'stores', Sopep: 'sopep' };

/** May this device manage these places? */
export function canManage(manage: string[] | undefined | null, key: ManageKey, isMaster: boolean, enrolled: boolean): boolean {
  if (!enrolled || isMaster) return true;
  return Array.isArray(manage) && manage.includes(key);
}

/** Flip one manage key (absent = none). */
export function toggleManage(manage: string[] | undefined | null, key: ManageKey): string[] {
  const base = Array.isArray(manage) ? manage : [];
  return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
}

// ---- Pages under a menu entry (15 Oct 2026, the Master's page) ----
//
// A menu entry's pages — Security's gangway, drills, searches — can be taken off
// one device's menu as its tabs can: `EnrolledDevice.hidePages`, the keys of the
// pages it does NOT show ("Security:searches"), set on the Master's page. Open
// by default, like the tabs; tidiness, not a lock.

export const pageKey = (route: string, view: string) => `${route}:${view}`;

/** Does this device show that page in its menu? */
export function pageShown(hidePages: string[] | undefined | null, key: string, isMaster: boolean, enrolled: boolean): boolean {
  if (!enrolled || isMaster) return true;
  return !(Array.isArray(hidePages) && hidePages.includes(key));
}

/** Show or hide one page (the list holds the hidden ones). */
export function togglePage(hidePages: string[] | undefined | null, key: string): string[] {
  const base = Array.isArray(hidePages) ? hidePages : [];
  return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
}

/** Flip one tab, keeping any keys this version does not know about. */
export function toggleTab(tabs: string[] | undefined | null, key: TabKey): string[] {
  const base = Array.isArray(tabs) ? tabs : ALL_TABS;
  return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
}
