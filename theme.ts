// ===================================
// THEME CONFIGURATION
// Marine Safety Manager (MSM)
// Mirrors Marine Hospital Manager tokens
// ===================================

import type { ViewStyle } from 'react-native';
import type { Group } from './types/equipment';

export const COLORS = {
  // Primary Colors
  primary: '#2E7D99',
  primaryDark: '#1F5670',
  primaryLight: '#4A9BB8',

  // Secondary Colors
  secondary: '#3498DB',
  secondaryDark: '#2874A6',
  secondaryLight: '#5DADE2',

  // Accent / status Colors
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  info: '#00BCD4',

  // Background Colors — flat, faint teal tint (minimalist)
  background: '#E6EFF1',
  backgroundTop: '#E6EFF1',
  backgroundDark: '#DCE8EA',
  card: '#FFFFFF',
  cardSolid: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Gradient (kept flat for token compatibility)
  gradientStart: '#E6EFF1',
  gradientEnd: '#E6EFF1',

  // Text Colors
  text: '#2C3E50',
  textLight: '#7F8C8D',
  textDark: '#1A252F',
  textWhite: '#FFFFFF',

  // Border Colors
  border: '#E2E6EA',
  borderLight: '#EDF0F2',
  borderDark: '#C7CDD3',

  // Tab Bar Colors
  tabActive: '#2E7D99',
  tabInactive: '#7F8C8D',
  tabBackground: '#FFFFFF',

  // Domain group colors
  lsa: '#1565C0',   // Life-Saving Appliances (blue)
  ffe: '#D84315',   // Fire-Fighting Equipment (deep orange/red)
  other: '#607D8B', // Other (slate)

  // Splash Screen
  splashBackground: '#2E7D99',
  splashText: '#FFFFFF',
  splashAccent: '#F39C12',
};

export const SIZES = {
  // Font Sizes
  h1: 32,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  body: 14,
  small: 12,
  tiny: 10,

  // Spacing
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Border Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusRound: 999,

  // Icon Sizes
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 48,
  iconXxl: 64,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
};

export const SHADOWS = {
  small: {
    shadowColor: '#1A252F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#1A252F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  large: {
    shadowColor: '#1A252F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
};

// Cards — flat white with a thin neutral border (minimalist, solid)
export const GLASS = {
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6EA',
    shadowColor: '#1A252F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardStrong: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE1E6',
    shadowColor: '#1A252F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6EA',
  },
};

export const APP_CONFIG = {
  name: 'Marine Safety Manager',
  version: '1.8',
  developer: 'Mykhaylo Osypov',
  company: 'KukaLab',
  year: '2026',
  email: 'kukalab@icloud.com',
  website: 'kuka-lab.com',
};

export const SCREEN_BG = {
  gradient: ['#E6EFF1', '#E6EFF1'] as const,
  gradientDiagonal: ['#E6EFF1', '#E6EFF1', '#E6EFF1'] as const,
  solid: '#E6EFF1',
};

// ===================================
// RUNTIME THEMES
// A Palette carries every colour token plus the composed card/input/shadow
// styles and the per-group badge colours, so screens can switch at runtime.
// `useTheme()` returns the active Palette (consumed as `COLORS` in screens).
// ===================================

export type ThemeName = 'light' | 'dark' | 'colorful';

export interface Palette {
  primary: string; primaryDark: string; primaryLight: string;
  secondary: string; secondaryDark: string; secondaryLight: string;
  success: string; warning: string; danger: string; info: string;
  background: string; backgroundTop: string; backgroundDark: string;
  card: string; cardSolid: string; overlay: string;
  gradientStart: string; gradientEnd: string;
  text: string; textLight: string; textDark: string; textWhite: string;
  border: string; borderLight: string; borderDark: string;
  tabActive: string; tabInactive: string; tabBackground: string;
  lsa: string; ffe: string; other: string;
  splashBackground: string; splashText: string; splashAccent: string;
  // Composed style objects (replace the GLASS / SHADOWS helpers per theme).
  glassCard: ViewStyle; glassCardStrong: ViewStyle; glassInput: ViewStyle;
  shadowSm: ViewStyle; shadowMd: ViewStyle; shadowLg: ViewStyle;
  bgGradient: readonly [string, string];
  // Category badge colour per group (teal everywhere except the colorful theme).
  groupColors: Record<Group, string>;
  // 'light' for dark backgrounds, 'dark' otherwise — drives the status bar.
  statusBar: 'light' | 'dark';
}

const LIGHT: Palette = {
  ...COLORS,
  glassCard: GLASS.card,
  glassCardStrong: GLASS.cardStrong,
  glassInput: GLASS.input,
  shadowSm: SHADOWS.small,
  shadowMd: SHADOWS.medium,
  shadowLg: SHADOWS.large,
  bgGradient: SCREEN_BG.gradient,
  groupColors: { LSA: COLORS.primary, FFE: COLORS.primary, OTHER: COLORS.primary },
  statusBar: 'dark',
};

const DARK: Palette = {
  ...LIGHT,
  primary: '#4A9BB8', primaryDark: '#7FC4DC', primaryLight: '#5DADE2',
  background: '#0E1618', backgroundTop: '#0E1618', backgroundDark: '#0A1012',
  card: '#172226', cardSolid: '#172226', overlay: 'rgba(0, 0, 0, 0.6)',
  gradientStart: '#0E1618', gradientEnd: '#0E1618',
  text: '#E6EDEF', textLight: '#93A4A8', textDark: '#F2F6F7', textWhite: '#FFFFFF',
  border: '#2A383C', borderLight: '#233034', borderDark: '#3A4A4F',
  tabActive: '#4A9BB8', tabInactive: '#7F9296', tabBackground: '#11191B',
  glassCard: {
    backgroundColor: '#172226', borderWidth: 1, borderColor: '#2A383C',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2,
  },
  glassCardStrong: {
    backgroundColor: '#1B282C', borderWidth: 1, borderColor: '#33444A',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 4, elevation: 3,
  },
  glassInput: { backgroundColor: '#11191B', borderWidth: 1, borderColor: '#2A383C' },
  shadowSm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 2, elevation: 1 },
  shadowMd: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2 },
  shadowLg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 },
  bgGradient: ['#0E1618', '#0E1618'] as const,
  groupColors: { LSA: '#4A9BB8', FFE: '#4A9BB8', OTHER: '#4A9BB8' },
  statusBar: 'light',
};

const COLORFUL: Palette = {
  ...LIGHT,
  groupColors: { LSA: '#2E7D32', FFE: '#D32F2F', OTHER: '#2E7D99' },
};

export const THEMES: Record<ThemeName, Palette> = { light: LIGHT, dark: DARK, colorful: COLORFUL };
export const THEME_LABELS: Record<ThemeName, string> = { light: 'Light', dark: 'Dark', colorful: 'Colorful' };
export const THEME_ORDER: ThemeName[] = ['light', 'dark', 'colorful'];
