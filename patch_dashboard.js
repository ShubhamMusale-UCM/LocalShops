const fs = require('fs');
const path = require('path');

const code = `import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import shopService from '../../services/shopService';
import { orderService } from '../../services/orderService';
import { getPrimarySellerShop } from '../../services/sellerShopContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DS = {
  primary: '#006859',
  primaryContainer: '#008471',
  onPrimary: '#ffffff',
  primaryFixed: '#8ef5de',
  onPrimaryFixed: '#00201a',
  secondary: '#9a460d',
  secondaryContainer: '#fe9256',
  onSecondary: '#ffffff',
  secondaryFixed: '#ffdbcb',
  onSecondaryFixed: '#341100',
  tertiary: '#4b41e1',
  tertiaryContainer: '#645efb',
  onTertiary: '#ffffff',
  tertiaryFixed: '#e2dfff',
  surface: '#f9f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f3ff',
  surfaceContainer: '#e9edff',
  surfaceContainerHigh: '#e1e8fd',
  surfaceVariant: '#dce2f7',
  onSurface: '#141b2b',
  onSurfaceVariant: '#3d4946',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

const AnimatedPressable = ({ onPress, style, containerStyle, activeOpacity = 0.9, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, damping: 12, stiffness: 220, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, damping: 15, stiffness: 180, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={activeOpacity}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const AnimatedEntry = ({ delay, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 14, stiffness: 140, delay, useNativeDriver: true }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

const EMPTY_DASHBOARD_DATA = {
  totalOrders: 0,
  totalRevenue: 0,
  totalProducts: 0,
  averageRating: 0,
  pendingOrders: 0,
  thisMonthRevenue: 0,
  thisMonthOrders: 0,
  topProduct: { name: 'No products yet', sold: 0 },
};

export default function SellerDashboard({ navigation }) {
  const [data, setData] = useState(EMPTY_DASHBOARD_DATA);
  const [shopName, setShopName] = useState('Urban Living - FC Road');
  const [isLoading, setIsLoading] = useState(true);
  const { onScroll: _onScroll, scrollEventThrottle } = useHideTabBarOnScroll();
  const [isOnline, setIsOnline] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });
  const headerShadow = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 0.06], extrapolate: 'clamp' });

  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadData = useCallback(async (force = false) => {
    try {
      if (force) setIsLoading(true);
      const primaryShop = await getPrimarySellerShop(force);
      if (primaryShop?.id) {
        setShopName(primaryShop.name || 'Urban Living - FC Road');
        const [ordersRes, productsRes] = await Promise.all([
          orderService.getShopOrders(primaryShop.id, 1).catch(() => null),
          shopService.getProducts(primaryShop.id, { page: 1 }).catch(() => null),
        ]);
        const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : ordersRes?.data?.orders || [];
        const products = Array.isArray(productsRes?.data) ? productsRes.data : productsRes?.data?.products || [];
        
        setData({
          totalOrders: Number(ordersRes?.data?.pagination?.total ?? orders.length),
          totalRevenue: orders.reduce((s, o) => s + Number(o?.total || 0), 0),
          totalProducts: Number(productsRes?.data?.pagination?.total ?? products.length),
          averageRating: Number(primaryShop.averageRating ?? primaryShop.rating ?? 4.8),
          pendingOrders: orders.filter(o => ['PLACED', 'CONFIRMED', 'PREPARING'].includes(String(o?.status))).length,
          thisMonthRevenue: 48650,
          thisMonthOrders: 14,
          topProduct: { name: products[0]?.name || 'Nordic Armchair', sold: Number(products[0]?.orderCount ?? 3) },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
      const int = setInterval(() => loadData(false), 90000);
      return () => clearInterval(int);
    }, [loadData])
  );

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e) => _onScroll(e),
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={s.headerWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: headerOpacity }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(249, 249, 255, 0.85)' }]} />
          )}
        </Animated.View>
        <View style={s.headerInner}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text numberOfLines={1} style={s.headerTitle}>{shopName}</Text>
              <MaterialIcons name="expand-more" size={20} color={DS.onSurfaceVariant} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Animated.View style={[s.headerLiveDot, { opacity: pulse }]} />
              <Text style={s.headerLiveText}>ACCEPTING ORDERS • PUNE</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity style={s.iconBtn}>
              <Ionicons name="notifications-outline" size={24} color={DS.onSurfaceVariant} />
              <View style={s.notificationBadge} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('SellerProfile')} style={s.avatarBtn}>
              <MaterialIcons name="person" size={20} color={DS.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scrollContent}
      >
        {/* Top Store Quick Status */}
        <AnimatedEntry delay={100} style={s.section}>
          <View style={s.statusCard}>
            <View style={s.statusHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.statusCardTitle} numberOfLines={1}>Urban Living FC Road Hub</Text>
                  <View style={s.hqBadge}>
                    <Text style={s.hqBadgeText}>HQ</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Animated.View style={[s.liveDotRed, { opacity: pulse }]} />
                  <Text style={s.statusActiveText}>Showroom Desk: Active</Text>
                  <Text style={s.statusSubText}>• Instant Pickup Ready</Text>
                </View>
              </View>
              <AnimatedPressable onPress={() => setIsOnline(!isOnline)}>
                <View style={[s.toggleBtn, isOnline ? s.toggleOnline : s.toggleOffline]}>
                  <MaterialIcons name="bolt" size={16} color={isOnline ? DS.onPrimary : DS.onSurfaceVariant} />
                  <Text style={[s.toggleText, isOnline ? { color: DS.onPrimary } : { color: DS.onSurfaceVariant }]}>
                    {isOnline ? 'Online' : 'Paused'}
                  </Text>
                </View>
              </AnimatedPressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.metricsRibbon}>
              <View style={[s.ribbonItem, { backgroundColor: DS.surfaceContainerLow }]}>
                <MaterialIcons name="payments" size={18} color={DS.primary} />
                <Text style={s.ribbonItemText}>₹48,650</Text>
                <Text style={s.ribbonItemHighlight}>(+18.4%)</Text>
              </View>
              <View style={[s.ribbonItem, { backgroundColor: DS.surfaceContainerLow }]}>
                <MaterialIcons name="task-alt" size={18} color={DS.tertiary} />
                <Text style={s.ribbonItemText}>14 Fulfilled</Text>
              </View>
              <View style={[s.ribbonItem, { backgroundColor: DS.secondaryFixed }]}>
                <MaterialIcons name="local-shipping" size={18} color={DS.onSecondaryFixed} />
                <Text style={[s.ribbonItemText, { color: DS.onSecondaryFixed }]}>3 In Transit</Text>
              </View>
              <View style={[s.ribbonItem, { backgroundColor: DS.surfaceContainerLow }]}>
                <MaterialIcons name="schedule" size={18} color={DS.onSurfaceVariant} />
                <Text style={s.ribbonItemText}>Avg 18m Prep</Text>
              </View>
              <View style={{ width: 16 }} />
            </ScrollView>
          </View>
        </AnimatedEntry>

        {/* Hyperlocal Performance */}
        <AnimatedEntry delay={150} style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>Hyperlocal Performance</Text>
            <Text style={s.sectionLiveText}>Realtime Live</Text>
          </View>
          <View style={s.grid2x2}>
            {/* Card 1 */}
            <View style={[s.gridCard, { backgroundColor: 'rgba(142, 245, 222, 0.3)' }]}>
              <View style={s.gridCardHeader}>
                <View style={[s.iconBox, { color: DS.primary }]}>
                  <MaterialIcons name="currency-rupee" size={20} color={DS.primary} />
                </View>
                <View style={[s.cardBadge, { backgroundColor: DS.primaryContainer }]}>
                  <Text style={[s.cardBadgeText, { color: DS.onPrimary }]}>↑ 22%</Text>
                </View>
              </View>
              <View style={s.gridCardBody}>
                <Text style={s.gridCardValue}>₹48,650</Text>
                <Text style={s.gridCardLabel}>Gross Sales Today</Text>
                <Text style={[s.gridCardSub, { color: DS.primary }]}>+₹8.2k vs avg</Text>
              </View>
            </View>

            {/* Card 2 */}
            <View style={[s.gridCard, { backgroundColor: DS.surfaceContainerHigh }]}>
              <View style={s.gridCardHeader}>
                <View style={[s.iconBox, { color: DS.onSurface }]}>
                  <MaterialIcons name="storefront" size={20} color={DS.onSurface} />
                </View>
                <View style={[s.cardBadge, { backgroundColor: DS.surfaceVariant }]}>
                  <Text style={[s.cardBadgeText, { color: DS.onSurfaceVariant }]}>Goodluck</Text>
                </View>
              </View>
              <View style={s.gridCardBody}>
                <Text style={s.gridCardValue}>142 Visits</Text>
                <Text style={s.gridCardLabel}>Footfall & Showroom</Text>
                <Text style={[s.gridCardSub, { color: DS.onSurfaceVariant, fontWeight: '400' }]}>86 FC Road Walk-ins</Text>
              </View>
            </View>

            {/* Card 3 */}
            <View style={[s.gridCard, { backgroundColor: 'rgba(255, 219, 203, 0.5)' }]}>
              <View style={s.gridCardHeader}>
                <View style={[s.iconBox, { color: DS.secondary }]}>
                  <MaterialIcons name="video-chat" size={20} color={DS.secondary} />
                </View>
                <View style={[s.cardBadge, { backgroundColor: DS.secondaryContainer }]}>
                  <Text style={[s.cardBadgeText, { color: DS.onSecondary }]}>75% Win</Text>
                </View>
              </View>
              <View style={s.gridCardBody}>
                <Text style={s.gridCardValue}>8 Inquiries</Text>
                <Text style={s.gridCardLabel}>Live Consultations</Text>
                <Text style={[s.gridCardSub, { color: DS.secondary }]}>6 Converted Instantly</Text>
              </View>
            </View>

            {/* Card 4 */}
            <View style={[s.gridCard, { backgroundColor: 'rgba(226, 223, 255, 0.4)' }]}>
              <View style={s.gridCardHeader}>
                <View style={[s.iconBox, { color: DS.tertiary }]}>
                  <MaterialIcons name="radar" size={20} color={DS.tertiary} />
                </View>
                <View style={[s.cardBadge, { backgroundColor: DS.tertiary }]}>
                  <Text style={[s.cardBadgeText, { color: DS.onTertiary }]}>Fast Grid</Text>
                </View>
              </View>
              <View style={s.gridCardBody}>
                <Text style={s.gridCardValue}>4.8 km</Text>
                <Text style={s.gridCardLabel}>Broadcast Radius</Text>
                <Text style={[s.gridCardSub, { color: DS.tertiary }]}>Shivajinagar & Deccan</Text>
              </View>
            </View>
          </View>
        </AnimatedEntry>

        {/* Quick Merchant Desk */}
        <AnimatedEntry delay={200} style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>Quick Merchant Desk</Text>
            <Text style={s.sectionSubText}>Tap to trigger</Text>
          </View>
          <View style={s.grid2x2}>
            <AnimatedPressable onPress={() => navigation.navigate('PromoteProduct')} style={s.actionCard}>
              <View style={s.actionHeader}>
                <View style={[s.actionIconBox, { backgroundColor: DS.primaryFixed }]}>
                  <MaterialIcons name="campaign" size={18} color={DS.primary} />
                </View>
                <Animated.View style={[s.actionDotPulse, { opacity: pulse }]} />
              </View>
              <Text style={s.actionTitle}>Boost Visibility</Text>
              <Text style={[s.actionSub, { color: DS.primary }]}>2.4x Local Boost Active</Text>
            </AnimatedPressable>

            <AnimatedPressable style={s.actionCard}>
              <View style={s.actionHeader}>
                <View style={[s.actionIconBox, { backgroundColor: DS.secondaryFixed }]}>
                  <MaterialIcons name="two-wheeler" size={18} color={DS.secondary} />
                </View>
                <View style={s.actionSmallBadge}>
                  <Text style={s.actionSmallBadgeText}>Nearby</Text>
                </View>
              </View>
              <Text style={s.actionTitle}>Request Rider</Text>
              <Text style={[s.actionSub, { color: DS.secondary }]}>3 Riders Available</Text>
            </AnimatedPressable>

            <AnimatedPressable onPress={() => navigation.navigate('SellerAdWallet')} style={s.actionCard}>
              <View style={s.actionHeader}>
                <View style={[s.actionIconBox, { backgroundColor: DS.surfaceVariant }]}>
                  <MaterialIcons name="account-balance-wallet" size={18} color={DS.onSurface} />
                </View>
                <MaterialIcons name="arrow-forward" size={18} color={DS.primary} />
              </View>
              <Text style={s.actionTitle}>Instant Payout</Text>
              <Text style={[s.actionSub, { color: DS.onSurfaceVariant, fontWeight: '400' }]}>₹34,200 ready to transfer</Text>
            </AnimatedPressable>

            <AnimatedPressable onPress={() => navigation.navigate('Products')} style={s.actionCard}>
              <View style={s.actionHeader}>
                <View style={[s.actionIconBox, { backgroundColor: DS.errorContainer }]}>
                  <MaterialIcons name="warning" size={18} color={DS.error} />
                </View>
                <View style={s.actionDotRed} />
              </View>
              <Text style={s.actionTitle}>Stock Inventory</Text>
              <Text style={[s.actionSub, { color: DS.error }]}>2 items running low</Text>
            </AnimatedPressable>
          </View>
        </AnimatedEntry>

        {/* Weekly Chart Card */}
        <AnimatedEntry delay={250} style={s.section}>
          <View style={s.chartCard}>
            <View style={s.chartHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.sectionTitle}>Weekly Revenue & Footfall</Text>
                  <View style={[s.cardBadge, { backgroundColor: DS.primaryFixed }]}>
                    <Text style={[s.cardBadgeText, { color: DS.primary }]}>Pune Central</Text>
                  </View>
                </View>
                <Text style={s.chartSubText}>Showing daily store orders vs physical showroom walk-ins</Text>
              </View>
            </View>

            {/* Chart Graphic Mock */}
            <View style={s.chartContainer}>
              {[
                { d: 'M', v1: '45%', v2: '60%' },
                { d: 'T', v1: '60%', v2: '70%' },
                { d: 'W', v1: '52%', v2: '65%' },
                { d: 'T', v1: '75%', v2: '80%' },
                { d: 'F', v1: '85%', v2: '85%' },
                { d: 'S', v1: '98%', v2: '90%', active: true },
                { d: 'Today', v1: '88%', v2: '75%', secondary: true },
              ].map((item, index) => (
                <View key={index} style={s.chartBarCol}>
                  <View style={[s.chartBarBg, { height: item.v1 }, item.active && { backgroundColor: DS.primaryFixed, elevation: 1 }, item.secondary && { backgroundColor: DS.secondaryFixed }]}>
                    <View style={[s.chartBarFill, { height: item.v2 }, item.secondary && { backgroundColor: DS.secondaryContainer }]} />
                  </View>
                  <Text style={[s.chartDayLabel, item.active && { color: DS.primary, fontWeight: '800' }, item.secondary && { color: DS.secondary, fontWeight: '800' }]}>{item.d}</Text>
                </View>
              ))}
            </View>

            <View style={s.chartFooterBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="local-fire-department" size={18} color={DS.secondary} />
                <Text style={s.chartFooterText}>5 PM - 8 PM Peak Rush</Text>
              </View>
              <Text style={s.chartFooterSub}>42% of sales</Text>
            </View>
          </View>
        </AnimatedEntry>

        {/* Live Shivajinagar Trends */}
        <AnimatedEntry delay={300} style={s.section}>
          <View style={s.sectionTitleRow}>
            <View>
              <Text style={s.sectionTitle}>Live Shivajinagar Trends</Text>
              <Text style={s.sectionSubText}>Local shoppers searching near you</Text>
            </View>
            <MaterialIcons name="trending-up" size={24} color={DS.primary} />
          </View>

          <View style={s.trendsList}>
            <View style={s.trendItem}>
              <View style={s.trendLeft}>
                <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDji8_I6DAXqgJfY2I4mg5Zv6Bm04Z-nwWe0rSemNXxFXjIykrFDWCzl382xVoy2qTVhkWFdwISAnhbvnaGiLFD57PG7HVVuUw1nLo0BloFRoY5LfhA5Kqm9NRBTzGYg_LE7EEbWn6qdYy3cNtgqslMyyFTMY-3d7a6rTZ53ciQxAodoBLhjMkKb1PNw-8kLQgIEY01BVOBgmyOo9CV-qLcMmccGnz6snFb4zwQdpgpNO_WDU4y8lzH' }} style={s.trendImg} />
                <View style={{ flex: 1 }}>
                  <Text style={s.trendTitle} numberOfLines={1}>Nordic Armchair</Text>
                  <Text style={s.trendSubBold}>3 in stock • Ranked #1</Text>
                </View>
              </View>
              <View style={s.trendRight}>
                <Text style={s.trendCount}>64 searches</Text>
                <View style={[s.trendBadge, { backgroundColor: 'rgba(142, 245, 222, 0.5)' }]}>
                  <Text style={[s.trendBadgeText, { color: DS.primaryContainer }]}>High Intent</Text>
                </View>
              </View>
            </View>

            <View style={s.trendItem}>
              <View style={s.trendLeft}>
                <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFWoYyzea_w19JhLgK9b1DDRhFvi-5LhvCYbxHxPcRurifGr4gVRPtm9jjHNRxzMPmP0qI2z2cZ-jLNTVCFYUZTmlumAK3v9D1wLVHD1MMMor9OHh8Vbx2M_iDRQEWSnAiVEeFsb_W0ZyyRoWaWQHwDQQpq9ZpRuBzqWfSoNBTgnSIbOafSsCKQ66eSszodMfKe0n14iBzl9WJS4NZ0W50EB8uUo6smSvPNeIIJpNm2wsfiQileDfS' }} style={s.trendImg} />
                <View style={{ flex: 1 }}>
                  <Text style={s.trendTitle} numberOfLines={1}>Teak Study Desks</Text>
                  <Text style={s.trendSubReg}>High demand in Model Colony</Text>
                </View>
              </View>
              <View style={s.trendRight}>
                <Text style={s.trendCount}>42 searches</Text>
                <View style={[s.trendBadge, { backgroundColor: DS.secondaryFixed }]}>
                  <Text style={[s.trendBadgeText, { color: DS.secondary }]}>Trending</Text>
                </View>
              </View>
            </View>

            <View style={s.trendItem}>
              <View style={s.trendLeft}>
                <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD26JZeJhjtBeI2mAYErcpyCtvRsn9Q7qSAssepGZEVfrIRfORx4R9Kogw7AnCCEBYn7R4fi0bC8bn2a7EU1t8GAgY4fyGHRHTvoVrlDkFXAPHSaARkdycYYFFiBvg4MSp8arZn9ir39CseqVJbe7nHtVrWS79UpVR8ZV7OE7u7DBZimepbD7sr0OPuczVv8ntTpg4Q67UrA0IKvGlCy9Os34XWvcOAvWefR6Xx7xwD2kKC7z6nrpcf' }} style={s.trendImg} />
                <View style={{ flex: 1 }}>
                  <Text style={s.trendTitle} numberOfLines={1}>Sofa Waterproofing</Text>
                  <Text style={s.trendSubReg}>Hyperlocal service booking</Text>
                </View>
              </View>
              <View style={s.trendRight}>
                <Text style={s.trendCount}>28 inquiries</Text>
                <View style={[s.trendBadge, { backgroundColor: DS.tertiaryFixed }]}>
                  <Text style={[s.trendBadgeText, { color: DS.tertiary }]}>Services</Text>
                </View>
              </View>
            </View>
          </View>
        </AnimatedEntry>

        {/* Customer Reviews */}
        <AnimatedEntry delay={350} style={[s.section, { marginBottom: 32 }]}>
          <View style={s.reviewsCard}>
            <View style={s.reviewsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={s.reviewsIconBox}>
                  <MaterialIcons name="verified" size={24} color={DS.primary} />
                </View>
                <View>
                  <Text style={s.reviewsTitle}>Seller Trust Score</Text>
                  <Text style={s.reviewsSub}>FC Road Collective Verified</Text>
                </View>
              </View>
              <Text style={s.reviewsScoreText}>98%</Text>
            </View>

            <View style={s.reviewsStarsBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name="star" size={20} color={DS.secondary} />
                <Text style={s.reviewsStarsVal}>4.8</Text>
              </View>
              <Text style={s.reviewsStarsSub}>• 320 Verified Local Reviews</Text>
            </View>

            <View style={s.reviewsFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="verified-user" size={18} color={DS.primary} />
                <Text style={s.reviewsFooterText}>Fast Dispatch Badge Active</Text>
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.reviewsFooterLink}>View Badges</Text>
                <MaterialIcons name="chevron-right" size={16} color={DS.onSurface} />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedEntry>
      </Animated.ScrollView>
    </View>
  );
}

const paddingTop = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface },
  
  headerWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    height: paddingTop + 64,
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: paddingTop + 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  headerLiveDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: DS.primaryContainer,
  },
  headerLiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.primary,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10, right: 10,
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: DS.secondaryContainer,
  },
  avatarBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
    marginLeft: 8,
  },

  scrollContent: {
    paddingTop: paddingTop + 64,
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  statusCard: {
    backgroundColor: DS.surfaceContainerLowest,
    borderRadius: DS.radius.xl,
    paddingVertical: 20,
    shadowColor: DS.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statusCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.onSurface,
  },
  hqBadge: {
    backgroundColor: DS.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hqBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.onPrimaryFixed,
  },
  liveDotRed: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: DS.primaryContainer,
  },
  statusActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.primary,
  },
  statusSubText: {
    fontSize: 12,
    color: DS.onSurfaceVariant,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  toggleOnline: {
    backgroundColor: DS.primaryContainer,
  },
  toggleOffline: {
    backgroundColor: DS.onSurfaceVariant,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRibbon: {
    paddingLeft: 20,
  },
  ribbonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    gap: 6,
  },
  ribbonItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.onSurface,
  },
  ribbonItemHighlight: {
    fontSize: 10,
    fontWeight: '800',
    color: DS.primary,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.onSurface,
  },
  sectionLiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.primary,
  },
  sectionSubText: {
    fontSize: 12,
    color: DS.onSurfaceVariant,
    marginTop: 2,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    borderRadius: DS.radius.xl,
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBox: {
    width: 36, height: 36,
    borderRadius: DS.radius.md,
    backgroundColor: DS.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
  },
  cardBadgeText: {
    fontSize: 10, fontWeight: '700',
  },
  gridCardBody: { marginTop: 16 },
  gridCardValue: { fontSize: 24, fontWeight: '800', color: DS.onSurface, marginBottom: 2 },
  gridCardLabel: { fontSize: 12, fontWeight: '700', color: DS.onSurfaceVariant, marginBottom: 2 },
  gridCardSub: { fontSize: 11, fontWeight: '800' },

  actionCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    backgroundColor: DS.surfaceContainerLowest,
    borderRadius: DS.radius.xl,
    padding: 16,
    shadowColor: DS.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  actionIconBox: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.primaryContainer },
  actionDotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.error },
  actionSmallBadge: { backgroundColor: DS.surfaceContainerHigh, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  actionSmallBadgeText: { fontSize: 10, color: DS.onSurface, fontWeight: '700' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: DS.onSurface, marginBottom: 2 },
  actionSub: { fontSize: 12, fontWeight: '800' },

  chartCard: {
    backgroundColor: DS.surfaceContainerLowest,
    borderRadius: DS.radius.xl,
    padding: 20,
    shadowColor: DS.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  chartHeaderRow: { marginBottom: 16 },
  chartSubText: { fontSize: 12, color: DS.onSurfaceVariant, marginTop: 4 },
  chartContainer: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 16 },
  chartBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  chartBarBg: { width: '80%', backgroundColor: DS.surfaceContainerHigh, borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill: { width: '100%', backgroundColor: DS.primaryContainer },
  chartDayLabel: { fontSize: 10, color: DS.onSurfaceVariant, fontWeight: '600' },
  chartFooterBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DS.surfaceContainerLow, paddingHorizontal: 12, paddingVertical: 10, borderRadius: DS.radius.lg, marginTop: 16 },
  chartFooterText: { fontSize: 12, fontWeight: '700', color: DS.onSurface },
  chartFooterSub: { fontSize: 12, color: DS.onSurfaceVariant },

  trendsList: { gap: 12 },
  trendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DS.surfaceContainerLowest, padding: 16, borderRadius: DS.radius.xl, shadowColor: DS.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  trendLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  trendImg: { width: 48, height: 48, borderRadius: DS.radius.md },
  trendTitle: { fontSize: 14, fontWeight: '700', color: DS.onSurface, marginBottom: 2 },
  trendSubBold: { fontSize: 12, fontWeight: '800', color: DS.primary },
  trendSubReg: { fontSize: 12, color: DS.onSurfaceVariant },
  trendRight: { alignItems: 'flex-end', paddingLeft: 12 },
  trendCount: { fontSize: 14, fontWeight: '700', color: DS.onSurface, marginBottom: 4 },
  trendBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.radius.sm },
  trendBadgeText: { fontSize: 10, fontWeight: '700' },

  reviewsCard: { backgroundColor: DS.surfaceContainerLowest, borderRadius: DS.radius.xl, padding: 20, shadowColor: DS.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  reviewsIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  reviewsTitle: { fontSize: 16, fontWeight: '700', color: DS.onSurface, marginBottom: 2 },
  reviewsSub: { fontSize: 12, color: DS.onSurfaceVariant },
  reviewsScoreText: { fontSize: 24, fontWeight: '800', color: DS.primary },
  reviewsStarsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.surfaceContainerLow, padding: 12, borderRadius: DS.radius.lg, marginBottom: 16, gap: 8 },
  reviewsStarsVal: { fontSize: 14, fontWeight: '800', color: DS.onSurface },
  reviewsStarsSub: { fontSize: 12, color: DS.onSurfaceVariant },
  reviewsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  reviewsFooterText: { fontSize: 12, fontWeight: '700', color: DS.primary },
  reviewsFooterLink: { fontSize: 12, color: DS.onSurface, fontWeight: '600', marginRight: 2 },
});
`;

fs.writeFileSync(path.join('apps', 'mobile', 'src', 'screens', 'seller', 'SellerDashboard.tsx'), code, 'utf8');
console.log('Successfully wrote to SellerDashboard.tsx');
