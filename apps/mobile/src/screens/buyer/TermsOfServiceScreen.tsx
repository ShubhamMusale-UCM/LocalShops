import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

const TermsOfServiceScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing and using CityLocalShop ("the Platform"), you accept and agree to be bound by the terms and provision of this agreement. 
          If you do not agree to abide by the above, please do not use this service.
        </Text>

        <Text style={styles.section}>2. Use License</Text>
        <Text style={styles.paragraph}>
          Permission is granted to temporarily download one copy of the materials (information or software) on CityLocalShop for personal, 
          non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
        </Text>
        <Text style={styles.listItem}>• Modifying or copying the materials</Text>
        <Text style={styles.listItem}>• Using the materials for any commercial purpose or for publicly displaying (commercial or non-commercial)</Text>
        <Text style={styles.listItem}>• Attempting to reverse compile, reverse engineer, disassemble, or otherwise attempting to discover any source code</Text>
        <Text style={styles.listItem}>• Removing any copyright or other proprietary notations from the materials</Text>

        <Text style={styles.section}>3. Disclaimer</Text>
        <Text style={styles.paragraph}>
          The materials on CityLocalShop are provided "as is". We make no warranties, expressed or implied, and hereby disclaim and negate 
          all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular 
          purpose, or non-infringement of intellectual property or other violation of rights.
        </Text>

        <Text style={styles.section}>4. Booking Platform & Intermediary Role</Text>
        <Text style={styles.paragraph}>
          CityLocalShop operates solely as a booking and discovery platform connecting buyers with local sellers. 
          We do not provide delivery services, handle physical goods, or participate in the actual transaction or fulfillment of orders. 
          All purchases, collections, and dispute resolutions regarding the quality or provision of goods and services must be handled directly between the buyer and the seller.
        </Text>

        <Text style={styles.section}>5. Limitations</Text>
        <Text style={styles.paragraph}>
          In no event shall CityLocalShop or its suppliers be liable for any damages (including, without limitation, damages for loss of data 
          or profit, or due to business interruption) arising out of the use or inability to use the materials on CityLocalShop.
        </Text>

        <Text style={styles.section}>5. Accuracy of Materials</Text>
        <Text style={styles.paragraph}>
          The materials appearing on CityLocalShop could include technical, typographical, or photographic errors. CityLocalShop does not warrant 
          that any of the materials on the Platform are accurate, complete, or current. We may make changes to the materials displayed on the 
          Platform at any time without notice.
        </Text>

        <Text style={styles.section}>6. Links</Text>
        <Text style={styles.paragraph}>
          CityLocalShop has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. 
          The inclusion of any link does not imply endorsement by CityLocalShop of the site. Use of any such linked website is at the user's own risk.
        </Text>

        <Text style={styles.section}>7. Modifications</Text>
        <Text style={styles.paragraph}>
          CityLocalShop may revise these terms of service for the Platform at any time without notice. By using this Platform, you are agreeing 
          to be bound by the then current version of these terms of service.
        </Text>

        <Text style={styles.section}>8. Governing Law</Text>
        <Text style={styles.paragraph}>
          These terms and conditions are governed by and construed in accordance with the laws applicable in your jurisdiction, and you 
          irrevocably submit to the exclusive jurisdiction of the courts in that location.
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

export default TermsOfServiceScreen;
