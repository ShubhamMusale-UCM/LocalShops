import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

const RefundPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refund Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>1. Refund Eligibility</Text>
        <Text style={styles.paragraph}>
          You may be eligible for a refund in the following circumstances:
        </Text>
        <Text style={styles.listItem}>• Order cancelled within 2 hours of placement</Text>
        <Text style={styles.listItem}>• Products delivered are damaged or defective</Text>
        <Text style={styles.listItem}>• Wrong items delivered</Text>
        <Text style={styles.listItem}>• Delivery failed after 3 attempts</Text>
        <Text style={styles.listItem}>• Product quality doesn't match the description</Text>

        <Text style={styles.section}>2. Non-Refundable Items</Text>
        <Text style={styles.paragraph}>
          The following items are generally non-refundable:
        </Text>
        <Text style={styles.listItem}>• Perishable food items once delivered</Text>
        <Text style={styles.listItem}>• Items customized per customer request</Text>
        <Text style={styles.listItem}>• Items used or partially consumed</Text>
        <Text style={styles.listItem}>• Items purchased on clearance or final sale</Text>

        <Text style={styles.section}>3. Refund Process</Text>
        <Text style={styles.paragraph}>
          To request a refund, follow these steps:
        </Text>
        <Text style={styles.listItem}>• Go to your orders section in the app</Text>
        <Text style={styles.listItem}>• Select the order and click "Report Issue"</Text>
        <Text style={styles.listItem}>• Choose the reason and provide relevant details and photos</Text>
        <Text style={styles.listItem}>• Our support team will review and respond within 24-48 hours</Text>

        <Text style={styles.section}>4. Refund Timeline</Text>
        <Text style={styles.paragraph}>
          Approved refunds will be processed as follows:
        </Text>
        <Text style={styles.listItem}>• Credit card refunds: 5-7 business days</Text>
        <Text style={styles.listItem}>• Digital wallet refunds: 2-3 business days</Text>
        <Text style={styles.listItem}>• Cash on delivery: Store credit (immediate) or bank transfer (5-7 days)</Text>

        <Text style={styles.section}>5. Partial Refunds</Text>
        <Text style={styles.paragraph}>
          In cases where you have accepted delivery but are requesting a refund for specific items:
        </Text>
        <Text style={styles.listItem}>• You may need to return the items to the seller</Text>
        <Text style={styles.listItem}>• Return shipping may be deducted from the refund</Text>
        <Text style={styles.listItem}>• The seller must evaluate the item before processing the refund</Text>

        <Text style={styles.section}>6. Exceptions</Text>
        <Text style={styles.paragraph}>
          CityLocalShop reserves the right to deny refunds in cases of:
        </Text>
        <Text style={styles.listItem}>• Customer request after delivery completion (unless product is defective)</Text>
        <Text style={styles.listItem}>• Communication breakdown between buyer and seller</Text>
        <Text style={styles.listItem}>• Fraudulent claims</Text>

        <Text style={styles.section}>7. Contact Support</Text>
        <Text style={styles.paragraph}>
          If you have any questions about refunds, please contact our support team at support@citylocalshop.com or call us at +91-XXXX-XXXX-XXXX
        </Text>

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

export default RefundPolicyScreen;
