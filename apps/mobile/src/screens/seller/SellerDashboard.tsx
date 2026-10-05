import React, { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import shopService from '../../services/shopService';
import { orderService } from '../../services/orderService';
import { getPrimarySellerShop } from '../../services/sellerShopContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13, 148, 136, 0.08)',
  success: '#10B981',
  successFaded: 'rgba(16, 185, 129, 0.08)',
  error: '#EF4444',
  errorFaded: 'rgba(239, 68, 68, 0.08)',
  warning: '#F59E0B',
  warningFaded: 'rgba(245, 158, 11, 0.08)',
  info: '#3B82F6',
  infoFaded: 'rgba(59, 130, 246, 0.08)',
  purple: '#8B5CF6',
  purpleFaded: 'rgba(139, 92, 246, 0.08)',
  gray900: '#1F2937',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

const SPRING_SOFT = { damping: 15, stiffness: 180, useNativeDriver: true as true };
const SPRING_SNAP = { damping: 12, stiffness: 220, useNativeDriver: true as true };

const AnimatedPressable: React.FC<{
  onPress?: () => void;
  style?: any;
  containerStyle?: any;
  activeOpacity?: number;
  children: React.ReactNode;
}> = ({ onPress, style, containerStyle, activeOpacity = 0.9, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, ...SPRING_SNAP }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, ...SPRING_SOFT }).start();
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

const AnimatedEntry: React.FC<{
  delay: number;
  children: React.ReactNode;
  style?: any;
}> = ({ delay, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 14,
        stiffness: 140,
        delay,
        useNativeDriver: true,
      }),
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
  totalViews: 0,
  topProduct: { name: 'No products yet', sold: 0 },
};

const MOCK_REVENUE_TREND = [2400, 3100, 2900, 4200, 3800, 5100, 4800, 6200];

