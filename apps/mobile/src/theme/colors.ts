export const lightColors = {
  background: '#F8FAFC',
  backgroundAlt: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardHover: '#F9FAFB',
  text: '#1F2937',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  border: '#F1F5F9',
  borderLight: '#F8FAFC',
  inputBorder: '#E2E8F0',
  divider: '#F1F5F9',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  shimmer: '#E2E8F0',
  shimmerHighlight: '#F1F5F9',
  badge: '#EF4444',
  badgeText: '#FFFFFF',
  skeleton: 'rgba(31, 41, 55, 0.08)',
};

export const darkColors = {
  background: '#0F172A',
  backgroundAlt: '#1E293B',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  card: '#1E293B',
  cardHover: '#334155',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  border: '#334155',
  borderLight: '#475569',
  inputBorder: '#475569',
  divider: '#334155',
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#334155',
  shimmerHighlight: '#475569',
  badge: '#F87171',
  badgeText: '#FFFFFF',
  skeleton: 'rgba(248, 250, 252, 0.08)',
};

export const Colors = {
  // Teal premium palette (#0D9488)
  primary: '#0D9488',
  primaryLight: '#CCFBF1',
  primaryDark: '#0F766E',
  primaryFaded: 'rgba(13, 148, 136, 0.08)',
  primaryFadedLight: 'rgba(204, 251, 241, 0.3)',
  primaryFadedDark: 'rgba(15, 118, 110, 0.25)',

  secondary: '#F59E0B',
  secondaryLight: '#FBBF24',
  secondaryDark: '#D97706',
  secondaryFaded: 'rgba(245, 158, 11, 0.12)',
  secondaryFadedLight: 'rgba(245, 158, 11, 0.08)',

  accent: '#EF4444',
  accentLight: '#F87171',
  accentDark: '#DC2626',
  accentFaded: 'rgba(239, 68, 68, 0.12)',

  success: '#059669',
  successLight: '#6EE7B7',
  successDark: '#047857',
  successFaded: 'rgba(5, 150, 105, 0.12)',

  warning: '#D97706',
  warningLight: '#FCD34D',
  warningDark: '#B45309',
  warningFaded: 'rgba(217, 119, 6, 0.12)',

  error: '#DC2626',
  errorLight: '#FCA5A5',
  errorDark: '#B91C1C',
  errorFaded: 'rgba(220, 38, 38, 0.12)',

  info: '#0EA5E9',
  infoLight: '#7DD3FC',
  infoDark: '#0284C7',
  infoFaded: 'rgba(14, 165, 233, 0.12)',

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

  sentimentPositive: '#059669',
  sentimentNeutral: '#D97706',
  sentimentNegative: '#DC2626',

  star: '#D97706',
  starEmpty: '#CBD5E1',
  starHalf: '#F59E0B',

  status: {
    online: '#059669',
    offline: '#94A3B8',
    busy: '#DC2626',
    away: '#D97706',
  },

  category: {
    grocery: '#0D9488',
    electronics: '#0EA5E9',
    clothing: '#E11D74',
    fashion: '#FB7185',
    furniture: '#D97706',
    food: '#DC2626',
    health: '#059669',
    beauty: '#BE185D',
    jewellery: '#B45309',
    books: '#475569',
    sports: '#0284C7',
    automotive: '#334155',
    hardware: '#B45309',
    pets: '#10B981',
    services: '#0F766E',
    toys: '#14B8A6',
    stationery: '#06B6D4',
    homeDecor: '#F59E0B',
  },

  gradient: {
    primary: ['#0F766E', '#14B8A6'] as const,
    primaryReverse: ['#14B8A6', '#0F766E'] as const,
    secondary: ['#B45309', '#F59E0B'] as const,
    accent: ['#E11D74', '#FB7185'] as const,
    sunset: ['#E11D74', '#FB7185'] as const,
    ocean: ['#0F766E', '#14B8A6'] as const,
    forest: ['#047857', '#0D9488'] as const,
    premium: ['#B45309', '#F59E0B'] as const,
    dark: ['#0F172A', '#334155'] as const,
    light: ['#F8FAFC', '#FEFCE8'] as const,
    blue: ['#0284C7', '#0EA5E9'] as const,
    warm: ['#D97706', '#E11D74'] as const,
  },

  overlay: {
    light: 'rgba(255, 255, 255, 0.9)',
    medium: 'rgba(255, 255, 255, 0.95)',
    dark: 'rgba(0, 0, 0, 0.5)',
    darker: 'rgba(0, 0, 0, 0.7)',
    darkest: 'rgba(0, 0, 0, 0.85)',
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
  infoFaded: 'rgba(59, 130, 246, 0.08)',
  successFaded: 'rgba(16, 185, 129, 0.08)',
  errorFaded: 'rgba(239, 68, 68, 0.08)',
  warningFaded: 'rgba(245, 158, 11, 0.08)',
  purple: '#8B5CF6',
  purpleFaded: 'rgba(139, 92, 246, 0.08)',

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