// components/ui/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  Easing,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';

// ─── Design Tokens (Radius & Shadow only, Colors moved to theme) ───
const DESIGN = {
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  // Enhanced
  shimmer?: boolean;
  animate?: boolean;
}

// ─── Base Skeleton ────────────────────────────────────────────────────────────
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius = DESIGN.radius.sm,
  style,
  shimmer = true,
  animate = true,
}) => {
  const { colors, isDarkMode } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!animate) return;

    if (shimmer) {
      // Shimmer slide animation
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      // Pulse animation fallback
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [animate, shimmer]);

  const containerWidth =
    typeof width === 'string' ? '100%' : width;

  if (!shimmer) {
    return (
      <Animated.View
        style={[
          {
            width: width as any,
            height,
            borderRadius,
            backgroundColor: colors.skeleton,
            opacity: pulseAnim,
          },
          style,
        ]}
      />
    );
  }

  // Shimmer translateX range based on a reference width (approximated)
  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {animate && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.shimmerOverlay,
            { 
              transform: [{ translateX }],
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)'
            },
          ]}
        />
      )}
    </View>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
export const SkeletonRow: React.FC<{
  items?: number;
  height?: number;
  gap?: number;
  style?: ViewStyle;
}> = ({ items = 2, height = 14, gap = 8, style }) => (
  <View style={[{ gap }, style]}>
    {Array.from({ length: items }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === items - 1 ? '50%' : '85%'}
        height={height}
        borderRadius={DESIGN.radius.full}
      />
    ))}
  </View>
);

export const SkeletonCard: React.FC<{
  style?: ViewStyle;
  imageHeight?: number;
  lines?: number;
}> = ({ style, imageHeight = 160, lines = 3 }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style, DESIGN.shadow]}>
      {/* Image placeholder */}
      <Skeleton
        width="100%"
        height={imageHeight}
        borderRadius={0}
      />

    {/* Content */}
    <View style={styles.cardBody}>
      {/* Badge row */}
      <View style={styles.row}>
        <Skeleton
          width={56}
          height={20}
          borderRadius={DESIGN.radius.full}
          style={{ marginRight: 6 }}
        />
        <Skeleton
          width={40}
          height={20}
          borderRadius={DESIGN.radius.full}
        />
      </View>

      {/* Text lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={
            i === 0
              ? '80%'
              : i === lines - 1
              ? '40%'
              : '65%'
          }
          height={i === 0 ? 16 : 13}
          borderRadius={DESIGN.radius.full}
          style={{ marginTop: i === 0 ? 10 : 6 }}
        />
      ))}

      {/* Price + button row */}
      <View style={[styles.row, { marginTop: 14, justifyContent: 'space-between' }]}>
        <Skeleton
          width={64}
          height={22}
          borderRadius={DESIGN.radius.md}
        />
        <Skeleton
          width={80}
          height={32}
          borderRadius={DESIGN.radius.full}
        />
      </View>
      </View>
    </View>
  );
};

// ─── Skeleton List Item ────────────────────────────────────────────────────────
export const SkeletonListItem: React.FC<{
  style?: ViewStyle;
  avatar?: boolean;
  lines?: number;
}> = ({ style, avatar = true, lines = 2 }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
    {/* Avatar */}
    {avatar && (
      <Skeleton
        width={52}
        height={52}
        borderRadius={DESIGN.radius.full}
        style={{ marginRight: 14, flexShrink: 0 }}
      />
    )}

    {/* Text block */}
    <View style={{ flex: 1, gap: 7 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === 0 ? '65%' : '85%'}
          height={i === 0 ? 15 : 13}
          borderRadius={DESIGN.radius.full}
        />
      ))}
    </View>

    {/* Right side */}
    <View style={{ alignItems: 'flex-end', gap: 8, marginLeft: 12 }}>
      <Skeleton width={44} height={13} borderRadius={DESIGN.radius.full} />
      <Skeleton width={28} height={20} borderRadius={DESIGN.radius.md} />
    </View>
  </View>
  );
};

// ─── Skeleton Grid ────────────────────────────────────────────────────────────
export const SkeletonGrid: React.FC<{
  columns?: number;
  rows?: number;
  gap?: number;
  itemHeight?: number;
  style?: ViewStyle;
}> = ({ columns = 2, rows = 2, gap = 12, itemHeight = 180, style }) => (
  <View style={[{ gap }, style]}>
    {Array.from({ length: rows }).map((_, row) => (
      <View key={row} style={[styles.row, { gap }]}>
        {Array.from({ length: columns }).map((_, col) => (
          <View key={col} style={{ flex: 1 }}>
            <SkeletonCard
              imageHeight={itemHeight}
              lines={2}
              style={{ marginBottom: 0 }}
            />
          </View>
        ))}
      </View>
    ))}
  </View>
);

// ─── Skeleton Header ──────────────────────────────────────────────────────────
export const SkeletonHeader: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.header, style]}>
    <Skeleton width={40} height={40} borderRadius={DESIGN.radius.full} />
    <View style={{ flex: 1, marginHorizontal: 12, gap: 6 }}>
      <Skeleton width="50%" height={14} borderRadius={DESIGN.radius.full} />
      <Skeleton width="70%" height={18} borderRadius={DESIGN.radius.full} />
    </View>
    <Skeleton width={40} height={40} borderRadius={DESIGN.radius.full} />
  </View>
);

// ─── Skeleton Chips Row ───────────────────────────────────────────────────────
export const SkeletonChips: React.FC<{
  count?: number;
  style?: ViewStyle;
}> = ({ count = 5, style }) => (
  <View style={[styles.chipsRow, style]}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        width={60 + (i % 3) * 20}
        height={34}
        borderRadius={DESIGN.radius.full}
        style={{ marginRight: 8 }}
      />
    ))}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shimmerOverlay: {
    width: '60%',
    // Diagonal shimmer
    transform: [{ skewX: '-20deg' }],
  },
  card: {
    borderRadius: DESIGN.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardBody: {
    padding: 14,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: DESIGN.radius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});