import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPanel, GlassCard } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { walletService, BuyerWalletBalance, WalletTransaction } from '../../services/walletService';

export default function WalletScreen() {
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [balanceData, setBalanceData] = useState<BuyerWalletBalance | null>(null);
  const [history, setHistory] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchData = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      setError(null);
      const [balanceRes, historyRes] = await Promise.all([
        walletService.getBuyerBalance(),
        walletService.getBuyerHistory(pageNum, 20),
      ]);
      setBalanceData(balanceRes);
      
      const newHistory = historyRes.transactions || [];
      if (pageNum === 1) {
        setHistory(newHistory);
      } else {
        setHistory(prev => [...prev, ...newHistory]);
      }
      setHasMore(newHistory.length === 20);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Error fetching wallet data:', err);
      setError(err?.response?.data?.error || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchData(page + 1);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const renderHeader = () => (
    <>
      <GlassCard style={styles.balanceCard}>
          <LinearGradient
            colors={['rgba(56, 189, 248, 0.2)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet-outline" size={32} color="#38BDF8" />
            <Text style={styles.balanceLabel}>Available Coins</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{balanceData?.balance?.toFixed(2) || '0.00'}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Earned</Text>
              <Text style={styles.statValue}>₹{balanceData?.lifetime?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValue}>₹{balanceData?.spent?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        
        {error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.emptyStateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(1)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (!loading && history.length === 0) ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        ) : null}
    </>
  );

  const renderItem = ({ item: tx }: { item: WalletTransaction }) => (
    <GlassCard style={styles.txCard}>
      <View style={styles.txIconContainer}>
        <Ionicons
          name={tx.direction === 'CREDIT' ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={24}
          color={tx.direction === 'CREDIT' ? '#10B981' : '#EF4444'}
        />
      </View>
      <View style={styles.txDetails}>
        <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
        <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <View style={styles.txAmountContainer}>
        <Text style={[styles.txAmount, { color: tx.direction === 'CREDIT' ? '#10B981' : '#EF4444' }]}>
          {tx.direction === 'CREDIT' ? '+' : '-'}₹{tx.amount}
        </Text>
        {tx.isExpired && <Text style={styles.expiredBadge}>Expired</Text>}
      </View>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      
      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { height: insets.top + 44, opacity: headerOpacity }]}>
        <GlassPanel style={StyleSheet.absoluteFillObject} />
        <View style={styles.stickyHeaderInner}>
          <Text style={styles.stickyTitle}>My Coins</Text>
        </View>
      </Animated.View>

      <View style={[styles.headerActions, { top: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.referButton} onPress={() => navigation.navigate('Referral')}>
          <Ionicons name="gift-outline" size={20} color="#38BDF8" />
          <Text style={styles.referText}>Earn More</Text>
        </TouchableOpacity>
      </View>

      <AnimatedFlatList
        data={error ? ([] as WalletTransaction[]) : history}
        keyExtractor={(item: any) => item.id}
        renderItem={(props: any) => renderItem(props)}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => fetchData(1)} tintColor="#38BDF8" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050814',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  stickyHeaderInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  stickyTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
  },
  headerActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  referText: {
    color: '#38BDF8',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    marginLeft: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    marginLeft: 8,
  },
  balanceAmount: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 48,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  statBox: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    marginBottom: 16,
  },
  txCard: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txDesc: {
    color: '#FFF',
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    marginBottom: 4,
  },
  txDate: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  expiredBadge: {
    color: '#F59E0B',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    marginTop: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  retryButtonText: {
    color: '#EF4444',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    marginTop: 12,
  },
});
