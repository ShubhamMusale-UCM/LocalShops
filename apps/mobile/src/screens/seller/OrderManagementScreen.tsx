import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, shadows } from '../../theme';
import Card from '../../components/ui/Card';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import { orderService } from '../../services/orderService';
import shopService from '../../services/shopService';
import { getProductImageUrl } from '../../utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Animation presets ──────────────────────────────────
const SPRING_SOFT = { damping: 22, stiffness: 250, useNativeDriver: true as true };
const SPRING_SNAP = { damping: 20, stiffness: 300, useNativeDriver: true as true };

// ─── Design System ──────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13, 148, 136, 0.08)',
  success: '#10B981',
  successDark: '#059669',
  error: '#EF4444',
  errorDark: '#DC2626',
  warning: '#F59E0B',
  warningDark: '#D97706',
  info: '#3B82F6',
  infoDark: '#2563EB',
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

// ─── Order status config ─────────────────────────────────
type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'CANCELLED';

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  itemCount: number;
  previewImage?: string;
}

// Next status transitions for seller
const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; color: string; icon: string }>> = {
  PLACED: { status: 'CONFIRMED', label: 'Accept Order', color: DS.info, icon: 'checkmark-circle-outline' },
  CONFIRMED: { status: 'PREPARING', label: 'Start Preparing', color: DS.warning, icon: 'timer-outline' },
  PREPARING: { status: 'READY_FOR_PICKUP', label: 'Mark Ready', color: '#8B5CF6', icon: 'cube-outline' },
  READY_FOR_PICKUP: { status: 'DELIVERED', label: 'Complete Order', color: DS.success, icon: 'checkmark-done-outline' },
};

const STATUS_CONFIG: Record<OrderStatus | string, { color: string; bg: string; icon: string; label: string }> = {
  PLACED: { color: DS.info, bg: '#EFF6FF', icon: 'receipt-outline', label: 'New Order' },
  CONFIRMED: { color: DS.info, bg: '#EFF6FF', icon: 'checkmark-circle', label: 'Confirmed' },
  PREPARING: { color: DS.warning, bg: '#FEF3C7', icon: 'timer-outline', label: 'Preparing' },
  READY_FOR_PICKUP: { color: '#8B5CF6', bg: '#EDE9FE', icon: 'cube-outline', label: 'Ready' },
  DELIVERED: { color: DS.success, bg: '#D1FAE5', icon: 'checkmark-done', label: 'Completed' },
  CANCELLED: { color: DS.error, bg: '#FEE2E2', icon: 'close-circle', label: 'Cancelled' },
};

