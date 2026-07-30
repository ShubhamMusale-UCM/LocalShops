import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import { getPrimarySellerShop } from '../../services/sellerShopContext';
import { sanitizeImageUrl, getSingleImageUrl } from '../../utils/image';
import { useTheme } from '../../theme';

const getStyles = (colors: any, radius: any, isDarkMode: boolean, topInset: number = 0) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      height: topInset + 44,
    },
    stickyHeaderInner: {
      flex: 1,
      marginTop: topInset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    heroSection: {
      alignItems: 'center',
      paddingTop: topInset + 16,
      paddingBottom: 28,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 20,
    },
    avatarContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: 16,
    },
    avatarFallback: {
      flex: 1,
      borderRadius: 48,
      backgroundColor: colors.primaryFaded,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
    },
    avatarImage: {
      flex: 1,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.success,
      borderWidth: 3,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroName: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    heroSub: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 12,
    },
    heroPills: {
      flexDirection: 'row',
      gap: 8,
    },
    heroPill: {
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
    },
    heroPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    proBannerWrap: {
      marginHorizontal: 16,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    proBanner: {
      borderRadius: radius.lg,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: isDarkMode ? colors.border : '#0F766E',
    },
    proLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    proIconRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(251, 191, 36, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    proTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    proSub: {
      fontSize: 12,
      color: '#CCFBF1',
      marginTop: 2,
    },
    proBtn: {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 99,
    },
    proBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    listGroup: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      borderRadius: radius.lg,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 8,
      elevation: 1,
    },
    groupLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textTertiary,
      marginLeft: 32,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    listItemWrap: {
      backgroundColor: 'transparent',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    listItemFirst: {
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    listItemLast: {
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    listIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    listLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    listValue: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    listDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 60,
    },
    dangerGroup: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
    },
    dangerBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.error,
    },
  });
};

const SPRING_SOFT = { damping: 22, stiffness: 250, useNativeDriver: true as true };
const SPRING_SNAP = { damping: 20, stiffness: 300, useNativeDriver: true as true };

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function GroupedListItem({
  icon,
  label,
  value,
  onPress,
  isFirst = false,
  isLast = false,
  iconBg,
  iconColor,
  hideChevron = false,
  s,
  colors,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  iconBg: string;
  iconColor: string;
  hideChevron?: boolean;
  s: any;
  colors: any;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const content = (
    <View style={[s.listItem, isFirst && s.listItemFirst, isLast && s.listItemLast]}>
      <View style={[s.listIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={s.listLabel} numberOfLines={1}>{label}</Text>
      {value ? <Text style={s.listValue}>{value}</Text> : null}
      {!hideChevron && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />}
    </View>
  );

  if (!onPress) {
    return (
      <View style={s.listItemWrap}>
        {content}
        {!isLast && <View style={s.listDivider} />}
      </View>
    );
  }

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={() => Animated.spring(pressScale, { toValue: 0.96, ...SPRING_SNAP }).start()}
      onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING_SOFT }).start()}
      activeOpacity={1}
      style={[s.listItemWrap, { transform: [{ scale: pressScale }] }]}
    >
      {content}
      {!isLast && <View style={s.listDivider} />}
    </AnimatedTouchable>
  );
}

