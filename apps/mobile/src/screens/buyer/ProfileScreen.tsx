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
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { useThemeStore } from '../../store/themeStore';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPhone } from '../../utils/formatters';
import { makeCall, shareContent } from '../../utils/helpers';
import { SUPPORT_PHONE } from '../../utils/constants';
import { sanitizeImageUrl, getSingleImageUrl } from '../../utils/image';
import api from '../../services/api';
import { useTheme } from '../../theme';

const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean, topInset: number = 0) => {
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
      paddingBottom: 24,
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
    bannerWrap: {
      marginHorizontal: 16,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    roleBanner: {
      borderRadius: radius.lg,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
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
      backgroundColor: 'rgba(251, 191, 36, 0.15)',
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
      color: '#9CA3AF',
      marginTop: 2,
      flexWrap: 'wrap',
      flex: 1,
    },
    proBtn: {
      backgroundColor: 'rgba(255,255,255,0.1)',
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
    version: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 24,
      marginBottom: 8,
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

export default function ProfileScreen() {
  const { colors, radius, shadows, isDarkMode: themeDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 20;
  const s = getStyles(colors, radius, shadows, themeDarkMode, topInset);
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { user, logout, updateUser, activeRole, switchRole } = useAuthStore();
  const savedAddress = useLocationStore((state) => state.address);
  const savedCity = useLocationStore((state) => state.city);
  const [upgradingSeller, setUpgradingSeller] = useState(false);

  const { onScroll: _onScroll, scrollEventThrottle } = useHideTabBarOnScroll();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({ inputRange: [60, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const avatarScale = scrollY.interpolate({ inputRange: [-50, 0, 100], outputRange: [1.2, 1, 0.8], extrapolate: 'clamp' });
  const avatarTranslate = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 20], extrapolate: 'clamp' });

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: any) => _onScroll(e),
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleRegisterShop = () => {
    if (user?.role === 'SELLER') {
      Alert.alert('Seller Account', 'Your account is already a seller account.');
      return;
    }

    Alert.alert(
      'Become a Seller',
      'This will switch your account role to SELLER so you can register and manage your shop. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              setUpgradingSeller(true);
              await api.put('/users/profile', { role: 'SELLER', city: savedCity || user?.city });
              updateUser({ role: 'SELLER', city: savedCity || user?.city });
              Alert.alert('Success', 'Your account is now a seller account. Switch to Seller Mode in settings to customize.');
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || err?.message || 'Could not update account role.');
            } finally {
              setUpgradingSeller(false);
            }
          },
        },
      ]
    );
  };

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
          <Animated.Text style={[s.stickyTitle, { opacity: headerOpacity, color: colors.text }]}>
            Profile
          </Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scrollContent}
      >
        {/* Hero Section */}
        <View style={[s.heroSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <LinearGradient colors={isDarkMode ? [colors.backgroundAlt, colors.background] : ['#EDFCF6', colors.background]} style={StyleSheet.absoluteFill} />

          <Animated.View style={[s.avatarContainer, { transform: [{ scale: avatarScale }, { translateY: avatarTranslate }] }]}>
            {sanitizeImageUrl(user?.avatar) ? (
              <Image source={{ uri: getSingleImageUrl(user?.avatar) }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={{ fontSize: 36, fontWeight: '700', color: colors.primary }}>{user?.name?.charAt(0)?.toUpperCase() || '👤'}</Text>
              </View>
            )}
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-sharp" size={14} color="#FFF" />
            </View>
          </Animated.View>

          <Text style={[s.heroName, { color: colors.text }]}>{user?.name || 'Guest User'}</Text>
          <Text style={s.heroSub}>{user?.phone ? formatPhone(user.phone) : 'No phone connected'}</Text>
          <View style={s.heroPills}>
            <View style={[s.heroPill, { backgroundColor: colors.backgroundAlt }]}>
              <Text style={[s.heroPillText, { color: colors.textSecondary }]}>{user?.role || 'BUYER'} Account</Text>
            </View>
            {savedCity ? (
              <View style={[s.heroPill, { backgroundColor: colors.backgroundAlt }]}>
                <Text style={[s.heroPillText, { color: colors.textSecondary }]}>{savedCity}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Dynamic Mode Switcher or Shop Registration Banner */}
        <View style={s.bannerWrap}>
          {user?.role === 'SELLER' ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => switchRole('SELLER')}
              style={{ overflow: 'hidden', borderRadius: radius.lg }}
            >
              <LinearGradient
                colors={isDarkMode ? ['#1E293B', '#0F172A'] : ['#0D9488', '#0F766E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.roleBanner, { borderColor: colors.border }]}
              >
                <View style={s.proLeft}>
                  <View style={[s.proIconRing, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.18)' }]}>
                    <Ionicons name="swap-horizontal" size={18} color={isDarkMode ? '#10B981' : '#FFFFFF'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.proTitle}>Switch to Seller Mode</Text>
                    <Text style={[s.proSub, { color: isDarkMode ? '#9CA3AF' : '#E0F2F1' }]}>Manage your shop, products, and orders</Text>
                  </View>
                </View>
                <View style={[s.proBtn, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)' }]}>
                  <Text style={s.proBtnText}>Switch</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleRegisterShop}
              style={{ overflow: 'hidden', borderRadius: radius.lg }}
            >
              <LinearGradient
                colors={isDarkMode ? ['#374151', '#1F2937'] : ['#D97706', '#B45309']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.roleBanner, { borderColor: colors.border }]}
              >
                <View style={s.proLeft}>
                  <View style={[s.proIconRing, { backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255, 255, 255, 0.18)' }]}>
                    <Ionicons name="storefront" size={18} color={isDarkMode ? '#FBBF24' : '#FFFFFF'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.proTitle}>{upgradingSeller ? 'Upgrading...' : 'Register Your Shop'}</Text>
                    <Text style={[s.proSub, { color: isDarkMode ? '#9CA3AF' : '#FEF3C7' }]}>Start selling to thousands of local buyers</Text>
                  </View>
                </View>
                <View style={[s.proBtn, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)' }]}>
                  <Text style={s.proBtnText}>Register</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Group 1: Buyer Actions */}
        <Text style={[s.groupLabel, { color: colors.textSecondary }]}>YOUR ACTIVITY</Text>
        <View style={[s.listGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <GroupedListItem
            isFirst
            icon="receipt"
            iconBg="rgba(13, 148, 136, 0.12)"
            iconColor={colors.primary}
            label="My Orders"
            onPress={() => navigation.navigate('BuyerOrders')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="heart"
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor={colors.error}
            label="Wishlist"
            onPress={() => navigation.navigate('Wishlist')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="gift"
            iconBg="rgba(245, 158, 11, 0.12)"
            iconColor={colors.warning}
            label="Referral Program"
            value={user?.referralCode || 'CLS50'}
            onPress={() => {
              shareContent(`CityLocalShop Referral`, `Use code ${user?.referralCode || 'CLS50'} to earn ₹50 on sign up!`);
            }}
            s={s}
            colors={colors}
          />
        </View>

        {/* Group 2: Saved Address & Preferences */}
        <Text style={[s.groupLabel, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View style={[s.listGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <GroupedListItem
            isFirst
            icon="location"
            iconBg={colors.infoFaded}
            iconColor={colors.info}
            label={savedAddress ? `Address: ${savedAddress}` : 'No Saved Address'}
            onPress={() => { }}
            hideChevron
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon={isDarkMode ? 'sunny' : 'moon'}
            iconBg={isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(139, 92, 246, 0.12)'}
            iconColor={isDarkMode ? '#FBBF24' : colors.purple}
            label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            onPress={toggleTheme}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="share-social"
            iconBg="rgba(16, 185, 129, 0.12)"
            iconColor={colors.success}
            label="Share App"
            onPress={() => shareContent('CityLocalShop', 'Discover amazing local shops near you!')}
            s={s}
            colors={colors}
          />
        </View>

        {/* Group 3: Support & Legal */}
        <Text style={[s.groupLabel, { color: colors.textSecondary }]}>SUPPORT & LEGAL</Text>
        <View style={[s.listGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <GroupedListItem
            isFirst
            icon="chatbubble"
            iconBg="rgba(139, 92, 246, 0.12)"
            iconColor={colors.purple}
            label="Help & Support"
            onPress={() => navigation.navigate('Help')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="call"
            iconBg="rgba(16, 185, 129, 0.12)"
            iconColor={colors.success}
            label="Call Support"
            onPress={() => makeCall(SUPPORT_PHONE)}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="document-text"
            iconBg={colors.backgroundAlt}
            iconColor={colors.textSecondary}
            label="Terms & Conditions"
            onPress={() => navigation.navigate('TermsAndConditions')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="shield-checkmark"
            iconBg={colors.backgroundAlt}
            iconColor={colors.textSecondary}
            label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="arrow-undo"
            iconBg={colors.backgroundAlt}
            iconColor={colors.textSecondary}
            label="Refund Policy"
            onPress={() => navigation.navigate('RefundPolicy')}
            s={s}
            colors={colors}
          />
        </View>

        {/* Danger Zone */}
        <View style={[s.dangerGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity style={s.dangerBtn} activeOpacity={0.8} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={s.dangerBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.version, { color: colors.textTertiary }]}>CityLocalShop v1.0.0</Text>
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}
