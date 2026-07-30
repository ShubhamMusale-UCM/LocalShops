import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import apiClient from '../../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

const DS3 = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13,148,136,0.08)',
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
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  inputBorder: '#E2E8F0',
  white: '#FFFFFF',
};

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
  totalEarnings: 0,
  thisMonthEarnings: 0,
  thisWeekEarnings: 0,
  pendingPayout: 0,
  completedPayouts: 0,
  averageOrderValue: 0,
  totalOrders: 0,
};

const FALLBACK_BREAKDOWN: PaymentBreakdown = {
  orders: 0,
  subscriptionRefunds: 0,
  bonuses: 0,
  deductions: 0,
};

const formatINR = (amount: number) =>
  `₹${amount.toLocaleString('en-IN')}`;

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  style?: object;
  delay?: number;
}

function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  style,
  delay = 0,
}: AnimatedCounterProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listener = animValue.addListener(({ value: v }) => {
      setDisplayValue(Math.round(v));
    });
    Animated.timing(animValue, {
      toValue: value,
      duration: 1000,
      delay,
      useNativeDriver: false,
    }).start();
    return () => animValue.removeListener(listener);
  }, [value]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue.toLocaleString('en-IN')}
      {suffix}
    </Text>
  );
}

interface TimeRangeChipProps {
  label: string;
  value: TimeRange;
  active: boolean;
  onPress: () => void;
  index: number;
}

