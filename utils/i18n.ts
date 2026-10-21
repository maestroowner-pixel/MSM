// ===================================
// Interface translation — t('settings.language.label').
//
// English (constants/i18n/en.ts) is the source; every other language is a
// partial dictionary, and a key it lacks shows the English — so a screen can be
// moved onto t() before its translations exist, and nothing ever shows a key.
//
// Ships dark: until the `i18n` module is on, uiLang() is 'en' whatever the
// device or the stored choice says, and t() returns exactly today's words.
//
// A component that must redraw when the language changes calls useT(); plain
// t() is right for anything computed on the spot (alerts, PDFs are not here).
// ===================================

import { useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t, setLangResolver } from './t';
import { LANGS, Lang, chosenLang, setChosenLangValue, uiLang } from './locale';

export { t, tk, tn, DICTS, currentLang, dateLocale } from './t';
export type { UiKey } from './t';

export const UI_LANG_KEY = 'msm:ui_lang';

setLangResolver(uiLang);

// ---- the choice, persisted ---------------------------------------------------

const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version++; listeners.forEach((f) => f()); };

const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as string[]).includes(v);

// A browser can read it before the first render; native reads it at launch (loadUiLang).
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(UI_LANG_KEY) : null;
  if (isLang(raw)) setChosenLangValue(raw);
} catch {}

export async function loadUiLang(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UI_LANG_KEY);
    const v = isLang(raw) ? raw : null;
    if (v !== chosenLang()) { setChosenLangValue(v); notify(); }
  } catch {}
}

/** null = follow the device. */
export async function setUiLang(l: Lang | null): Promise<void> {
  setChosenLangValue(l);
  notify();
  try {
    if (l) await AsyncStorage.setItem(UI_LANG_KEY, l);
    else await AsyncStorage.removeItem(UI_LANG_KEY);
  } catch {}
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/**
 * t, re-rendering the caller when the language changes. The function is a new
 * one after each change, so a useMemo that lists it in its deps recomputes.
 */
export function useT(): typeof t {
  const v = useSyncExternalStore(subscribe, () => version, () => version);
  return useMemo(() => ((k, vars) => t(k, vars)) as typeof t, [v]);
}
