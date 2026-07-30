// components/ui/Badge.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const DESIGN = {
  colors: {
    primary: '#0D9488',
    primaryFaded: 'rgba(13,148,136,0.10)',
    primaryLight: '#CCFBF1',
    success: '#10B981',
    successFaded: 'rgba(16,185,129,0.10)',
    error: '#EF4444',
    errorFaded: 'rgba(239,68,68,0.10)',
    warning: '#F59E0B',
    warningFaded: 'rgba(245,158,11,0.10)',
    info: '#3B82F6',
    infoFaded: 'rgba(59,130,246,0.10)',
    purple: '#8B5CF6',
    purpleFaded: 'rgba(139,92,246,0.10)',
    gray700: '#4B5563',
    gray100: '#F3F4F6',
    gray600: '#6B7280',
    secondary: '#8B5CF6',
    secondaryFaded: 'rgba(139,92,246,0.10)',
    white: '#FFFFFF',
  },
  radius: {
    full: 999,
    md: 12,
  },
};

// ─── Variant Config ───────────────────────────────────────────────────────────
const VARIANT_CONFIG = {
  primary: {
    bg: DESIGN.colors.primaryFaded,
    text: DESIGN.colors.primary,
    border: 'rgba(13,148,136,0.15)',
    dot: DESIGN.colors.primary,
  },
  secondary: {
    bg: DESIGN.colors.secondaryFaded,
    text: DESIGN.colors.secondary,
    border: 'rgba(139,92,246,0.15)',
    dot: DESIGN.colors.secondary,
  },
  success: {
    bg: DESIGN.colors.successFaded,
    text: DESIGN.colors.success,
    border: 'rgba(16,185,129,0.15)',
    dot: DESIGN.colors.success,
  },
  warning: {
    bg: DESIGN.colors.warningFaded,
    text: DESIGN.colors.warning,
    border: 'rgba(245,158,11,0.15)',
    dot: DESIGN.colors.warning,
  },
  error: {
    bg: DESIGN.colors.errorFaded,
    text: DESIGN.colors.error,
    border: 'rgba(239,68,68,0.15)',
    dot: DESIGN.colors.error,
  },
  destructive: {
    bg: DESIGN.colors.errorFaded,
    text: DESIGN.colors.error,
    border: 'rgba(239,68,68,0.15)',
    dot: DESIGN.colors.error,
  },
  neutral: {
    bg: DESIGN.colors.gray100,
    text: DESIGN.colors.gray700,
    border: 'rgba(75,85,99,0.12)',
    dot: DESIGN.colors.gray600,
  },
  info: {
    bg: DESIGN.colors.infoFaded,
    text: DESIGN.colors.info,
    border: 'rgba(59,130,246,0.15)',
    dot: DESIGN.colors.info,
  },
  purple: {
    bg: DESIGN.colors.purpleFaded,
    text: DESIGN.colors.purple,
    border: 'rgba(139,92,246,0.15)',
    dot: DESIGN.colors.purple,
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  text?: string;
  label?: string;
  variant?: keyof typeof VARIANT_CONFIG;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: string;
  style?: ViewStyle;
  // Enhanced props
  showDot?: boolean;
  pulseDot?: boolean;
  count?: number;
  solid?: boolean; // filled background style
  animate?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Badge: React.FC<BadgeProps> = ({
  text,
  label,
  variant = 'primary',
  size = 'sm',
  icon,
  style,
  showDot = false,
  pulseDot = false,
  count,
  solid = false,
  animate = false,
}) => {
  const badgeText =
    count !== undefined
      ? count > 99
        ? '99+'
        : String(count)
      : (text ?? label ?? '');

  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.primary;

  // ── Pulse animation for dot ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const entryScale = useRef(new Animated.Value(0.7)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    if (animate) {
      Animated.parallel([
        Animated.spring(entryScale, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(entryOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      entryScale.setValue(1);
      entryOpacity.setValue(1);
    }
  }, [animate]);

  useEffect(() => {
    if (pulseDot && showDot) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pulseDot, showDot]);

  // ── Size styles ──
  const getSizeStyle = (): { badge: ViewStyle; text: TextStyle; dot: ViewStyle; icon: TextStyle } => {
    switch (size) {
      case 'xs':
        return {
          badge: { paddingHorizontal: 6, paddingVertical: 2 },
          text: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
          dot: { width: 5, height: 5, borderRadius: 2.5 },
          icon: { fontSize: 10 },
        };
      case 'sm':
        return {
          badge: { paddingHorizontal: 8, paddingVertical: 3 },
          text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
          dot: { width: 6, height: 6, borderRadius: 3 },
          icon: { fontSize: 11 },
        };
      case 'md':
        return {
          badge: { paddingHorizontal: 10, paddingVertical: 4 },
          text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
          dot: { width: 7, height: 7, borderRadius: 3.5 },
          icon: { fontSize: 12 },
        };
      case 'lg':
        return {
          badge: { paddingHorizontal: 14, paddingVertical: 6 },
          text: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
          dot: { width: 8, height: 8, borderRadius: 4 },
          icon: { fontSize: 13 },
        };
    }
  };

  const sizeStyle = getSizeStyle();

  // ── Solid (filled) style ──
  const solidStyle = solid
    ? {
        backgroundColor: config.text,
        borderColor: config.text,
      }
    : {
        backgroundColor: config.bg,
        borderColor: config.border,
      };

  const textColor = solid ? DESIGN.colors.white : config.text;

  return (
    <Animated.View
      style={[
        styles.badge,
        sizeStyle.badge,
        solidStyle,
        style,
        animate && {
          opacity: entryOpacity,
          transform: [{ scale: entryScale }],
        },
      ]}
    >
      {/* Status dot */}
      {showDot && (
        <Animated.View
          style={[
            styles.dot,
            sizeStyle.dot,
            { backgroundColor: solid ? DESIGN.colors.white : config.dot },
            pulseDot && { opacity: pulseAnim },
            { marginRight: badgeText ? 5 : 0 },
          ]}
        />
      )}

      {/* Icon */}
      {icon && !showDot && (
        <Text
          style={[
            sizeStyle.icon,
            { marginRight: badgeText ? 4 : 0, lineHeight: 18 },
          ]}
        >
          {icon}
        </Text>
      )}

      {/* Label */}
      {badgeText.length > 0 && (
        <Text
          style={[
            sizeStyle.text,
            { color: textColor },
          ]}
          numberOfLines={1}
        >
          {badgeText}
        </Text>
      )}
    </Animated.View>
  );
};

// ─── Notification Count Badge ─────────────────────────────────────────────────
export const CountBadge: React.FC<{
  count: number;
  style?: ViewStyle;
  maxCount?: number;
}> = ({ count, style, maxCount = 99 }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 10,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [count]);

  if (count <= 0) return null;

  return (
    <Animated.View
      style={[
        styles.countBadge,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Text style={styles.countText}>
        {count > maxCount ? `${maxCount}+` : String(count)}
      </Text>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DESIGN.radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: DESIGN.radius.full,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: DESIGN.radius.full,
    backgroundColor: DESIGN.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: DESIGN.colors.white,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: DESIGN.colors.white,
    lineHeight: 14,
  },
});

export default Badge;