export default function SellerProfileScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, isDarkMode } = useTheme();
  const { toggleTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 20;
  const s = getStyles(colors, radius, isDarkMode, topInset);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const switchRole = useAuthStore((s) => s.switchRole);
  const activeRole = useAuthStore((s) => s.activeRole);

  const { onScroll: _onScroll, scrollEventThrottle } = useHideTabBarOnScroll();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [shop, setShop] = useState<any>(null);

  useEffect(() => {
    getPrimarySellerShop().then(setShop).catch(console.error);
  }, []);

  const subscription = { plan: 'PRO SELLER', expiryDate: '12 Oct, 2026', status: 'Active' };

  const headerOpacity = scrollY.interpolate({ inputRange: [60, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const avatarScale = scrollY.interpolate({ inputRange: [-50, 0, 100], outputRange: [1.2, 1, 0.8], extrapolate: 'clamp' });
  const avatarTranslate = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 20], extrapolate: 'clamp' });

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: any) => _onScroll(e),
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Floating Header on Scroll */}
      <View style={s.stickyHeader}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: headerOpacity }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.96)',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            />
          )}
        </Animated.View>
        <View style={s.stickyHeaderInner}>
          <Animated.Text style={[s.stickyTitle, { opacity: headerOpacity }]}>Seller Profile</Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scrollContent}
      >
        {/* Hero Section */}
        <View style={s.heroSection}>
          <LinearGradient
            colors={isDarkMode ? [colors.backgroundAlt, colors.background] : ['#EDFCF6', colors.background]}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View style={[s.avatarContainer, { transform: [{ scale: avatarScale }, { translateY: avatarTranslate }] }]}>
            {sanitizeImageUrl(shop?.logo) ? (
              <Image source={{ uri: getSingleImageUrl(shop?.logo) }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarFallback}>
                <Ionicons name="storefront" size={40} color={colors.primary} />
              </View>
            )}
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-sharp" size={14} color="#FFF" />
            </View>
          </Animated.View>

          <Text style={s.heroName}>{shop?.name || user?.name || 'Local Store'}</Text>
          <Text style={s.heroSub}>{user?.email || 'seller@example.com'}</Text>
          <View style={s.heroPills}>
            <View style={s.heroPill}>
              <Text style={s.heroPillText}>Joined 2026</Text>
            </View>
            <View style={s.heroPill}>
              <Text style={s.heroPillText}>Premium</Text>
            </View>
          </View>
        </View>

        {/* Pro Subscription Banner */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Subscription')} style={s.proBannerWrap}>
          <LinearGradient
            colors={isDarkMode ? ['#1E293B', '#0F172A'] : ['#0D9488', '#0F766E']}
            style={s.proBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.proLeft}>
              <View style={s.proIconRing}>
                <Ionicons name="sparkles" size={18} color="#FBBF24" />
              </View>
              <View>
                <Text style={s.proTitle}>{subscription.plan}</Text>
                <Text style={s.proSub}>Renews {subscription.expiryDate}</Text>
              </View>
            </View>
            <View style={s.proBtn}>
              <Text style={s.proBtnText}>Manage</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Group 1: Business Details */}
        <Text style={s.groupLabel}>BUSINESS MANAGEMENT</Text>
        <View style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon="briefcase"
            iconBg="rgba(13, 148, 136, 0.12)"
            iconColor={colors.primary}
            label="Shop Customization"
            onPress={() => navigation.navigate('ShopCustomization')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="analytics"
            iconBg="rgba(245, 158, 11, 0.12)"
            iconColor={colors.warning}
            label="Analytics & Reports"
            onPress={() => navigation.navigate('Analytics')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="cash"
            iconBg="rgba(16, 185, 129, 0.12)"
            iconColor={colors.success}
            label="Earnings & Bank"
            onPress={() => navigation.navigate('EarningsBreakdown')}
            s={s}
            colors={colors}
          />
        </View>

        {/* Group 2: Preferences & Mode Switcher */}
        <Text style={s.groupLabel}>PREFERENCES</Text>
        <View style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon={isDarkMode ? 'sunny' : 'moon'}
            iconBg={isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(139, 92, 246, 0.12)'}
            iconColor={isDarkMode ? '#FBBF24' : colors.purple}
            label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            onPress={toggleTheme}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="swap-horizontal"
            iconBg="rgba(59, 130, 246, 0.12)"
            iconColor={colors.info}
            label={`Switch to ${activeRole === 'SELLER' ? 'Buyer' : 'Seller'} Mode`}
            value={activeRole || undefined}
            onPress={() => switchRole(activeRole === 'SELLER' ? 'BUYER' : 'SELLER')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="help-buoy"
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor={colors.error}
            label="Seller Support"
            onPress={() => navigation.navigate('SellerHelpSupport')}
            s={s}
            colors={colors}
          />
        </View>

        {/* Group 3: Legal */}
        <Text style={s.groupLabel}>LEGAL & POLICIES</Text>
        <View style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon="document-text"
            iconBg={colors.backgroundAlt}
            iconColor={colors.textSecondary}
            label="Terms & Conditions"
            onPress={() => navigation.navigate('SellerTermsConditions')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="shield-checkmark"
            iconBg={colors.backgroundAlt}
            iconColor={colors.textSecondary}
            label="Privacy Policy"
            onPress={() => navigation.navigate('SellerPrivacyPolicy')}
            s={s}
            colors={colors}
          />
        </View>

        {/* Danger Zone */}
        <View style={s.dangerGroup}>
          <TouchableOpacity
            style={s.dangerBtn}
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout },
              ])
            }
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={s.dangerBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}
