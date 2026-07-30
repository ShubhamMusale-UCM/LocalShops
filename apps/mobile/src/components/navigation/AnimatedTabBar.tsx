// components/navigation/AnimatedTabBar.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext';

// ─── Design System ──────────────────────────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryFaded: 'rgba(13, 148, 136, 0.10)',
  primaryLight: '#CCFBF1',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  purple: '#8B5CF6',
  gray900: '#1F2937',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  card: '#FFFFFF',
  border: '#F1F5F9',
  background: '#F8FAFC',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

// ─── Smooth animation config (iPhone-level) ──────────────────────────────────
const SPRING_SOFT = { damping: 22, stiffness: 250, useNativeDriver: true };
const SPRING_SNAP = { damping: 20, stiffness: 300, useNativeDriver: true };

// ─── Tab Config ──────────────────────────────────────────────────────────────
const TAB_CONFIG: Record<
  string,
  { icon: string; iconFocused: string; label: string; color?: string }
> = {
  Home: { icon: 'home-outline', iconFocused: 'home', label: 'Home', color: DS.primary },
  Search: { icon: 'search-outline', iconFocused: 'search', label: 'Search', color: DS.info },
  Categories: { icon: 'grid-outline', iconFocused: 'grid', label: 'Browse', color: DS.purple },
  Saved: { icon: 'heart-outline', iconFocused: 'heart', label: 'Saved', color: '#EF4444' },
  Cart: { icon: 'bag-outline', iconFocused: 'bag', label: 'Cart', color: DS.warning },
  Profile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile', color: DS.gray700 },
  Dashboard: { icon: 'speedometer-outline', iconFocused: 'speedometer', label: 'Dashboard', color: DS.primary },
  Products: { icon: 'cube-outline', iconFocused: 'cube', label: 'Products', color: DS.info },
  Orders: { icon: 'receipt-outline', iconFocused: 'receipt', label: 'Orders', color: DS.warning },
  Analytics: { icon: 'analytics-outline', iconFocused: 'analytics', label: 'Analytics', color: DS.purple },
  SellerProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile', color: DS.gray700 },
  DeliveryDashboard: { icon: 'bicycle-outline', iconFocused: 'bicycle', label: 'Deliveries', color: DS.primary },
  ActiveDelivery: { icon: 'navigate-outline', iconFocused: 'navigate', label: 'Active', color: DS.success },
  DeliveryHistory: { icon: 'time-outline', iconFocused: 'time', label: 'History', color: DS.info },
  Earnings: { icon: 'cash-outline', iconFocused: 'cash', label: 'Earnings', color: DS.warning },
  DeliveryProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile', color: DS.gray700 },
};

interface AnimatedTabBarProps extends BottomTabBarProps {
  badgeCounts?: Record<string, number>;
}

// ─── Badge Component ─────────────────────────────────────────────────────────
const TabBadge: React.FC<{ count: number }> = ({ count }) => {
  const scaleAnim = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > 0 && prevCount.current !== count) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, ...SPRING_SNAP }),
        Animated.spring(scaleAnim, { toValue: 1, ...SPRING_SOFT }),
      ]).start();
    } else if (count === 0) {
      Animated.timing(scaleAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(1);
    }
    prevCount.current = count;
  }, [count]);

  if (count <= 0) return null;

  return (
    <Animated.View
      style={[styles.badge, { transform: [{ scale: scaleAnim }], minWidth: count > 9 ? 20 : 18 }]}
    >
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
};

