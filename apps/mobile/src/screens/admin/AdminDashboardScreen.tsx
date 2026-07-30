import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';

interface Overview {
  users: number;
  shops: number;
  products: number;
  orders: number;
  reviews: number;
  activeShops: number;
  grossMerchandiseValue: number;
}

export default function AdminDashboardScreen() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/admin/overview');
        setOverview(data?.data || null);
      } catch {
        setOverview(null);
      }
    };

    load();
  }, []);

  const items = [
    { label: 'Users', value: overview?.users || 0, icon: 'people' },
    { label: 'Shops', value: overview?.shops || 0, icon: 'storefront' },
    { label: 'Products', value: overview?.products || 0, icon: 'cube' },
    { label: 'Orders', value: overview?.orders || 0, icon: 'receipt' },
    { label: 'Reviews', value: overview?.reviews || 0, icon: 'chatbubbles' },
    { label: 'Active Shops', value: overview?.activeShops || 0, icon: 'checkmark-circle' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Platform overview and moderation controls</Text>

      <View style={styles.grid}>
        {items.map((item) => (
          <Card key={item.label} style={styles.statCard}>
            <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </Card>
        ))}
      </View>

      <Card>
        <Text style={styles.gmvLabel}>Gross Merchandise Value</Text>
        <Text style={styles.gmvValue}>₹{(overview?.grossMerchandiseValue || 0).toLocaleString('en-IN')}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.gray[900],
  },
  subtitle: {
    ...Typography.body,
    color: Colors.gray[600],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    gap: Spacing.xs,
  },
  statValue: {
    ...Typography.h4,
    color: Colors.gray[900],
  },
  statLabel: {
    ...Typography.bodySmall,
    color: Colors.gray[600],
  },
  gmvLabel: {
    ...Typography.body,
    color: Colors.gray[600],
    marginBottom: Spacing.xs,
  },
  gmvValue: {
    ...Typography.h2,
    color: Colors.primary,
  },
});
