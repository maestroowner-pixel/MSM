// ===================================
// System-language detection (no native dependency).
// The app UI stays English; only the in-app Manual is localized. If the device
// language is Russian, Spanish, Ukrainian, Norwegian or Portuguese we switch
// the Manual to it — anything else falls back to English.
// ===================================

import { NativeModules, Platform } from 'react-native';

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

/** The Manual language: matches device locale, else en. */
export function manualLang(): Lang {
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
