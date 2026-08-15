import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeOut,
  Layout,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';



import { useCartStore, CartItem } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { sanitizeImageUrl, getSingleImageUrl } from '../../utils/image';
import { useTheme } from '../../theme';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design System & Dynamic Stylesheet ───────────────────
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
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    headerBadge: {
      backgroundColor: '#38BDF8',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
      minWidth: 24,
      alignItems: 'center',
    },
    headerBadgeText: {
      fontSize: 12,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    clearBtnText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#EF4444',
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      marginTop: -40,
    },
    emptyIconBg: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
      paddingHorizontal: 20,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    emptyBtnText: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    scrollView: { flex: 1 },
    shopSection: {
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      overflow: 'hidden',
    },
    shopHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    shopHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    shopIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopName: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    shopMeta: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.6)',
      marginTop: 1,
    },
    cartItemCard: {
      flexDirection: 'row',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    cartImageWrap: {
      position: 'relative',
      marginRight: 14,
    },
    cartImage: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      backgroundColor: '#050814',
    },
    cartImagePlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartDiscountTag: {
      position: 'absolute',
      top: -4,
      left: -4,
      backgroundColor: '#EF4444',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    cartDiscountText: {
      fontSize: 9,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
    },
    cartItemDetails: {
      flex: 1,
      justifyContent: 'space-between',
    },
    cartItemName: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
      lineHeight: 18,
      marginBottom: 2,
    },
    cartItemUnit: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.6)',
      marginBottom: 4,
    },
    cartPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    cartItemPrice: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    cartItemMrp: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.5)',
      textDecorationLine: 'line-through',
    },
    cartItemBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cartItemTotal: {
      fontSize: 16,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#38BDF8',
      letterSpacing: -0.3,
    },
    quantityStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      padding: 2,
    },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnPrimary: {
      backgroundColor: '#06B6D4',
    },
    stepperCount: {
      minWidth: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperCountText: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    swipeDeleteWrap: {
      width: 80,
      borderRadius: 0,
      overflow: 'hidden',
    },
    swipeDeleteGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    swipeDeleteText: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
    summaryCard: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    summaryCardInner: {
      padding: 20,
    },
    summaryTitle: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      marginBottom: 16,
      letterSpacing: -0.2,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    summaryLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    summaryFree: {
      color: '#34D399',
      fontFamily: 'Outfit_700Bold',
    },
    summaryDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 14,
    },
    summaryTotalLabel: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
    summaryTotalValue: {
      fontSize: 20,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#38BDF8',
      letterSpacing: -0.3,
    },
    savingsStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    savingsText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: '#34D399',
    },
    checkoutBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    checkoutLeft: {
      flex: 1,
    },
    checkoutLabel: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: 'rgba(255,255,255,0.6)',
    },
    checkoutTotal: {
      fontSize: 24,
      fontFamily: 'Outfit_800ExtraBold',
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    checkoutHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.5)',
      marginTop: 1,
    },
    checkoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    checkoutBtnText: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
    },
  });
};
const PLATFORM_FEE = 10;

