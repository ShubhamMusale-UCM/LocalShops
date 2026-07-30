/**
 * BuyerOrdersScreen — World-class premium redesign
 * Inspired by: Blinkit, Apple, Linear, Swiggy, Nothing OS
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { orderService } from '../../services/orderService';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import { getProductImageUrl } from '../../utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

interface BuyerOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    total: number;
    product?: { id: string; name: string; images?: string[]; price: number };
  }>;
  shop?: { name?: string };
}

// ─── Status theme map ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<OrderStatus, { color: string; bg: string; label: string; progress: number; emoji: string }> = {
  PLACED:            { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',   label: 'Order Placed',      progress: 0.15, emoji: '📋' },
  CONFIRMED:         { color: '#2563EB', bg: 'rgba(37,99,235,0.12)',    label: 'Confirmed',         progress: 0.30, emoji: '✅' },
  PREPARING:         { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   label: 'Preparing',         progress: 0.50, emoji: '👨‍🍳' },
  READY_FOR_PICKUP:  { color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',    label: 'Ready',             progress: 0.75, emoji: '📦' },
  DELIVERED:         { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',    label: 'Delivered',         progress: 1.00, emoji: '🎉' },
  CANCELLED:         { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    label: 'Cancelled',         progress: 0.00, emoji: '❌' },
  REFUNDED:          { color: '#EC4899', bg: 'rgba(236,72,153,0.12)',   label: 'Refunded',          progress: 0.00, emoji: '↩️' },
};

// ─── Timeline step dots ───────────────────────────────────────────────────────
const TIMELINE_STEPS: OrderStatus[] = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED',
];

// ─── Spring-press helper ──────────────────────────────────────────────────────
const PressableScale: React.FC<{ onPress?: () => void; style?: any; children: React.ReactNode }> = ({
  onPress, style, children,
}) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 70 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }}
      style={style}
    >
      <Animated.View style={anim}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ─── Order card ───────────────────────────────────────────────────────────────
const OrderCard: React.FC<{
  item: BuyerOrder;
  index: number;
  isDark: boolean;
  onPress: (id: string) => void;
  onTrack: (id: string) => void;
}> = ({ item, index, isDark, onPress, onTrack }) => {
  const config = STATUS_MAP[item.status] ?? {
    color: '#64748B', bg: 'rgba(100,116,139,0.12)', label: item.status, progress: 0, emoji: '📦',
  };

  const isActive = !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(item.status);
  const itemCount = item.items?.reduce((s, l) => s + (l.quantity || 0), 0) || 0;
  const shopName = item.shop?.name || 'Local Merchant';
  const orderNum = item.orderNumber || `#${item.id.slice(-8).toUpperCase()}`;
  const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const previewImage = getProductImageUrl(
    item.items?.flatMap((l: any) => [
      ...(Array.isArray(l.product?.images) ? l.product.images : []),
      l.productImage,
    ].filter(Boolean))
  );

  const stepIndex = TIMELINE_STEPS.indexOf(item.status);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(110).delay(index * 35)}
      style={{ marginBottom: 16 }}
    >
      <PressableScale onPress={() => onPress(item.id)}>
        <View style={[styles.card, { backgroundColor: isDark ? '#151A2D' : '#FFFFFF' }]}>
          {/* ── Top row ── */}
          <View style={styles.cardTop}>
            {/* Product thumbnail */}
            <View style={[styles.thumb, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              {previewImage ? (
                <Image source={{ uri: previewImage }} style={styles.thumbImg} />
              ) : (
                <Text style={styles.thumbEmoji}>{config.emoji}</Text>
              )}
              <View style={[styles.thumbDot, { backgroundColor: config.color }]} />
            </View>

            {/* Meta */}
            <View style={styles.cardMeta}>
              <View style={styles.metaRow}>
                <Text style={[styles.shopName, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
                  {shopName}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                  <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>
              <Text style={[styles.orderNum, { color: isDark ? '#94A3B8' : '#64748B' }]}>{orderNum}</Text>
              <Text style={[styles.orderDate, { color: isDark ? '#64748B' : '#94A3B8' }]}>{dateStr}</Text>
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]} />

          {/* ── Metrics row ── */}
          <View style={styles.metricsRow}>
            <View>
              <Text style={[styles.metricLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>ITEMS</Text>
              <Text style={[styles.metricValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metricLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>TOTAL PAID</Text>
              <Text style={styles.totalPrice}>₹{Number(item.total || 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* ── Active order: timeline progress ── */}
          {isActive && config.progress > 0 && (
            <View style={styles.timelineSection}>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                <LinearGradient
                  colors={[config.color + 'BB', config.color]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${config.progress * 100}%` }]}
                />
              </View>
              <View style={styles.stepDots}>
                {TIMELINE_STEPS.map((step, i) => {
                  const passed = i <= stepIndex;
                  return (
                    <View
                      key={step}
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: passed ? config.color : (isDark ? '#1E293B' : '#E2E8F0'),
                          borderColor: passed ? config.color : (isDark ? '#334155' : '#CBD5E1'),
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={[styles.stepLabel, { color: config.color }]}>{config.label}</Text>
            </View>
          )}

          {/* ── CTAs ── */}
          <View style={styles.actions}>
            {isActive ? (
              <TouchableOpacity
                style={[styles.trackBtn, { backgroundColor: '#2563EB' }]}
                onPress={() => onTrack(item.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={14} color="#FFFFFF" />
                <Text style={styles.trackBtnText}>Track Order</Text>
              </TouchableOpacity>
            ) : item.status === 'DELIVERED' ? (
              <TouchableOpacity
                style={[styles.reorderBtn, { borderColor: '#22C55E' }]}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={14} color="#22C55E" />
                <Text style={[styles.reorderText, { color: '#22C55E' }]}>Reorder</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.detailBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
              onPress={() => onPress(item.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text style={[styles.detailText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

// ─── Tab pill ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'ALL',     label: 'All',     icon: 'layers-outline',          color: '#2563EB' },
  { key: 'ACTIVE',  label: 'Active',  icon: 'flash-outline',           color: '#06B6D4' },
  { key: 'HISTORY', label: 'History', icon: 'checkmark-circle-outline', color: '#22C55E' },
] as const;

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BuyerOrdersScreen() {
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [tab, setTab] = useState<'ALL' | 'ACTIVE' | 'HISTORY'>('ALL');

  const { onScroll, onScrollEndDrag, onMomentumScrollEnd, scrollEventThrottle } =
    useHideTabBarOnScroll();

  const bg = isDark ? '#0B1020' : '#F8FAFC';
  const card = isDark ? '#151A2D' : '#FFFFFF';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const textSub = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const loadOrders = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await orderService.getMyOrders(1);
      const payload = res?.data || {};
      const list: BuyerOrder[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.orders)
        ? payload.orders
        : [];
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    if (tab === 'ACTIVE') return orders.filter(o => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status));
    if (tab === 'HISTORY') return orders.filter(o => ['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status));
    return orders;
  }, [orders, tab]);

  const activeCount = orders.filter(o => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status)).length;

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.delay(300)} style={styles.emptyWrap}>
      <LinearGradient
        colors={isDark ? ['#1E3A8A20', '#0F172A00'] : ['#EFF6FF', '#DBEAFE00']}
        style={styles.emptyGrad}
      >
        <Text style={styles.emptyEmoji}>🧾</Text>
        <Text style={[styles.emptyTitle, { color: text }]}>No Orders Yet</Text>
        <Text style={[styles.emptySub, { color: textSub }]}>
          Once you place your first order, it will appear here with full tracking.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyBtnText}>Start Shopping</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderHeader = () => (
    <View>
      {/* Hero header */}
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#0F172A'] : ['#EFF6FF', '#DBEAFE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.eyebrow, { color: isDark ? '#93C5FD' : '#2563EB' }]}>MY ORDERS</Text>
            <Text style={[styles.heroTitle, { color: isDark ? '#F8FAFC' : '#1E3A8A' }]}>
              Order History
            </Text>
          </View>
          {activeCount > 0 && (
            <View style={[styles.activeBadge, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.activeBadgeText}>{activeCount} Active</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Floating tab pills */}
      <View style={[styles.tabRow, { backgroundColor: bg }]}>
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive ? t.color : (isDark ? '#1E293B' : '#FFFFFF'),
                  borderColor: isActive ? 'transparent' : border,
                },
              ]}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={isActive ? '#FFFFFF' : textSub}
              />
              <Text style={[styles.tabText, { color: isActive ? '#FFFFFF' : textSub }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={[styles.loadingText, { color: textSub }]}>Loading your orders...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={scrollEventThrottle}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOrders(true)}
            colors={['#2563EB']}
            tintColor="#2563EB"
            progressBackgroundColor={card}
          />
        }
        renderItem={({ item, index }) => (
          <OrderCard
            item={item}
            index={index}
            isDark={isDark}
            onPress={(id) => navigation.navigate('OrderDetail', { orderId: id })}
            onTrack={(id) => navigation.navigate('OrderTracking', { orderId: id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 0,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 36 },
  activeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  activeBadgeText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tabText: { fontSize: 12, fontWeight: '800' },

  // Order Card
  card: {
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbEmoji: { fontSize: 28 },
  thumbDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cardMeta: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  shopName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '900' },
  orderNum: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  orderDate: { fontSize: 11, fontWeight: '500' },

  divider: { height: 1, marginVertical: 14 },

  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metricValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  totalPrice: { fontSize: 18, fontWeight: '900', color: '#2563EB', letterSpacing: -0.4, marginTop: 2 },

  // Timeline
  timelineSection: { marginTop: 16 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  stepDots: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  stepLabel: { fontSize: 11, fontWeight: '700' },

  // Actions
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
  trackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 3,
  },
  trackBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  reorderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  reorderText: { fontWeight: '800', fontSize: 13 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  detailText: { fontWeight: '700', fontSize: 13 },

  // Empty state
  emptyWrap: { paddingTop: 40, paddingHorizontal: 20 },
  emptyGrad: { borderRadius: 28, padding: 36, alignItems: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
