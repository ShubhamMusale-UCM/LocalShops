import React, { useEffect, useRef, useState } from 'react';
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
  Alert,
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
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',
  amber: '#D97706',
  gray900: '#1F2937',
  gray800: '#374151',
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

interface Plan {
  id: string;
  name: string;
  price: number;
  billingLabel: string;
  features: string[];
  color: string;
  bgColor: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billingLabel: 'Forever free',
    features: ['Up to 10 products', 'Basic analytics', 'Standard listing'],
    color: DS.gray600,
    bgColor: DS.gray100,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 499,
    billingLabel: '/month',
    features: ['Up to 50 products', 'Basic analytics', '1 promoted listing/month', 'Email support'],
    color: DS.primary,
    bgColor: DS.primaryFaded,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 1999,
    billingLabel: '/month',
    features: ['Unlimited products', 'Advanced analytics', '5 promoted listings/month', 'Priority support', 'AI suggestions'],
    color: DS.purple,
    bgColor: DS.purpleLight,
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 4999,
    billingLabel: '/month',
    features: ['Everything in Pro', 'Premium analytics', 'Unlimited promotions', '24/7 support', 'Account manager', 'Delivery access'],
    color: DS.amber,
    bgColor: DS.warningLight,
  },
];

const BENEFITS = [
  { icon: 'cube-outline', text: 'List more products, increase visibility' },
  { icon: 'analytics-outline', text: 'Detailed sales analytics & trends' },
  { icon: 'megaphone-outline', text: 'Promote products, reach more buyers' },
  { icon: 'headset-outline', text: 'Priority customer support' },
  { icon: 'bulb-outline', text: 'Advanced marketing & AI tools' },
];