interface ShopGroup {
  shopId: string;
  shopName: string;
  items: CartItem[];
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Animated Quantity Stepper ───────────────────────────
const QuantityStepper: React.FC<{
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}> = ({ quantity, onDecrease, onIncrease }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const scale = useSharedValue(1);
  const quantityScale = useSharedValue(1);

  const animatedQuantityStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quantityScale.value }],
  }));

  const handlePress = (callback: () => void, type: 'inc' | 'dec') => {
    quantityScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    callback();
  };

  return (
    <View style={styles.quantityStepper}>
      <TouchableOpacity
        onPress={() => handlePress(onDecrease, 'dec')}
        style={styles.stepperBtn}
        activeOpacity={0.7}
      >
        <Ionicons
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={quantity === 1 ? 14 : 16}
          color={quantity === 1 ? '#EF4444' : '#38BDF8'}
        />
      </TouchableOpacity>

      <Animated.View style={[styles.stepperCount, animatedQuantityStyle]}>
        <Text style={styles.stepperCountText}>{quantity}</Text>
      </Animated.View>

      <TouchableOpacity
        onPress={() => handlePress(onIncrease, 'inc')}
        style={[styles.stepperBtn, styles.stepperBtnPrimary]}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

// ─── Cart Item Component ────────────────────────────────
const CartItemCard: React.FC<{
  item: CartItem;
  index: number;
  onRemove: (id: string, name: string) => void;
  onDecrease: (id: string, qty: number) => void;
  onIncrease: (id: string, qty: number) => void;
}> = ({ item, index, onRemove, onDecrease, onIncrease }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const itemTotal = item.price * item.quantity;
  const savings =
    item.mrp && item.mrp > item.price
      ? (item.mrp - item.price) * item.quantity
      : 0;
  const discount =
    item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0;
  const imageUri = sanitizeImageUrl(item.image);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.swipeDeleteWrap}
      onPress={() => onRemove(item.productId, item.name)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#EF4444', '#EF4444CC']}
        style={styles.swipeDeleteGradient}
      >
        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        <Text style={styles.swipeDeleteText}>Remove</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(14)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(14)}
    >
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <View style={styles.cartItemCard}>
          {/* Image Section */}
          <View style={styles.cartImageWrap}>
            {imageUri ? (
              <Image
                source={{ uri: getSingleImageUrl(item.image) }}
                style={styles.cartImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.cartImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.6)" />
              </View>
            )}
            {discount > 0 && (
              <View style={styles.cartDiscountTag}>
                <Text style={styles.cartDiscountText}>{discount}%</Text>
              </View>
            )}
          </View>

          {/* Details Section */}
          <View style={styles.cartItemDetails}>
            <Text style={styles.cartItemName} numberOfLines={2}>
              {item.name}
            </Text>

            {item.unit && (
              <Text style={styles.cartItemUnit}>{item.unit}</Text>
            )}

            <View style={styles.cartPriceRow}>
              <Text style={styles.cartItemPrice}>₹{item.price.toFixed(0)}</Text>
              {item.mrp && item.mrp > item.price && (
                <Text style={styles.cartItemMrp}>₹{item.mrp.toFixed(0)}</Text>
              )}
            </View>

            <View style={styles.cartItemBottom}>
              <QuantityStepper
                quantity={item.quantity}
                onDecrease={() => onDecrease(item.productId, item.quantity)}
                onIncrease={() => onIncrease(item.productId, item.quantity)}
              />
              <Text style={styles.cartItemTotal}>₹{itemTotal.toFixed(0)}</Text>
            </View>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
};

