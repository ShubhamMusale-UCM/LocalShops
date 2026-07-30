import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedRN, {
  FadeInDown,
  FadeInUp,
  SlideInRight,
  Layout,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { useTheme } from '../../theme';
import { useLocationStore } from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import paymentService from '../../services/paymentService';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design System Constants ────────────────────────────
const getStyles = (colors: ReturnType<typeof useTheme>['colors'], radius: ReturnType<typeof useTheme>['radius'], shadows: ReturnType<typeof useTheme>['shadows'], isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSecure: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: isDarkMode ? '#102F20' : '#D1FAE5',
      borderRadius: radius.full,
    },
    headerSecureText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 32,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepItem: {
      alignItems: 'center',
      gap: 6,
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircleActive: {
      backgroundColor: colors.primary,
    },
    stepCircleCompleted: {
      backgroundColor: colors.success,
    },
    stepLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    stepLabelActive: {
      fontWeight: '700',
      color: colors.text,
    },
    stepLine: {
      width: 40,
      height: 2,
      backgroundColor: colors.border,
      marginHorizontal: 8,
      marginBottom: 20,
      borderRadius: 1,
    },
    stepLineActive: {
      backgroundColor: colors.success,
    },
    scrollView: {
      flex: 1,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 18,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionIconBg: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryFaded,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    addNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primaryFaded,
      borderRadius: radius.full,
    },
    addNewText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDarkMode ? '#102F20' : '#D1FAE5',
      borderColor: isDarkMode ? 'rgba(16,185,129,0.30)' : '#A7F3D0',
      marginTop: 16,
    },
    bannerIconBg: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(16,185,129,0.18)' : '#A7F3D0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successBannerText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
      flex: 1,
    },
    warningBanner: {
      backgroundColor: isDarkMode ? '#2D1F10' : '#FEF3C7',
      borderColor: isDarkMode ? 'rgba(245,158,11,0.30)' : '#FDE68A',
      marginTop: 16,
    },
    warningBannerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    bannerIconBgWarning: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(245,158,11,0.18)' : '#FDE68A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningBannerText: {
      fontSize: 13,
      fontWeight: '500',
      color: isDarkMode ? '#FBBF24' : '#92400E',
      flex: 1,
    },
    bannerTrack: {
      height: 5,
      backgroundColor: colors.background,
      borderRadius: 3,
      overflow: 'hidden',
    },
    bannerFill: {
      height: '100%',
      backgroundColor: colors.warning,
      borderRadius: 3,
    },
    emptyAddressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: radius.md,
    },
    emptyAddressText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    addressCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginTop: 14,
    },
    addressCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryFaded,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      marginRight: 12,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    addressIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    addressInfo: {
      flex: 1,
    },
    addressTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    addressLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    defaultTag: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: isDarkMode ? '#102F20' : '#D1FAE5',
      borderRadius: 4,
    },
    defaultTagText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.success,
    },
    addressText: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 2,
    },
    addressMeta: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    paymentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginBottom: 10,
    },
    paymentCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryFaded,
    },
    paymentCardDisabled: {
      opacity: 0.5,
    },
    paymentIconBg: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    paymentInfo: {
      flex: 1,
    },
    paymentName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    paymentDesc: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    comingSoonTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.full,
    },
    comingSoonText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    promoInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 4,
      marginTop: 14,
      backgroundColor: colors.backgroundAlt,
    },
    promoInputFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    promoInputApplied: {
      borderColor: colors.success,
      backgroundColor: isDarkMode ? '#102F20' : '#F0FDF4',
    },
    promoInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 10,
      letterSpacing: 1,
    },
    promoBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
    },
    promoBtnApplied: {
      backgroundColor: colors.success,
    },
    promoBtnDisabled: {
      backgroundColor: colors.border,
    },
    promoBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    promoSuccessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    promoSuccessText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    freeValue: {
      color: colors.success,
      fontWeight: '700',
    },
    discountLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
    },
    discountValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.success,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.3,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    },
    bottomLeft: {
      flex: 1,
    },
    bottomLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    bottomTotal: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    bottomHint: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textSecondary,
      marginTop: 1,
    },
    placeOrderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    placeOrderText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      overflow: 'hidden',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBody: {
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      marginBottom: 16,
      backgroundColor: colors.backgroundAlt,
    },
    modalInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalSaveBtn: {
      flex: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    modalSaveGradient: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalSaveText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
};

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  shopId: string;
  shopName: string;
  price: number;
  quantity: number;
  image: string;
}

