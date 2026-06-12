// ===================================
// Theme context
// Holds the active theme name (persisted) and exposes the live Palette.
// Screens call useTheme() and treat the result as `COLORS`; their StyleSheet
// is rebuilt via a makeStyles(COLORS) factory whenever the theme changes.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palette, ThemeName, THEMES } from '../theme';

const THEME_KEY = 'msm:theme';

interface ThemeCtx {
  name: ThemeName;
  palette: Palette;
  setTheme: (name: ThemeName) => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (v && v in THEMES) setName(v as ThemeName);
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setName(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ name, palette: THEMES[name], setTheme }}>{children}</Ctx.Provider>;
}

/** The active palette — consumed as `COLORS` inside screens. */
export function useTheme(): Palette {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx.palette;
}

/** Theme name + setter, for the Settings selector. */
export function useThemeName(): { name: ThemeName; setTheme: (n: ThemeName) => void } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useThemeName must be used within ThemeProvider');
  return { name: ctx.name, setTheme: ctx.setTheme };
}
