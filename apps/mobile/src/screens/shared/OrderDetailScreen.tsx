import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Platform, Image, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { orderService } from '../../services/orderService';
import { getProductImageUrl } from '../../utils/image';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { TouchSpring } from '../../components/ui/TouchSpring';

type Props = NativeStackScreenProps<any, 'OrderDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_MAP: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  PLACED:            { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',   label: 'Order Placed',      icon: 'receipt-outline' },
  CONFIRMED:         { color: '#2563EB', bg: 'rgba(37,99,235,0.12)',    label: 'Confirmed',         icon: 'checkmark-circle-outline' },
  PREPARING:         { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   label: 'Preparing',         icon: 'timer-outline' },
  READY_FOR_PICKUP:  { color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',    label: 'Ready for Pickup',  icon: 'cube-outline' },
  DELIVERED:         { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',    label: 'Delivered',         icon: 'checkmark-done-outline' },
  CANCELLED:         { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    label: 'Cancelled',         icon: 'close-circle-outline' },
  REFUNDED:          { color: '#EC4899', bg: 'rgba(236,72,153,0.12)',   label: 'Refunded',          icon: 'refresh-circle-outline' },
};

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const params = route.params as any;
  const orderId = params?.orderId || 'Unknown';
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    let active = true;
    const loadOrder = async () => {
      try {
        setLoading(true);
        const response = await orderService.getById(orderId);
        const payload = response?.data || response;
        if (active) setOrder(payload);
      } catch (error) {
        if (active) setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (orderId && orderId !== 'Unknown') {
      loadOrder();
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [orderId]);

  const config = STATUS_MAP[order?.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.12)', label: order?.status || 'Unknown', icon: 'info-outline' };

  const getLineImage = (line: any) =>
    getProductImageUrl(
      [
        ...(Array.isArray(line?.product?.images) ? line.product.images : []),
        line?.productImage,
        line?.product?.image,
      ].filter(Boolean)
    );

  const bg = isDark ? '#0B1020' : '#F8FAFC';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const textSub = isDark ? '#94A3B8' : '#64748B';

  const renderHeader = () => (
    <GlassPanel intensity={30} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchSpring onPress={() => navigation.goBack()} style={styles.backBtn}>
        <View style={styles.backBtnInner}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </View>
      </TouchSpring>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerEyebrow, { color: '#06B6D4' }]}>ORDER DETAILS</Text>
        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>
          #{String(order?.orderNumber || orderId).slice(-8).toUpperCase()}
        </Text>
      </View>
      <View style={{ width: 44 }} />
    </GlassPanel>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#050814' }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <AmbientOrbs />
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#06B6D4" />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: '#050814' }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <AmbientOrbs />
        {renderHeader()}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#64748B" />
          <Text style={[styles.errorTitle, { color: text }]}>Order Not Found</Text>
          <Text style={[styles.errorSub, { color: textSub }]}>We couldn\'t load this order.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#050814' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientOrbs />
      
      {renderHeader()}

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Section */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <GlassCard intensity={25} style={[styles.statusCard, { borderColor: config.color + '40' }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon as any} size={28} color={config.color} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: textSub }]}>Current Status</Text>
              <Text style={[styles.statusValue, { color: config.color }]}>{config.label}</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Order Meta */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <GlassCard intensity={20} style={styles.metaCard}>
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                <Ionicons name="calendar-outline" size={16} color={textSub} />
                <Text style={[styles.metaLabel, { color: textSub }]}>Date</Text>
              </View>
              <Text style={[styles.metaValue, { color: text }]}>{new Date(order.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                <Ionicons name="card-outline" size={16} color={textSub} />
                <Text style={[styles.metaLabel, { color: textSub }]}>Payment</Text>
              </View>
              <Text style={[styles.metaValue, { color: text }]}>{order.paymentMethod || 'ONLINE'} • {order.paymentStatus || 'PENDING'}</Text>
            </View>
            {order.deliveryAddress && (
              <>
                <View style={styles.divider} />
                <View style={styles.metaCol}>
                  <View style={styles.metaLeft}>
                    <Ionicons name="location-outline" size={16} color={textSub} />
                    <Text style={[styles.metaLabel, { color: textSub }]}>Delivery Address</Text>
                  </View>
                  <Text style={[styles.metaValueBlock, { color: text }]}>{order.deliveryAddress}</Text>
                </View>
              </>
            )}
          </GlassCard>
        </Animated.View>

        {/* Ordered Items Container */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.itemsSection}>
            <Text style={[styles.sectionTitle, { color: text }]}>Items in Order</Text>
            
            <GlassCard intensity={25} style={styles.itemsCard}>
              {(order.items || []).map((line: any, idx: number) => (
                <View key={line.id || idx}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemImageWrap}>
                      <Image source={{ uri: getLineImage(line) }} style={styles.itemImage} />
                      <View style={[styles.itemImageOverlay, { borderColor: config.color }]} />
                    </View>
                    
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: text }]} numberOfLines={2}>
                        {line.product?.name || `Product ${String(line.productId || '').slice(-6)}`}
                      </Text>
                      
                      <View style={styles.itemMetaRow}>
                        <View style={styles.qtyPill}>
                          <Text style={styles.qtyText}>{line.quantity}x</Text>
                        </View>
                        <Text style={[styles.itemBasePrice, { color: textSub }]}>
                          @ ₹{Number(line.price || 0).toFixed(0)}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.itemTotal, { color: '#06B6D4' }]}>
                      ₹{Number(line.total || 0).toFixed(0)}
                    </Text>
                  </View>
                  {idx < (order.items?.length || 1) - 1 && <View style={styles.itemDivider} />}
                </View>
              ))}

              <View style={styles.totalSection}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={[styles.totalLabel, { color: text }]}>Total Amount</Text>
                <Text style={[styles.totalAmount, { color: '#06B6D4' }]}>
                  ₹{Number(order.total || 0).toFixed(2)}
                </Text>
              </View>
            </GlassCard>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.actionSection}>
          {order.status === 'DELIVERED' ? (
            <TouchSpring style={styles.actionBtn}>
              <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.actionGrad}>
                <Ionicons name="star" size={20} color="#FFF" />
                <Text style={styles.actionText}>Leave a Review</Text>
              </LinearGradient>
            </TouchSpring>
          ) : order.status !== 'CANCELLED' && order.status !== 'REFUNDED' ? (
            <TouchSpring 
              style={styles.actionBtn}
              onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
            >
              <LinearGradient colors={['#06B6D4', '#0284C7']} style={styles.actionGrad}>
                <Ionicons name="navigate-outline" size={20} color="#FFF" />
                <Text style={styles.actionText}>Track Order</Text>
              </LinearGradient>
            </TouchSpring>
          ) : null}
        </Animated.View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  backBtn: {
    width: 44, height: 44,
  },
  backBtnInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleWrap: { alignItems: 'center' },
  headerEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 20 },
  
  // Status
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statusValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  
  // Meta
  metaCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaCol: { flexDirection: 'column', alignItems: 'flex-start' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { fontSize: 13, fontWeight: '500' },
  metaValue: { fontSize: 14, fontWeight: '700' },
  metaValueBlock: { fontSize: 14, fontWeight: '600', marginTop: 10, lineHeight: 22 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  
  // Items
  itemsSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, marginLeft: 4 },
  itemsCard: {
    borderRadius: 28,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  itemRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 14,
  },
  itemImageWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  itemImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  itemImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 20,
  },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700', marginBottom: 8, lineHeight: 20 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  qtyText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  itemBasePrice: { fontSize: 12, fontWeight: '600' },
  itemTotal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  itemDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalAmount: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  
  // Action
  actionSection: { marginTop: 10 },
  actionBtn: { borderRadius: 20, overflow: 'hidden' },
  actionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  actionText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  
  // Error
  errorTitle: { fontSize: 22, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  errorSub: { fontSize: 15 },
});