// ─── Step Indicator ─────────────────────────────────────
const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const steps = [
    { icon: 'location-outline', label: 'Address' },
    { icon: 'card-outline', label: 'Payment' },
    { icon: 'checkmark-outline', label: 'Review' },
  ];

  return (
    <AnimatedRN.View
      entering={FadeInDown.delay(100).springify().damping(14)}
      style={styles.stepIndicator}
    >
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                idx <= currentStep && styles.stepCircleActive,
                idx < currentStep && styles.stepCircleCompleted,
              ]}
            >
              {idx < currentStep ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={step.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={14}
                  color={idx <= currentStep ? '#FFFFFF' : colors.textTertiary}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                idx <= currentStep && styles.stepLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {idx < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                idx < currentStep && styles.stepLineActive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </AnimatedRN.View>
  );
};

// ─── Section Card Wrapper ───────────────────────────────
const SectionCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}> = ({ children, delay = 0, style }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  return (
    <AnimatedRN.View
      entering={FadeInDown.delay(delay).springify().damping(14)}
      style={[styles.sectionCard, style]}
    >
      {children}
    </AnimatedRN.View>
  );
};

// ─── Main Component ─────────────────────────────────────
const CheckoutScreen: React.FC<{ route: any }> = ({ route }) => { // TODO: Add strict route type
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const navigation = useNavigation<any>(); // TODO: Replace with strict navigation type when defined
  const { cartItems, subtotal, platformFee, total } = route.params;

  const user = useAuthStore((s) => s.user);
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const city = useLocationStore((s) => s.city);
  const address = useLocationStore((s) => s.address);
  const savedPincode = useLocationStore((s) => s.pincode);
  const setLocation = useLocationStore((s) => s.setLocation);
  const pincode = savedPincode || '400001';

  const [selectedAddress, setSelectedAddress] = useState<string | null>(address || null);
  const [selectedAddressLat, setSelectedAddressLat] = useState<number>(latitude || 0);
  const [selectedAddressLng, setSelectedAddressLng] = useState<number>(longitude || 0);
  const [selectedPincode, setSelectedPincode] = useState<string>(pincode);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('razorpay');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    description?: string;
  } | null>(null);
  const [promoFocused, setPromoFocused] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const orderRequestInFlightRef = useRef(false);

  const addresses = useMemo(
    () =>
      address
        ? [
            {
              id: 'current',
              label: 'Home',
              address,
              city: city || 'Mumbai',
              pincode: pincode || '400001',
              latitude: latitude || 0,
              longitude: longitude || 0,
              isDefault: true,
              icon: 'home',
            },
          ]
        : [],
    [address, city, latitude, longitude, pincode]
  );

  useEffect(() => {
    let active = true;

    const hydrateAddressFromProfile = async () => {
      if (address && savedPincode) {
        return;
      }

      try {
        const response = await api.get('/users/profile');
        const profile = response?.data || {};
        const profileAddress = typeof profile.address === 'string' ? profile.address : null;
        const profileCity = typeof profile.city === 'string' ? profile.city : city || 'Mumbai';
        const profilePincode = typeof profile.pincode === 'string' ? profile.pincode : savedPincode || '400001';
        const profileLat = typeof profile.latitude === 'number' ? profile.latitude : latitude || 0;
        const profileLng = typeof profile.longitude === 'number' ? profile.longitude : longitude || 0;

        if (!active || !profileAddress) {
          return;
        }

        setSelectedAddress(profileAddress);
        setSelectedAddressLat(profileLat);
        setSelectedAddressLng(profileLng);
        setSelectedPincode(profilePincode);
        setLocation(profileLat, profileLng, profileAddress, profileCity, profilePincode);
      } catch {
        // Non-blocking fallback; checkout can still use locally saved address.
      }
    };

    hydrateAddressFromProfile();

    return () => {
      active = false;
    };
  }, [address, savedPincode, city, latitude, longitude, setLocation]);

  const paymentMethods = [
    {
      id: 'razorpay',
      name: 'Credit/Debit Card',
      icon: 'card-outline',
      enabled: true,
      gradient: ['#3B82F6', '#2563EB'] as [string, string],
      description: 'UPI, Cards, NetBanking',
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      icon: 'cash-outline',
      enabled: true,
      gradient: ['#10B981', '#059669'] as [string, string],
      description: 'Pay when delivered',
    },
    {
      id: 'wallet',
      name: 'Wallet',
      icon: 'wallet-outline',
      enabled: false,
      gradient: ['#8B5CF6', '#7C3AED'] as [string, string],
      description: 'Coming soon',
    },
  ];

  const finalTotal = appliedPromo ? total - appliedPromo.discount : total;
  const itemCount = cartItems.reduce(
    (sum: number, item: CartItem) => sum + item.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    if (orderRequestInFlightRef.current) {
      return;
    }

    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select an address for booking records.');
      return;
    }
    if (!selectedPincode || !/^\d{6}$/.test(selectedPincode)) {
      Alert.alert('Pincode Required', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!selectedPayment) {
      Alert.alert('Payment Required', 'Please select a payment method.');
      return;
    }

    orderRequestInFlightRef.current = true;
    setIsProcessing(true);

    try {
      const clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const orderPayload = {
        amount: finalTotal,
        clientRequestId,
        cartItems: cartItems.map((item: CartItem) => ({
          productId: item.productId,
          shopId: item.shopId,
          quantity: item.quantity,
          price: item.price,
          name: item.productName,
        })),
        deliveryAddress: {
          address: selectedAddress,
          latitude: selectedAddressLat,
          longitude: selectedAddressLng,
          pincode: selectedPincode,
        },
        paymentMethod: (selectedPayment === 'cod' ? 'COD' : 'ONLINE') as 'COD' | 'ONLINE',
        deliveryType: 'PICKUP' as 'DELIVERY' | 'PICKUP',
      };

      if (selectedPayment === 'razorpay') {
        const order = await paymentService.createProductOrder(orderPayload);
        navigation.navigate('Payment', { order, amount: finalTotal, cartItems });
      } else if (selectedPayment === 'cod') {
        const order = await paymentService.createProductOrder(orderPayload);
        const effectiveOrderId = (order as {id?: string, orderId?: string})?.id || (order as {id?: string, orderId?: string})?.orderId;
        const pickupFallback = Boolean((order as {pickupFallback?: boolean})?.pickupFallback);
        useCartStore.getState().clearCart();
        Alert.alert(
          'Order Confirmed! 🎉',
          pickupFallback
            ? `Order #${String(effectiveOrderId || '').slice(-8)} placed. This shop supports pickup only. Pay ₹${finalTotal.toFixed(0)} at pickup.`
            : `Order #${String(effectiveOrderId || '').slice(-8)} placed. Pay ₹${finalTotal.toFixed(0)} at delivery.`,
          [
            {
              text: 'Track Order',
              onPress: () =>
                navigation.navigate('OrderTracking', { orderId: effectiveOrderId }),
            },
            {
              text: 'Continue Shopping',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      }
    } catch (error: unknown) {
      const err = error as any;
      const apiError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to place order. Please try again.';
      Alert.alert('Error', apiError);
      console.error(error);
    } finally {
      setIsProcessing(false);
      orderRequestInFlightRef.current = false;
    }
  };

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    if (promoCode.toUpperCase() === 'SAVE50') {
      setAppliedPromo({
        code: 'SAVE50',
        discount: Math.min(50, subtotal * 0.1),
        description: '₹50 off on orders above ₹500',
      });
      Alert.alert('Success! 🎉', 'Promo code applied.');
    } else {
      Alert.alert('Invalid Code', 'This promo code is not valid.');
    }
  };


  // ─── Address Section ───────────
  const renderAddressSection = () => (
    <SectionCard delay={100}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconBg}>
            <Ionicons name="location" size={18} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>Booking Address</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddressModal(true)}
          style={styles.addNewBtn}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addNewText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        <TouchableOpacity
          onPress={() => setShowAddressModal(true)}
          style={styles.emptyAddressCard}
        >
          <Ionicons name="location-outline" size={24} color={colors.textTertiary} />
          <Text style={styles.emptyAddressText}>
            Tap to add a booking address
          </Text>
        </TouchableOpacity>
      ) : (
        addresses.map((addr) => {
          const isSelected = selectedAddress === addr.address;
          return (
            <TouchableOpacity
              key={addr.id}
              style={[styles.addressCard, isSelected && styles.addressCardActive]}
              onPress={() => {
                setSelectedAddress(addr.address);
                setSelectedAddressLat(addr.latitude);
                setSelectedAddressLng(addr.longitude);
                setSelectedPincode(addr.pincode);
              }}
              activeOpacity={0.85}
            >
              {/* Radio */}
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>

              {/* Icon */}
              <View
                style={[
                  styles.addressIconBg,
                  isSelected && { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Ionicons
                  name={addr.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
              </View>

              {/* Content */}
              <View style={styles.addressInfo}>
                <View style={styles.addressTopRow}>
                  <Text style={styles.addressLabel}>{addr.label}</Text>
                  {addr.isDefault && (
                    <View style={styles.defaultTag}>
                      <Text style={styles.defaultTagText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressText} numberOfLines={2}>
                  {addr.address}
                </Text>
                <Text style={styles.addressMeta}>
                  {addr.city} - {addr.pincode}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </SectionCard>
  );

  // ─── Payment Section ───────────
  const renderPaymentSection = () => (
    <SectionCard delay={200}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="card" size={18} color={colors.info} />
        </View>
        <Text style={styles.sectionTitle}>Payment Method</Text>
      </View>

      <View style={{ marginTop: 16 }}>
        {paymentMethods.map((method) => {
          const isSelected = selectedPayment === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentCard,
                isSelected && styles.paymentCardActive,
                !method.enabled && styles.paymentCardDisabled,
              ]}
              onPress={() => method.enabled && setSelectedPayment(method.id)}
              disabled={!method.enabled}
              activeOpacity={0.85}
            >
              {/* Radio */}
              <View
                style={[
                  styles.radio,
                  isSelected && method.enabled && styles.radioActive,
                ]}
              >
                {isSelected && method.enabled && <View style={styles.radioDot} />}
              </View>

              {/* Icon */}
              <LinearGradient
                colors={method.gradient}
                style={styles.paymentIconBg}
              >
                <Ionicons name={method.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color="#FFFFFF" />
              </LinearGradient>

              {/* Info */}
              <View style={styles.paymentInfo}>
                <Text
                  style={[
                    styles.paymentName,
                    !method.enabled && { color: colors.textTertiary },
                  ]}
                >
                  {method.name}
                </Text>
                <Text style={styles.paymentDesc}>{method.description}</Text>
              </View>

              {!method.enabled && (
                <View style={styles.comingSoonTag}>
                  <Text style={styles.comingSoonText}>Soon</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </SectionCard>
  );

  // ─── Promo Section ─────────────
  const renderPromoSection = () => (
    <SectionCard delay={250}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="pricetag" size={16} color={colors.warning} />
        </View>
        <Text style={styles.sectionTitle}>Promo Code</Text>
      </View>

      <View
        style={[
          styles.promoInputRow,
          promoFocused && styles.promoInputFocused,
          appliedPromo && styles.promoInputApplied,
        ]}
      >
        <Ionicons
          name="gift-outline"
          size={18}
          color={appliedPromo ? colors.success : colors.textTertiary}
        />
        <TextInput
          style={styles.promoInput}
          placeholder="Enter code"
          placeholderTextColor={colors.textTertiary}
          value={promoCode}
          onChangeText={setPromoCode}
          editable={!appliedPromo}
          onFocus={() => setPromoFocused(true)}
          onBlur={() => setPromoFocused(false)}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[
            styles.promoBtn,
            appliedPromo && styles.promoBtnApplied,
            !promoCode.trim() && !appliedPromo && styles.promoBtnDisabled,
          ]}
          onPress={
            appliedPromo
              ? () => {
                  setAppliedPromo(null);
                  setPromoCode('');
                }
              : handleApplyPromo
          }
          disabled={!promoCode.trim() && !appliedPromo}
        >
          <Text
            style={[
              styles.promoBtnText,
              appliedPromo && { color: '#FFFFFF' },
            ]}
          >
            {appliedPromo ? '✓ Applied' : 'Apply'}
          </Text>
        </TouchableOpacity>
      </View>

      {appliedPromo && (
        <View style={styles.promoSuccessRow}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.promoSuccessText}>
            {appliedPromo.description}
          </Text>
        </View>
      )}
    </SectionCard>
  );

  // ─── Order Summary ─────────────
  const renderOrderSummary = () => (
    <SectionCard delay={300}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#EDE9FE' }]}>
          <Ionicons name="receipt" size={16} color={colors.purple} />
        </View>
        <Text style={styles.sectionTitle}>Order Summary</Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Text>
          <Text style={styles.summaryValue}>₹{subtotal.toFixed(0)}</Text>
        </View>


        {platformFee > 0 && (
          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={colors.textTertiary}
              />
            </View>
            <Text style={styles.summaryValue}>₹{platformFee}</Text>
          </View>
        )}

        {appliedPromo && (
          <View style={styles.summaryRow}>
            <Text style={styles.discountLabel}>
              Discount ({appliedPromo.code})
            </Text>
            <Text style={styles.discountValue}>
              -₹{appliedPromo.discount.toFixed(0)}
            </Text>
          </View>
        )}

        <View style={styles.summaryDivider} />

        <View style={[styles.summaryRow, { marginBottom: 0 }]}>
          <Text style={styles.totalLabel}>Total to Pay</Text>
          <Text style={styles.totalValue}>₹{finalTotal.toFixed(0)}</Text>
        </View>
      </View>
    </SectionCard>
  );

  // ─── Bottom Bar ────────────────
  const renderBottomBar = () => (
    <AnimatedRN.View
      entering={FadeInUp.delay(400).springify().damping(14)}
      style={styles.bottomBar}
    >
      <View style={styles.bottomLeft}>
        <Text style={styles.bottomLabel}>Total</Text>
        <Text style={styles.bottomTotal}>₹{finalTotal.toFixed(0)}</Text>

      </View>

      <TouchableOpacity
        onPress={handlePlaceOrder}
        disabled={isProcessing || !selectedAddress || !selectedPayment}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={
            !selectedAddress || !selectedPayment
              ? [colors.textTertiary, colors.textSecondary]
              : [colors.primary, colors.primaryDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.placeOrderBtn}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>
                {selectedPayment === 'cod' ? 'Place COD Order' : 'Pay Now'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </AnimatedRN.View>
  );

  // ─── Address Modal ─────────────
  const renderAddressModal = () => (
    <Modal visible={showAddressModal} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <LinearGradient
            colors={['#35C095', '#0E8D6D']}
            style={styles.modalHeader}
          >
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="location" size={20} color="#FFFFFF" />
              <Text style={styles.modalTitle}>New Address</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddressModal(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Full Address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.modalInput}
                placeholder="House no., Street, Area..."
                placeholderTextColor={colors.textTertiary}
                value={newAddress}
                onChangeText={setNewAddress}
                multiline
              />
            </View>

            <Text style={styles.inputLabel}>Pincode</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.modalInput}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor={colors.textTertiary}
                value={newPincode}
                onChangeText={setNewPincode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddressModal(false);
                  setNewAddress('');
                  setNewPincode('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  if (newAddress.trim()) {
                    const normalizedPincode = (newPincode || pincode).trim();
                    if (!/^\d{6}$/.test(normalizedPincode)) {
                      Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit pincode.');
                      return;
                    }

                    setSelectedAddress(newAddress);
                    setSelectedAddressLat(latitude || 0);
                    setSelectedAddressLng(longitude || 0);
                    setSelectedPincode(normalizedPincode);
                    setLocation(latitude || 0, longitude || 0, newAddress.trim(), city || 'Mumbai', normalizedPincode);

                    api
                      .put('/users/profile', {
                        address: newAddress.trim(),
                        city: city || 'Mumbai',
                        pincode: normalizedPincode,
                        latitude: latitude || 0,
                        longitude: longitude || 0,
                      })
                      .catch(() => {});

                    setNewAddress('');
                    setNewPincode('');
                    setShowAddressModal(false);
                    Alert.alert('✓ Address Saved', 'Address updated.');
                  } else {
                    Alert.alert('Required', 'Please enter an address.');
                  }
                }}
              >
                <LinearGradient
                  colors={['#35C095', '#0E8D6D']}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>Save Address</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ─── Header ────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSecure}>
          <Ionicons name="shield-checkmark" size={14} color={colors.success} />
          <Text style={styles.headerSecureText}>Secure</Text>
        </View>
      </View>

      {/* ─── Step Indicator ────────────── */}
      <StepIndicator
        currentStep={selectedAddress && selectedPayment ? 2 : selectedAddress ? 1 : 0}
      />

      {/* ─── Content ───────────────────── */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
      >

        {renderAddressSection()}
        {renderPaymentSection()}
        {renderPromoSection()}
        {renderOrderSummary()}
      </ScrollView>

      {renderBottomBar()}
      {renderAddressModal()}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────

export default CheckoutScreen;
