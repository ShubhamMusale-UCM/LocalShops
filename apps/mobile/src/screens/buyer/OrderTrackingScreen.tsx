import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../theme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { orderService } from '../../services/orderService';

interface OrderStatus {
  step: number;
  title: string;
  description: string;
  timestamp?: string;
  completed: boolean;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  estimatedDelivery?: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  deliveryPartner?: {
    name: string;
    phone: string;
    rating: number;
  };
  deliveryAddress: string;
  total: number;
  statusHistory: Array<{
    status: string;
    note?: string;
    updatedAt?: string;
  }>;
}

const STATUS_FLOW = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED'];

const STATUS_LABELS: Record<string, { title: string; description: string }> = {
  PLACED: { title: 'Order Placed', description: 'Your order has been placed.' },
  CONFIRMED: { title: 'Order Confirmed', description: 'Shop confirmed your order.' },
  PREPARING: { title: 'Preparing', description: 'Shop is preparing your order.' },
  READY_FOR_PICKUP: { title: 'Ready', description: 'Order is packed and ready.' },
  DELIVERED: { title: 'Completed', description: 'Order completed successfully.' },
};

const OrderTrackingScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const orderSteps: OrderStatus[] = useMemo(() => {
    if (!order) {
      return [];
    }

    const historyByStatus = new Map<string, { updatedAt?: string; note?: string }>();
    for (const entry of order.statusHistory || []) {
      if (!entry?.status) continue;
      historyByStatus.set(String(entry.status), {
        updatedAt: entry.updatedAt,
        note: entry.note,
      });
    }

    const currentIndex = Math.max(0, STATUS_FLOW.indexOf(order.status));

    return STATUS_FLOW.map((status, index) => {
      const label = STATUS_LABELS[status] || { title: status, description: '' };
      const statusHistory = historyByStatus.get(status);
      return {
        step: index + 1,
        title: label.title,
        description: statusHistory?.note || label.description,
        timestamp: statusHistory?.updatedAt
          ? new Date(statusHistory.updatedAt).toLocaleString()
          : undefined,
        completed: index <= currentIndex,
      };
    });
  }, [order]);

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      try {
        setIsLoading(true);
        const response = await orderService.getById(orderId);
        const payload = response?.data || response;
        const mapped: Order = {
          id: payload.id,
          status: payload.status,
          createdAt: payload.createdAt,
          estimatedDelivery: payload.estimatedDelivery,
          items: Array.isArray(payload.items)
            ? payload.items.map((item: any) => ({
              id: item.id,
              productName: item.product?.name || `Product ${String(item.productId || '').slice(-6)}`,
              quantity: Number(item.quantity || 0),
              price: Number(item.price || 0),
              total: Number(item.total || 0),
            }))
            : [],
          deliveryAddress: payload.deliveryAddress || 'Pickup from shop',
          total: Number(payload.total || 0),
          statusHistory: Array.isArray(payload.statusHistory) ? payload.statusHistory : [],
        };

        if (active) {
          setOrder(mapped);
        }
      } catch (error) {
        if (active) {
          setOrder(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    if (orderId) {
      loadOrder();
    } else {
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingHorizontal: 16, paddingTop: 40, justifyContent: 'flex-start' }]}>
        <SkeletonCard imageHeight={0} lines={4} style={{ marginBottom: 16, width: '100%' }} />
        <SkeletonCard imageHeight={0} lines={4} style={{ width: '100%' }} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Order ID</Text>
          <Text style={styles.headerValue}>#{String(order.id || '').slice(-8)}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons name="time" size={14} color={colors.warning} />
          <Text style={styles.statusText}>{String(order.status || '').replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* Removed Delivery Partner Card */}

      {/* Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>Order Status</Text>
        {orderSteps.map((step, idx) => (
          <View key={step.step}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineMarker}>
                <View
                  style={[
                    styles.markerCircle,
                    { backgroundColor: step.completed ? colors.success : colors.gray300 },
                  ]}
                >
                  {step.completed && (
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  )}
                </View>

                {idx < orderSteps.length - 1 && (
                  <View
                    style={[
                      styles.markerLine,
                      {
                        backgroundColor: step.completed
                          ? colors.success
                          : colors.gray300,
                      },
                    ]}
                  />
                )}
              </View>

              <View style={styles.timelineContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
                {step.timestamp && (
                  <Text style={styles.stepTimestamp}>{step.timestamp}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Booking Address */}
      <Card style={styles.addressCard}>
        <View style={styles.addressHeader}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.addressLabel}>Booking Address</Text>
        </View>
        <Text style={styles.addressText}>{order.deliveryAddress}</Text>
        {order.estimatedDelivery ? (
          <Text style={styles.estimatedTime}>
            📦 Estimated completion: {new Date(order.estimatedDelivery).toLocaleString()}
          </Text>
        ) : null}
      </Card>

      {/* Order Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.itemsTitle}>Order Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>₹{item.total.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.itemTotalRow}>
          <Text style={styles.itemTotalLabel}>Total Amount</Text>
          <Text style={styles.itemTotalValue}>₹{order.total}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        <Button
          label="Share Order"
          variant="secondary"
          onPress={() => { }}
          icon="share-social"
          style={{ marginBottom: spacing.md }}
        />
        <Button
          label="View Receipt"
          variant="secondary"
          onPress={() => { }}
          icon="document-text"
          style={{ marginBottom: spacing.md }}
        />
        <Button
          label="Contact Support"
          variant="secondary"
          onPress={() => { }}
          icon="help-circle"
        />
      </View>

      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  headerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  partnerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  partnerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehicleText: {
    fontSize: 12,
    color: colors.gray600,
  },
  timelineSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineMarker: {
    width: 60,
    alignItems: 'center',
    position: 'relative',
  },
  markerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    zIndex: 10,
  },
  markerLine: {
    width: 3,
    height: 60,
    position: 'absolute',
    top: 36,
    left: '50%',
    marginLeft: -1.5,
  },
  timelineContent: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: 13,
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  stepTimestamp: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  addressCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    marginLeft: spacing.sm,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  estimatedTime: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  itemsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  itemQuantity: {
    fontSize: 12,
    color: colors.gray600,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  itemTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    marginTop: spacing.sm,
  },
  itemTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  itemTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  actionsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.gray600,
  },
});

export default OrderTrackingScreen;