export default function SellerDashboard({ navigation }: { navigation: any }) {
  const [data, setData] = useState(EMPTY_DASHBOARD_DATA);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [shopName, setShopName] = useState('Your Shop');
  const [isLoading, setIsLoading] = useState(true);
  const { onScroll: _onScroll, scrollEventThrottle } = useHideTabBarOnScroll();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });

  // Pulsing dot for Live Badge & Sparkline
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
      if (!primaryShop?.id) return setData(EMPTY_DASHBOARD_DATA);

      setShopName(primaryShop.name || 'Your Shop');
      const [ordersRes, productsRes, analyticsRes] = await Promise.all([
        orderService.getShopOrders(primaryShop.id, 1),
        shopService.getProducts(primaryShop.id, { page: 1, sort: 'popularity' }),
        shopService.getAnalytics(primaryShop.id, 30).catch(() => null),
      ]);

      const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : ordersRes?.data?.orders || [];
      const products = Array.isArray(productsRes?.data) ? productsRes.data : productsRes?.data?.products || [];
      const totals = analyticsRes?.data?.totals;

      setData({
        totalOrders: Number(ordersRes?.data?.pagination?.total ?? orders.length),
        totalRevenue: Number(totals?.revenue ?? orders.reduce((s: any, o: any) => s + Number(o?.total || 0), 0)),
        totalProducts: Number(productsRes?.data?.pagination?.total ?? products.length),
        averageRating: Number(primaryShop.averageRating ?? primaryShop.rating ?? 0),
        pendingOrders: orders.filter((o: any) => ['PLACED', 'CONFIRMED', 'PREPARING'].includes(String(o?.status))).length,
        thisMonthRevenue: Number(totals?.revenue ?? 0),
        thisMonthOrders: Number(totals?.orders ?? orders.length),
        totalViews: 1254, // Mocked for now
        topProduct: { name: products[0]?.name || 'No products yet', sold: Number(products[0]?.orderCount ?? 0) },
      });

      setRecentOrders(orders.slice(0, 3));
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

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e: any) => _onScroll(e),
  });

  const generateSparkline = (dataPoints: number[], width: number, height: number) => {
    if (dataPoints.length < 2) return '';
    const max = Math.max(...dataPoints, 1);
    const min = Math.min(...dataPoints, 0);
    const range = max - min;
    const xStep = width / (dataPoints.length - 1);
    return dataPoints
      .map((val, index) => {
        const x = index * xStep;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const generateClosedSparkline = (dataPoints: number[], width: number, height: number) => {
    const linePath = generateSparkline(dataPoints, width, height);
    if (!linePath) return '';
    return `${linePath} L ${width} ${height} L 0 ${height} Z`;
  };

  const graphWidth = SCREEN_WIDTH - 64;
  const graphHeight = 46;
  const linePath = generateSparkline(MOCK_REVENUE_TREND, graphWidth, graphHeight);
  const closedPath = generateClosedSparkline(MOCK_REVENUE_TREND, graphWidth, graphHeight);

  // Generate coordinates for last point of sparkline
  const lastVal = MOCK_REVENUE_TREND[MOCK_REVENUE_TREND.length - 1];
  const maxVal = Math.max(...MOCK_REVENUE_TREND, 1);
  const minVal = Math.min(...MOCK_REVENUE_TREND, 0);
  const lastX = graphWidth;
  const lastY = graphHeight - ((lastVal - minVal) / (maxVal - minVal)) * (graphHeight - 8) - 4;

  const getStatusColor = (status: string) => {
    const s = String(status).toUpperCase();
    if (['DELIVERED', 'COMPLETED'].includes(s)) return DS.success;
    if (['PLACED', 'CONFIRMED', 'PREPARING'].includes(s)) return DS.info;
    if (['CANCELLED', 'FAILED'].includes(s)) return DS.error;
    return DS.warning;
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Premium Frosted Header */}
      <View style={s.headerWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: headerOpacity }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(248, 250, 252, 0.98)', borderBottomWidth: 1, borderBottomColor: DS.border }]} />
          )}
        </Animated.View>
        <View style={s.headerInner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Animated.View style={[s.liveBadge, { opacity: headerOpacity }]}>
              <Animated.View style={[s.liveDot, { opacity: pulse }]} />
              <Text style={s.liveText}>Live</Text>
            </Animated.View>
            <Animated.Text numberOfLines={1} style={[s.headerTitleSmall, { opacity: headerOpacity }]}>
              {shopName}
            </Animated.Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SellerProfile')} style={s.avatarBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#0D9488', '#0F766E']} style={s.avatarGradient}>
              <Ionicons name="person" size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={DS.primary} />
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={s.scrollContent}
        >
          {/* Transforming Greeting Hero with Live indicator */}
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>{getGreeting()},</Text>
              <Text style={s.heroShopName} numberOfLines={1}>
                {shopName}
              </Text>
            </View>
            <View style={s.heroLiveBadge}>
              <Animated.View style={[s.heroLiveDot, { opacity: pulse }]} />
              <Text style={s.heroLiveText}>Store Online</Text>
            </View>
          </View>

          {/* Dynamic Sparkline Hero Revenue Insights Card */}
          <AnimatedEntry delay={100} style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <LinearGradient colors={['#0D9488', '#0F766E']} style={s.revenueCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.revenueHeaderRow}>
                <View>
                  <Text style={s.revenueCardLabel}>Total Sales & Revenue</Text>
                  <Text style={s.revenueCardVal}>₹{data.totalRevenue.toLocaleString()}</Text>
                </View>
                <View style={s.revenueGrowthBadge}>
                  <Ionicons name="trending-up" size={14} color={DS.primary} />
                  <Text style={s.revenueGrowthTxt}>+14.8%</Text>
                </View>
              </View>

              {/* Sparkline Graph */}
              {linePath ? (
                <View style={s.graphContainer}>
                  <Svg width={graphWidth} height={graphHeight}>
                    <Defs>
                      <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#22D3EE" stopOpacity={0.4} />
                        <Stop offset="100%" stopColor="#22D3EE" stopOpacity={0.0} />
                      </SvgGradient>
                    </Defs>
                    {/* Closed area path under line */}
                    <Path d={closedPath} fill="url(#grad)" />
                    {/* Line path */}
                    <Path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="2.5" />
                  </Svg>
                  {/* Glowing end node on graph */}
                  <Animated.View style={[s.graphNode, { left: lastX - 4, top: lastY - 4, opacity: pulse, borderColor: '#22D3EE' }]} />
                </View>
              ) : null}

              <View style={s.revenueFooterRow}>
                <View style={s.revFooterCol}>
                  <Text style={s.revFooterLabel}>This Month</Text>
                  <Text style={s.revFooterVal}>₹{data.thisMonthRevenue.toLocaleString()}</Text>
                </View>
                <View style={s.revFooterDivider} />
                <View style={s.revFooterCol}>
                  <Text style={s.revFooterLabel}>Monthly Orders</Text>
                  <Text style={s.revFooterVal}>{data.thisMonthOrders} orders</Text>
                </View>
              </View>
            </LinearGradient>
          </AnimatedEntry>

          {/* KPI Tiles (2x2 Grid) */}
          <AnimatedEntry delay={120} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={s.sectionHeader}>Performance Overview</Text>
            <View style={s.kpiGrid}>
              <View style={s.kpiTile}>
                <Ionicons name="cash-outline" size={22} color="#22D3EE" style={s.kpiIcon} />
                <Text style={s.kpiLabel}>Sales</Text>
                <Text style={s.kpiValue}>₹{data.totalRevenue.toLocaleString()}</Text>
              </View>
              <View style={s.kpiTile}>
                <Ionicons name="cube-outline" size={22} color="#8B5CF6" style={s.kpiIcon} />
                <Text style={s.kpiLabel}>Orders</Text>
                <Text style={s.kpiValue}>{data.totalOrders}</Text>
              </View>
              <View style={s.kpiTile}>
                <Ionicons name="pricetags-outline" size={22} color="#F59E0B" style={s.kpiIcon} />
                <Text style={s.kpiLabel}>Products</Text>
                <Text style={s.kpiValue}>{data.totalProducts}</Text>
              </View>
              <View style={s.kpiTile}>
                <Ionicons name="eye-outline" size={22} color="#10B981" style={s.kpiIcon} />
                <Text style={s.kpiLabel}>Views</Text>
                <Text style={s.kpiValue}>{data.totalViews}</Text>
              </View>
            </View>
          </AnimatedEntry>

          {/* Priority Pending orders banner */}
          {data.pendingOrders > 0 && (
            <AnimatedEntry delay={150}>
              <AnimatedPressable onPress={() => navigation.navigate('Orders')} style={s.priorityBanner}>
                <View style={s.bannerIconRing}>
                  <Ionicons name="notifications" size={20} color={DS.error} />
                  <View style={s.pulseDot} />
                </View>
                <View style={s.bannerTextCol}>
                  <Text style={s.bannerTitle}>{data.pendingOrders} Orders Pending</Text>
                  <Text style={s.bannerSub}>Tap to manage and fulfill now</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.error} />
              </AnimatedPressable>
            </AnimatedEntry>
          )}

          {/* Sleek Operations Console Grid */}
          <AnimatedEntry delay={200} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={s.sectionHeader}>Operations Console</Text>
            <View style={s.operationsGrid}>
              <View style={s.opsRow}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('AddProduct')}
                  style={[s.opsCard, { borderLeftColor: DS.purple, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.purple + '15' }]}>
                    <Ionicons name="add-circle" size={24} color={DS.purple} />
                  </View>
                  <Text style={s.opsCardTitle}>Add Item</Text>
                  <Text style={s.opsCardDesc}>Create product listing</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={() => navigation.navigate('Products')}
                  style={[s.opsCard, { borderLeftColor: DS.primary, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.primary + '15' }]}>
                    <Ionicons name="cube" size={24} color={DS.primary} />
                  </View>
                  <Text style={s.opsCardTitle}>Inventory</Text>
                  <Text style={s.opsCardDesc}>{data.totalProducts} active items</Text>
                </AnimatedPressable>
              </View>

              <View style={s.opsRow}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('Orders')}
                  style={[s.opsCard, { borderLeftColor: DS.info, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.info + '15' }]}>
                    <Ionicons name="receipt" size={24} color={DS.info} />
                  </View>
                  <Text style={s.opsCardTitle}>Orders Feed</Text>
                  <Text style={s.opsCardDesc}>{data.totalOrders} total completed</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={() => navigation.navigate('ManageFlashSales')}
                  style={[s.opsCard, { borderLeftColor: DS.warning, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.warning + '15' }]}>
                    <Ionicons name="flash" size={24} color={DS.warning} />
                  </View>
                  <Text style={s.opsCardTitle}>Flash Sales</Text>
                  <Text style={s.opsCardDesc}>Manage discounts</Text>
                </AnimatedPressable>
              </View>

              <View style={s.opsRow}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('StoreSettings')}
                  style={[s.opsCard, { borderLeftColor: DS.gray600, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.gray600 + '15' }]}>
                    <Ionicons name="settings" size={24} color={DS.gray600} />
                  </View>
                  <Text style={s.opsCardTitle}>Store Settings</Text>
                  <Text style={s.opsCardDesc}>Hours & Status</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={() => navigation.navigate('PromoteProduct')}
                  style={[s.opsCard, { borderLeftColor: DS.success, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.success + '15' }]}>
                    <Ionicons name="megaphone" size={24} color={DS.success} />
                  </View>
                  <Text style={s.opsCardTitle}>Promote</Text>
                  <Text style={s.opsCardDesc}>Boost ranking & sales</Text>
                </AnimatedPressable>
              </View>

              <View style={s.opsRow}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('SellerAudience')}
                  style={[s.opsCard, { borderLeftColor: DS.primary, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.primary + '15' }]}>
                    <Ionicons name="people" size={24} color={DS.primary} />
                  </View>
                  <Text style={s.opsCardTitle}>Audience</Text>
                  <Text style={s.opsCardDesc}>Broadcast & Followers</Text>
                </AnimatedPressable>
                
                <AnimatedPressable
                  onPress={() => navigation.navigate('SellerAdWallet')}
                  style={[s.opsCard, { borderLeftColor: DS.warning, borderLeftWidth: 4 }]}
                  containerStyle={{ flex: 1 }}
                >
                  <View style={[s.opsIconWrap, { backgroundColor: DS.warning + '15' }]}>
                    <Ionicons name="wallet" size={24} color={DS.warning} />
                  </View>
                  <Text style={s.opsCardTitle}>Ad Wallet</Text>
                  <Text style={s.opsCardDesc}>Manage ad balance</Text>
                </AnimatedPressable>
              </View>
            </View>
          </AnimatedEntry>

          {/* Daily Goal / Motivation Segment */}
          <AnimatedEntry delay={250} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={s.dailyGoalCard}>
              <View style={s.dailyGoalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flag-outline" size={16} color={DS.primary} />
                  <Text style={s.dailyGoalTitle}>Daily Goal</Text>
                </View>
                <Text style={s.dailyGoalProgressText}>
                  ₹{Math.min(data.totalRevenue, 10000).toLocaleString()} / ₹10,000
                </Text>
              </View>

              {/* Goal Progress bar */}
              <View style={s.goalProgressTrack}>
                <View
                  style={[
                    s.goalProgressFill,
                    {
                      width: `${Math.min(100, (data.totalRevenue / 10000) * 100)}%`,
                      backgroundColor: DS.primary,
                    },
                  ]}
                />
              </View>

              <Text style={s.goalMotivationText}>
                {data.totalRevenue >= 10000
                  ? 'Fantastic! You have hit your daily goal. Fulfill orders to maximize earnings.'
                  : `You are ₹${(10000 - Math.min(data.totalRevenue, 10000)).toLocaleString()} away from hitting today's target!`}
              </Text>
            </View>
          </AnimatedEntry>

          {/* Store Health Section */}
          <AnimatedEntry delay={270} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={s.sectionHeader}>Store Health</Text>
            <View style={s.storeHealthCard}>
              <View style={s.healthScoreRow}>
                <View style={s.healthScoreGauge}>
                  {/* Mock Semicircle Gauge using borders */}
                  <View style={s.healthScoreGaugeInner}>
                    <Text style={s.healthScoreNum}>92</Text>
                    <Text style={s.healthScoreTotal}>/100</Text>
                  </View>
                </View>
                <View style={{ flex: 1, paddingLeft: 16 }}>
                  <Text style={s.healthScoreTitle}>Excellent Performance</Text>
                  <Text style={s.healthScoreSub}>Your store is highly visible and trusted by customers.</Text>
                </View>
              </View>
              <View style={s.healthDivider} />
              <Text style={s.optimizationTitle}>Optimization Tips</Text>
              <View style={s.optimizationList}>
                <View style={s.optItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#22D3EE" />
                  <Text style={s.optItemText}>Maintain &gt;95% fulfillment rate</Text>
                </View>
                <View style={s.optItem}>
                  <Ionicons name="alert-circle" size={16} color={DS.warning} />
                  <Text style={s.optItemText}>2 products missing high-quality images</Text>
                </View>
                <View style={s.optItem}>
                  <Ionicons name="alert-circle" size={16} color={DS.warning} />
                  <Text style={s.optItemText}>Reply to pending reviews</Text>
                </View>
              </View>
            </View>
          </AnimatedEntry>

          {/* Live Recent Orders Activity Stream */}
          <AnimatedEntry delay={300} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionHeader}>Live Order Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={s.sectionHeaderLink}>See All</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length > 0 ? (
              <View style={s.ordersFeedCard}>
                {recentOrders.map((order, idx) => {
                  const itemsSummary = Array.isArray(order.items)
                    ? order.items.map((it: any) => `${it.quantity}x ${it.productName || it.name}`).join(', ')
                    : 'Order items';

                  return (
                    <View key={order.id || idx}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Orders')}
                        style={s.orderFeedItem}
                        activeOpacity={0.7}
                      >
                        <View style={s.orderIconCircle}>
                          <Ionicons name="cart-outline" size={18} color={DS.gray700} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.orderIdText} numberOfLines={1}>
                              Order #{String(order.id || '').substring(0, 8).toUpperCase()}
                            </Text>
                            <View style={[s.orderStatusBadge, { backgroundColor: getStatusColor(order.status) + '15' }]}>
                              <Text style={[s.orderStatusBadgeText, { color: getStatusColor(order.status) }]}>
                                {order.status}
                              </Text>
                            </View>
                          </View>
                          <Text style={s.orderItemsText} numberOfLines={1}>
                            {itemsSummary}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          <Text style={s.orderPriceText}>₹{order.total}</Text>
                          <Ionicons name="chevron-forward" size={14} color={DS.gray400} style={{ marginTop: 4 }} />
                        </View>
                      </TouchableOpacity>
                      {idx < recentOrders.length - 1 && <View style={s.orderDivider} />}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={s.emptyOrdersCard}>
                <Ionicons name="chatbox-ellipses-outline" size={32} color={DS.gray400} style={{ marginBottom: 8 }} />
                <Text style={s.emptyStateText}>No recent orders received yet.</Text>
                <Text style={s.emptyStateSub}>Once customer orders are received, they will stream here.</Text>
              </View>
            )}
          </AnimatedEntry>

          {/* Top Performer Card & Marketing */}
          <AnimatedEntry delay={350} style={{ paddingHorizontal: 16, marginBottom: 40 }}>
            <Text style={s.sectionHeader}>Performance & Growth</Text>

            {/* Top Performer Row */}
            <AnimatedPressable onPress={() => navigation.navigate('Products')} style={s.performerCard}>
              <View style={s.performerIcon}>
                <Ionicons name="flame" size={22} color={DS.warning} />
              </View>
              <View style={s.performerInfo}>
                <Text style={s.performerName} numberOfLines={1}>
                  {data.topProduct.name}
                </Text>
                <Text style={s.performerSold}>{data.topProduct.sold} units sold</Text>
              </View>
              <View style={s.performerBadge}>
                <Text style={s.performerBadgeTxt}>#1 Seller</Text>
              </View>
            </AnimatedPressable>

            {/* Average Rating Banner */}
            <View style={s.ratingBanner}>
              <View style={s.ratingIconCircle}>
                <Ionicons name="star" size={20} color={DS.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ratingTitle}>Store Reputation</Text>
                <Text style={s.ratingSub}>
                  Your average rating is {data.averageRating.toFixed(1)} stars. Keep up the high service!
                </Text>
              </View>
              <View style={s.ratingStarsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < Math.round(data.averageRating) ? 'star' : 'star-outline'}
                    size={14}
                    color={DS.warning}
                  />
                ))}
              </View>
            </View>

            {/* Marketing card */}
            <AnimatedPressable onPress={() => navigation.navigate('PromoteProduct')} style={s.marketingCard}>
              <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={s.marketingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={s.marketingIconRing}>
                  <Ionicons name="megaphone" size={22} color="#FFF" />
                </View>
                <View style={s.marketingInfo}>
                  <Text style={s.marketingTitle}>Boost Your Local Sales</Text>
                  <Text style={s.marketingSub}>Create an ad campaign to reach 3x more customers in your area.</Text>
                </View>
                <View style={s.marketingBtn}>
                  <Text style={s.marketingBtnText}>Promote</Text>
                </View>
              </LinearGradient>
            </AnimatedPressable>
          </AnimatedEntry>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const paddingTop = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: paddingTop + 54,
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: paddingTop,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.successFaded,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DS.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.success,
    textTransform: 'uppercase',
  },
  headerTitleSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingTop: paddingTop + 54 + 4,
    paddingBottom: 100,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  greeting: {
    fontSize: 12,
    color: DS.gray500,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroShopName: {
    fontSize: 26,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  heroLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  heroLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.success,
  },
  heroLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  revenueCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: DS.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  revenueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  revenueCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  revenueCardVal: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 4,
  },
  revenueGrowthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 3,
  },
  revenueGrowthTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: DS.primary,
  },

  graphContainer: {
    height: 48,
    marginVertical: 14,
    justifyContent: 'flex-end',
  },
  graphNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: DS.primaryDark,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  revenueFooterRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
    marginTop: 8,
  },
  revFooterCol: {
    flex: 1,
  },
  revFooterLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  revFooterVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  revFooterDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
  },

  priorityBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: DS.radius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  bannerIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.error,
    borderWidth: 1.5,
    borderColor: '#FEF2F2',
  },
  bannerTextCol: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: DS.error, marginBottom: 2 },
  bannerSub: { fontSize: 13, color: '#991B1B', fontWeight: '500' },

  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLink: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.primary,
  },

  operationsGrid: {
    gap: 12,
  },
  opsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  opsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    minHeight: 110,
    justifyContent: 'space-between',
    width: '100%',
  },
  opsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  opsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.gray900,
  },
  opsCardDesc: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
    marginTop: 2,
  },

  dailyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  dailyGoalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dailyGoalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.gray700,
  },
  dailyGoalProgressText: {
    fontSize: 13,
    fontWeight: '800',
    color: DS.gray900,
  },
  goalProgressTrack: {
    height: 6,
    backgroundColor: DS.gray100,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalMotivationText: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
    lineHeight: 16,
  },

  ordersFeedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  orderFeedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  orderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.gray900,
  },
  orderStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  orderItemsText: {
    fontSize: 12,
    color: DS.gray500,
    marginTop: 4,
    fontWeight: '500',
  },
  orderPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.gray900,
  },
  orderDivider: {
    height: 1,
    backgroundColor: DS.border,
    marginHorizontal: 16,
  },

  emptyOrdersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyStateText: {
    fontSize: 14,
    color: DS.gray900,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: DS.gray500,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },

  performerCard: {
    backgroundColor: DS.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 12,
  },
  performerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  performerInfo: { flex: 1 },
  performerName: { fontSize: 14, fontWeight: '700', color: DS.gray900, marginBottom: 3 },
  performerSold: { fontSize: 12, color: DS.gray500, fontWeight: '500' },
  performerBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  performerBadgeTxt: { fontSize: 11, fontWeight: '800', color: DS.primary },

  ratingBanner: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FEF3C7',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  ratingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.gray900,
  },
  ratingSub: {
    fontSize: 12,
    color: DS.gray600,
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },

  marketingCard: {
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  marketingGradient: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
  },
  marketingIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  marketingInfo: { flex: 1 },
  marketingTitle: { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  marketingSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 16, fontWeight: '500' },
  marketingBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketingBtnText: { fontSize: 12, fontWeight: '700', color: '#6D28D9' },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiTile: {
    width: '48%',
    backgroundColor: DS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  kpiIcon: {
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.gray500,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: DS.gray900,
  },

  storeHealthCard: {
    backgroundColor: DS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  healthScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthScoreGauge: {
    width: 80,
    height: 40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: 'rgba(34,211,238,0.2)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: '#22D3EE',
  },
  healthScoreGaugeInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: -4,
  },
  healthScoreNum: {
    fontSize: 24,
    fontWeight: '900',
    color: '#22D3EE',
  },
  healthScoreTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.gray500,
    marginLeft: 2,
  },
  healthScoreTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: DS.gray900,
    marginBottom: 2,
  },
  healthScoreSub: {
    fontSize: 11,
    color: DS.gray500,
    lineHeight: 16,
  },
  healthDivider: {
    height: 1,
    backgroundColor: DS.border,
    marginBottom: 16,
  },
  optimizationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.gray900,
    marginBottom: 12,
  },
  optimizationList: {
    gap: 8,
  },
  optItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.background,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  optItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.gray700,
  }
});