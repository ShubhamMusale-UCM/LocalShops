import { Platform, ViewStyle } from 'react-native';

export const Shadows = {
  none: {} as ViewStyle,

  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle,

  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,

  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
    },
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,

  xl: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    },
    android: { elevation: 12 },
    default: {},
  }) as ViewStyle,

  // Special: colored shadow for cards
  colored: (color: string) => Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: { elevation: 5 },
    default: {},
  }) as ViewStyle,
} as const;

// Compatibility alias for modules that import lowercase shadows tokens.
export const shadows = Shadows;
