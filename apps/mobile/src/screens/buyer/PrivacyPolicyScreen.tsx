import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          CityLocalShop ("we", "us", or "our") operates the CityLocalShop platform and mobile application (the "Service"). We respect your privacy and are committed to protecting it through our compliance with this policy. This Privacy Policy describes the types of information we may collect from you or that you may provide when you use our Service, and our practices for collecting, using, maintaining, protecting, and disclosing that information.
        </Text>

        <Text style={styles.section}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect several types of information from and about users of our Service, including:
        </Text>
        <Text style={styles.subsection}>Personal Data</Text>
        <Text style={styles.listItem}>• Identifiers: Name, email address, phone number, and account credentials.</Text>
        <Text style={styles.listItem}>• Profile Data: Profile picture, date of birth, and communication preferences.</Text>
        <Text style={styles.listItem}>• Financial Data: Payment methods and transaction history (processed securely via third-party providers; we do not store full credit card numbers).</Text>

        <Text style={styles.subsection}>Location Data</Text>
        <Text style={styles.listItem}>• Precise and approximate GPS coordinates, address, and city.</Text>
        <Text style={styles.listItem}>• We collect location data to connect you with nearby sellers, perform geographic density studies, and enhance platform analytics. You can control location tracking through your device settings.</Text>

        <Text style={styles.subsection}>Usage & Device Data</Text>
        <Text style={styles.listItem}>• Interaction metrics: Browsing history, search queries, products viewed, and booking history.</Text>
        <Text style={styles.listItem}>• Technical data: IP address, device ID, operating system, browser type, and crash logs.</Text>

        <Text style={styles.section}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use information that we collect about you or that you provide to us to:
        </Text>
        <Text style={styles.listItem}>• Provide, maintain, and improve our Service as a booking and discovery platform.</Text>
        <Text style={styles.listItem}>• Process transactions and send related notifications (e.g., booking confirmations).</Text>
        <Text style={styles.listItem}>• Facilitate communication between buyers and local sellers.</Text>
        <Text style={styles.listItem}>• Analyze platform usage, conduct geographic density studies, and train artificial intelligence (AI) models to improve search relevance, personalization, and operational efficiency.</Text>
        <Text style={styles.listItem}>• Detect, prevent, and address technical issues, fraud, or illegal activities.</Text>

        <Text style={styles.section}>4. Data Sharing and Disclosure</Text>
        <Text style={styles.paragraph}>
          We may disclose aggregated information about our users, and information that does not identify any individual, without restriction. We may disclose personal information that we collect:
        </Text>
        <Text style={styles.listItem}>• To Sellers: When you make a booking, we share necessary details (name, contact info, booking address) with the seller to fulfill your order.</Text>
        <Text style={styles.listItem}>• To Service Providers: Third-party vendors who provide services like payment processing, data analytics, hosting, and customer support.</Text>
        <Text style={styles.listItem}>• For Legal Requirements: To comply with any court order, law, or legal process, including responding to governmental or regulatory requests.</Text>

        <Text style={styles.section}>5. Data Retention</Text>
        <Text style={styles.paragraph}>
          We will retain your personal data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your data to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements. Usage and location data may be anonymized and retained indefinitely for analytics and AI training purposes.
        </Text>

        <Text style={styles.section}>6. Your Data Rights</Text>
        <Text style={styles.paragraph}>
          Depending on your location, you may have the following rights regarding your personal data:
        </Text>
        <Text style={styles.listItem}>• The right to access, update, or delete the information we have on you.</Text>
        <Text style={styles.listItem}>• The right of rectification if your information is inaccurate or incomplete.</Text>
        <Text style={styles.listItem}>• The right to object to our processing of your personal data.</Text>
        <Text style={styles.listItem}>• The right to data portability.</Text>
        <Text style={styles.paragraph}>
          To exercise any of these rights, please contact our support team.
        </Text>

        <Text style={styles.section}>7. Security of Data</Text>
        <Text style={styles.paragraph}>
          We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. However, the transmission of information via the internet is not completely secure, and we cannot guarantee the security of your personal information transmitted to our Service.
        </Text>

        <Text style={styles.section}>8. Changes to This Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "last updated" date. You are advised to review this Privacy Policy periodically for any changes.
        </Text>

        <Text style={styles.section}>9. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this Privacy Policy or our privacy practices, please contact us at: support@citylocalshop.com
        </Text>

        <View style={{ height: 60 }} />
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
  subsection: {
    ...Typography.labelSmall,
    color: Colors.gray[900],
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
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

export default PrivacyPolicyScreen;
