export const lightColors = {
  background: '#F8FAFC',
  backgroundAlt: '#FFFFFF',
  surface: 'rgba(255, 255, 255, 0.85)',
  surfaceElevated: 'rgba(255, 255, 255, 0.95)',
  card: 'rgba(255, 255, 255, 0.85)',
  cardHover: '#F9FAFB',
  text: '#0F172A',
  textSecondary: 'rgba(15, 23, 42, 0.65)',
  textTertiary: 'rgba(15, 23, 42, 0.45)',
  textInverse: '#FFFFFF',
  border: 'rgba(255, 255, 255, 1)',
  borderLight: 'rgba(255, 255, 255, 0.8)',
  inputBorder: 'rgba(15, 23, 42, 0.15)',
  divider: 'rgba(15, 23, 42, 0.08)',
  overlay: 'rgba(248, 250, 252, 0.6)',
  overlayLight: 'rgba(248, 250, 252, 0.4)',
  shimmer: '#E2E8F0',
  shimmerHighlight: '#F1F5F9',
  badge: '#EF4444',
  badgeText: '#FFFFFF',
  skeleton: 'rgba(15, 23, 42, 0.08)',
};

export const darkColors = {
  background: '#050814',
  backgroundAlt: '#02040A',
  surface: 'rgba(255, 255, 255, 0.035)',
  surfaceElevated: 'rgba(255, 255, 255, 0.07)',
  card: 'rgba(255, 255, 255, 0.05)',
  cardHover: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.4)',
  textInverse: '#0F172A',
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  inputBorder: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.1)',
  overlay: 'rgba(5, 8, 20, 0.85)',
  overlayLight: 'rgba(5, 8, 20, 0.6)',
  shimmer: 'rgba(255, 255, 255, 0.05)',
  shimmerHighlight: 'rgba(255, 255, 255, 0.1)',
  badge: '#EF4444',
  badgeText: '#FFFFFF',
  skeleton: 'rgba(255, 255, 255, 0.08)',
};

export const Colors = {
  // Next-Gen Glassmorphic primary palette
  primary: '#2563EB',
  primaryLight: '#60A5FA',
  primaryDark: '#1D4ED8',
  primaryFaded: 'rgba(37, 99, 235, 0.2)',
  primaryFadedLight: 'rgba(96, 165, 250, 0.3)',
  primaryFadedDark: 'rgba(29, 78, 216, 0.25)',

  secondary: '#06B6D4',
  secondaryLight: '#22D3EE',
  secondaryDark: '#0891B2',
  secondaryFaded: 'rgba(6, 182, 212, 0.2)',
  secondaryFadedLight: 'rgba(34, 211, 238, 0.3)',

  accent: '#06B6D4',
  accentLight: '#22D3EE',
  accentDark: '#0891B2',
  accentFaded: 'rgba(6, 182, 212, 0.2)',

  purple: '#8B5CF6',
  purpleFaded: 'rgba(139, 92, 246, 0.2)',

  success: '#22C55E',
  successLight: '#4ADE80',
  successDark: '#16A34A',
  successFaded: 'rgba(34, 197, 94, 0.2)',

  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  warningFaded: 'rgba(245, 158, 11, 0.2)',

  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  errorFaded: 'rgba(239, 68, 68, 0.2)',

  info: '#3B82F6',
  infoLight: '#60A5FA',
  infoDark: '#2563EB',
  infoFaded: 'rgba(59, 130, 246, 0.2)',

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
    grocery: '#06B6D4',
    electronics: '#2563EB',
    clothing: '#8B5CF6',
    fashion: '#8B5CF6',
    furniture: '#F59E0B',
    food: '#EF4444',
    health: '#22C55E',
    beauty: '#E879F9',
    jewellery: '#FBBF24',
    books: '#64748B',
    sports: '#3B82F6',
    automotive: '#334155',
    hardware: '#D97706',
    pets: '#4ADE80',
    services: '#0EA5E9',
    toys: '#2DD4BF',
    stationery: '#A78BFA',
    homeDecor: '#F59E0B',
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