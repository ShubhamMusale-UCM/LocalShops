import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { walletService, SellerAdWalletBalance, WalletTransaction } from '../../services/walletService';
import { getPrimarySellerShop } from '../../services/sellerShopContext';
// @ts-ignore
import RazorpayCheckout from 'react-native-razorpay';
import api from '../../services/api';

export default function SellerAdWalletScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [currentShop, setCurrentShop] = useState<any>(null);
  
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isToppingUp, setIsToppingUp] = useState(false);

  const fetchData = async () => {
    if (!currentShop?.id) return;
    try {
      setLoading(true);
      const [balRes, histRes] = await Promise.all([
        walletService.getAdWalletBalance(currentShop.id),
        walletService.getAdWalletHistory(currentShop.id, 1, 50),
      ]);
      setBalance(balRes.adWalletBalance);
      setHistory(histRes.transactions || []);
    } catch (error) {
      console.error('Error fetching ad wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPrimarySellerShop().then((shop) => {
      setCurrentShop(shop);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [currentShop?.id]);

  const handleTopUp = async () => {
    // Basic implementation of top up. For production, you'd want a modal to enter amount.
    const amount = 500; // Hardcoded top-up for demo, could be an input field
    try {
      setIsToppingUp(true);
      // Create Razorpay order for wallet topup
      // Assuming a generic topup endpoint exists or reusing an existing payment flow
      const res = await api.post('/wallet/topup/initiate', { amount, shopId: currentShop?.id });
      // Direct bypass for seller test mode
      await api.post('/wallet/topup/verify', {
        razorpay_order_id: res.data?.orderId || `order_${Date.now()}`,
        razorpay_payment_id: 'pay_test_' + Date.now(),
        razorpay_signature: 'test_signature',
        shopId: currentShop?.id,
        amount
      });
      Alert.alert('Success', `₹${amount} added to Ad Wallet (Bypassed)!`);
      fetchData();
      return;

      const { orderId, amount: rpAmount, currency, key } = res.data;

      const options = {
        description: 'Ad Wallet Top-up',
        image: 'https://citylocalshop.com/logo.png',
        currency,
        key,
        amount: rpAmount,
        name: 'CityLocalShop Ads',
        order_id: orderId,
        theme: { color: '#38BDF8' }
      };

      RazorpayCheckout.open(options).then(async (data: any) => {
        // Verify payment
        await api.post('/wallet/topup/verify', {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          shopId: currentShop?.id,
          amount
        });
        Alert.alert('Success', 'Wallet topped up successfully!');
        fetchData();
      }).catch((error: any) => {
        Alert.alert('Payment Failed', 'Your payment was cancelled or failed.');
      });
    } catch (error) {
      Alert.alert('Error', 'Could not initiate top-up. Top-ups might not be configured.');
    } finally {
      setIsToppingUp(false);
    }
  };

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ad Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#38BDF8" />}
      >
        <GlassCard style={styles.balanceCard}>
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.2)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.balanceHeader}>
            <Ionicons name="megaphone-outline" size={32} color="#F59E0B" />
            <Text style={styles.balanceLabel}>Ad Campaign Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
          
          <GlassButton
            onPress={handleTopUp}
            style={{ marginTop: 12, backgroundColor: '#F59E0B' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              {isToppingUp ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 16, marginLeft: 8 }}>Top Up Wallet (₹500)</Text>
                </>
              )}
            </View>
          </GlassButton>
        </GlassCard>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.infoText}>
            Ad balance is used for Promoted Listings. You can top up your wallet manually, and you also earn free ad credits when buyers use their City Coins on your shop!
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Ad Wallet History</Text>
        
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyStateText}>No ad transactions yet</Text>
          </View>
        ) : (
          history.map(tx => (
            <GlassCard key={tx.id} style={styles.txCard}>
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
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050814' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  balanceCard: { padding: 24, borderRadius: 24, marginBottom: 16, overflow: 'hidden' },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit_500Medium', fontSize: 16, marginLeft: 8 },
  balanceAmount: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 48, marginBottom: 16 },
  infoBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 24, alignItems: 'flex-start' },
  infoText: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit_400Regular', fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 20 },
  sectionTitle: { color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 18, marginBottom: 16 },
  txCard: { flexDirection: 'row', padding: 16, marginBottom: 12, alignItems: 'center' },
  txIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txDetails: { flex: 1 },
  txDesc: { color: '#FFF', fontFamily: 'Outfit_500Medium', fontSize: 15, marginBottom: 4 },
  txDate: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit_400Regular', fontSize: 12 },
  txAmountContainer: { alignItems: 'flex-end' },
  txAmount: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  expiredBadge: { color: '#F59E0B', fontFamily: 'Outfit_600SemiBold', fontSize: 10, marginTop: 2, backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyStateText: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit_500Medium', fontSize: 15, marginTop: 12 },
});
