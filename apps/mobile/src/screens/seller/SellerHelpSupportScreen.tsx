import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { SUPPORT_PHONE, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../../utils/constants';

// ─── Design tokens ───────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13,148,136,0.08)',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  warning: '#F59E0B',
  purple: '#8B5CF6',
  gray900: '#1F2937',
  gray800: '#374151',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  radius: { sm: 8, md: 12, lg: 16, full: 999 },
};

const SPRING = { damping: 22, stiffness: 250, useNativeDriver: true as true };
const SNAP = { damping: 20, stiffness: 300, useNativeDriver: true as true };

const FAQS = [
  {
    id: '1',
    question: 'When do I receive payouts?',
    answer: 'Payout timelines depend on your subscription and settlement cycle. Track payout status from seller analytics and payout history.',
  },
  {
    id: '2',
    question: 'Why is my product not visible?',
    answer: 'Check product stock, category, and active status. Ensure your shop is active and listing details are complete.',
  },
  {
    id: '3',
    question: 'How do sponsored products work?',
    answer: 'Sponsored listings boost relevant search placement while your campaign is active and budget is available.',
  },
  {
    id: '4',
    question: 'How do I handle cancellations & refunds?',
    answer: 'Open the order detail, review cancellation reason, and update status according to policy. Refund adjustments reflect in settlements.',
  },
  {
    id: '5',
    question: 'Can I edit my shop details anytime?',
    answer: 'Yes, update branding, category, address, contact and operating hours from your seller profile and customization screens.',
  },
];

