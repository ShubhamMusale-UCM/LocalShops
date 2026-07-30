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
    id: '1', title: 'Seller Eligibility', icon: 'person-circle-outline',
    content: ['Sellers must provide accurate business details, legal ownership information, GST details (if applicable), and valid contact information.'],
  },
  {
    id: '2', title: 'Listing Responsibilities', icon: 'list-circle-outline',
    content: [
      'Product/service listings must be accurate, lawful, and up to date.',
      'Prices, stock, and availability should be maintained in real time.',
      'Misleading images, fake claims, or counterfeit items are prohibited.',
    ],
  },
  {
    id: '3', title: 'Order Fulfillment', icon: 'checkmark-circle-outline',
    content: [
      'Confirm and process accepted orders within promised timelines.',
      'Keep buyer communication clear for delays, substitutions, or unavailability.',
      'Repeated cancellation after confirmation may impact seller visibility.',
    ],
  },
  {
    id: '4', title: 'Payments & Settlements', icon: 'cash-outline',
    content: ['Settlements are processed as per your plan and payout cycle. Commission, platform fees, ad spends, refunds, and chargebacks may be adjusted before payout.'],
  },
  {
    id: '5', title: 'Promotions & Sponsored Listings', icon: 'megaphone-outline',
    content: [
      'Sponsored products are ranked higher for relevant searches while campaign is active.',
      'Budget misuse, fraudulent clicks, or policy abuse can suspend ad campaigns.',
    ],
  },
  {
    id: '6', title: 'Prohibited Conduct', icon: 'shield-outline',
    content: [
      'No illegal, restricted, or unsafe goods/services.',
      'No fake reviews, fake orders, or manipulated pricing.',
      'No harassment or abusive behavior toward buyers or support.',
    ],
  },
  {
    id: '7', title: 'Suspension & Termination', icon: 'warning-outline',
    content: ['CityLocalShop may suspend listings, ad campaigns, payouts, or accounts for policy violations, fraudulent activity, or legal non-compliance.'],
  },
  {
    id: '8', title: 'Support Contact', icon: 'headset-outline',
    content: ['For policy clarification or disputes, contact seller support via the Help & Support page or email support@citylocalshop.com.'],
  },
];

export default function SellerTermsConditionsScreen() {
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
            <Text style={s.headerTitle}>Terms & Conditions</Text>
            <Text style={s.headerSub}>Seller agreement — last updated Jan 2026</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.noticeBanner}>
          <Ionicons name="information-circle" size={18} color={DS.primary} />
          <Text style={s.noticeText}>
            By using CityLocalShop as a seller, you agree to these terms.
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
