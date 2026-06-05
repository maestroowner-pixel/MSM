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

  // Background Colors
  background: '#DAEEF7',
  backgroundTop: '#B8D9ED',
  backgroundDark: '#A5C8E0',
  card: 'rgba(255, 255, 255, 0.70)',
  cardSolid: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Gradient
  gradientStart: '#B8D9ED',
  gradientEnd: '#DAEEF7',

  // Text Colors
  text: '#2C3E50',
  textLight: '#7F8C8D',
  textDark: '#1A252F',
  textWhite: '#FFFFFF',

  // Border Colors
  border: '#E0E6ED',
  borderLight: '#F0F3F5',
  borderDark: '#BDC3C7',

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
    shadowColor: '#2E7D99',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1F5670',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#1F5670',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Glassmorphism cards
export const GLASS = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.90)',
    shadowColor: '#1F5670',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardStrong: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#1F5670',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.80)',
  },
};

export const APP_CONFIG = {
  name: 'Marine Safety Manager',
  version: '1.0.0',
  developer: 'Mykhaylo Osypov',
  company: 'KukaLab',
  year: '2026',
  email: 'kukalab@icloud.com',
  website: 'kuka-lab.com',
};

export const SCREEN_BG = {
  gradient: ['#B8D9ED', '#DAEEF7'] as const,
  gradientDiagonal: ['#C2E0F0', '#DAEEF7', '#EAF5FB'] as const,
  solid: '#DAEEF7',
};
