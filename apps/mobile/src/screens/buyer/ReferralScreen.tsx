import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControl, TouchableOpacity, Share, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel, GlassCard } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { walletService, ReferralStatus } from '../../services/walletService';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<ReferralStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await walletService.getReferralStatus();
      setData(res);
    } catch (err: any) {
      console.error('Error fetching referral status:', err);
      setError(err?.response?.data?.error || 'Failed to load referral status');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const handleShare = async () => {
    if (!data?.referralCode) return;
    try {
      await Share.share({
        message: `Use my referral code ${data.referralCode} to get ₹${data.rewardPerReferral || 50} on CityLocalShop! Download the app: https://citylocalshop.com/app`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <SectionList
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#38BDF8" />}
        sections={[
          { title: 'Pending Referrals', data: data?.pendingReferrals || [], type: 'PENDING' },
          { title: 'Completed Referrals', data: data?.completedReferrals || [], type: 'COMPLETED' },
        ]}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={() => (
          <>
            <View style={styles.heroSection}>
              <Image source={require('../../assets/images/app-icon.png')} style={styles.heroIcon} />
              <Text style={styles.heroTitle}>Invite Friends, Earn Coins!</Text>
              <Text style={styles.heroSubtitle}>
                Get ₹{data?.rewardPerReferral || 50} in coins for every friend who signs up with your code and completes their first booking.
              </Text>
            </View>

            <GlassCard style={styles.codeCard}>
              <Text style={styles.codeLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{error ? 'Error' : (data?.referralCode || '...')}</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                  <Ionicons name="share-social" size={20} color="#FFF" />
                  <Text style={styles.shareText}>Share</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            <View style={styles.statsContainer}>
              <GlassCard style={styles.statBox}>
                <Text style={styles.statLabel}>Total Referrals</Text>
                <Text style={styles.statValue}>{data?.totalReferrals || 0}</Text>
              </GlassCard>
              <View style={{ width: 16 }} />
              <GlassCard style={styles.statBox}>
                <Text style={styles.statLabel}>Total Earned</Text>
                <Text style={styles.statValue}>₹{data?.totalEarned?.toFixed(2) || '0.00'}</Text>
              </GlassCard>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        renderSectionHeader={({ section: { title, data } }) => (
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{title} ({data.length})</Text>
        )}
        renderItem={({ item, section }) => (
          <GlassCard style={styles.referralCard}>
            <View style={styles.refUser}>
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.refName}>{item.referredUser?.name || 'User'}</Text>
            </View>
            {section.type === 'PENDING' ? (
              <Text style={styles.refStatusPending}>Awaiting 1st Order</Text>
            ) : (
              <Text style={styles.refStatusCompleted}>+₹{item.amountCredited}</Text>
            )}
          </GlassCard>
        )}
        ListEmptyComponent={() => (
           <Text style={styles.emptyText}>No referrals yet</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050814',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroIcon: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  codeCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 8,
    paddingLeft: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  codeText: {
    color: '#38BDF8',
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  shareText: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: 16,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Outfit_500Medium',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
  },
  sectionTitle: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    marginBottom: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
  },
  refUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  refName: {
    color: '#FFF',
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
  },
  refStatusPending: {
    color: '#F59E0B',
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
  },
  refStatusCompleted: {
    color: '#10B981',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
});
