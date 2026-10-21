// npm run check:i18n — every language dictionary against the English one:
// no key English does not have, the same {placeholders}, nothing empty.
// Missing keys are allowed (they show the English) and are counted, not failed.
import { en } from '../constants/i18n/en';
import { ru } from '../constants/i18n/ru';
import { es } from '../constants/i18n/es';
import { uk } from '../constants/i18n/uk';
import { no } from '../constants/i18n/no';
import { pt } from '../constants/i18n/pt';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const keys = Object.keys(en) as (keyof typeof en)[];
let failed = 0;
for (const [lang, d] of Object.entries({ ru, es, uk, no, pt }) as [string, Record<string, string | undefined>][]) {
  for (const k of Object.keys(d)) {
    const v = d[k] ?? '';
    const base = k.replace(/\.(few|many)$/, '.other');
    const why = !(base in en) ? 'not in en' : !v.trim() ? 'empty' : vars(v) !== vars((en as any)[base]) ? `placeholders {${vars(v)}} ≠ {${vars((en as any)[base])}}` : '';
    if (why) { failed++; console.log(`✗ ${lang} ${k}: ${why}`); }
  }
  const have = keys.filter((k) => d[k]).length;
  console.log(`${have === keys.length ? '✓' : '·'} ${lang}: ${have}/${keys.length} translated`);
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
