import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography, typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import paymentService from '../../services/paymentService';
import { useCartStore } from '../../store/cartStore';

type Props = NativeStackScreenProps<any, 'Payment'>;

interface PaymentScreenRoute {
  order: any;
  amount: number;
  cartItems: any[];
}

const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { order, amount, cartItems } = route.params as PaymentScreenRoute;
  const localOrderId = (order as any)?.localOrderId || (order as any)?.orderId || (order as any)?.id;
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');
  const clearCart = useCartStore((state) => state.clearCart);

  // TODO: Integrate actual Razorpay SDK
  // For now, this is a placeholder that demonstrates the payment flow
  // BYPASS FOR TESTING: Comment out Razorpay integration to test without payment gateway
  const handleRazorpayPayment = async () => {
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      // ═══════════════════════════════════════════════════════════════════
      // TESTING BYPASS: Razorpay integration commented out for testing
      // In production, uncomment the following code:
      // ═══════════════════════════════════════════════════════════════════
      
      // const RazorpayCheckout = require('react-native-razorpay').default;
      // const options = {
      //   description: `Order ${order.id}`,
      //   image: 'https://img.razorpay.com/static/assets/logo/rzp.png',
      //   currency: 'INR',
      //   amount: amount * 100, // in paise
      //   order_id: order.id,
      //   name: 'CityLocalShop',
      //   prefill: {
      //     email: user?.email,
      //     contact: user?.phone,
      //   },
      //   timeout: 60,
      // };
      // RazorpayCheckout.open(options)
      //   .then((data: any) => handlePaymentSuccess(data))
      //   .catch((error: any) => handlePaymentError(error));

      // ═══════════════════════════════════════════════════════════════════
      // TESTING MODE: Simulate successful payment without Razorpay
      // This allows testing order flow without actual payment processing
      // ═══════════════════════════════════════════════════════════════════
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // BYPASS: Skip Razorpay verification and directly mark as successful
      // In production, call handlePaymentSuccess with Razorpay data instead
      setPaymentStatus('success');
      clearCart();
      
      // Log for testing
      console.log('✅ TEST MODE: Order payment bypassed (no Razorpay verification)');
      console.log('Order ID:', order.id);
      console.log('Amount: ₹', amount);
      console.log('Note: Order is INITIATED status. In production, backend verifies Razorpay signature.');
      
      setTimeout(() => {
        navigation.navigate('OrderTracking', { orderId: localOrderId });
      }, 2000);
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = async (razorpayData: any) => {
    try {
      // Verify payment with backend
      await paymentService.verifyPayment({
        razorpay_order_id: order.id,
        razorpay_payment_id: razorpayData.razorpay_payment_id,
        razorpay_signature: razorpayData.razorpay_signature,
        orderId: localOrderId,
      });

      setPaymentStatus('success');
      clearCart();
      
      // Navigate to order tracking after 2 seconds
      setTimeout(() => {
        navigation.navigate('OrderTracking', { orderId: localOrderId });
      }, 2000);
    } catch (error) {
      console.error('Payment verification error:', error);
      setPaymentStatus('failed');
      Alert.alert('Payment verification failed', 'Please try again or contact support.');
    }
  };

  const handlePaymentError = (error: any) => {
    setPaymentStatus('failed');
    Alert.alert(
      'Payment Failed',
      error.description || 'The payment was not completed. Please try again.',
      [
        {
          text: 'Retry',
          onPress: handleRazorpayPayment,
        },
        {
          text: 'Cancel',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return '✓';
      case 'failed':
        return '✕';
      case 'processing':
        return '⏳';
      default:
        return '💳';
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return Colors.success;
      case 'failed':
        return Colors.error;
      case 'processing':
        return Colors.primary;
      default:
        return Colors.gray[600];
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={isProcessing}>
          <Ionicons name="chevron-back" size={28} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Status Section */}
        <View style={[styles.statusSection, { backgroundColor: getStatusColor() + '15' }]}>
          <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: 64, marginBottom: Spacing.md }}>{getStatusIcon()}</Text>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {paymentStatus === 'pending' && 'Ready to Pay'}
              {paymentStatus === 'processing' && 'Processing Payment...'}
              {paymentStatus === 'success' && 'Payment Successful!'}
              {paymentStatus === 'failed' && 'Payment Failed'}
            </Text>
          </View>
        </View>

        {/* Order Summary */}
        <Card style={styles.summaryCard} shadow="md">
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value}>{order.id}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Items</Text>
          {cartItems.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemShop}>{item.shopName}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{amount.toFixed(2)}</Text>
          </View>
        </Card>

        {/* Payment Method Section */}
        {paymentStatus === 'pending' && (
          <Card style={styles.paymentMethodCard} shadow="md">
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 24, marginRight: Spacing.sm }}>💳</Text>
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            <Text style={styles.methodName}>Razorpay (Secure Payment)</Text>
            <Text style={styles.methodDescription}>
              Pay safely with Razorpay. Supports all major cards, net banking, and digital wallets.
            </Text>
          </Card>
        )}

        {/* Success Message */}
        {paymentStatus === 'success' && (
          <View style={styles.successMessage}>
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successDescription}>
              Your payment has been processed successfully. Redirecting to order tracking...
            </Text>
          </View>
        )}

        {/* Error Message */}
        {paymentStatus === 'failed' && (
          <View style={styles.errorMessage}>
            <Text style={styles.errorTitle}>Payment Failed</Text>
            <Text style={styles.errorDescription}>
              Unfortunately, your payment could not be processed. Please check your payment method and try again.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Button */}
      {paymentStatus === 'pending' && (
        <View style={styles.footer}>
          <Button
            title={`Pay ₹${amount.toFixed(2)}`}
            onPress={handleRazorpayPayment}
            loading={isProcessing}
            disabled={isProcessing}
          />
        </View>
      )}

      {paymentStatus === 'failed' && (
        <View style={styles.footer}>
          <Button
            title="Retry Payment"
            onPress={handleRazorpayPayment}
            loading={isProcessing}
            disabled={isProcessing}
            style={{ marginBottom: Spacing.md }}
          />
          <Button
            title="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={isProcessing}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.gray[900],
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  statusSection: {
    borderRadius: Spacing.radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  statusText: {
    ...typography.h4,
    fontWeight: '600',
  },
  summaryCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...typography.h5,
    color: Colors.gray[900],
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.body,
    color: Colors.gray[600],
  },
  value: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray[100],
    marginVertical: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
  },
  itemShop: {
    ...Typography.caption,
    color: Colors.gray[500],
    marginTop: 2,
  },
  itemPrice: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  totalLabel: {
    ...typography.h6,
    color: Colors.gray[900],
  },
  totalValue: {
    ...typography.h5,
    color: Colors.primary,
    fontWeight: '700',
  },
  paymentMethodCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  methodName: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  methodDescription: {
    ...Typography.bodySmall,
    color: Colors.gray[500],
    lineHeight: 18,
  },
  successMessage: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  successTitle: {
    ...Typography.h4,
    color: Colors.success,
    marginBottom: Spacing.sm,
  },
  successDescription: {
    ...Typography.body,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  errorMessage: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  errorTitle: {
    ...Typography.h4,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  errorDescription: {
    ...Typography.body,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
});

export default PaymentScreen;
