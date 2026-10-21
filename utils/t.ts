// ===================================
// t() itself — pure (no React Native), so the pure services and their
// `npm run check:*` scripts can use it: in a script nothing installs a
// resolver, the language is English, and every check reads as before.
// The app installs the resolver in utils/i18n (the `i18n` module + Settings).
// ===================================

import type { Lang } from './locale';
import { en, UiDict, UiKey } from '../constants/i18n/en';
import { ru } from '../constants/i18n/ru';
import { es } from '../constants/i18n/es';
import { uk } from '../constants/i18n/uk';
import { no } from '../constants/i18n/no';
import { pt } from '../constants/i18n/pt';

export type { UiKey } from '../constants/i18n/en';

export const DICTS: Record<Lang, UiDict> = { en, ru, es, uk, no, pt };

let resolve: () => Lang = () => 'en';
export function setLangResolver(f: () => Lang) { resolve = f; }

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** The string for `key` in the interface language, `{name}` filled from vars. */
export function t(key: UiKey, vars?: Record<string, string | number>): string {
  return fill(DICTS[resolve()][key] ?? en[key] ?? key, vars);
}

/** t for a key built at run time (`menu.Security.gangway`); an unknown key returns itself. */
export function tk(key: string, vars?: Record<string, string | number>): string {
  return t(key as UiKey, vars);
}

/** CLDR plural category for these six languages. */
export function pluralCat(lang: Lang, n: number): 'one' | 'few' | 'many' | 'other' {
  const i = Math.abs(Math.trunc(n));
  if (lang === 'ru' || lang === 'uk') {
    if (i % 10 === 1 && i % 100 !== 11) return 'one';
    if (i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 12 || i % 100 > 14)) return 'few';
    return 'many';
  }
  if (lang === 'pt') return i === 0 || i === 1 ? 'one' : 'other';
  return i === 1 ? 'one' : 'other';
}

/**
 * A count with its noun — tn('n.day', 3) → "3 days" / «3 дня». The forms are
 * `${base}.one` / `.few` / `.many` / `.other`, {n} the count; a language
 * without the form it needs falls back to its `.other`, then to English.
 */
export function tn(base: string, n: number, vars?: Record<string, string | number>): string {
  const lang = resolve();
  const d = DICTS[lang] as Record<string, string | undefined>;
  const e = en as Record<string, string | undefined>;
  const cat = pluralCat(lang, n);
  const s = d[`${base}.${cat}`] ?? d[`${base}.other`] ?? e[`${base}.${pluralCat('en', n)}`] ?? e[`${base}.other`] ?? base;
  return fill(s, { n, ...vars });
}

/** The current interface language (English in scripts). */
export function currentLang(): Lang { return resolve(); }

const DATE_LOCALE: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', es: 'es-ES', uk: 'uk-UA', no: 'nb-NO', pt: 'pt-BR' };

/** The locale for toLocaleString — 'en-GB' while the interface is English. */
export function dateLocale(): string { return DATE_LOCALE[resolve()]; }
