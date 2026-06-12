// ===================================
// System-language detection (no native dependency).
// The app UI stays English; only the in-app Manual is localized. If the device
// language is Russian, Spanish or Ukrainian we switch the Manual to it —
// anything else falls back to English.
// ===================================

import { NativeModules, Platform } from 'react-native';

export type Lang = 'en' | 'ru' | 'es' | 'uk';

const LOCALIZED: Lang[] = ['ru', 'es', 'uk'];

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

/** The Manual language: ru/es/uk when the device is set to one, else en. */
export function manualLang(): Lang {
  const code = systemLocale().toLowerCase().slice(0, 2);
  return (LOCALIZED as string[]).includes(code) ? (code as Lang) : 'en';
}
