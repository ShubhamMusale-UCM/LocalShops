import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, StatusBar, Platform, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { orderService } from '../../services/orderService';
import { getProductImageUrl } from '../../utils/image';

type Props = NativeStackScreenProps<any, 'OrderDetail'>;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const params = route.params as any;
  const orderId = params?.orderId || 'Unknown';
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      try {
        setLoading(true);
        const response = await orderService.getById(orderId);
        const payload = response?.data || response;
        if (active) {
          setOrder(payload);
        }
      } catch (error) {
        if (active) {
          setOrder(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (orderId && orderId !== 'Unknown') {
      loadOrder();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [orderId]);

  const statusColor = useMemo(() => {
    switch (order?.status) {
      case 'DELIVERED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.error;
      case 'READY_FOR_PICKUP':
        return Colors.primary;
      case 'PREPARING':
      case 'CONFIRMED':
        return Colors.warning;
      default:
        return Colors.info;
    }
  }, [order?.status]);

  const statusIcon = useMemo(() => {
    switch (order?.status) {
      case 'PLACED':
        return 'receipt-outline';
      case 'CONFIRMED':
        return 'checkmark-circle-outline';
      case 'PREPARING':
        return 'timer-outline';
      case 'READY_FOR_PICKUP':
        return 'cube-outline';
      case 'DELIVERED':
        return 'checkmark-done-outline';
      case 'CANCELLED':
        return 'close-circle-outline';
      default:
        return 'info-outline';
    }
  }, [order?.status]);

  const getLineImage = (line: any) =>
    getProductImageUrl(
      [
        ...(Array.isArray(line?.product?.images) ? line.product.images : []),
        line?.productImage,
        line?.product?.image,
      ].filter(Boolean)
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Order</Text>
          <Text style={styles.headerSubtitle}>#{String(order?.orderNumber || orderId).slice(-10)}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !order ? (
        <View style={styles.content}>
          <Ionicons name="alert-circle-outline" size={56} color={Colors.gray[300]} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.subtitle}>Order not found</Text>
          <Text style={styles.text}>We could not load this order right now.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Status Card */}
          <View style={[styles.statusCard, { borderLeftColor: statusColor, backgroundColor: `${statusColor}08` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={[styles.statusIconContainer, { backgroundColor: `${statusColor}20` }]}>
                <Ionicons name={statusIcon as any} size={28} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>Order Status</Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {String(order.status || 'PLACED').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          </View>

          {/* Order Meta Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Details</Text>
            <View style={styles.divider} />
            
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                <Ionicons name="calendar-outline" size={16} color={Colors.gray[500]} />
                <Text style={styles.metaLabel}>Order Date</Text>
              </View>
              <Text style={styles.metaValue}>{new Date(order.createdAt).toLocaleString()}</Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                <Ionicons name="card-outline" size={16} color={Colors.gray[500]} />
                <Text style={styles.metaLabel}>Payment</Text>
              </View>
              <Text style={styles.metaValue}>{order.paymentMethod || 'ONLINE'} • {order.paymentStatus || 'PENDING'}</Text>
            </View>

            {order.deliveryAddress && (
              <View style={styles.metaRowLarge}>
                <View style={styles.metaLeft}>
                  <Ionicons name="location-outline" size={16} color={Colors.gray[500]} />
                  <Text style={styles.metaLabel}>Booking Address</Text>
                </View>
                <Text style={styles.metaValueLarge}>{order.deliveryAddress}</Text>
              </View>
            )}
          </View>

          {/* Items Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items in Order</Text>
            <View style={styles.divider} />
            
            {(order.items || []).map((line: any, idx: number) => (
              <View key={line.id || idx}>
                <View style={styles.itemRow}>
                  <View style={styles.itemImageWrap}>
                    <Image source={{ uri: getLineImage(line) }} style={styles.itemImage} />
                    <View style={[styles.itemImageBadge, { backgroundColor: statusColor }]} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{line.product?.name || `Product ${String(line.productId || '').slice(-6)}`}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyText}>Qty: {line.quantity}</Text>
                      </View>
                      <Text style={styles.itemBase}>@ ₹{Number(line.price || 0).toFixed(0)}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemPrice}>₹{Number(line.total || 0).toFixed(0)}</Text>
                </View>
                {idx < (order.items?.length || 1) - 1 && <View style={styles.itemDivider} />}
              </View>
            ))}

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{Number(order.total || 0).toFixed(0)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {order.status === 'DELIVERED' ? (
            <TouchableOpacity style={styles.reviewButton}>
              <Ionicons name="star-outline" size={20} color="#FFF" />
              <Text style={styles.reviewButtonText}>Leave a Review</Text>
            </TouchableOpacity>
          ) : order.status === 'CANCELLED' ? null : (
            <TouchableOpacity 
              style={styles.trackButton}
              onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
            >
              <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
              <Text style={styles.trackButtonText}>View Order Status</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 0) + 12,
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: Spacing.xs,
    borderRadius: Spacing.radius.md,
  },
  headerTitle: {
    ...Typography.h4,
    color: '#FFF',
    fontWeight: '600',
  },
  headerSubtitle: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Status Card
  statusCard: {
    backgroundColor: Colors.light.card,
    borderLeftWidth: 4,
    borderRadius: Spacing.radius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: Spacing.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    ...Typography.caption,
    color: Colors.gray[600],
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statusValue: {
    ...Typography.h5,
    marginTop: 4,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: Spacing.radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTitle: {
    ...Typography.h5,
    color: Colors.gray[900],
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginVertical: Spacing.md,
  },

  // Meta Rows
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  metaRowLarge: {
    flexDirection: 'column',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaLabel: {
    ...Typography.body,
    color: Colors.gray[600],
    fontWeight: '500',
  },
  metaValue: {
    ...Typography.body,
    color: Colors.gray[900],
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  metaValueLarge: {
    ...Typography.body,
    color: Colors.gray[900],
    marginTop: Spacing.sm,
    fontWeight: '600',
    lineHeight: 22,
  },

  // Item Rows
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  itemImageWrap: {
    width: 64,
    height: 64,
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImageBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
    fontWeight: '600',
  },
  qtyBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.sm,
  },
  qtyText: {
    ...Typography.caption,
    color: Colors.gray[700],
    fontWeight: '600',
  },
  itemBase: {
    ...Typography.caption,
    color: Colors.gray[500],
  },
  itemPrice: {
    ...Typography.h5,
    color: Colors.primary,
    fontWeight: '700',
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },

  // Total Row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  totalLabel: {
    ...Typography.h5,
    color: Colors.gray[900],
    fontWeight: '700',
  },
  totalValue: {
    ...Typography.h4,
    color: Colors.primary,
    fontWeight: '900',
  },

  // Button
  reviewButton: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Spacing.radius.md,
    marginTop: Spacing.md,
  },
  reviewButtonText: {
    ...Typography.bodyBold,
    color: '#FFF',
  },
  trackButton: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Spacing.radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginTop: Spacing.md,
  },
  trackButtonText: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  subtitle: {
    ...Typography.h5,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  text: {
    ...Typography.body,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
