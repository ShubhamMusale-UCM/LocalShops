import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api';

// ─── Design tokens ───────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13,148,136,0.08)',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',
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
  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },
};

const SPRING = { damping: 22, stiffness: 250, useNativeDriver: true as true };
const SNAP = { damping: 20, stiffness: 300, useNativeDriver: true as true };

type TimeRange = 'week' | 'month' | 'year';

interface EarningsSummary {
  totalEarnings: number;
  thisMonthEarnings: number;
  thisWeekEarnings: number;
  pendingPayout: number;
  completedPayouts: number;
  averageOrderValue: number;
  totalOrders: number;
}

interface PaymentBreakdown {
  orders: number;
  subscriptionRefunds: number;
  bonuses: number;
  deductions: number;
}

const FALLBACK_SUMMARY: EarningsSummary = {
  totalEarnings: 0, thisMonthEarnings: 0, thisWeekEarnings: 0,
  pendingPayout: 0, completedPayouts: 0, averageOrderValue: 0, totalOrders: 0,
};
const FALLBACK_BREAKDOWN: PaymentBreakdown = {
  orders: 0, subscriptionRefunds: 0, bonuses: 0, deductions: 0,
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── Animated stat tile ──────────────────────────────────
const StatTile: React.FC<{
  label: string; value: string; icon: string; color: string; bgColor: string; delay: number;
}> = ({ label, value, icon, color, bgColor, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, ...SPRING }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.statTile, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Animated.View>
  );
};

// ─── Breakdown row ───────────────────────────────────────
const BreakdownRow: React.FC<{
  label: string; amount: string; isPositive: boolean; icon: string;
}> = ({ label, amount, isPositive, icon }) => (
  <View style={s.breakRow}>
    <View style={[s.breakIcon, { backgroundColor: isPositive ? DS.successLight : '#FEE2E2' }]}>
      <Ionicons name={icon as any} size={14} color={isPositive ? DS.success : DS.error} />
    </View>
    <Text style={s.breakLabel}>{label}</Text>
    <Text style={[s.breakAmount, { color: isPositive ? DS.success : DS.error }]}>
      {isPositive ? '+' : '−'} {amount}
    </Text>
  </View>
);

