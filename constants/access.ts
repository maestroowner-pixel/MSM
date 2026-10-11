// ===================================
// Access — which tabs each device shows.
//
// WHY. A bosun has no use for the crew-certificate register, the engine room's
// maintenance plan or the monthly reports; a tab bar with them on is clutter he
// learns to ignore, and a tab bar he ignores is one he stops trusting. The Master
// asked to decide per handset, on one screen, with a dot per tab: green on, red
// off (9 Oct 2026). That screen is screens/AccessSc.
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

export type TabKey = 'certificates' | 'documents' | 'permits' | 'fuel' | 'garbage' | 'sopep' | 'security' | 'surveys' | 'orb' | 'reports' | 'maintenance' | 'spares' | 'rest';

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
  { key: 'surveys', module: 'surveys', route: 'Surveys', label: 'Surveys', column: 'SRV', icon: 'calendar-check-outline' },
  { key: 'sopep', module: 'sopep', route: 'Sopep', label: 'SOPEP', column: 'SOPEP', icon: 'oil' },
  { key: 'security', module: 'security', route: 'Security', label: 'Security', column: 'ISPS', icon: 'shield-account' },
  { key: 'spares', module: 'spares', route: 'Spares', label: 'Spares', column: 'Spares', icon: 'package-variant-closed' },
  { key: 'rest', module: 'rest', route: 'HoursOfRest', label: 'Rest', column: 'Rest', icon: 'bed-clock' },
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

/** Flip one tab, keeping any keys this version does not know about. */
export function toggleTab(tabs: string[] | undefined | null, key: TabKey): string[] {
  const base = Array.isArray(tabs) ? tabs : ALL_TABS;
  return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
}
