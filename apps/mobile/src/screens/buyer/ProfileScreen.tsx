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
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], radius: ReturnType<typeof useTheme>['radius'], shadows: ReturnType<typeof useTheme>['shadows'], isDarkMode: boolean, topInset: number = 0) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#050814',
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
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingBottom: 40,
    },
    heroSection: {
      alignItems: 'center',
      paddingTop: topInset + 16,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
      marginBottom: 20,
      borderTopWidth: 0,
    },
    avatarContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.05)',
      shadowColor: '#38BDF8',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: 16,
    },
    avatarFallback: {
      flex: 1,
      borderRadius: 48,
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#050814',
    },
    avatarImage: {
      flex: 1,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: '#050814',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#10B981',
      borderWidth: 3,
      borderColor: '#050814',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroName: {
      fontSize: 24,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    heroSub: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
      fontFamily: 'Inter_500Medium',
      marginBottom: 12,
    },
    heroPills: {
      flexDirection: 'row',
      gap: 8,
    },
    heroPill: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
    },
    heroPillText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: 'rgba(255,255,255,0.6)',
    },
    bannerWrap: {
      marginHorizontal: 16,
      marginBottom: 24,
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
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    proSub: {
      fontSize: 12,
      color: '#9CA3AF',
      fontFamily: 'Inter_400Regular',
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
      fontFamily: 'Inter_700Bold',
      color: '#FFFFFF',
    },
    listGroup: {
      marginHorizontal: 16,
      borderRadius: radius.lg,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    groupLabel: {
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      color: 'rgba(255,255,255,0.4)',
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
      fontFamily: 'Inter_500Medium',
      color: '#FFFFFF',
      flex: 1,
    },
    listValue: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
      fontFamily: 'Inter_500Medium',
    },
    listDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      marginLeft: 60,
    },
    dangerGroup: {
      marginHorizontal: 16,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
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
      fontFamily: 'Inter_700Bold',
      color: '#EF4444',
    },
    version: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.4)',
      fontFamily: 'Inter_400Regular',
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
      {!hideChevron && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" style={{ marginLeft: 8 }} />}
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
      <AmbientOrbs />

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
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                },
              ]}
            />
          )}
        </Animated.View>
        <View style={s.stickyHeaderInner}>
          <Animated.Text style={[s.stickyTitle, { opacity: headerOpacity }]}>
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
        <GlassPanel intensity={30} style={s.heroSection}>
          <Animated.View style={[s.avatarContainer, { transform: [{ scale: avatarScale }, { translateY: avatarTranslate }] }]}>
            {sanitizeImageUrl(user?.avatar) ? (
              <Image source={{ uri: getSingleImageUrl(user?.avatar) }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={{ fontSize: 36, fontWeight: '700', color: '#38BDF8' }}>{user?.name?.charAt(0)?.toUpperCase() || '👤'}</Text>
              </View>
            )}
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-sharp" size={14} color="#FFF" />
            </View>
          </Animated.View>

          <Text style={s.heroName}>{user?.name || 'Guest User'}</Text>
          <Text style={s.heroSub}>{user?.phone ? formatPhone(user.phone) : 'No phone connected'}</Text>
          <View style={s.heroPills}>
            <View style={s.heroPill}>
              <Text style={s.heroPillText}>{user?.role || 'BUYER'} Account</Text>
            </View>
            {savedCity ? (
              <View style={s.heroPill}>
                <Text style={s.heroPillText}>{savedCity}</Text>
              </View>
            ) : null}
          </View>
        </GlassPanel>

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
                style={[s.roleBanner, { borderColor: 'rgba(255,255,255,0.1)' }]}
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
                style={[s.roleBanner, { borderColor: 'rgba(255,255,255,0.1)' }]}
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
        <Text style={s.groupLabel}>YOUR ACTIVITY</Text>
        <GlassCard intensity={20} style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon="receipt"
            iconBg="rgba(13, 148, 136, 0.12)"
            iconColor="#38BDF8"
            label="My Orders"
            onPress={() => navigation.navigate('BuyerOrders')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="heart"
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor="#EF4444"
            label="Wishlist"
            onPress={() => navigation.navigate('Wishlist')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="gift"
            iconBg="rgba(245, 158, 11, 0.12)"
            iconColor="#F59E0B"
            label="Referral Program"
            value={user?.referralCode || 'CLS50'}
            onPress={() => {
              shareContent(`CityLocalShop Referral`, `Use code ${user?.referralCode || 'CLS50'} to earn ₹50 on sign up!`);
            }}
            s={s}
            colors={colors}
          />
        </GlassCard>

        {/* Group 2: Saved Address & Preferences */}
        <Text style={s.groupLabel}>PREFERENCES</Text>
        <GlassCard intensity={20} style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon="location"
            iconBg="rgba(56, 189, 248, 0.1)"
            iconColor="#38BDF8"
            label={savedAddress ? `Address: ${savedAddress}` : 'No Saved Address'}
            onPress={() => { }}
            hideChevron
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon={isDarkMode ? 'sunny' : 'moon'}
            iconBg={isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(139, 92, 246, 0.12)'}
            iconColor={isDarkMode ? '#FBBF24' : '#8B5CF6'}
            label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            onPress={toggleTheme}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="share-social"
            iconBg="rgba(16, 185, 129, 0.12)"
            iconColor="#10B981"
            label="Share App"
            onPress={() => shareContent('CityLocalShop', 'Discover amazing local shops near you!')}
            s={s}
            colors={colors}
          />
        </GlassCard>

        {/* Group 3: Support & Legal */}
        <Text style={s.groupLabel}>SUPPORT & LEGAL</Text>
        <GlassCard intensity={20} style={s.listGroup}>
          <GroupedListItem
            isFirst
            icon="chatbubble"
            iconBg="rgba(139, 92, 246, 0.12)"
            iconColor="#8B5CF6"
            label="Help & Support"
            onPress={() => navigation.navigate('Help')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="call"
            iconBg="rgba(16, 185, 129, 0.12)"
            iconColor="#10B981"
            label="Call Support"
            onPress={() => makeCall(SUPPORT_PHONE)}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="document-text"
            iconBg="rgba(255,255,255,0.05)"
            iconColor="rgba(255,255,255,0.6)"
            label="Terms & Conditions"
            onPress={() => navigation.navigate('TermsAndConditions')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            icon="shield-checkmark"
            iconBg="rgba(255,255,255,0.05)"
            iconColor="rgba(255,255,255,0.6)"
            label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
            s={s}
            colors={colors}
          />
          <GroupedListItem
            isLast
            icon="arrow-undo"
            iconBg="rgba(255,255,255,0.05)"
            iconColor="rgba(255,255,255,0.6)"
            label="Refund Policy"
            onPress={() => navigation.navigate('RefundPolicy')}
            s={s}
            colors={colors}
          />
        </GlassCard>

        {/* Danger Zone */}
        <GlassCard intensity={10} style={s.dangerGroup}>
          <TouchableOpacity style={s.dangerBtn} activeOpacity={0.8} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={s.dangerBtnText}>Log Out</Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={s.version}>CityLocalShop v1.0.0</Text>
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}
