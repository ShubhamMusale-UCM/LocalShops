import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

const TermsAndConditionsScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>1. User Accounts</Text>
        <Text style={styles.paragraph}>
          When you create an account on CityLocalShop, you agree to:
        </Text>
        <Text style={styles.listItem}>• Provide accurate and complete information</Text>
        <Text style={styles.listItem}>• Maintain confidentiality of your password</Text>
        <Text style={styles.listItem}>• Be responsible for all activities under your account</Text>
        <Text style={styles.listItem}>• Notify us immediately of unauthorized access</Text>

        <Text style={styles.section}>2. Ordering and Purchasing</Text>
        <Text style={styles.paragraph}>
          By placing an order through CityLocalShop:
        </Text>
        <Text style={styles.listItem}>• You represent that you are at least 18 years old</Text>
        <Text style={styles.listItem}>• You have the legal right to enter into binding agreements</Text>
        <Text style={styles.listItem}>• You authorize us to charge your payment method</Text>
        <Text style={styles.listItem}>• You accept responsibility for timely payment</Text>

        <Text style={styles.section}>3. Product Information</Text>
        <Text style={styles.paragraph}>
          While we strive to ensure accuracy, please note:
        </Text>
        <Text style={styles.listItem}>• Product descriptions, prices, and images are subject to change without notice</Text>
        <Text style={styles.listItem}>• Sellers are responsible for product accuracy and quality</Text>
        <Text style={styles.listItem}>• Stock availability is not guaranteed</Text>
        <Text style={styles.listItem}>• We reserve the right to refuse or cancel any order</Text>

        <Text style={styles.section}>4. Pricing and Payment</Text>
        <Text style={styles.paragraph}>
          Our pricing terms include:
        </Text>
        <Text style={styles.listItem}>• All prices are in Indian Rupees (₹)</Text>
        <Text style={styles.listItem}>• Prices include all applicable taxes unless otherwise stated</Text>
        <Text style={styles.listItem}>• Additional charges may apply for delivery and services</Text>
        <Text style={styles.listItem}>• Payment must be received before order processing</Text>

        <Text style={styles.section}>5. Delivery and Shipping</Text>
        <Text style={styles.paragraph}>
          Regarding delivery:
        </Text>
        <Text style={styles.listItem}>• Delivery times are estimates and not guaranteed</Text>
        <Text style={styles.listItem}>• You are responsible for providing accurate delivery address</Text>
        <Text style={styles.listItem}>• Delivery partners may attempt delivery up to 3 times</Text>
        <Text style={styles.listItem}>• Failed deliveries may be cancelled and refunded</Text>

        <Text style={styles.section}>6. Returns and Refunds</Text>
        <Text style={styles.paragraph}>
          Please refer to our Refund Policy for detailed information on:
        </Text>
        <Text style={styles.listItem}>• Return eligibility criteria</Text>
        <Text style={styles.listItem}>• Return process and timeline</Text>
        <Text style={styles.listItem}>• Refund timelines</Text>
        <Text style={styles.listItem}>• Non-refundable items</Text>

        <Text style={styles.section}>7. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to:
        </Text>
        <Text style={styles.listItem}>• Engage in fraudulent or illegal activities</Text>
        <Text style={styles.listItem}>• Violate intellectual property rights</Text>
        <Text style={styles.listItem}>• Harass, abuse, or defame other users or sellers</Text>
        <Text style={styles.listItem}>• Attempt to hack or interfere with our systems</Text>
        <Text style={styles.listItem}>• Engage in any form of spam or unsolicited marketing</Text>

        <Text style={styles.section}>8. Seller Responsibilities</Text>
        <Text style={styles.paragraph}>
          As a seller on our platform:
        </Text>
        <Text style={styles.listItem}>• You are responsible for product quality and legality</Text>
        <Text style={styles.listItem}>• You must respond to customer inquiries within 24 hours</Text>
        <Text style={styles.listItem}>• You agree to comply with all local laws and regulations</Text>
        <Text style={styles.listItem}>• You are liable for product-related claims and disputes</Text>

        <Text style={styles.section}>9. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          CityLocalShop shall not be liable for:
        </Text>
        <Text style={styles.listItem}>• Indirect, incidental, or consequential damages</Text>
        <Text style={styles.listItem}>• Loss of data, profits, or business interruption</Text>
        <Text style={styles.listItem}>• Third-party actions or services</Text>
        <Text style={styles.listItem}>• Disputes between buyers and sellers</Text>

        <Text style={styles.section}>10. Dispute Resolution</Text>
        <Text style={styles.paragraph}>
          In case of disputes:
        </Text>
        <Text style={styles.listItem}>• Contact our support team first for resolution</Text>
        <Text style={styles.listItem}>• We will mediate between buyer and seller</Text>
        <Text style={styles.listItem}>• Escalation may go to arbitration/legal action</Text>

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
  section: {
    ...Typography.h5,
    color: Colors.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    ...Typography.body,
    color: Colors.gray[700],
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  listItem: {
    ...Typography.body,
    color: Colors.gray[700],
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
});

export default TermsAndConditionsScreen;
