import { TextStyle, Platform } from 'react-native';
import { fp } from './responsive';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const headingLineHeight = (size: number) => Math.round(size * 1.2);
const bodyLineHeight = (size: number) => Math.round(size * 1.4);

const text = (size: number, weight: TextStyle['fontWeight'], isHeading = false): TextStyle => ({
  fontFamily,
  fontSize: fp(size),
  lineHeight: isHeading ? headingLineHeight(fp(size)) : bodyLineHeight(fp(size)),
  fontWeight: weight,
});

export const Typography = {
  displayLarge: { ...text(32, '700', true), letterSpacing: -0.4 } as TextStyle,
  display: { ...text(28, '700', true), letterSpacing: -0.2 } as TextStyle,

  h1: text(32, '700', true) as TextStyle,
  h2: text(28, '700', true) as TextStyle,
  h3: text(24, '600', true) as TextStyle,
  h4: text(20, '600', true) as TextStyle,
  h5: text(18, '600', true) as TextStyle,
  h6: text(16, '600', true) as TextStyle,

  bodyLarge: text(16, '400') as TextStyle,
  body: text(14, '400') as TextStyle,
  bodySmall: text(13, '400') as TextStyle,
  bodyTiny: text(12, '400') as TextStyle,

  bodyLargeMedium: text(16, '500') as TextStyle,
  bodyMedium: text(14, '500') as TextStyle,
  bodySmallMedium: text(13, '500') as TextStyle,

  bodyLargeBold: text(16, '700') as TextStyle,
  bodyBold: text(14, '700') as TextStyle,
  bodySmallBold: text(13, '700') as TextStyle,

  priceXXL: text(32, '700', true) as TextStyle,
  priceXL: text(28, '700', true) as TextStyle,
  priceLarge: text(24, '700', true) as TextStyle,
  price: text(20, '700', true) as TextStyle,
  priceSmall: text(16, '700', true) as TextStyle,
  priceTiny: text(12, '700') as TextStyle,

  label: text(14, '500') as TextStyle,
  labelLarge: text(16, '500') as TextStyle,
  labelSmall: text(12, '500') as TextStyle,

  caption: text(12, '400') as TextStyle,
  captionMedium: text(12, '500') as TextStyle,
  captionBold: text(12, '600') as TextStyle,

  badge: {
    ...text(10, '600'),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  } as TextStyle,
  badgeLarge: {
    ...text(11, '600'),
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
    ...text(10, '600'),
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