export default function EarningsBreakdownScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [summary, setSummary] = useState<EarningsSummary>(FALLBACK_SUMMARY);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown>(FALLBACK_BREAKDOWN);
  const headerFade = useRef(new Animated.Value(0)).current;

  const netEarnings = useMemo(
    () => breakdown.orders + breakdown.bonuses - breakdown.subscriptionRefunds - breakdown.deductions,
    [breakdown]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, breakdownRes] = await Promise.all([
        apiClient.get('/analytics/seller', { params: { dateRange: timeRange } }),
        apiClient.get('/analytics/ads'),
      ]);
      const sellerStats = summaryRes.data?.data?.stats || summaryRes.data?.stats || {};
      const adsStats = breakdownRes.data?.data || breakdownRes.data || {};
      const totalRevenue = Number(sellerStats.totalRevenue || 0);
      const totalOrders = Number(sellerStats.totalOrders || 0);
      setSummary({
        ...FALLBACK_SUMMARY,
        totalEarnings: totalRevenue,
        thisMonthEarnings: timeRange === 'month' ? totalRevenue : 0,
        thisWeekEarnings: timeRange === 'week' ? totalRevenue : 0,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        totalOrders,
      });
      setBreakdown({
        ...FALLBACK_BREAKDOWN,
        orders: totalRevenue,
        deductions: Number(adsStats.totalSpent || 0),
      });
    } catch {
      setSummary(FALLBACK_SUMMARY);
      setBreakdown(FALLBACK_BREAKDOWN);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    loadData();
  }, [timeRange]);

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  const stats = [
    { label: 'Total Earned', value: fmt(summary.totalEarnings), icon: 'wallet-outline', color: DS.primary, bgColor: DS.primaryFaded },
    { label: 'This Period', value: fmt(timeRange === 'week' ? summary.thisWeekEarnings : summary.thisMonthEarnings), icon: 'trending-up-outline', color: DS.success, bgColor: DS.successLight },
    { label: 'Avg Order', value: fmt(summary.averageOrderValue), icon: 'receipt-outline', color: DS.warning, bgColor: DS.warningLight },
    { label: 'Total Orders', value: String(summary.totalOrders), icon: 'bag-handle-outline', color: DS.purple, bgColor: DS.purpleLight },
  ];

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={DS.primary} />
      {/* Header */}
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={s.header}>
        <Animated.View style={[s.headerContent, { opacity: headerFade }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>Earnings</Text>
            <Text style={s.headerSub}>Track your revenue & payouts</Text>
          </View>
          <TouchableOpacity onPress={loadData} style={s.backBtn}>
            <Ionicons name="refresh-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Time range pills inside header */}
        <View style={s.rangeRow}>
          {timeRanges.map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => setTimeRange(r.key)}
              style={[s.rangeChip, timeRange === r.key && s.rangeChipActive]}
            >
              <Text style={[s.rangeChipText, timeRange === r.key && s.rangeChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={DS.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero net earnings */}
          <View style={s.heroCard}>
            <Text style={s.heroLabel}>Net Earnings</Text>
            <Text style={s.heroValue}>{fmt(netEarnings)}</Text>
            <View style={s.heroBadge}>
              <Ionicons name="trending-up" size={13} color={DS.success} />
              <Text style={s.heroBadgeText}>This {timeRange}</Text>
            </View>
          </View>

          {/* Stats grid */}
          <View style={s.statsGrid}>
            {stats.map((st, i) => (
              <StatTile key={st.label} {...st} delay={i * 35} />
            ))}
          </View>

          {/* Payment breakdown */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Breakdown</Text>
            <View style={s.card}>
              <BreakdownRow label="Order Revenue" amount={fmt(breakdown.orders)} isPositive icon="bag-handle" />
              <View style={s.divider} />
              <BreakdownRow label="Bonuses" amount={fmt(breakdown.bonuses)} isPositive icon="gift" />
              <View style={s.divider} />
              <BreakdownRow label="Ad Spend" amount={fmt(breakdown.deductions)} isPositive={false} icon="megaphone" />
              <View style={s.divider} />
              <BreakdownRow label="Subscription Refunds" amount={fmt(breakdown.subscriptionRefunds)} isPositive={false} icon="card" />
              <View style={[s.netRow]}>
                <Text style={s.netLabel}>Net Total</Text>
                <Text style={[s.netValue, { color: netEarnings >= 0 ? DS.success : DS.error }]}>
                  {fmt(netEarnings)}
                </Text>
              </View>
            </View>
          </View>

          {/* Pending payout */}
          {summary.pendingPayout > 0 && (
            <View style={s.section}>
              <View style={s.pendingCard}>
                <View style={s.pendingLeft}>
                  <Ionicons name="time-outline" size={22} color={DS.warning} />
                  <View>
                    <Text style={s.pendingTitle}>Pending Payout</Text>
                    <Text style={s.pendingSubtitle}>Processing in 3-5 business days</Text>
                  </View>
                </View>
                <Text style={s.pendingAmount}>{fmt(summary.pendingPayout)}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  rangeRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 4, borderRadius: DS.radius.full, alignSelf: 'flex-start',
  },
  rangeChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: DS.radius.full,
  },
  rangeChipActive: { backgroundColor: '#fff' },
  rangeChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  rangeChipTextActive: { color: DS.primary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, paddingBottom: 100, gap: 0 },

  // Hero
  heroCard: {
    backgroundColor: DS.card,
    borderRadius: DS.radius.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  heroLabel: { fontSize: 13, fontWeight: '500', color: DS.gray500, marginBottom: 4 },
  heroValue: { fontSize: 32, fontWeight: '800', color: DS.gray900, letterSpacing: -0.5 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DS.successLight, borderRadius: DS.radius.full,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: DS.success },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statTile: {
    width: '47.5%', backgroundColor: DS.card, borderRadius: DS.radius.md,
    padding: 14, borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: DS.radius.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: DS.gray900, letterSpacing: -0.3, marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '500', color: DS.gray500 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: DS.gray900, marginBottom: 10 },

  // Card
  card: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: DS.border },

  // Breakdown row
  breakRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  breakIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  breakLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: DS.gray700 },
  breakAmount: { fontSize: 14, fontWeight: '700' },

  // Net row
  netRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, backgroundColor: DS.gray50,
  },
  netLabel: { fontSize: 14, fontWeight: '700', color: DS.gray900 },
  netValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  // Pending payout
  pendingCard: {
    backgroundColor: DS.warningLight, borderRadius: DS.radius.md,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#FDE68A', gap: 10,
  },
  pendingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  pendingSubtitle: { fontSize: 11, color: '#B45309', marginTop: 1 },
  pendingAmount: { fontSize: 16, fontWeight: '800', color: '#92400E' },
});
