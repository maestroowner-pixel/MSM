/*
 * Every icon name the app asks for must exist in BOTH icon sets.
 *
 * The app draws MaterialCommunityIcons two different ways: the FONT through
 * @expo/vector-icons on the phones, and SVG paths from @mdi/js on the web (see
 * components/MciIcon.web.tsx — Chromium on Windows would not paint the font).
 * The two sets are versioned separately, so a name can exist in one and not the
 * other, and an unknown name does not fail anywhere: it draws the question-mark
 * fallback, or nothing at all.
 *
 * That is exactly how "Engineering Lifting Equipment" reached a test build with
 * a "?" on its tile (29 Sep 2026) — `hoist` is not an MDI icon, and nothing said
 * so until a person looked at the screen. This says so in a second.
 *
 *   npm run check:icons
 */
import { CATEGORIES } from '../constants/categories';
import { LIFTING_CATEGORIES } from '../constants/lifting';

/* eslint-disable @typescript-eslint/no-var-requires */
const font: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');
const mdi: Record<string, string> = require('@mdi/js');

const mdiKey = (name: string) =>
  'mdi' + name.split('-').map((s) => (s ? s[0].toUpperCase() + s.slice(1) : '')).join('');

let fails = 0;
const check = (name: string, where: string) => {
  const inFont = !!font[name];
  const inMdi = !!mdi[mdiKey(name)];
  if (inFont && inMdi) return;
  fails++;
  const missing = [!inFont && 'the phone font', !inMdi && 'the web set'].filter(Boolean).join(' and ');
  console.log(`FAIL  "${name}" (${where}) is not in ${missing}`);
};

// Category badges — the ones a wrong name shows as a "?" tile in Equipment.
// Both the registered list and the module's own, so a switched-off module is
// still checked; it is about to be switched on.
const seen = new Set<string>();
for (const c of [...CATEGORIES, ...LIFTING_CATEGORIES]) {
  const key = `${c.icon}|${c.key}`;
  if (seen.has(key)) continue;
  seen.add(key);
  check(c.icon, `category ${String(c.key)}`);
}

// The glyphs the emoji map still resolves for the manual and getting-started.
// Read from the SOURCE tree, not from wherever this was compiled to.
const ui = require('fs').readFileSync(
  require('path').join(process.cwd(), 'components/ui.tsx'),
  'utf8'
);
for (const m of ui.matchAll(/^\s*'[^']+':\s*'([a-z0-9-]+)',/gm)) {
  check(m[1], 'components/ui.tsx glyph map');
}

// The picker a vessel chooses its own heading's icon from (Settings → Categories).
const picker = require('fs').readFileSync(
  require('path').join(process.cwd(), 'screens/CategoriesEditSc.tsx'),
  'utf8'
);
const block = picker.match(/const ICONS = \[([\s\S]*?)\];/);
if (!block) { fails++; console.log('FAIL  ICONS list not found in screens/CategoriesEditSc.tsx'); }
else for (const m of block[1].matchAll(/'([a-z0-9-]+)'/g)) check(m[1], 'category icon picker');

console.log(
  fails
    ? `\n${fails} icon name(s) would draw a question mark.`
    : `\nAll ${seen.size} category icons and the glyph map resolve in both sets.`
);
process.exit(fails ? 1 : 0);
