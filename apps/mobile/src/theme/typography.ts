import { TextStyle, Platform } from 'react-native';
import { fp } from './responsive';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const text = (size: number, weight: TextStyle['fontWeight'], lineHeightValue?: number): TextStyle => ({
  fontFamily,
  fontSize: fp(size),
  lineHeight: fp(lineHeightValue || Math.round(size * 1.4)),
  fontWeight: weight,
});

export const Typography = {
  displayLarge: { ...text(34, '700', 40), letterSpacing: -0.4 } as TextStyle,
  display: { ...text(28, '700', 34), letterSpacing: -0.2 } as TextStyle,

  h1: text(24, '700', 30) as TextStyle,
  h2: text(20, '700', 26) as TextStyle,
  h3: text(18, '600', 24) as TextStyle,
  h4: text(16, '600', 22) as TextStyle, // title
  h5: text(14, '600', 20) as TextStyle,
  h6: text(14, '600', 20) as TextStyle,

  bodyLarge: text(16, '400', 24) as TextStyle,
  body: text(14, '400', 20) as TextStyle,
  bodySmall: text(12, '400', 16) as TextStyle,
  bodyTiny: text(11, '400', 14) as TextStyle, // No text under 11px

  bodyLargeMedium: text(16, '500', 24) as TextStyle,
  bodyMedium: text(14, '500', 20) as TextStyle,
  bodySmallMedium: text(12, '500', 16) as TextStyle,

  bodyLargeBold: text(16, '700', 24) as TextStyle,
  bodyBold: text(14, '700', 20) as TextStyle,
  bodySmallBold: text(12, '700', 16) as TextStyle,

  priceXXL: text(28, '700', 34) as TextStyle,
  priceXL: text(24, '700', 30) as TextStyle,
  priceLarge: text(20, '700', 26) as TextStyle,
  price: text(16, '700', 22) as TextStyle,
  priceSmall: text(14, '700', 20) as TextStyle,
  priceTiny: text(12, '700', 16) as TextStyle,

  label: text(14, '500', 20) as TextStyle,
  labelLarge: text(16, '500', 22) as TextStyle,
  labelSmall: text(12, '500', 16) as TextStyle,

  caption: text(12, '400', 16) as TextStyle,
  captionMedium: text(12, '500', 16) as TextStyle,
  captionBold: text(12, '600', 16) as TextStyle,

  badge: {
    ...text(11, '600', 14),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  } as TextStyle,
  badgeLarge: {
    ...text(12, '600', 16),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  } as TextStyle,

  button: text(14, '600') as TextStyle,
  buttonLarge: text(16, '600') as TextStyle,
  buttonSmall: text(12, '600') as TextStyle,

  link: {
    ...text(14, '500'),
    textDecorationLine: 'underline',
  } as TextStyle,
  linkSmall: {
    ...text(12, '500'),
    textDecorationLine: 'underline',
  } as TextStyle,

  overline: {
    ...text(11, '600', 14),
    textTransform: 'uppercase',
    letterSpacing: fp(11) * 0.06,
  } as TextStyle,
} as const;

export const typography = {
  ...Typography,
  body2: Typography.body,
  body3: Typography.bodySmall,
  subtitle1: Typography.bodyLargeMedium,
  subtitle2: Typography.bodyMedium,
  title: Typography.h4,
  subtitle: Typography.bodyMedium,
  paragraph: Typography.body,
};

export const textTransforms = {
  uppercase: { textTransform: 'uppercase' } as TextStyle,
  lowercase: { textTransform: 'lowercase' } as TextStyle,
  capitalize: { textTransform: 'capitalize' } as TextStyle,
  none: { textTransform: 'none' } as TextStyle,
};

export const textDecorations = {
  underline: { textDecorationLine: 'underline' } as TextStyle,
  lineThrough: { textDecorationLine: 'line-through' } as TextStyle,
  none: { textDecorationLine: 'none' } as TextStyle,
};

export const textAlignments = {
  left: { textAlign: 'left' } as TextStyle,
  center: { textAlign: 'center' } as TextStyle,
  right: { textAlign: 'right' } as TextStyle,
  justify: { textAlign: 'justify' } as TextStyle,
};