// ─── Animated Filter Pill ────────────────────────────────
const FilterPill: React.FC<{
  label: string;
  isActive: boolean;
  count?: number;
  onPress: () => void;
  delay: number;
}> = ({ label, isActive, count, onPress, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      delay: Math.min(delay, 120),
      useNativeDriver: true,
    }).start();
  }, []);

  const formatLabel = (raw: string) =>
    raw
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');

  return (
    <Animated.View style={{ opacity, transform: [{ scale: pressScale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.97, ...SPRING_SNAP }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING_SOFT }).start()}
        activeOpacity={1}
        style={[styles.filterPill, isActive && styles.filterPillActive]}
      >
        <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
          {formatLabel(label)}
        </Text>
        {count !== undefined && (
          <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Order Card ──────────────────────────────────────────
const AnimatedOrderCard: React.FC<{
  item: Order;
  index: number;
  onPress: () => void;
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<void>;
}> = ({ item, index, onPress, onUpdateStatus }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      delay: Math.min(index * 30, 150),
      useNativeDriver: true,
    }).start();
  }, []);

  const config = STATUS_CONFIG[item.status] || {
    color: DS.gray600,
    bg: DS.gray100,
    icon: 'help-circle',
    label: item.status,
  };

  const nextAction = NEXT_STATUS[item.status];

  const handleAction = async () => {
    if (!nextAction || updating) return;
    Alert.alert(
      nextAction.label,
      `Move order ${item.orderNumber} to "${nextAction.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            await onUpdateStatus(item.id, nextAction.status);
            setUpdating(false);
          },
        },
      ]
    );
  };

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale: pressScale }],
        marginBottom: 12,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.98, ...SPRING_SNAP }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING_SOFT }).start()}
        activeOpacity={1}
        style={styles.orderCard}
      >
        <View style={styles.orderImageStrip}>
          <Image source={{ uri: item.previewImage || '' }} style={styles.orderImage} />
          <View style={[styles.orderImageBadge, { backgroundColor: config.color }]}>
            <Ionicons name={config.icon as any} size={12} color="#FFFFFF" />
          </View>
        </View>

        {/* PLACED urgent accent */}
        {item.status === 'PLACED' && <View style={styles.urgentAccent} />}

        {/* Top Section */}
        <View style={styles.orderTopRow}>
          <View style={styles.orderIdSection}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.orderCustomer}>{item.customer}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={13} color={config.color} />
            <Text style={[styles.statusChipText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        {/* Separator */}
        <View style={styles.orderSeparator} />

        {/* Bottom meta */}
        <View style={styles.orderBottomRow}>
          <View style={styles.orderMeta}>
            <View style={styles.orderMetaItem}>
              <Ionicons name="bag-outline" size={13} color={DS.gray500} />
              <Text style={styles.orderMetaText}>
                {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.orderMetaItem}>
              <Ionicons name="time-outline" size={13} color={DS.gray500} />
              <Text style={styles.orderMetaText}>{item.createdAt}</Text>
            </View>
          </View>
          <Text style={styles.orderTotal}>₹{item.total.toLocaleString()}</Text>
        </View>

        {/* Action button — shown for actionable statuses */}
        {nextAction && (
          <TouchableOpacity
            onPress={handleAction}
            activeOpacity={0.85}
            disabled={updating}
            style={[styles.actionBtn, { backgroundColor: nextAction.color }]}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={nextAction.icon as any} size={15} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Delivered — final state label */}
        {item.status === 'DELIVERED' && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-done-circle" size={14} color={DS.success} />
            <Text style={styles.completedText}>Order Completed</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Component ──────────────────────────────────────
const OrderManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const headerFade = useRef(new Animated.Value(0)).current;

  const { onScroll, scrollEventThrottle } = useHideTabBarOnScroll();

  const filters = [
    'ALL',
    'PLACED',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'DELIVERED',
  ];

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);

  const loadSellerOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const myShopsResponse = await shopService.getMyShops();
      const myShops = Array.isArray(myShopsResponse.data)
        ? myShopsResponse.data
        : myShopsResponse.data?.shops || [];

      if (!myShops.length) {
        setOrders([]);
        return;
      }

      const primaryShop = myShops[0];
      setShopId(primaryShop.id);
      const response = await orderService.getShopOrders(primaryShop.id, 1);
      const payload = response?.data || {};
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.orders)
        ? payload.orders
        : [];

      const mapped: Order[] = list.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber || `#${String(order.id).slice(-8)}`,
        customer: order.user?.name || 'Customer',
        total: Number(order.total || 0),
        status: (order.status || 'PLACED') as Order['status'],
        createdAt: new Date(order.createdAt).toLocaleString(),
        itemCount: Array.isArray(order.items)
          ? order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
          : 0,
        previewImage: getProductImageUrl(
          Array.isArray(order.items)
            ? order.items.flatMap((line: any) => [
                ...(Array.isArray(line.product?.images) ? line.product.images : []),
                line.productImage,
                line.product?.image,
              ].filter(Boolean))
            : []
        ),
      }));

      setOrders(mapped);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 429) console.error('Failed to load seller orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSellerOrders();
  }, [loadSellerOrders]);

  const handleUpdateStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      try {
        await orderService.updateStatus(orderId, newStatus);
        // Optimistically update local state
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      } catch (error) {
        Alert.alert('Update Failed', 'Could not update order status. Please try again.');
        console.error('Status update failed:', error);
      }
    },
    []
  );

  const getFilterCount = (filter: string) => {
    if (filter === 'ALL') return orders.length;
    return orders.filter((o) => o.status === filter).length;
  };

  const filteredOrders =
    selectedFilter === 'ALL'
      ? orders
      : orders.filter((o) => o.status === selectedFilter);

  // Sort: PLACED first (most urgent), then by createdAt desc
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const priority: Record<string, number> = {
      PLACED: 0, CONFIRMED: 1, PREPARING: 2, READY_FOR_PICKUP: 3,
      DELIVERED: 4, CANCELLED: 5,
    };
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  });

  const onRefresh = useCallback(() => loadSellerOrders(true), [loadSellerOrders]);

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBg}>
        <Ionicons name="receipt-outline" size={44} color={DS.gray400} />
      </View>
      <Text style={styles.emptyTitle}>No orders found</Text>
      <Text style={styles.emptySubtitle}>
        Orders matching this filter will appear here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ─── Header ──────────────────────── */}
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={styles.header}>
        <Animated.View style={[styles.headerContent, { opacity: headerFade }]}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Dashboard');
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Orders</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{orders.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="search-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      {/* ─── Filter Pills ───────────────── */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filters.map((filter, idx) => (
            <FilterPill
              key={filter}
              label={filter}
              isActive={selectedFilter === filter}
              count={getFilterCount(filter)}
              onPress={() => setSelectedFilter(filter)}
              delay={idx * 40}
            />
          ))}
        </ScrollView>
      </View>

      {/* ─── Orders List ───────────────── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DS.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedOrders}
          renderItem={({ item, index }) => (
            <AnimatedOrderCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[DS.primary]}
              tintColor={DS.primary}
            />
          }
        />
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.background },

  // Header
  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? 54
        : StatusBar.currentHeight
        ? StatusBar.currentHeight + 12
        : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#FFFFFF' },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter
  filterSection: {
    backgroundColor: DS.card,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    paddingVertical: 12,
  },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: DS.radius.full,
    backgroundColor: DS.gray50,
    borderWidth: 1.2,
    borderColor: DS.gray300,
    gap: 6,
  },
  filterPillActive: { backgroundColor: DS.primary, borderColor: DS.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: DS.gray700 },
  filterPillTextActive: { color: '#FFFFFF' },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: DS.gray600 },
  filterBadgeTextActive: { color: '#FFFFFF' },

  // Order Card
  orderCard: {
    backgroundColor: DS.card,
    borderRadius: DS.radius.lg,
    padding: 16,
    paddingTop: 88,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  orderImageStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: DS.gray100,
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  orderImageBadge: {
    position: 'absolute',
    right: 12,
    bottom: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DS.card,
  },
  urgentAccent: {
    position: 'absolute',
    left: 0,
    top: 72,
    bottom: 0,
    width: 3,
    backgroundColor: DS.info,
    borderTopLeftRadius: DS.radius.lg,
    borderBottomLeftRadius: DS.radius.lg,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdSection: { flex: 1, marginRight: 12 },
  orderNumber: { fontSize: 15, fontWeight: '700', color: DS.gray900, marginBottom: 2 },
  orderCustomer: { fontSize: 13, fontWeight: '500', color: DS.gray500 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
  },
  statusChipText: { fontSize: 11, fontWeight: '600' },
  orderSeparator: { height: 1, backgroundColor: DS.border, marginVertical: 11 },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderMetaText: { fontSize: 12, fontWeight: '500', color: DS.gray500 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: DS.gray400 },
  orderTotal: { fontSize: 16, fontWeight: '800', color: DS.primary, letterSpacing: -0.3 },

  // Action button
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: DS.radius.md,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Completed badge
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: DS.radius.md,
    backgroundColor: '#D1FAE5',
  },
  completedText: { fontSize: 13, fontWeight: '600', color: DS.success },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: DS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DS.gray900, marginBottom: 6 },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.gray500,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default OrderManagementScreen;