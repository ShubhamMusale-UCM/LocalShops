import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from '../../utils/constants';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const HelpScreen = () => {
  const navigation = useNavigation();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How do I place an order?',
      answer: 'You can place an order by browsing products, adding them to your cart, and proceeding to checkout. Enter your delivery address and select your preferred payment method.',
    },
    {
      id: '2',
      question: 'What are the delivery charges?',
      answer: 'Delivery charges vary based on distance and order value. Free delivery is available on orders above ₹200. Charges are calculated dynamically in the checkout screen.',
    },
    {
      id: '3',
      question: 'Can I cancel my order?',
      answer: 'Orders can be cancelled within 2 hours of placement. After that, the order is being prepared. Contact seller or support team to cancel.',
    },
    {
      id: '4',
      question: 'What payment methods do you accept?',
      answer: 'We accept Credit/Debit cards, Digital wallets (Google Pay, PhonePe, Paytm), UPI, and Cash on Delivery (where available).',
    },
    {
      id: '5',
      question: 'How do I track my order?',
      answer: 'Once your order is confirmed, go to "My Orders" section. You can see real-time delivery tracking and seller/delivery partner details.',
    },
    {
      id: '6',
      question: 'What if my order arrives damaged?',
      answer: 'Report the issue immediately through the "Report Issue" option in your order. Provide photos or videos as evidence. Our team will investigate and process a refund if eligible.',
    },
    {
      id: '7',
      question: 'How do I become a seller?',
      answer: 'Go to your Profile > Register Your Shop. Fill in your shop details and wait for verification. Once verified, you can start listing products.',
    },
    {
      id: '8',
      question: 'What fees does CityLocalShop charge sellers?',
      answer: 'We charge a commission based on category. Please check your seller dashboard for detailed breakdown. Premium subscription plans offer reduced commission rates.',
    },
  ];

  const handleCall = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`);
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@citylocalshop.com');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Section */}
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Card shadow="sm" style={styles.contactCard}>
          <TouchableOpacity style={styles.contactOption} onPress={handleCall}>
            <View style={styles.contactIconBg}>
              <Ionicons name="call" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Call Support</Text>
              <Text style={styles.contactDesc}>{SUPPORT_PHONE}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.contactOption} onPress={handleWhatsApp}>
            <View style={styles.contactIconBg}>
              <Ionicons name="logo-whatsapp" size={20} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>WhatsApp Support</Text>
              <Text style={styles.contactDesc}>Chat with us 24/7</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
            <View style={styles.contactIconBg}>
              <Ionicons name="mail" size={20} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactDesc}>support@citylocalshop.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
          </TouchableOpacity>
        </Card>

        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {faqs.map((faq, index) => (
          <Card key={faq.id} shadow="sm" style={styles.faqCard}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Ionicons
                name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.primary}
              />
            </TouchableOpacity>
            {expandedFAQ === faq.id && (
              <View style={styles.faqBody}>
                <View style={styles.faqDivider} />
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            )}
          </Card>
        ))}

        {/* Additional Resources */}
        <Text style={styles.sectionTitle}>Additional Resources</Text>
        <Card shadow="sm" style={styles.resourceCard}>
          <TouchableOpacity style={styles.resourceOption}>
            <Ionicons name="document-text" size={20} color={Colors.primary} />
            <Text style={styles.resourceLabel}>Terms of Service</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.resourceOption}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.resourceLabel}>Privacy Policy</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.resourceOption}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.resourceLabel}>About Us</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...Typography.h3, color: Colors.gray[900], flex: 1, textAlign: 'center' },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h5,
    color: Colors.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  contactCard: { marginBottom: Spacing.lg },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  contactIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  contactLabel: { ...Typography.labelSmall, color: Colors.gray[900], fontWeight: '600' },
  contactDesc: { ...Typography.caption, color: Colors.gray[500], marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.gray[100], marginHorizontal: Spacing.lg },
  faqCard: { marginBottom: Spacing.md, overflow: 'hidden' },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  faqQuestion: { ...Typography.body, color: Colors.gray[900], flex: 1, fontWeight: '600' },
  faqBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  faqDivider: { height: 1, backgroundColor: Colors.gray[100], marginBottom: Spacing.md },
  faqAnswer: { ...Typography.body, color: Colors.gray[700], lineHeight: 22 },
  resourceCard: { marginBottom: Spacing.lg },
  resourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  resourceLabel: { ...Typography.body, color: Colors.gray[900], marginLeft: Spacing.md, fontWeight: '500' },
});

export default HelpScreen;