const PlanCard: React.FC<{
  plan: Plan;
  isActive: boolean;
  index: number;
  renewalDate?: string | null;
  onSelect: (id: string) => void;
}> = ({ plan, isActive, index, renewalDate, onSelect }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay: index * 40, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 40, ...SPRING }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }, { scale: pressScale }] }]}>
      <TouchableOpacity
        onPress={() => onSelect(plan.id)}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.97, ...SNAP }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING }).start()}
        activeOpacity={1}
        style={[
          s.planCard,
          isActive && { borderColor: plan.color, borderWidth: 2 },
          plan.popular && !isActive && s.popularCard,
        ]}
      >
        {/* Popular badge */}
        {plan.popular && (
          <View style={[s.popularBadge, { backgroundColor: plan.color }]}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={s.popularBadgeText}>Most Popular</Text>
          </View>
        )}

        {/* Current plan badge */}
        {isActive && (
          <View style={[s.currentBadge, { backgroundColor: plan.bgColor }]}>
            <Ionicons name="checkmark-circle" size={12} color={plan.color} />
            <Text style={[s.currentBadgeText, { color: plan.color }]}>Current Plan</Text>
          </View>
        )}

        {/* Plan header */}
        <View style={s.planHeader}>
          <View style={[s.planIcon, { backgroundColor: plan.bgColor }]}>
            <Ionicons
              name={plan.id === 'free' ? 'gift-outline' : plan.id === 'starter' ? 'rocket-outline' : plan.id === 'professional' ? 'diamond-outline' : 'star-outline'}
              size={20}
              color={plan.color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.planName}>{plan.name}</Text>
            <View style={s.priceRow}>
              <Text style={[s.planPrice, { color: plan.price === 0 ? DS.gray600 : plan.color }]}>
                {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
              </Text>
              {plan.price > 0 && (
                <Text style={s.planBillingLabel}>{plan.billingLabel}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={s.featureList}>
          {plan.features.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={[s.featureCheck, { backgroundColor: plan.bgColor }]}>
                <Ionicons name="checkmark" size={10} color={plan.color} />
              </View>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        {isActive ? (
          <View style={[s.renewBadge, { backgroundColor: plan.bgColor }]}>
            <Ionicons name="calendar-outline" size={14} color={plan.color} />
            <Text style={[s.renewText, { color: plan.color }]}>
              {renewalDate ? `Renews ${renewalDate}` : 'Active Plan'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.upgradeBtn, { backgroundColor: plan.color }]}
            onPress={() => onSelect(plan.id)}
            activeOpacity={0.85}
          >
            <Text style={s.upgradeBtnText}>
              {plan.id === 'free' ? 'Downgrade' : 'Upgrade Now'}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState('starter');
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/subscription/my-subscription');
      const sub = res.data?.data || res.data;
      if (sub?.plan) {
        setActivePlan(String(sub.plan).toLowerCase());
        if (sub.endDate) {
          setRenewalDate(new Date(sub.endDate).toLocaleDateString());
        }
      }
    } catch {
      // Keep default
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (planId === activePlan) return;
    try {
      setLoading(true);
      await apiClient.post('/subscription/create', { planId: planId.toUpperCase() });
      setActivePlan(planId);
      Alert.alert('Subscription Updated', `Your plan has been updated to ${planId.toUpperCase()}.`);
      fetchSubscription();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    fetchSubscription();
  }, []);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={s.header}>
        <Animated.View style={[s.headerContent, { opacity: headerFade }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>Subscription Plans</Text>
            <Text style={s.headerSub}>Grow your business with the right plan</Text>
          </View>
          <View style={{ width: 38 }} />
        </Animated.View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Plans */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Choose Your Plan</Text>
          <View style={{ gap: 12 }}>
            {PLANS.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isActive={activePlan === plan.id}
                renewalDate={renewalDate}
                index={i}
                onSelect={handlePlanSelect}
              />
            ))}
          </View>
        </View>

        {/* Why upgrade */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Why Upgrade?</Text>
          <View style={s.benefitCard}>
            {BENEFITS.map((b, i) => (
              <View key={i}>
                <View style={s.benefitRow}>
                  <View style={s.benefitIcon}>
                    <Ionicons name={b.icon as any} size={18} color={DS.primary} />
                  </View>
                  <Text style={s.benefitText}>{b.text}</Text>
                </View>
                {i < BENEFITS.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={s.trustRow}>
          {[
            { icon: 'shield-checkmark-outline', label: 'Secure payments' },
            { icon: 'close-circle-outline', label: 'Cancel anytime' },
            { icon: 'headset-outline', label: '24/7 support' },
          ].map((t) => (
            <View key={t.label} style={s.trustItem}>
              <Ionicons name={t.icon as any} size={18} color={DS.primary} />
              <Text style={s.trustLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 12,
    paddingHorizontal: 16, paddingBottom: 20,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  body: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: DS.gray900, marginBottom: 12 },

  // Plan card
  planCard: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    padding: 16, borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  popularCard: { borderColor: DS.purple + '40', borderWidth: 1.5 },
  popularBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: DS.radius.full, marginBottom: 10,
  },
  popularBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  currentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: DS.radius.full, marginBottom: 10,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '700' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  planIcon: {
    width: 44, height: 44, borderRadius: DS.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  planName: { fontSize: 16, fontWeight: '700', color: DS.gray900, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  planBillingLabel: { fontSize: 12, color: DS.gray500, fontWeight: '500' },
  featureList: { gap: 8, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: {
    width: 18, height: 18, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: 13, color: DS.gray700, fontWeight: '500', flex: 1 },
  renewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, borderRadius: DS.radius.md, justifyContent: 'center',
  },
  renewText: { fontSize: 13, fontWeight: '600' },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: DS.radius.md,
  },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Benefits
  benefitCard: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    overflow: 'hidden',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  benefitIcon: {
    width: 32, height: 32, borderRadius: DS.radius.sm,
    backgroundColor: DS.primaryFaded, alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { fontSize: 13, color: DS.gray700, fontWeight: '500', flex: 1 },
  divider: { height: 1, backgroundColor: DS.border },

  // Trust row
  trustRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: DS.card, borderRadius: DS.radius.md,
    padding: 14, borderWidth: 1, borderColor: DS.border,
  },
  trustItem: { alignItems: 'center', gap: 4 },
  trustLabel: { fontSize: 10, fontWeight: '500', color: DS.gray600, textAlign: 'center' },
});
