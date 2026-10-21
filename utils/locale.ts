// ===================================
// System-language detection (no native dependency).
// The Manual follows the device language — Russian, Spanish, Ukrainian,
// Norwegian or Portuguese, anything else English. The interface (utils/i18n)
// stays English until the `i18n` module is on; then it follows the device too,
// or the language chosen in Settings, and the Manual follows that choice.
// ===================================

import { NativeModules, Platform } from 'react-native';
import { moduleOn } from '../constants/modules';

export type Lang = 'en' | 'ru' | 'es' | 'uk' | 'no' | 'pt';

/** Best-effort device locale string (e.g. "ru_RU", "es-ES", "uk_UA"). */
function systemLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const s: any = NativeModules.SettingsManager?.settings;
      return (s?.AppleLocale || s?.AppleLanguages?.[0] || '') as string;
    }
    // Android
    return (NativeModules.I18nManager?.localeIdentifier || '') as string;
  } catch {
    return '';
  }
}

export const LANGS: Lang[] = ['en', 'ru', 'es', 'uk', 'no', 'pt'];

/** Each language in its own words — how a picker should name it. */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', ru: 'Русский', es: 'Español', uk: 'Українська', no: 'Norsk', pt: 'Português',
};

// The language picked in Settings (null = as the device). Kept here rather than
// in utils/i18n so the Manual can honour it without importing the dictionaries.
let chosen: Lang | null = null;
export function chosenLang(): Lang | null { return chosen; }
export function setChosenLangValue(l: Lang | null) { chosen = l; }

/** The interface language: English until the `i18n` module is released. */
export function uiLang(): Lang {
  if (!moduleOn('i18n')) return 'en';
  return chosen ?? deviceLang();
}

/** The Manual language: the one chosen in Settings (with `i18n` on), else the device's. */
export function manualLang(): Lang {
  return moduleOn('i18n') && chosen ? chosen : deviceLang();
}

/** The device's language if the app has it, else en. */
export function deviceLang(): Lang {
  const full = systemLocale().toLowerCase();
  const code = full.slice(0, 2);
  if (code === 'ru') return 'ru';
  if (code === 'es') return 'es';
  if (code === 'uk') return 'uk';
  if (code === 'pt') return 'pt';
  // Norwegian: nb (Bokmål, most common), nn (Nynorsk), no (generic)
  if (code === 'nb' || code === 'nn' || code === 'no') return 'no';
  return 'en';
}
