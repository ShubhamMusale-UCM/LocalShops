import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const DS = {
  primary: '#0D9488', gray900: '#1F2937', gray700: '#4B5563',
  gray600: '#6B7280', gray300: '#E5E7EB', gray100: '#F3F4F6',
  background: '#F8FAFC', card: '#FFFFFF', border: '#F1F5F9',
  radius: { lg: 16, full: 999 },
};

const SECTIONS = [
  {
    id: '1', title: 'Data We Collect', icon: 'document-text-outline',
    content: [
      'Business profile details: shop name, address, phone, email, GST (if provided).',
      'Product/service data, pricing, inventory, and listing media.',
      'Performance data: orders, refunds, ad clicks, and analytics metrics.',
      'Geographic data: precise shop location for density analysis and buyer matching.',
    ],
  },
  {
    id: '2', title: 'Why We Use Seller Data', icon: 'analytics-outline',
    content: [
      'To process bookings, payouts, and compliance workflows.',
      'To rank and recommend relevant shops/products to buyers.',
      'To provide business intelligence reports and fraud detection.',
      'To train artificial intelligence (AI) models that improve platform efficiency and personalization.',
    ],
  },
  {
    id: '3', title: 'Data Sharing', icon: 'share-social-outline',
    content: ['Seller data is shared with buyers only where necessary for transaction fulfillment (shop name, listing details, booking context). Sensitive business or settlement data is not exposed to buyers. Third-party vendors are used for secure payment processing and platform analytics.'],
  },
  {
    id: '4', title: 'Data Security', icon: 'shield-checkmark-outline',
    content: ['We use access controls, encrypted transport, and audit mechanisms to protect seller data. No system is 100% risk-free, but we continuously improve safeguards.'],
  },
  {
    id: '5', title: 'Your Controls', icon: 'settings-outline',
    content: [
      'Update profile, listing, and contact details from your seller account.',
      'Request support assistance for correction or account-level concerns.',
    ],
  },
  {
    id: '6', title: 'Data Retention & AI', icon: 'time-outline',
    content: ['We retain seller transaction records for legal, tax, and dispute-resolution requirements. Aggregated and anonymized data, including geographic density insights, may be retained indefinitely for AI training and market analysis.'],
  },
  {
    id: '7', title: 'Contact', icon: 'mail-outline',
    content: ['For privacy questions or requests regarding your data rights, contact support@citylocalshop.com.'],
  },
];

export default function SellerPrivacyPolicyScreen() {
  const navigation = useNavigation();
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>Privacy Policy</Text>
            <Text style={s.headerSub}>How we handle your seller data</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.noticeBanner}>
          <Ionicons name="shield-checkmark" size={18} color={DS.primary} />
          <Text style={s.noticeText}>
            Your data is protected and used only to power your seller experience.
          </Text>
        </View>

        {SECTIONS.map((sec, i) => (
          <View key={sec.id} style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}>
                <Ionicons name={sec.icon as any} size={16} color={DS.primary} />
              </View>
              <Text style={s.sectionNum}>{i + 1}.</Text>
              <Text style={s.sectionTitle}>{sec.title}</Text>
            </View>
            {sec.content.map((line, j) => (
              <View key={j} style={s.contentRow}>
                {sec.content.length > 1 && <View style={s.bullet} />}
                <Text style={s.contentText}>{line}</Text>
              </View>
            ))}
          </View>
        ))}
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
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  body: { padding: 16, paddingBottom: 80, gap: 10 },
  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F0FDF9', borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: '#99F6E4', padding: 12, marginBottom: 4,
  },
  noticeText: { flex: 1, fontSize: 12, color: DS.gray700, lineHeight: 18 },
  sectionCard: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    padding: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: 'rgba(13,148,136,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  sectionNum: { fontSize: 13, fontWeight: '800', color: DS.primary },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: DS.gray900, flex: 1 },
  contentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 4 },
  bullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: DS.primary, marginTop: 7, flexShrink: 0 },
  contentText: { flex: 1, fontSize: 13, color: DS.gray700, lineHeight: 20 },
});
