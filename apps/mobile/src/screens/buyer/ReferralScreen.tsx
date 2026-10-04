import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Share, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel, GlassCard } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { walletService, ReferralStatus } from '../../services/walletService';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await walletService.getReferralStatus();
      setData(res);
    } catch (error) {
      console.error('Error fetching referral status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleShare = async () => {
    if (!data?.referralCode) return;
    try {
      await Share.share({
        message: `Use my referral code ${data.referralCode} to get exclusive rewards on CityLocalShop!`,
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#38BDF8" />}
      >
        <View style={styles.heroSection}>
          <Image source={require('../../assets/images/app-icon.png')} style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Invite Friends, Earn Coins!</Text>
          <Text style={styles.heroSubtitle}>
            Get ₹50 in coins for every friend who signs up with your code and completes their first booking.
          </Text>
        </View>

        <GlassCard style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{data?.referralCode || '...'}</Text>
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

        <Text style={styles.sectionTitle}>Pending Referrals</Text>
        {data?.pendingReferrals && data.pendingReferrals.length > 0 ? (
          data.pendingReferrals.map((ref, i) => (
            <GlassCard key={i} style={styles.referralCard}>
              <View style={styles.refUser}>
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
                </View>
                <Text style={styles.refName}>{ref.referredUser.name}</Text>
              </View>
              <Text style={styles.refStatusPending}>Awaiting 1st Order</Text>
            </GlassCard>
          ))
        ) : (
          <Text style={styles.emptyText}>No pending referrals</Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Completed Referrals</Text>
        {data?.completedReferrals && data.completedReferrals.length > 0 ? (
          data.completedReferrals.map((ref, i) => (
            <GlassCard key={i} style={styles.referralCard}>
              <View style={styles.refUser}>
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
                </View>
                <Text style={styles.refName}>{ref.referredUser.name}</Text>
              </View>
              <Text style={styles.refStatusCompleted}>+₹{ref.amountCredited}</Text>
            </GlassCard>
          ))
        ) : (
          <Text style={styles.emptyText}>No completed referrals yet</Text>
        )}
      </ScrollView>
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