function TimeRangeChip({
  label,
  value,
  active,
  onPress,
  index,
}: TimeRangeChipProps) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      delay: index * 60,
      damping: 14,
      stiffness: 120,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressIn = () =>
    Animated.spring(pressAnim, {
      toValue: 0.94,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(pressAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ scale: pressAnim }] }}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[
          earningsStyles.rangeChip,
          active && earningsStyles.rangeChipActive,
        ]}
      >
        {active && (
          <Ionicons name="checkmark-circle" size={13} color={DS3.white} />
        )}
        <Text
          style={[
            earningsStyles.rangeChipText,
            active && earningsStyles.rangeChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface EarningsRowProps {
  label: string;
  value: string;
  type?: 'credit' | 'debit' | 'neutral';
  icon?: string;
  delay?: number;
  showBorder?: boolean;
}

function EarningsRow({
  label,
  value,
  type = 'neutral',
  icon,
  delay = 0,
  showBorder = true,
}: EarningsRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        delay,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const valueColor =
    type === 'credit'
      ? DS3.success
      : type === 'debit'
      ? DS3.error
      : DS3.gray900;

  return (
    <Animated.View
      style={[
        earningsStyles.earningsRow,
        showBorder && earningsStyles.earningsRowBorder,
        { opacity: fadeAnim, transform: [{ translateX }] },
      ]}
    >
      {icon && (
        <View
          style={[
            earningsStyles.earningsRowIcon,
            {
              backgroundColor:
                type === 'credit'
                  ? 'rgba(16,185,129,0.1)'
                  : type === 'debit'
                  ? 'rgba(239,68,68,0.1)'
                  : DS3.primaryFaded,
            },
          ]}
        >
          <Ionicons
            name={icon as any}
            size={14}
            color={
              type === 'credit'
                ? DS3.success
                : type === 'debit'
                ? DS3.error
                : DS3.primary
            }
          />
        </View>
      )}
      <Text style={earningsStyles.earningsLabel}>{label}</Text>
      <Text style={[earningsStyles.earningsValue, { color: valueColor }]}>
        {type === 'credit' ? '+' : type === 'debit' ? '-' : ''}
        {value}
      </Text>
    </Animated.View>
  );
}

interface SectionCardEProps {
  children: React.ReactNode;
  delay?: number;
  style?: object;
}

function SectionCardE({ children, delay = 0, style }: SectionCardEProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        earningsStyles.card,
        style,
        { opacity: fadeAnim, transform: [{ translateY }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function EarningsBreakdownScreen() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [summary, setSummary] = useState<EarningsSummary>(FALLBACK_SUMMARY);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown>(
    FALLBACK_BREAKDOWN
  );
  const [refreshing, setRefreshing] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-16)).current;
  const totalEarningsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerFade, {
        toValue: 1,
        delay: 50,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslate, {
        toValue: 0,
        delay: 50,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const netEarnings = useMemo(() => {
    return (
      breakdown.orders +
      breakdown.bonuses -
      breakdown.subscriptionRefunds -
      breakdown.deductions
    );
  }, [breakdown]);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [summaryRes, breakdownRes] = await Promise.all([
        apiClient.get('/analytics/seller', { params: { dateRange: timeRange } }),
        apiClient.get('/analytics/ads'),
      ]);

      const sellerStats = summaryRes.data?.data?.stats || summaryRes.data?.stats || {};
      const adsStats = breakdownRes.data?.data || breakdownRes.data || {};

      const totalRevenue = Number(sellerStats.totalRevenue || 0);
      const totalOrders = Number(sellerStats.totalOrders || 0);

      const summaryData = {
        totalEarnings: totalRevenue,
        thisMonthEarnings: timeRange === 'month' ? totalRevenue : 0,
        thisWeekEarnings: timeRange === 'week' ? totalRevenue : 0,
        pendingPayout: 0,
        completedPayouts: 0,
        averageOrderValue:
          totalOrders > 0 ? totalRevenue / totalOrders : 0,
        totalOrders,
      };

      const breakdownData = {
        orders: totalRevenue,
        subscriptionRefunds: 0,
        bonuses: 0,
        deductions: Number(adsStats.totalSpent || 0),
      };

      setSummary({ ...FALLBACK_SUMMARY, ...summaryData });
      setBreakdown({ ...FALLBACK_BREAKDOWN, ...breakdownData });
    } catch {
      setSummary(FALLBACK_SUMMARY);
      setBreakdown(FALLBACK_BREAKDOWN);
      // Keep UI stable even when analytics data is unavailable.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const statusBarHeight =
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const rangeOptions: { label: string; value: TimeRange }[] = [
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'This Year', value: 'year' },
  ];

  const netIsPositive = netEarnings >= 0;

  if (loading) {
    return (
      <View style={earningsStyles.loaderScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={earningsStyles.loaderContent}>
          <View style={earningsStyles.loaderIconWrap}>
            <ActivityIndicator size="large" color={DS3.primary} />
          </View>
          <Text style={earningsStyles.loaderTitle}>Loading Earnings</Text>
          <Text style={earningsStyles.loaderSub}>
            Fetching your financial data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={earningsStyles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        style={earningsStyles.scroll}
        contentContainerStyle={earningsStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[DS3.primary, DS3.primaryDark]}
          style={[
            earningsStyles.header,
            { paddingTop: statusBarHeight + 20 },
          ]}
        >
          <Animated.View
            style={{
              opacity: headerFade,
              transform: [{ translateY: headerTranslate }],
            }}
          >
            <View style={earningsStyles.headerTopRow}>
              <View>
                <Text style={earningsStyles.headerLabel}>
                  Total Earnings
                </Text>
                <AnimatedCounter
                  value={summary.totalEarnings}
                  prefix="₹"
                  style={earningsStyles.headerAmount}
                  delay={200}
                />
              </View>
              <View style={earningsStyles.headerBadge}>
                <Ionicons name="trending-up" size={16} color={DS3.white} />
              </View>
            </View>

            {/* Quick Stats */}
            <View style={earningsStyles.quickStats}>
              <View style={earningsStyles.quickStatItem}>
                <Ionicons
                  name="calendar"
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
                <View>
                  <Text style={earningsStyles.quickStatLabel}>This Month</Text>
                  <Text style={earningsStyles.quickStatValue}>
                    {formatINR(summary.thisMonthEarnings)}
                  </Text>
                </View>
              </View>
              <View style={earningsStyles.quickStatDivider} />
              <View style={earningsStyles.quickStatItem}>
                <Ionicons
                  name="time"
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
                <View>
                  <Text style={earningsStyles.quickStatLabel}>This Week</Text>
                  <Text style={earningsStyles.quickStatValue}>
                    {formatINR(summary.thisWeekEarnings)}
                  </Text>
                </View>
              </View>
              <View style={earningsStyles.quickStatDivider} />
              <View style={earningsStyles.quickStatItem}>
                <Ionicons
                  name="hourglass"
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
                <View>
                  <Text style={earningsStyles.quickStatLabel}>Pending</Text>
                  <Text style={earningsStyles.quickStatValue}>
                    {formatINR(summary.pendingPayout)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Time Range Filter */}
            <View style={earningsStyles.rangeRow}>
              {rangeOptions.map((opt, i) => (
                <TimeRangeChip
                  key={opt.value}
                  label={opt.label}
                  value={opt.value}
                  active={timeRange === opt.value}
                  onPress={() => setTimeRange(opt.value)}
                  index={i}
                />
              ))}
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={earningsStyles.body}>
          {/* Summary Card */}
          <SectionCardE delay={80}>
            <View style={earningsStyles.cardHeaderRow}>
              <View
                style={[
                  earningsStyles.cardIconWrap,
                  { backgroundColor: DS3.primaryFaded },
                ]}
              >
                <Ionicons name="wallet" size={18} color={DS3.primary} />
              </View>
              <Text style={earningsStyles.cardTitle}>Earnings Summary</Text>
              <View style={earningsStyles.updatedBadge}>
                <View style={earningsStyles.updatedDot} />
                <Text style={earningsStyles.updatedText}>Updated</Text>
              </View>
            </View>

            <View style={earningsStyles.bigValueWrap}>
              <AnimatedCounter
                value={summary.totalEarnings}
                prefix="₹"
                style={earningsStyles.bigValue}
                delay={200}
              />
              <Text style={earningsStyles.bigValueLabel}>Total Earnings</Text>
            </View>

            <EarningsRow
              label="This Month"
              value={formatINR(summary.thisMonthEarnings)}
              icon="calendar-outline"
              type="neutral"
              delay={100}
            />
            <EarningsRow
              label="This Week"
              value={formatINR(summary.thisWeekEarnings)}
              icon="time-outline"
              type="neutral"
              delay={160}
            />
            <EarningsRow
              label="Pending Payout"
              value={formatINR(summary.pendingPayout)}
              icon="hourglass-outline"
              type="neutral"
              delay={220}
              showBorder={false}
            />
          </SectionCardE>

          {/* Payment Breakdown */}
          <SectionCardE delay={160}>
            <View style={earningsStyles.cardHeaderRow}>
              <View
                style={[
                  earningsStyles.cardIconWrap,
                  { backgroundColor: 'rgba(139,92,246,0.1)' },
                ]}
              >
                <Ionicons name="receipt" size={18} color={DS3.purple} />
              </View>
              <Text style={earningsStyles.cardTitle}>Payment Breakdown</Text>
            </View>

            <EarningsRow
              label="Orders Revenue"
              value={formatINR(breakdown.orders)}
              icon="bag-check"
              type="credit"
              delay={100}
            />
            <EarningsRow
              label="Bonuses"
              value={formatINR(breakdown.bonuses)}
              icon="gift"
              type="credit"
              delay={160}
            />
            <EarningsRow
              label="Subscription Refunds"
              value={formatINR(breakdown.subscriptionRefunds)}
              icon="return-down-back"
              type="debit"
              delay={220}
            />
            <EarningsRow
              label="Deductions"
              value={formatINR(breakdown.deductions)}
              icon="remove-circle"
              type="debit"
              delay={280}
              showBorder={false}
            />

            {/* Net Earnings Banner */}
            <View
              style={[
                earningsStyles.netBanner,
                {
                  backgroundColor: netIsPositive
                    ? 'rgba(16,185,129,0.08)'
                    : 'rgba(239,68,68,0.08)',
                  borderColor: netIsPositive
                    ? 'rgba(16,185,129,0.2)'
                    : 'rgba(239,68,68,0.2)',
                },
              ]}
            >
              <View style={earningsStyles.netBannerLeft}>
                <View
                  style={[
                    earningsStyles.netIconWrap,
                    {
                      backgroundColor: netIsPositive
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(239,68,68,0.15)',
                    },
                  ]}
                >
                  <Ionicons
                    name={netIsPositive ? 'trending-up' : 'trending-down'}
                    size={18}
                    color={netIsPositive ? DS3.success : DS3.error}
                  />
                </View>
                <View>
                  <Text style={earningsStyles.netLabel}>Net Earnings</Text>
                  <Text style={earningsStyles.netSubLabel}>
                    After all deductions
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  earningsStyles.netValue,
                  {
                    color: netIsPositive ? DS3.success : DS3.error,
                  },
                ]}
              >
                {netIsPositive ? '+' : '-'}
                {formatINR(Math.abs(netEarnings))}
              </Text>
            </View>
          </SectionCardE>

          {/* Performance Card */}
          <SectionCardE delay={240}>
            <View style={earningsStyles.cardHeaderRow}>
              <View
                style={[
                  earningsStyles.cardIconWrap,
                  { backgroundColor: 'rgba(59,130,246,0.1)' },
                ]}
              >
                <Ionicons name="bar-chart" size={18} color={DS3.info} />
              </View>
              <Text style={earningsStyles.cardTitle}>Performance</Text>
            </View>

            <View style={earningsStyles.perfGrid}>
              <View style={earningsStyles.perfCard}>
                <View
                  style={[
                    earningsStyles.perfIconWrap,
                    { backgroundColor: DS3.primaryFaded },
                  ]}
                >
                  <Ionicons
                    name="stats-chart"
                    size={20}
                    color={DS3.primary}
                  />
                </View>
                <AnimatedCounter
                  value={summary.averageOrderValue}
                  prefix="₹"
                  style={earningsStyles.perfValue}
                  delay={300}
                />
                <Text style={earningsStyles.perfLabel}>Avg Order Value</Text>
              </View>
              <View style={earningsStyles.perfCard}>
                <View
                  style={[
                    earningsStyles.perfIconWrap,
                    { backgroundColor: 'rgba(139,92,246,0.1)' },
                  ]}
                >
                  <Ionicons
                    name="cube"
                    size={20}
                    color={DS3.purple}
                  />
                </View>
                <AnimatedCounter
                  value={summary.totalOrders}
                  style={earningsStyles.perfValue}
                  delay={360}
                />
                <Text style={earningsStyles.perfLabel}>Total Orders</Text>
              </View>
              <View style={earningsStyles.perfCard}>
                <View
                  style={[
                    earningsStyles.perfIconWrap,
                    { backgroundColor: 'rgba(16,185,129,0.1)' },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={DS3.success}
                  />
                </View>
                <AnimatedCounter
                  value={summary.completedPayouts}
                  prefix="₹"
                  style={earningsStyles.perfValue}
                  delay={420}
                />
                <Text style={earningsStyles.perfLabel}>
                  Completed Payouts
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={earningsStyles.refreshBtn}
              onPress={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={DS3.primary} />
              ) : (
                <>
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={DS3.primary}
                  />
                  <Text style={earningsStyles.refreshBtnText}>
                    Refresh Data
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </SectionCardE>
        </View>
      </ScrollView>
    </View>
  );
}

const earningsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS3.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  loaderScreen: {
    flex: 1,
    backgroundColor: DS3.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContent: { alignItems: 'center', gap: 12 },
  loaderIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DS3.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  loaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS3.gray900,
  },
  loaderSub: {
    fontSize: 13,
    color: DS3.gray500,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: DS3.white,
    letterSpacing: -1,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  quickStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 6,
  },
  quickStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: DS3.white,
    marginTop: 1,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minHeight: 36,
  },
  rangeChipActive: {
    backgroundColor: DS3.white,
  },
  rangeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  rangeChipTextActive: {
    color: DS3.primary,
  },
  body: { padding: 16, gap: 14 },
  card: {
    backgroundColor: DS3.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS3.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DS3.gray900,
    flex: 1,
  },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  updatedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: DS3.success,
  },
  updatedText: { fontSize: 11, fontWeight: '600', color: DS3.success },
  bigValueWrap: {
    backgroundColor: DS3.primaryFaded,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  bigValue: {
    fontSize: 32,
    fontWeight: '800',
    color: DS3.primary,
    letterSpacing: -0.8,
  },
  bigValueLabel: {
    fontSize: 12,
    color: DS3.gray500,
    fontWeight: '600',
    marginTop: 2,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    minHeight: 44,
  },
  earningsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: DS3.border,
  },
  earningsRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: DS3.gray600,
  },
  earningsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: DS3.gray900,
  },
  netBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  netBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  netIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  netLabel: { fontSize: 14, fontWeight: '700', color: DS3.gray900 },
  netSubLabel: {
    fontSize: 11,
    color: DS3.gray500,
    fontWeight: '500',
    marginTop: 1,
  },
  netValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  perfGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  perfCard: {
    flex: 1,
    backgroundColor: DS3.gray50,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: DS3.border,
  },
  perfIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfValue: {
    fontSize: 15,
    fontWeight: '800',
    color: DS3.gray900,
    letterSpacing: -0.3,
  },
  perfLabel: {
    fontSize: 10,
    color: DS3.gray500,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: DS3.primaryFaded,
    borderWidth: 1,
    borderColor: DS3.primaryLight,
    minHeight: 44,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: DS3.primary,
  },
});