// ─── Main Component ─────────────────────────────────────
export default function CartScreen() {
  const navigation = useNavigation<any>(); // TODO: Replace with strict navigation type when defined
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const insets = useSafeAreaInsets();

  const cartItems = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const user = useAuthStore((s) => s.user);

  const headerOpacity = useSharedValue(0);
  const checkoutTranslate = useSharedValue(100);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 500 });
    checkoutTranslate.value = withSpring(0, { damping: 14, stiffness: 80 });
  }, []);

  const groupedByShop = useMemo<ShopGroup[]>(() => {
    return cartItems.reduce((acc, item) => {
      let shop = acc.find((s) => s.shopId === item.shopId);
      if (!shop) {
        shop = { shopId: item.shopId, shopName: item.shopName, items: [] };
        acc.push(shop);
      }
      shop.items.push(item);
      return acc;
    }, [] as ShopGroup[]);
  }, [cartItems]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cartItems]
  );
  const itemCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems]
  );
  const deliveryFee = 0;
  const platformFee = useMemo(() => (subtotal > 0 ? PLATFORM_FEE : 0), [subtotal]);
  const total = useMemo(
    () => subtotal + platformFee,
    [subtotal, platformFee]
  );
  const totalSavings = useMemo(
    () =>
      cartItems.reduce(
        (sum, i) => sum + ((i.mrp || i.price) - i.price) * i.quantity,
        0
      ),
    [cartItems]
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [
      { translateY: interpolate(headerOpacity.value, [0, 1], [-15, 0]) },
    ],
  }));

  const checkoutAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: checkoutTranslate.value }],
  }));

  const handleCheckout = useCallback(() => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to proceed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Add items before checkout.');
      return;
    }
    navigation.navigate('Checkout', {
      cartItems,
      subtotal,
      deliveryFee,
      platformFee,
      total,
    });
  }, [user, cartItems, subtotal, deliveryFee, platformFee, total]);

  const handleRemoveItem = useCallback(
    (productId: string, name: string) => {
      Alert.alert('Remove Item', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(productId) },
      ]);
    },
    [removeItem]
  );

  const handleClearCart = useCallback(() => {
    if (cartItems.length === 0) return;
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearCart() },
    ]);
  }, [cartItems.length, clearCart]);

  const handleDecrease = useCallback(
    (productId: string, qty: number) => {
      if (qty === 1) {
        const item = cartItems.find((i) => i.productId === productId);
        if (item) handleRemoveItem(productId, item.name);
      } else {
        updateQuantity(productId, qty - 1);
      }
    },
    [updateQuantity, cartItems, handleRemoveItem]
  );

  const handleIncrease = useCallback(
    (productId: string, qty: number) => {
      updateQuantity(productId, qty + 1);
    },
    [updateQuantity]
  );

  // ─── Empty Cart ────────
  if (cartItems.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AmbientOrbs />
        <View style={{ zIndex: 10 }}>
          <GlassPanel intensity={40} style={{ borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={styles.header}>
              <GlassButton onPress={() => navigation.goBack()} style={styles.headerBtn} intensity={20}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </GlassButton>
              <Text style={styles.headerTitle}>My Cart</Text>
              <View style={{ width: 44 }} />
            </View>
          </GlassPanel>
        </View>
        <Animated.View
          entering={FadeInDown.delay(200).springify().damping(14)}
          style={styles.emptyWrap}
        >
          <View style={styles.emptyIconBg}>
            <Ionicons name="bag-outline" size={56} color="#38BDF8" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse nearby stores and add items to get started
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#06B6D4', '#0891B2']}
              style={styles.emptyBtn}
            >
              <Ionicons name="storefront-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Start Shopping</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AmbientOrbs />

      {/* ─── Header ──────────────── */}
      <Animated.View style={[headerAnimatedStyle, { zIndex: 10 }]}>
        <GlassPanel intensity={40} style={{ borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <View style={styles.header}>
            <GlassButton onPress={() => navigation.goBack()} style={styles.headerBtn} intensity={20}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </GlassButton>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>My Cart</Text>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </GlassPanel>
      </Animated.View>

      {/* ─── Scrollable Content ──── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 160 }}
      >

        {/* Shop Sections */}
        {groupedByShop.map((shop, shopIdx) => (
          <Animated.View
            key={shop.shopId}
            entering={FadeInDown.delay(shopIdx * 100 + 100)
              .springify()
              .damping(14)}
          >
            <GlassCard style={styles.shopSection} intensity={20}>
              {/* Shop Header */}
              <View style={styles.shopHeader}>
                <View style={styles.shopHeaderLeft}>
                  <View style={styles.shopIconBg}>
                    <Ionicons name="storefront" size={18} color="#06B6D4" />
                  </View>
                  <View>
                    <Text style={styles.shopName}>{shop.shopName}</Text>
                    <Text style={styles.shopMeta}>
                      {shop.items.length} {shop.items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
              </View>

              {/* Items */}
              {shop.items.map((item, idx) => (
                <CartItemCard
                  key={item.productId}
                  item={item}
                  index={idx}
                  onRemove={handleRemoveItem}
                  onDecrease={handleDecrease}
                  onIncrease={handleIncrease}
                />
              ))}
            </GlassCard>
          </Animated.View>
        ))}

        {/* ─── Order Summary ───────── */}
        <Animated.View
          entering={FadeInDown.delay(300).springify().damping(14)}
        >
          <GlassCard style={styles.summaryCard} intensity={20}>
            <View style={styles.summaryCardInner}>
              <Text style={styles.summaryTitle}>Order Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </Text>
                <Text style={styles.summaryValue}>₹{subtotal.toFixed(0)}</Text>
              </View>

              {platformFee > 0 && (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Text style={styles.summaryLabel}>Platform Fee</Text>
                    <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
                  </View>
                  <Text style={styles.summaryValue}>₹{platformFee}</Text>
                </View>
              )}

              <View style={styles.summaryDivider} />

              <View style={[styles.summaryRow, { marginBottom: 0 }]}>
                <Text style={styles.summaryTotalLabel}>Total to Pay</Text>
                <Text style={styles.summaryTotalValue}>₹{total.toFixed(0)}</Text>
              </View>

              {totalSavings > 0 && (
                <View style={styles.savingsStrip}>
                  <Ionicons name="pricetag-outline" size={14} color="#22C55E" />
                  <Text style={styles.savingsText}>
                    You're saving ₹{totalSavings.toFixed(0)} on this order!
                  </Text>
                </View>
              )}
            </View>
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* ─── Checkout Bar ────────── */}
      <Animated.View
        style={[
          styles.checkoutBar,
          checkoutAnimatedStyle,
          { paddingBottom: insets.bottom + 12 },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.checkoutLeft}>
          <Text style={styles.checkoutLabel}>Total</Text>
          <Text style={styles.checkoutTotal}>₹{total.toFixed(0)}</Text>

        </View>
        <TouchableOpacity onPress={handleCheckout} activeOpacity={0.85}>
          <LinearGradient
            colors={['#06B6D4', '#0891B2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutBtn}
          >
            <Text style={styles.checkoutBtnText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
