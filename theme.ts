// ===================================
// THEME CONFIGURATION
// Marine Safety Manager (MSM)
// Mirrors Marine Hospital Manager tokens
// ===================================

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
  version: '1.3',
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
