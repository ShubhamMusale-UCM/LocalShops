// components/navigation/AnimatedTabBar.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext';
import { useTheme } from '../../theme';
import { BlurView } from 'expo-blur';

// ─── Smooth animation config (iPhone-level) ──────────────────────────────────
const SPRING_SOFT = { damping: 22, stiffness: 250, useNativeDriver: true };
const SPRING_SNAP = { damping: 20, stiffness: 300, useNativeDriver: true };

// ─── Tab Config ──────────────────────────────────────────────────────────────
const TAB_CONFIG: Record<
  string,
  { icon: string; iconFocused: string; label: string }
> = {
  Home: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  Search: { icon: 'search-outline', iconFocused: 'search', label: 'Search' },
  Categories: { icon: 'grid-outline', iconFocused: 'grid', label: 'Browse' },
  Saved: { icon: 'heart-outline', iconFocused: 'heart', label: 'Saved' },
  Cart: { icon: 'bag-outline', iconFocused: 'bag', label: 'Cart' },
  Profile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
  Dashboard: { icon: 'speedometer-outline', iconFocused: 'speedometer', label: 'Dashboard' },
  Products: { icon: 'cube-outline', iconFocused: 'cube', label: 'Products' },
  Orders: { icon: 'receipt-outline', iconFocused: 'receipt', label: 'Orders' },
  Analytics: { icon: 'analytics-outline', iconFocused: 'analytics', label: 'Analytics' },
  SellerProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
  DeliveryDashboard: { icon: 'bicycle-outline', iconFocused: 'bicycle', label: 'Deliveries' },
  ActiveDelivery: { icon: 'navigate-outline', iconFocused: 'navigate', label: 'Active' },
  DeliveryHistory: { icon: 'time-outline', iconFocused: 'time', label: 'History' },
  Earnings: { icon: 'cash-outline', iconFocused: 'cash', label: 'Earnings' },
  DeliveryProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
};

interface AnimatedTabBarProps extends BottomTabBarProps {
  badgeCounts?: Record<string, number>;
}

// ─── Badge Component ─────────────────────────────────────────────────────────
const TabBadge: React.FC<{ count: number; colors: any }> = ({ count, colors }) => {
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
      style={[styles.badge, { backgroundColor: colors.error, transform: [{ scale: scaleAnim }], minWidth: count > 9 ? 20 : 18 }]}
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
  colors: any;
}> = ({ routeName, isFocused, onPress, onLongPress, accessibilityLabel, badgeCount = 0, tabIndex, colors }) => {
  const config = TAB_CONFIG[routeName] ?? {
    icon: 'help-circle-outline',
    iconFocused: 'help-circle',
    label: routeName,
  };

  const activeColor = colors.primary;
  const iconName = isFocused ? config.iconFocused : config.icon;

  const entryOpacity = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entryOpacity, {
      toValue: 1,
      duration: 180,
      delay: Math.min(tabIndex * 30, 100),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.spring(iconScaleAnim, { toValue: isFocused ? 1.08 : 1, ...SPRING_SOFT }).start();
  }, [isFocused]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressScale, { toValue: 0.9, ...SPRING_SNAP }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, ...SPRING_SOFT }).start();
  }, []);

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
          <View style={styles.iconWrapOuter}>
            <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
              <Ionicons
                name={iconName as any}
                size={22}
                color={isFocused ? colors.textInverse : colors.textTertiary}
              />
            </Animated.View>
            <View style={styles.badgeWrapper}>
              <TabBadge count={badgeCount} colors={colors} />
            </View>
          </View>
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
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();

  const containerOpacity = useRef(new Animated.Value(0)).current;
  const containerEntry = useRef(new Animated.Value(16)).current;

  // Sliding pill indicator
  const indicatorPosition = useSharedValue(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(containerEntry, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    indicatorPosition.value = withSpring(state.index, { damping: 20, stiffness: 200 });
  }, [state.index]);

  const reanimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [0, 30, 90], [1, 0.7, 0], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: translateY.value }],
      opacity,
    };
  });

  const numTabs = state.routes.length;
  // Calculate tab width: Screen width - horizontal padding (32)
  const tabWidth = (width - 32) / numTabs;

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorPosition.value * tabWidth }],
      width: tabWidth,
    };
  });

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 24);

  return (
    <Reanimated.View style={[styles.outerWrapper, { bottom: bottomInset }, reanimatedStyle]}>
      <Animated.View
        style={[
          styles.tabBarContainer,
          { opacity: containerOpacity, transform: [{ translateY: containerEntry }] },
        ]}
      >
        <BlurView intensity={20} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <View style={StyleSheet.absoluteFillObject}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceElevated }} />
        </View>

        {/* Sliding Pill Indicator */}
        <Reanimated.View style={[styles.indicatorWrapper, indicatorStyle]}>
           <View style={[styles.indicatorPill, { backgroundColor: colors.primary }]} />
        </Reanimated.View>

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
                colors={colors}
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
    borderRadius: 999,
    overflow: 'hidden',
    height: 64,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 16,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  indicatorWrapper: {
    position: 'absolute',
    height: '100%',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  indicatorPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -6,
    right: -10,
    zIndex: 10,
  },
  badge: {
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
