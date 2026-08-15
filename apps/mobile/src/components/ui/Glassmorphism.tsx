import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

const SPATIAL_EASING = Easing.bezier(0.175, 0.885, 0.32, 1.275);

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

export function GlassPanel({ children, style, intensity = 80, tint }: GlassProps) {
  const { isDarkMode } = useTheme();
  const activeTint = tint || (isDarkMode ? 'dark' : 'light');

  return (
    <View style={[
      styles.panelContainer,
      isDarkMode ? styles.panelBorderDark : styles.panelBorderLight,
      style
    ]}>
      <BlurView
        intensity={intensity}
        tint={activeTint}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={StyleSheet.absoluteFillObject}>
        <View style={isDarkMode ? styles.panelDarkOverlay : styles.panelLightOverlay} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

interface GlassCardProps extends GlassProps {
  onPress?: () => void;
}

export function GlassCard({ children, style, intensity = 80, tint, onPress }: GlassCardProps) {
  const { isDarkMode } = useTheme();
  const activeTint = tint || (isDarkMode ? 'dark' : 'light');

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 400, easing: SPATIAL_EASING });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 400, easing: SPATIAL_EASING });
  };

  const Component = onPress ? Pressable : View;

  return (
    <Animated.View style={[
      styles.cardContainer,
      isDarkMode ? styles.cardBorderDark : styles.cardBorderLight,
      animatedStyle,
      style
    ]}>
      <Component
        onPress={onPress}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        style={styles.pressableArea}
      >
        <BlurView
          intensity={intensity}
          tint={activeTint}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={StyleSheet.absoluteFillObject}>
          {isDarkMode ? (
            <LinearGradient
              colors={['rgba(19, 27, 46, 0.85)', 'rgba(11, 15, 26, 0.65)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(241, 245, 249, 0.75)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </Component>
    </Animated.View>
  );
}

interface GlassButtonProps extends GlassProps {
  onPress?: () => void;
  disabled?: boolean;
}

export function GlassButton({ children, style, intensity = 80, tint, onPress, disabled }: GlassButtonProps) {
  const { isDarkMode } = useTheme();
  const activeTint = tint || (isDarkMode ? 'dark' : 'light');

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withTiming(0.92, { duration: 250, easing: SPATIAL_EASING });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withTiming(1, { duration: 250, easing: SPATIAL_EASING });
  };

  return (
    <Animated.View style={[
      styles.buttonContainer,
      isDarkMode ? styles.buttonBorderDark : styles.buttonBorderLight,
      animatedStyle,
      style
    ]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.pressableArea}
      >
        <BlurView
          intensity={intensity}
          tint={activeTint}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={StyleSheet.absoluteFillObject}>
          <View style={[isDarkMode ? styles.buttonDarkOverlay : styles.buttonLightOverlay, disabled && styles.disabledOverlay]} />
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  pressableArea: {
    flex: 1,
  },

  // Panel Styles
  panelContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  panelBorderDark: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  panelBorderLight: {
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  panelDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  panelLightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },

  // Card Styles
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 10,
  },
  cardBorderDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardBorderLight: {
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },

  // Button Styles
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  buttonBorderDark: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  buttonBorderLight: {
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  buttonDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonLightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  disabledOverlay: {
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
  },
});
