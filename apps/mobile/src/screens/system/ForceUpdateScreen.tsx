import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

export const ForceUpdateScreen = () => {
  const handleUpdate = () => {
    // In a real app, this links to the specific Play Store or App Store page
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id123456789'
      : 'market://details?id=com.citylocalshop.app';
      
    Linking.openURL(url).catch(() => {
      // Fallback to web browser if store app is not available
      Linking.openURL('https://play.google.com/store/apps/details?id=com.citylocalshop.app');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="rocket" size={64} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.description}>
          We've added new features and fixed some bugs! You need to update your app to the latest version to continue using CityLocalShop.
        </Text>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.gray[900],
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.body,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.xl,
  },
  updateButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    ...Typography.h5,
    color: Colors.white,
  },
});
