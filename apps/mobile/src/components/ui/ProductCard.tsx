import React, { useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { fp } from '../../theme/responsive';
import { formatPrice } from '../../utils/formatters';
import { Badge } from './Badge';
import { useTheme } from '../../theme';
import { useWishlistStore } from '../../store/wishlistStore';
import { useCartStore } from '../../store/cartStore';
import { getProductImageUrl } from '../../utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  discount?: number;
  images?: string[];
  shop?: { id: string; name: string };
  shopDistance_km?: number;
  unit?: string;
}

interface ProductCardProps {
  item: any;
  width?: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  onAdd?: () => void;
}

export const ProductCard = ({ item, width, style, onPress, onAdd }: ProductCardProps) => {
  const { colors, isDarkMode } = useTheme();
  const hasDiscount = typeof item.discount === 'number' && item.discount > 0;
  const hasMRP = typeof item.mrp === 'number' && item.mrp > item.price;
  const discountPercent: number = hasDiscount
    ? item.discount!
    : hasMRP
      ? Math.round(((item.mrp! - item.price) / item.mrp!) * 100)
      : 0;
  const imageUri = getProductImageUrl(item.images) || item.images?.[0];

  const toggleItem = useWishlistStore(state => state.toggleItem);
  const items = useWishlistStore(state => state.items);
  const isSaved = items.some(entry => entry.productId === item.id);
  
  const updateQuantity = useCartStore(state => state.updateQuantity);
  const quantities = useCartStore(state => state.quantities);
  const cartQty = quantities[item.id] || 0;

  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const heartScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  const toggleSave = () => {
    toggleItem({
      productId: item.id,
      name: item.name,
      price: Number(item.price || 0),
      image: imageUri,
      shopName: item.shop?.name,
    });
    heartScale.value = withSequence(
      withSpring(1.5, { damping: 2, stiffness: 100 }),
      withSpring(1, { damping: 2, stiffness: 100 })
    );
  };

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const rippleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: interpolate(rippleOpacity.value, [0, 1], [0.5, 1.5]) }],
  }));

  const handlePressIn = (event: any) => {
    touchStart.current = {
      x: event?.nativeEvent?.pageX || 0,
      y: event?.nativeEvent?.pageY || 0,
    };
    cardScale.value = withSpring(0.97, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = (event: any) => {
    cardScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    const endX = event?.nativeEvent?.pageX || 0;
    const endY = event?.nativeEvent?.pageY || 0;
    const moved = Math.abs(endX - touchStart.current.x) > 8 || Math.abs(endY - touchStart.current.y) > 8;
    if (!moved) {
      onPress();
    }
  };

  const handleAddPressIn = () => {
    buttonScale.value = withSpring(0.92, { damping: 10, stiffness: 200 });
  };

  const handleAddPressOut = async () => {
    buttonScale.value = withSpring(1, { damping: 10, stiffness: 200 });

    setIsAdding(true);
    rippleOpacity.value = withSequence(
      withTiming(0.6, { duration: 100 }),
      withTiming(0, { duration: 300 })
    );
    
    // Auto add 1 item to cart
    if (cartQty === 0) {
      updateQuantity(item.id, 1, item.shop?.id || '');
    }
    
    if (onAdd) {
      onAdd();
    }
    setTimeout(() => setIsAdding(false), 300);
  };

  const handleIncrease = () => {
    updateQuantity(item.id, cartQty + 1, item.shop?.id || '');
  };

  const handleDecrease = () => {
    if (cartQty > 0) {
      updateQuantity(item.id, cartQty - 1, item.shop?.id || '');
    }
  };

  const getDeliveryTime = () => {
    // Simulate delivery time based on distance or random
    const minutes = Math.floor(Math.random() * (25 - 10 + 1) + 10);
    return `${minutes} min`;
  };

  return (
    <Animated.View style={[cardAnimatedStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.border },
          width ? { width } : { width: SCREEN_WIDTH * 0.42 },
          style
        ]}
      >
        {/* Ripple Effect */}
        <Animated.View style={[styles.ripple, rippleAnimatedStyle, { backgroundColor: 'rgba(34, 211, 238, 0.1)' }]} />

        <View style={[styles.imageContainer, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
          {imageUri && !imageError ? (
            <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="contain" onError={() => setImageError(true)} />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="cube-outline" size={32} color={colors.textSecondary} />
            </View>
          )}

          {discountPercent > 0 && (
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.discountBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.discountText}>{discountPercent}% OFF</Text>
            </LinearGradient>
          )}

          <TouchableOpacity
            style={[styles.heartButton, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}
            onPress={toggleSave}
            activeOpacity={0.8}
          >
            <Animated.View style={heartAnimatedStyle}>
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={16}
                color={isSaved ? colors.accent : colors.textSecondary}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>

          {item.shop && (
            <Text style={[styles.shopName, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.shop.name}
            </Text>
          )}

          <View style={styles.bottomRow}>
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: colors.accent }]}>{formatPrice(item.price)}</Text>
              {hasMRP && <Text style={[styles.mrp, { color: colors.textMuted }]}>₹{item.mrp}</Text>}
            </View>
            <Animated.View style={[styles.addButtonContainer, buttonAnimatedStyle]}>
              {cartQty > 0 ? (
                <View style={[styles.stepperContainer, { backgroundColor: colors.accent }]}>
                  <TouchableOpacity onPress={handleDecrease} style={styles.stepperBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={cartQty === 1 ? 'trash-outline' : 'remove'} size={14} color="#000" />
                  </TouchableOpacity>
                  <Text style={styles.stepperCountText}>{cartQty}</Text>
                  <TouchableOpacity onPress={handleIncrease} style={styles.stepperBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="add" size={14} color="#000" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPressIn={handleAddPressIn}
                  onPressOut={handleAddPressOut}
                  style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 1 }]}
                >
                  <Text style={[styles.addButtonText, { color: colors.accent }]}>ADD</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>

          {/* Rating and Distance Pills Row */}
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.1)' : '#FEF3C7' }]}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={[styles.pillText, { color: '#F59E0B' }]}>4.5</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: isDarkMode ? 'rgba(34,211,238,0.1)' : '#E0F2FE' }]}>
              <Ionicons name="location" size={10} color={colors.accent} />
              <Text style={[styles.pillText, { color: colors.accent }]}>
                {item.shopDistance_km ? `${item.shopDistance_km} km` : getDeliveryTime()}
              </Text>
            </View>
          </View>

        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    zIndex: 10,
  },
  imageContainer: {
    position: 'relative',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    minHeight: 36,
  },
  shopName: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
  },
  mrp: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addButtonContainer: {
    marginLeft: 8,
  },
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  addButtonText: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 64,
    justifyContent: 'space-between',
  },
  stepperBtn: {
    padding: 2,
  },
  stepperCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    marginHorizontal: 4,
  },
});