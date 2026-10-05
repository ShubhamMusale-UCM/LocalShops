export const lightColors = {
  background: '#F8FAFC',
  backgroundAlt: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  card: '#FFFFFF',
  cardHover: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#F1F5F9',
  border: 'rgba(15, 23, 42, 0.08)',
  borderLight: 'rgba(15, 23, 42, 0.04)',
  inputBorder: 'rgba(15, 23, 42, 0.15)',
  divider: 'rgba(15, 23, 42, 0.08)',
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.4)',
  shimmer: '#E2E8F0',
  shimmerHighlight: '#F1F5F9',
  badge: '#F87171',
  badgeText: '#FFFFFF',
  skeleton: 'rgba(15, 23, 42, 0.08)',
};

export const darkColors = {
  background: '#0A0F1A',
  backgroundAlt: '#111827',
  surface: '#111827',
  surfaceElevated: '#172033',
  card: '#111827',
  cardHover: '#172033',
  text: '#F1F5F9',
  textSecondary: '#A3B1C6',
  textTertiary: '#7C8AA0',
  textInverse: '#0F172A',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  inputBorder: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(10, 15, 26, 0.85)',
  overlayLight: 'rgba(10, 15, 26, 0.6)',
  shimmer: 'rgba(255, 255, 255, 0.05)',
  shimmerHighlight: 'rgba(255, 255, 255, 0.1)',
  badge: '#F87171',
  badgeText: '#0A0F1A',
  skeleton: 'rgba(255, 255, 255, 0.08)',
};

export const Colors = {
  // Next-Gen Glassmorphic primary palette (Phase 1 teal/cyan)
  primary: '#22D3EE',
  primaryLight: '#67E8F9',
  primaryDark: '#06B6D4',
  primaryFaded: 'rgba(34, 211, 238, 0.2)',
  primaryFadedLight: 'rgba(103, 232, 249, 0.3)',
  primaryFadedDark: 'rgba(6, 182, 212, 0.25)',

  secondary: '#06B6D4',
  secondaryLight: '#22D3EE',
  secondaryDark: '#0891B2',
  secondaryFaded: 'rgba(6, 182, 212, 0.2)',
  secondaryFadedLight: 'rgba(34, 211, 238, 0.3)',

  accent: '#22D3EE',
  accentLight: '#67E8F9',
  accentDark: '#06B6D4',
  accentFaded: 'rgba(34, 211, 238, 0.2)',

  purple: '#8B5CF6',
  purpleFaded: 'rgba(139, 92, 246, 0.2)',

  success: '#34D399',
  successLight: '#6EE7B7',
  successDark: '#10B981',
  successFaded: 'rgba(52, 211, 153, 0.2)',

  warning: '#FBBF24',
  warningLight: '#FCD34D',
  warningDark: '#F59E0B',
  warningFaded: 'rgba(251, 191, 36, 0.2)',

  error: '#F87171',
  errorLight: '#FCA5A5',
  errorDark: '#EF4444',
  errorFaded: 'rgba(248, 113, 113, 0.2)',

  info: '#22D3EE',
  infoLight: '#67E8F9',
  infoDark: '#06B6D4',
  infoFaded: 'rgba(34, 211, 238, 0.2)',

  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  light: lightColors,
  dark: darkColors,

  sentimentPositive: '#22C55E',
  sentimentNeutral: '#F59E0B',
  sentimentNegative: '#EF4444',

  star: '#F59E0B',
  starEmpty: 'rgba(255, 255, 255, 0.2)',
  starHalf: '#FBBF24',

  status: {
    online: '#22C55E',
    offline: '#94A3B8',
    busy: '#EF4444',
    away: '#F59E0B',
  },

  category: {
    grocery: '#22D3EE',
    electronics: '#22D3EE',
    clothing: '#22D3EE',
    fashion: '#22D3EE',
    furniture: '#22D3EE',
    food: '#22D3EE',
    health: '#22D3EE',
    beauty: '#22D3EE',
    jewellery: '#22D3EE',
    books: '#22D3EE',
    sports: '#22D3EE',
    automotive: '#22D3EE',
    hardware: '#22D3EE',
    pets: '#22D3EE',
    services: '#22D3EE',
    toys: '#22D3EE',
    stationery: '#22D3EE',
    homeDecor: '#22D3EE',
  },

  gradient: {
    primary: ['#2563EB', '#06B6D4'] as const,
    primaryReverse: ['#06B6D4', '#2563EB'] as const,
    secondary: ['#8B5CF6', '#D946EF'] as const,
    accent: ['#06B6D4', '#3B82F6'] as const,
    sunset: ['#F59E0B', '#EF4444'] as const,
    ocean: ['#2563EB', '#06B6D4'] as const,
    forest: ['#059669', '#10B981'] as const,
    premium: ['#1E293B', '#0F172A'] as const,
    dark: ['rgba(5, 8, 20, 0.9)', 'rgba(5, 8, 20, 0.3)'] as const,
    light: ['rgba(248, 250, 252, 0.9)', 'rgba(248, 250, 252, 0.3)'] as const,
    blue: ['#2563EB', '#3B82F6'] as const,
    warm: ['#F59E0B', '#EF4444'] as const,
  },

  overlay: {
    light: 'rgba(255, 255, 255, 0.6)',
    medium: 'rgba(255, 255, 255, 0.8)',
    dark: 'rgba(5, 8, 20, 0.5)',
    darker: 'rgba(5, 8, 20, 0.8)',
    darkest: 'rgba(5, 8, 20, 0.95)',
  },

  social: {
    facebook: '#1877F2',
    whatsapp: '#25D366',
    instagram: '#E4405F',
    twitter: '#1DA1F2',
    youtube: '#FF0000',
    linkedin: '#0A66C2',
  },
} as const;

