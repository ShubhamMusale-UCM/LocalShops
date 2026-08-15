import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  isDarkMode?: boolean;
}

export function GlassPanel({
  children,
  style,
  intensity = Platform.OS === 'ios' ? 20 : 60,
  tint,
  isDarkMode: propIsDarkMode,
}: GlassPanelProps) {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode ?? themeIsDarkMode;

  const defaultTint = tint || (isDarkMode ? 'dark' : 'light');

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint={defaultTint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.borderOverlay, isDarkMode ? styles.darkOverlay : styles.lightOverlay]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  darkOverlay: {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderLeftColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    borderRightColor: 'rgba(0, 0, 0, 0.5)',
  },
  lightOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  }
});
