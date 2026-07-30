// components/ui/Card.tsx
import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  StyleProp,
  useColorScheme,
  Animated,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const DESIGN = {
  colors: {
    primary: '#0D9488',
    dark: '#0F766E',
    light: '#CCFBF1',
    faded: 'rgba(13,148,136,0.08)',
    cardBg: '#FFFFFF',
    cardBorder: '#F1F5F9',
    darkCard: '#1E293B',
    darkBorder: '#334155',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// ─── Spring Config ────────────────────────────────────────────────────────────
const SPRING_PRESS = {
  damping: 14,
  stiffness: 180,
  useNativeDriver: true,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  // Enhanced props
  animate?: boolean;
  animationDelay?: number;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  pressScale?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  padding = 16,
  shadow = 'sm',
  animate = true,
  animationDelay = 0,
  variant = 'default',
  pressScale = 0.97,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // ── Animation refs ──
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(16)).current;

  // ── Entry animation ──
  React.useEffect(() => {
    if (!animate) {
      entryAnim.setValue(1);
      entryTranslate.setValue(0);
      return;
    }
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(entryAnim, {
          toValue: 1,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, animationDelay);
    return () => clearTimeout(timer);
  }, [animate, animationDelay]);

  // ── Press handlers ──
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: pressScale,
      ...SPRING_PRESS,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_PRESS,
    }).start();
  };

  // ── Variant styles ──
  const getVariantStyle = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: isDark
        ? DESIGN.colors.darkCard
        : DESIGN.colors.cardBg,
      borderColor: isDark
        ? DESIGN.colors.darkBorder
        : DESIGN.colors.cardBorder,
    };

    switch (variant) {
      case 'elevated':
        return {
          ...base,
          borderWidth: 0,
        };
      case 'outlined':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderColor: isDark ? DESIGN.colors.darkBorder : '#E2E8F0',
          borderWidth: 1.5,
        };
      case 'filled':
        return {
          backgroundColor: isDark
            ? DESIGN.colors.darkCard
            : DESIGN.colors.faded,
          borderColor: isDark
            ? DESIGN.colors.darkBorder
            : DESIGN.colors.light,
          borderWidth: 1,
        };
      default:
        return base;
    }
  };

  // ── Shadow style ──
  const getShadowStyle = () => {
    if (shadow === 'none' || variant === 'outlined') return {};
    return DESIGN.shadow[shadow] ?? DESIGN.shadow.sm;
  };

  // ── Composed style ──
  const composedStyle: StyleProp<ViewStyle> = [
    styles.card,
    getVariantStyle(),
    getShadowStyle(),
    { padding },
    style,
  ];

  const animatedContainerStyle = {
    opacity: entryAnim,
    transform: [
      { scale: scaleAnim },
      { translateY: entryTranslate },
    ],
  };

  // ── Render ──
  if (onPress) {
    return (
      <Animated.View style={animatedContainerStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={composedStyle}
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[composedStyle, animatedContainerStyle]}>
      {children}
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: DESIGN.colors.cardBg,
    borderRadius: DESIGN.radius.lg,
    borderWidth: 1,
    borderColor: DESIGN.colors.cardBorder,
    overflow: 'hidden',
    // Ensures minimum touch target height when pressable
    minHeight: Platform.select({ ios: 0, android: 0 }),
  },
});

export default Card;