export type ThemeColors = typeof Colors.light | typeof Colors.dark;

// Compatibility object for screens using lowercase token names.
export const colors = {
  primary: Colors.primary,
  primaryLight: Colors.primaryLight,
  primaryDark: Colors.primaryDark,
  primaryFaded: Colors.primaryFaded,

  secondary: Colors.secondary,
  secondaryLight: Colors.secondaryLight,
  secondaryDark: Colors.secondaryDark,

  accent: Colors.accent,
  accentLight: Colors.accentLight,

  success: Colors.success,
  successLight: Colors.successLight,

  warning: Colors.warning,
  warningLight: Colors.warningLight,

  error: Colors.error,
  errorLight: Colors.errorLight,
  destructive: Colors.error,

  info: Colors.info,
  infoLight: Colors.infoLight,
  infoFaded: Colors.infoFaded,
  successFaded: Colors.successFaded,
  errorFaded: Colors.errorFaded,
  warningFaded: Colors.warningFaded,
  purple: Colors.purple,
  purpleFaded: Colors.purpleFaded,

  white: Colors.white,
  black: Colors.black,

  background: lightColors.background,
  backgroundAlt: lightColors.backgroundAlt,
  surface: lightColors.surface,

  lightGray: Colors.gray[100],
  gray: Colors.gray[500],
  darkGray: Colors.gray[700],

  gray50: Colors.gray[50],
  gray100: Colors.gray[100],
  gray200: Colors.gray[200],
  gray300: Colors.gray[300],
  gray400: Colors.gray[400],
  gray500: Colors.gray[500],
  gray600: Colors.gray[600],
  gray700: Colors.gray[700],
  gray800: Colors.gray[800],
  gray900: Colors.gray[900],

  neutral200: Colors.gray[200],
  neutral300: Colors.gray[300],
  neutral400: Colors.gray[400],
  neutral500: Colors.gray[500],
  neutral600: Colors.gray[600],
  neutral700: Colors.gray[700],
  neutral800: Colors.gray[800],
  neutral900: Colors.gray[900],

  // Additional compatibility
  border: lightColors.border,
  divider: lightColors.divider,
  overlay: lightColors.overlay,

  star: Colors.star,
  starEmpty: Colors.starEmpty,
  card: lightColors.card,
  textPrimary: lightColors.text,
  textSecondary: lightColors.textSecondary,
} as const;