const CONTACT_OPTIONS = [
  {
    id: 'phone',
    label: 'Call Support',
    subtitle: 'Mon–Sat, 9AM–9PM',
    icon: 'call-outline',
    color: DS.primary,
    bgColor: DS.primaryFaded,
    action: () => Linking.openURL(`tel:${SUPPORT_PHONE}`),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Seller Desk',
    subtitle: 'Usually replies in minutes',
    icon: 'logo-whatsapp',
    color: DS.success,
    bgColor: DS.successLight,
    action: () => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`),
  },
  {
    id: 'email',
    label: 'Email Support',
    subtitle: 'Response within 24 hours',
    icon: 'mail-outline',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    action: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
  },
];

// ─── FAQ accordion item ──────────────────────────────────
const FaqItem: React.FC<{
  faq: { id: string; question: string; answer: string };
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}> = ({ faq, isExpanded, onToggle, isLast }) => {
  const pressScale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotate, { toValue: isExpanded ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [isExpanded]);

  const iconRotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.98, ...SNAP }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING }).start()}
        activeOpacity={1}
        style={s.faqRow}
      >
        <View style={s.faqLeft}>
          <View style={s.faqIcon}>
            <Ionicons name="help-circle-outline" size={16} color={DS.primary} />
          </View>
          <Text style={s.faqQuestion}>{faq.question}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
          <Ionicons name="chevron-down" size={18} color={DS.gray400} />
        </Animated.View>
      </TouchableOpacity>
      {isExpanded && (
        <View style={s.faqAnswer}>
          <Text style={s.faqAnswerText}>{faq.answer}</Text>
        </View>
      )}
      {!isLast && <View style={s.divider} />}
    </View>
  );
};

// ─── Contact row ─────────────────────────────────────────
const ContactRow: React.FC<{
  option: typeof CONTACT_OPTIONS[0];
  delay: number;
  isLast: boolean;
}> = ({ option, delay, isLast }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, delay, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ opacity: 1 }}>
      <TouchableOpacity
        onPress={option.action}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.97, ...SNAP }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, ...SPRING }).start()}
        activeOpacity={1}
        style={s.contactRow}
      >
        <Animated.View style={[s.contactInner, { transform: [{ scale: pressScale }] }]}>
          <View style={[s.contactIcon, { backgroundColor: option.bgColor }]}>
            <Ionicons name={option.icon as any} size={20} color={option.color} />
          </View>
          <View style={s.contactText}>
            <Text style={s.contactLabel}>{option.label}</Text>
            <Text style={s.contactSubtitle}>{option.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
        </Animated.View>
      </TouchableOpacity>
      {!isLast && <View style={s.divider} />}
    </View>
  );
};

export default function SellerHelpSupportScreen() {
  const navigation = useNavigation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
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
            <Text style={s.headerTitle}>Help & Support</Text>
            <Text style={s.headerSub}>We're here to help</Text>
          </View>
          <View style={{ width: 38 }} />
        </Animated.View>

        {/* Hero stat strip */}
        <View style={s.statStrip}>
          {[
            { icon: 'time-outline', label: 'Avg response', value: '<2 min' },
            { icon: 'happy-outline', label: 'Satisfaction', value: '98%' },
            { icon: 'headset-outline', label: 'Support hours', value: '9–9 PM' },
          ].map((stat, i) => (
            <View key={i} style={[s.stripItem, i < 2 && s.stripDivider]}>
              <Ionicons name={stat.icon as any} size={14} color="rgba(255,255,255,0.8)" />
              <Text style={s.stripValue}>{stat.value}</Text>
              <Text style={s.stripLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact Us</Text>
          <View style={s.card}>
            {CONTACT_OPTIONS.map((opt, i) => (
              <ContactRow
                key={opt.id}
                option={opt}
                delay={i * 40}
                isLast={i === CONTACT_OPTIONS.length - 1}
              />
            ))}
          </View>
        </View>

        {/* FAQ section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Frequently Asked</Text>
          <View style={s.card}>
            {FAQS.map((faq, i) => (
              <FaqItem
                key={faq.id}
                faq={faq}
                isExpanded={expandedId === faq.id}
                onToggle={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                isLast={i === FAQS.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Quick tips */}
        <View style={s.tipsCard}>
          <View style={s.tipsHeader}>
            <Ionicons name="bulb-outline" size={18} color={DS.warning} />
            <Text style={s.tipsTitle}>Quick Tips</Text>
          </View>
          {[
            'Keep your shop status active to appear in search',
            'Respond to new orders within 15 minutes for better ratings',
            'Add high-quality photos to boost product conversion',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipNumber}>{i + 1}</Text>
              <Text style={s.tipText}>{tip}</Text>
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
    paddingHorizontal: 16, paddingBottom: 16,
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

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: DS.radius.md,
    padding: 12,
  },
  stripItem: { flex: 1, alignItems: 'center', gap: 3 },
  stripDivider: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  stripValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  stripLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  body: { padding: 16, paddingBottom: 80, gap: 0 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: DS.gray900, marginBottom: 10 },

  card: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: DS.border },

  // Contact row
  contactRow: { paddingHorizontal: 16, paddingVertical: 12 },
  contactInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactIcon: {
    width: 42, height: 42, borderRadius: DS.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  contactText: { flex: 1 },
  contactLabel: { fontSize: 14, fontWeight: '600', color: DS.gray900 },
  contactSubtitle: { fontSize: 12, color: DS.gray500, marginTop: 1 },

  // FAQ
  faqRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  faqLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqIcon: {
    width: 28, height: 28, borderRadius: DS.radius.sm,
    backgroundColor: DS.primaryFaded, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  faqQuestion: { flex: 1, fontSize: 13, fontWeight: '600', color: DS.gray900, lineHeight: 18 },
  faqAnswer: {
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2,
    backgroundColor: DS.gray50,
  },
  faqAnswerText: { fontSize: 13, color: DS.gray700, lineHeight: 20 },

  // Tips
  tipsCard: {
    backgroundColor: '#FFFBEB', borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: '#FDE68A',
    padding: 16, marginBottom: 0,
  },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  tipNumber: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: DS.warning, textAlign: 'center',
    fontSize: 11, fontWeight: '800', color: '#fff', lineHeight: 20,
  },
  tipText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
});
