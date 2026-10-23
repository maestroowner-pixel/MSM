// The built-in bridge, engine, familiarisation and emergency checklists on screen, in the
// interface language. Keyed by the English phrase (`wc.p.<slug>`), not by line id: the same
// headings, columns and answers ("Checked", "Remarks", "Yes") recur across every form, and
// FAM_GENERAL sits inside three of them. Only on screen — the signed record keeps the lines
// it was signed against, answers are stored in English, and the PDF prints them as written.
// A phrase re-worded (by the vessel, or in services/dp.ts without the dictionary) has no key
// whose English matches, so it shows as written rather than as an out-of-date translation.

import { WATCH_TEMPLATES } from '../services/dp';
import { DICTS, currentLang, tk } from './t';

const BUILT_IN = new Set(WATCH_TEMPLATES.map((x) => x.id));

/** A built-in watch / familiarisation form (or the vessel's re-worded copy of one); DP stays English. */
export const watchBuiltIn = (templateId?: string) => !!templateId && BUILT_IN.has(templateId);

export const watchKey = (s: string) => `wc.p.${s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

export function watchText(s: string, on: boolean): string;
export function watchText(s: string | undefined, on: boolean): string | undefined;
export function watchText(s: string | undefined, on: boolean): string | undefined {
  if (!s || !on || currentLang() === 'en') return s;
  const key = watchKey(s);
  return (DICTS.en as Record<string, string | undefined>)[key] === s ? tk(key) : s;
}