// ─── Tab Item Component ───────────────────────────────────────────────────────
const TabItem: React.FC<{
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  badgeCount?: number;
  tabIndex: number;
}> = ({ routeName, isFocused, onPress, onLongPress, accessibilityLabel, badgeCount = 0, tabIndex }) => {
  const config = TAB_CONFIG[routeName] ?? {
    icon: 'help-circle-outline',
    iconFocused: 'help-circle',
    label: routeName,
    color: DS.primary,
  };

  const activeColor = config.color ?? DS.primary;
  const iconName = isFocused ? config.iconFocused : config.icon;

  // Minimal: entry fade only, pill bg + icon scale on focus, press scale
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const bgScaleAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.55)).current;
  const dotOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  // Entry: simple fade, stagger capped at 100ms total
  useEffect(() => {
    Animated.timing(entryOpacity, {
      toValue: 1,
      duration: 180,
      delay: Math.min(tabIndex * 30, 100),
      useNativeDriver: true,
    }).start();
  }, []);

  // Focus transition: soft spring
  useEffect(() => {
    Animated.parallel([
      Animated.spring(bgScaleAnim, { toValue: isFocused ? 1 : 0, ...SPRING_SOFT }),
      Animated.spring(iconScaleAnim, { toValue: isFocused ? 1.08 : 1, ...SPRING_SOFT }),
      Animated.timing(labelOpacity, { toValue: isFocused ? 1 : 0.55, duration: 150, useNativeDriver: true }),
      Animated.spring(dotOpacity, { toValue: isFocused ? 1 : 0, ...SPRING_SOFT }),
    ]).start();
  }, [isFocused]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressScale, { toValue: 0.97, ...SPRING_SNAP }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, ...SPRING_SOFT }).start();
  }, []);

  const activeBgColor = activeColor + '15';

  return (
    <Animated.View style={[styles.tabItem, { opacity: entryOpacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel ?? config.label}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tabPressable}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Animated.View style={[styles.tabItemInner, { transform: [{ scale: pressScale }] }]}>
          {/* Icon container */}
          <View style={styles.iconWrapOuter}>
            {/* Pill background */}
            <Animated.View
              style={[
                styles.iconPill,
                { backgroundColor: activeBgColor, transform: [{ scaleX: bgScaleAnim }], opacity: bgScaleAnim },
              ]}
            />
            {/* Icon */}
            <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
              <Ionicons
                name={iconName as any}
                size={22}
                color={isFocused ? activeColor : DS.gray400}
              />
            </Animated.View>
            {/* Badge */}
            <View style={styles.badgeWrapper}>
              <TabBadge count={badgeCount} />
            </View>
          </View>

          {/* Label */}
          <Animated.Text
            style={[
              styles.label,
              { color: isFocused ? activeColor : DS.gray500, opacity: labelOpacity, fontWeight: isFocused ? '700' : '500' },
            ]}
            numberOfLines={1}
          >
            {config.label}
          </Animated.Text>

          {/* Active dot */}
          <Animated.View
            style={[
              styles.activeDot,
              { backgroundColor: activeColor, opacity: dotOpacity, transform: [{ scale: dotOpacity }] },
            ]}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  state,
  descriptors,
  navigation,
  badgeCounts = {},
}) => {
  const { translateY } = useTabBarVisibility();
  const insets = useSafeAreaInsets();

  // Gentle entry: fade + tiny lift (16px only)
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const containerEntry = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(containerEntry, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  // Hide/show on scroll
  const reanimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [0, 30, 90], [1, 0.7, 0], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: translateY.value }],
      opacity,
    };
  });

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 12);

  return (
    <Reanimated.View style={[styles.outerWrapper, { bottom: bottomInset }, reanimatedStyle]}>
      <Animated.View
        style={[
          styles.tabBarContainer,
          { opacity: containerOpacity, transform: [{ translateY: containerEntry }] },
        ]}
      >
        <View style={styles.tabsRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const badgeCount = badgeCounts[route.name] ?? 0;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.dispatch(TabActions.jumpTo(route.name));
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                badgeCount={badgeCount}
                tabIndex={index}
              />
            );
          })}
        </View>
      </Animated.View>
    </Reanimated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  tabBarContainer: {
    backgroundColor: DS.card,
    borderRadius: DS.radius.xl + 8,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 6 : 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.90)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 52,
  },
  iconWrapOuter: {
    height: 36,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  iconPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: DS.radius.full,
  },
  label: {
    fontSize: 10,
    letterSpacing: -0.1,
    lineHeight: 14,
    textAlign: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: DS.radius.full,
    marginTop: 3,
  },
  badgeWrapper: {
    position: 'absolute',
    top: -4,
    right: 0,
    zIndex: 10,
  },
  badge: {
    height: 18,
    borderRadius: DS.radius.full,
    backgroundColor: DS.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DS.card,
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 13,
    letterSpacing: -0.3,
  },
});

export default AnimatedTabBar;
