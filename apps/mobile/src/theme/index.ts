export { Colors, colors } from './colors';
export { Typography, typography } from './typography';
export { Spacing, spacing } from './spacing';
export { Shadows, shadows } from './shadows';
export { wp, hp, fp, scale, verticalScale, touchTarget } from './responsive';
export { getCategoryIcon, categoryIconMap } from './iconography';

import { useThemeStore } from '../store/themeStore';
import { Colors, colors as compatColors, lightColors, darkColors } from './colors';
import { spacing } from './spacing';
import { shadows } from './shadows';

export function useTheme() {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const activeModeColors = isDarkMode ? darkColors : lightColors;

  const mergedColors = {
    ...compatColors,
    ...activeModeColors,
    primary: Colors.primary,
    primaryLight: Colors.primaryLight,
    primaryDark: Colors.primaryDark,
    primaryFaded: isDarkMode ? 'rgba(13, 148, 136, 0.25)' : 'rgba(13, 148, 136, 0.08)',
    border: activeModeColors.border,
    borderLight: activeModeColors.borderLight,
    inputBorder: activeModeColors.inputBorder,
    divider: activeModeColors.divider,
    card: activeModeColors.card,
    text: activeModeColors.text,
    textPrimary: activeModeColors.text,
    textSecondary: activeModeColors.textSecondary,
    textTertiary: activeModeColors.textTertiary,
    textInverse: activeModeColors.textInverse,
    background: activeModeColors.background,
    backgroundAlt: activeModeColors.backgroundAlt,
    surface: activeModeColors.surface,
  };

  return {
    isDarkMode,
    colors: mergedColors,
    radius: spacing.radius,
    shadows: shadows,
    spacing: spacing,
  };
}
