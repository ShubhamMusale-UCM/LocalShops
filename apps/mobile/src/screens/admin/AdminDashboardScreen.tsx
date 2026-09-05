import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';

type Tab = 'Overview' | 'Analytics' | 'Moderation' | 'Approvals';

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
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingShops, setPendingShops] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      if (activeTab === 'Overview') {
        const { data } = await api.get('/admin/overview');
        setOverview(data?.data || null);
      } else if (activeTab === 'Analytics') {
        const { data } = await api.get('/admin/analytics');
        setAnalytics(data?.data || null);
      } else if (activeTab === 'Moderation') {
        const { data } = await api.get('/admin/users');
        setUsers(data?.data?.items || []);
      } else if (activeTab === 'Approvals') {
        const { data } = await api.get('/admin/shops?status=pending');
        setPendingShops(data?.data?.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleUserBan = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive: !currentStatus });
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  const handleApproveShop = async (shopId: string) => {
    try {
      await api.patch(`/admin/shops/${shopId}/verify`, { isVerified: true });
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to approve shop');
    }
  };

  const renderTabs = () => {
    const tabs: Tab[] = ['Overview', 'Analytics', 'Moderation', 'Approvals'];
    return (
      <View style={styles.tabContainer}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.activeTab]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderOverview = () => {
    const items = [
      { label: 'Users', value: overview?.users || 0, icon: 'people' },
      { label: 'Shops', value: overview?.shops || 0, icon: 'storefront' },
      { label: 'Products', value: overview?.products || 0, icon: 'cube' },
      { label: 'Orders', value: overview?.orders || 0, icon: 'receipt' },
      { label: 'Reviews', value: overview?.reviews || 0, icon: 'chatbubbles' },
      { label: 'Active Shops', value: overview?.activeShops || 0, icon: 'checkmark-circle' },
    ];

    return (
      <View>
        <View style={styles.grid}>
          {items.map((item) => (
            <Card key={item.label} style={styles.statCard}>
              <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </Card>
          ))}
        </View>
        <Card style={{ marginTop: Spacing.md }}>
          <Text style={styles.gmvLabel}>Gross Merchandise Value</Text>
          <Text style={styles.gmvValue}>₹{(overview?.grossMerchandiseValue || 0).toLocaleString('en-IN')}</Text>
        </Card>
      </View>
    );
  };

  const renderAnalytics = () => {
    if (!analytics) return <Text>Loading analytics...</Text>;
    return (
      <View style={{ gap: Spacing.md }}>
        <Card>
          <Text style={styles.statLabel}>New Signups (Last 7 Days)</Text>
          <Text style={styles.statValue}>{analytics.recentSignups}</Text>
        </Card>
        <Card>
          <Text style={styles.statLabel}>Orders (Last 7 Days)</Text>
          <Text style={styles.statValue}>{analytics.recentOrders}</Text>
        </Card>
        <Card>
          <Text style={styles.statLabel}>Order Status Distribution</Text>
          {Object.entries(analytics.orderStatusDistribution || {}).map(([status, count]) => (
            <Text key={status} style={styles.subtitle}>{status}: {count as number}</Text>
          ))}
        </Card>
      </View>
    );
  };

  const renderModeration = () => {
    return (
      <View style={{ paddingBottom: 100 }}>
        {users.map(u => (
          <Card key={u.id} style={{ marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.statValue}>{u.name}</Text>
              <Text style={styles.subtitle}>{u.phone} | {u.role}</Text>
              <Text style={styles.subtitle}>Status: {u.isActive !== false ? 'Active' : 'Banned'}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: u.isActive !== false ? Colors.error : Colors.success }]}
              onPress={() => handleToggleUserBan(u.id, u.isActive !== false)}
            >
              <Text style={styles.btnText}>{u.isActive !== false ? 'Ban' : 'Unban'}</Text>
            </TouchableOpacity>
          </Card>
        ))}
      </View>
    );
  };

  const renderApprovals = () => {
    if (pendingShops.length === 0) {
      return <Text style={styles.subtitle}>No shops pending approval.</Text>;
    }
    return (
      <View style={{ paddingBottom: 100 }}>
        {pendingShops.map(s => (
          <Card key={s.id} style={{ marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.statValue}>{s.name}</Text>
              <Text style={styles.subtitle}>{s.category} | {s.city}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: Colors.primary }]}
              onPress={() => handleApproveShop(s.id)}
            >
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
          </Card>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Platform overview and moderation controls</Text>
      
      {renderTabs()}

      {activeTab === 'Overview' && renderOverview()}
      {activeTab === 'Analytics' && renderAnalytics()}
      {activeTab === 'Moderation' && renderModeration()}
      {activeTab === 'Approvals' && renderApprovals()}
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    ...Typography.body,
    color: Colors.gray[500],
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
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
  btn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
