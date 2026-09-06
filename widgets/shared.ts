// ===================================
// Home-screen widgets — the shared vocabulary between the APP (which owns the
// data) and the WIDGET (which only ever reads a snapshot of it).
//
// A widget process is not the app: on both platforms it wakes up in its own
// sandbox with no access to the live DataContext, so the app hands it a tiny,
// already-computed snapshot through a shared container — an App Group on iOS, a
// plain key in AsyncStorage on Android (which react-native-android-widget's task
// handler can read from its headless JS). Everything in this file is pure so BOTH
// the writer (services/widgetBridge) and the Android reader
// (widgets/widget-task-handler) can import it without pulling in a native module.
//
// Ported from DEM (Deck Equipment Manager). MSM has no "store" grouping, so a
// flagged row's second line is the category (+ position) instead.
// ===================================

import { EquipmentItem } from '../types/equipment';

/** iOS App Group both the app and the widget target are members of. Mirrors the
 *  entitlement in app.json and targets/widget/expo-target.config.js. */
export const APP_GROUP = 'group.com.kukalab.msm';

/** The one key the flagged snapshot lives under — same name in both stores
 *  (App Group UserDefaults on iOS, AsyncStorage on Android). */
export const FLAGGED_KEY = 'msm.widget.flagged';

/** How many flagged items the app exports. The widget shows a window of 3; the
 *  rest are there so the OS timeline can rotate through a longer list over time. */
export const FLAGGED_EXPORT_MAX = 8;

/** How many rows the flagged widget shows at once — the "three rows" it asks for. */
export const FLAGGED_WINDOW = 3;

/** One flagged row as the widget needs it: an id to deep-link back to, and two
 *  strings to show. Deliberately flat (string values only) so it round-trips
 *  through both ExtensionStorage and JSON without surprises. */
export interface FlaggedEntry {
  id: string;
  name: string;
  sub: string;
}

/**
 * The exact list the app pushes to the widget: flagged items, most-recently-
 * touched first (matching FlaggedSc's own order), capped and flattened. `describe`
 * turns one item into its two display lines — supplied by the caller so this file
 * stays free of the category registry (and thus native-free).
 */
export function buildFlaggedSnapshot(
  items: EquipmentItem[],
  describe: (item: EquipmentItem) => { name: string; sub: string }
): FlaggedEntry[] {
  return items
    .filter((i) => i.flagged)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, FLAGGED_EXPORT_MAX)
    .map((i) => {
      const { name, sub } = describe(i);
      return { id: i.id, name: name || 'Item', sub: sub || 'Flagged' };
    });
}

/** The deep link a widget row opens — the same payload a scanned sticker carries,
 *  so a widget row and a scanned label land in exactly one place. */
export function itemDeepLink(id: string): string {
  return `msm://item/${id}`;
}

/** The scanner button on every widget opens the in-app scanner. */
export const SCAN_DEEP_LINK = 'msm://scan';

/**
 * The scan-button icon: a viewfinder frame with a life-buoy in its centre. The
 * buoy is what distinguishes MSM's scanner from the sibling apps' (DEM's is a bare
 * frame) — "marine safety" at a glance. All white, so it reads on the teal button.
 * NO LONGER ON THE WIDGETS — both now show assets/widget-scan-256.png, the QR
 * with the MSM cube in it. Kept because the widget-picker preview images are
 * rendered from this markup, and because it is the mark used wherever the
 * scanner needs a line icon rather than a tile.
 */
export const SCAN_ICON_SVG =
  '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
  '<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round">' +
  '<path d="M9 32 V13 a4 4 0 0 1 4-4 H32"/><path d="M68 9 H87 a4 4 0 0 1 4 4 V32"/>' +
  '<path d="M91 68 V87 a4 4 0 0 1 -4 4 H68"/><path d="M32 91 H13 a4 4 0 0 1 -4-4 V68"/></g>' +
  '<circle cx="50" cy="50" r="15" fill="none" stroke="#fff" stroke-width="7"/>' +
  '<g stroke="#fff" stroke-width="4.5" stroke-linecap="round">' +
  '<line x1="50" y1="28" x2="50" y2="38"/><line x1="50" y1="62" x2="50" y2="72"/>' +
  '<line x1="28" y1="50" x2="38" y2="50"/><line x1="62" y1="50" x2="72" y2="50"/></g></svg>';

/** Widget palette — a frozen copy of the app's brand tokens (theme.ts). The
 *  widget cannot import the live theme (it runs outside React), so the few
 *  colours it needs are pinned here. */
export const WIDGET_COLORS = {
  primary: '#2E7D99',
  primaryDark: '#1F5670',
  warning: '#F39C12',
  card: '#FFFFFF',
  background: '#E6EFF1',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E2E6EA',
} as const;
