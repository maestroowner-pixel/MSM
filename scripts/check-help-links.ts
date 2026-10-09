// npm run check:help — every "?" in the app names a manual section that exists.
// Titles are read from the source so a renamed or removed section fails here,
// not as a missing button on a device.
import * as fs from 'fs';
import * as path from 'path';
import { MANUAL } from '../constants/manual';

const root = path.join(__dirname, '..', '..');
const titles = new Set(MANUAL.en.sections.map((s) => s.title));
let failed = 0;
for (const dir of ['screens', 'components']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!f.endsWith('.tsx')) continue;
    const src = fs.readFileSync(path.join(root, dir, f), 'utf8');
    for (const m of src.matchAll(/(?:help|section)="([^"]+)"/g)) {
      const ok = titles.has(m[1]);
      if (!ok) failed++;
      console.log(`${ok ? '✓' : '✗'} ${dir}/${f}: "${m[1]}"`);
    }
  }
}
const langs = Object.keys(MANUAL) as (keyof typeof MANUAL)[];
for (const l of langs) {
  const ok = MANUAL[l].sections.length === MANUAL.en.sections.length;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${l}: ${MANUAL[l].sections.length} sections (en ${MANUAL.en.sections.length})`);
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
