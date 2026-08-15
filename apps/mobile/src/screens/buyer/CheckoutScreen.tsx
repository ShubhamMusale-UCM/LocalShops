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
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design System Constants ────────────────────────────
const getStyles = (colors: ReturnType<typeof useTheme>['colors'], radius: ReturnType<typeof useTheme>['radius'], shadows: ReturnType<typeof useTheme>['shadows'], isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#050814',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    headerSecure: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: radius.full,
    },
    headerSecureText: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    stepItem: {
      alignItems: 'center',
      gap: 6,
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    stepCircleActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      borderColor: '#38BDF8',
    },
    stepCircleCompleted: {
      backgroundColor: '#10B981',
      borderColor: '#10B981',
    },
    stepLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.5)',
    },
    stepLabelActive: {
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    stepLine: {
      width: 40,
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginHorizontal: 8,
      marginBottom: 20,
      borderRadius: 1,
    },
    stepLineActive: {
      backgroundColor: '#10B981',
    },
    scrollView: {
      flex: 1,
    },
    sectionCard: {
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    sectionCardInner: {
      padding: 18,
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
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    addNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      borderRadius: radius.full,
    },
    addNewText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: '#38BDF8',
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.2)',
      marginTop: 16,
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
    },
    bannerIconBg: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successBannerText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
      flex: 1,
    },
    warningBanner: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.2)',
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
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
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningBannerText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: '#FBBF24',
      flex: 1,
    },
    bannerTrack: {
      height: 5,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    bannerFill: {
      height: '100%',
      backgroundColor: '#F59E0B',
      borderRadius: 3,
    },
    emptyAddressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
      borderStyle: 'dashed',
      borderRadius: 16,
    },
    emptyAddressText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.6)',
    },
    addressCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.05)',
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: 16,
      marginTop: 14,
    },
    addressCardActive: {
      borderColor: '#38BDF8',
      backgroundColor: 'rgba(56, 189, 248, 0.05)',
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      marginRight: 12,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: {
      borderColor: '#38BDF8',
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#38BDF8',
    },
    addressIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
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
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    defaultTag: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: 4,
    },
    defaultTagText: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
    },
    addressText: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.6)',
      lineHeight: 18,
      marginBottom: 2,
    },
    addressMeta: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.4)',
    },
    paymentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.05)',
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: 16,
      marginBottom: 10,
    },
    paymentCardActive: {
      borderColor: '#38BDF8',
      backgroundColor: 'rgba(56, 189, 248, 0.05)',
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
      backgroundColor: 'rgba(255,255,255,0.05)'
    },
    paymentInfo: {
      flex: 1,
    },
    paymentName: {
      fontSize: 14,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    paymentDesc: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.5)',
    },
    comingSoonTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: radius.full,
    },
    comingSoonText: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: 'rgba(255,255,255,0.5)',
    },
    promoInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: radius.md,
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 4,
      marginTop: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    promoInputFocused: {
      borderColor: '#38BDF8',
      backgroundColor: 'rgba(56, 189, 248, 0.05)',
    },
    promoInputApplied: {
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    promoInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
      paddingVertical: 10,
      letterSpacing: 1,
    },
    promoBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: '#38BDF8',
      borderRadius: radius.sm,
    },
    promoBtnApplied: {
      backgroundColor: '#10B981',
    },
    promoBtnDisabled: {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    promoBtnText: {
      fontSize: 13,
      fontFamily: 'Outfit_700Bold',
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
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    summaryLabel: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.6)',
    },
    summaryValue: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
    freeValue: {
      color: '#34D399',
      fontFamily: 'Outfit_700Bold',
    },
    discountLabel: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
    },
    discountValue: {
      fontSize: 14,
      fontFamily: 'Outfit_700Bold',
      color: '#34D399',
    },
    summaryDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 14,
    },
    totalLabel: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    totalValue: {
      fontSize: 20,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#38BDF8',
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
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden',
    },
    bottomLeft: {
      flex: 1,
    },
    bottomLabel: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.6)',
    },
    bottomTotal: {
      fontSize: 24,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    bottomHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.4)',
      marginTop: 1,
    },
    placeOrderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: '#38BDF8',
    },
    placeOrderText: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalSheet: {
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
      backgroundColor: '#0A0F1F',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHandle: {
      width: 48,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBody: {
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    inputLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: 'rgba(255,255,255,0.6)',
      marginBottom: 8,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      borderRadius: radius.md,
      paddingHorizontal: 16,
      marginBottom: 20,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    modalInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: '#FFFFFF',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: radius.md,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
    modalSaveBtn: {
      flex: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    modalSaveGradient: {
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: '#38BDF8',
    },
    modalSaveText: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
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
    >
      <GlassPanel intensity={20} style={styles.stepIndicator}>
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
      </GlassPanel>
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
    >
      <GlassCard style={[styles.sectionCard, style]} intensity={15}>
        <View style={styles.sectionCardInner}>
          {children}
        </View>
      </GlassCard>
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
    {
      id: 'apple_pay',
      name: Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay',
      icon: 'logo-apple',
      enabled: true,
      gradient: ['#000000', '#1A1A1A'] as [string, string],
      description: 'Fast & Secure checkout',
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
        const effectiveOrderId = (order as { id?: string, orderId?: string })?.id || (order as { id?: string, orderId?: string })?.orderId;
        const pickupFallback = Boolean((order as { pickupFallback?: boolean })?.pickupFallback);
        useCartStore.getState().clearCart();
        Alert.alert(
          'Order Confirmed! 🎉',
          pickupFallback
            ? `Order #${String(effectiveOrderId || '').slice(-8)} placed. This shop supports pickup only. Pay ₹${finalTotal.toFixed(0)} at pickup.`
            : `Order #${String(effectiveOrderId || '').slice(-8)} placed. Pay ₹${finalTotal.toFixed(0)} at delivery.`,
          [
            {
              text: 'View Orders',
              onPress: () =>
                navigation.navigate('BuyerOrders'),
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
              {method.id === 'apple_pay' && isSelected && (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <AnimatedRN.View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#06B6D4',
                    }}
                    entering={FadeInUp.springify().damping(12)}
                  />
                  <Text style={{ fontSize: 9, color: '#06B6D4', marginTop: 4, fontWeight: '700' }}>Biometric</Text>
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
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
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
              ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
              : ['#06B6D4', '#0891B2']
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
                {selectedPayment === 'cod' ? 'Place COD Order' : selectedPayment === 'apple_pay' ? (Platform.OS === 'ios' ? 'Pay with Apple' : 'Pay with Google') : 'Pay Now'}
              </Text>
              {selectedPayment === 'apple_pay' ? (
                <Ionicons name="finger-print" size={18} color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              )}
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
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
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
                      .catch(() => { });

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
                  colors={['#06B6D4', '#0891B2']}
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
      <AmbientOrbs />

      {/* ─── Header ────────────────────── */}
      <View style={{ zIndex: 10 }}>
        <GlassPanel intensity={40} style={{ borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <View style={styles.header}>
            <GlassButton
              onPress={() => navigation.goBack()}
              style={styles.headerBtn}
              intensity={20}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </GlassButton>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={styles.headerSecure}>
              <Ionicons name="shield-checkmark" size={14} color="#22C55E" />
              <Text style={styles.headerSecureText}>Secure</Text>
            </View>
          </View>
        </GlassPanel>
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
