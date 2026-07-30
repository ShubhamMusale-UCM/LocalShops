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
  item: Product;
  width?: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  onAdd?: () => void;
}

export const ProductCard = ({ item, width, style, onPress, onAdd }: ProductCardProps) => {
  const hasDiscount = typeof item.discount === 'number' && item.discount > 0;
  const hasMRP = typeof item.mrp === 'number' && item.mrp > item.price;
  const discountPercent: number = hasDiscount
    ? item.discount!
    : hasMRP
      ? Math.round(((item.mrp! - item.price) / item.mrp!) * 100)
      : 0;
  const imageUri = item.images?.[0] || 'https://placehold.co/240x240/F1F5F9/64748B?text=Product';

  const [isSaved, setIsSaved] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const heartScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  const toggleSave = () => {
    setIsSaved(!isSaved);
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

    if (onAdd) {
      setIsAdding(true);
      rippleOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0, { duration: 300 })
      );
      onAdd();
      setTimeout(() => setIsAdding(false), 300);
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
          width ? { width } : { width: SCREEN_WIDTH * 0.42 },
          style
        ]}
      >
        {/* Ripple Effect */}
        <Animated.View style={[styles.ripple, rippleAnimatedStyle]} />

        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="contain" />

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
            style={styles.heartButton}
            onPress={toggleSave}
            activeOpacity={0.8}
          >
            <Animated.View style={heartAnimatedStyle}>
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={18}
                color={isSaved ? '#EF4444' : Colors.gray[400]}
              />
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.deliveryBadge}>
            <Ionicons name="time-outline" size={10} color={Colors.success} />
            <Text style={styles.deliveryText}>{getDeliveryTime()}</Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <Text style={styles.unitText} numberOfLines={1}>
            {item.unit || '1 unit'}
          </Text>

          <View style={styles.bottomRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
              {hasMRP && <Text style={styles.mrp}>₹{item.mrp}</Text>}
            </View>

            <Animated.View style={[styles.addButtonContainer, buttonAnimatedStyle]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPressIn={handleAddPressIn}
                onPressOut={handleAddPressOut}
                style={[styles.addButton, isAdding && styles.addButtonActive]}
              >
                <LinearGradient
                  colors={isAdding ? ['#22C55E', '#16A34A'] : ['#16A34A', '#15803D']}
                  style={styles.addButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isAdding ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.addButtonText}>ADD</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 12,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderRadius: 16,
    zIndex: 10,
  },
  imageContainer: {
    position: 'relative',
    height: 110,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 10,
    fontWeight: '800',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
    zIndex: 2,
  },
  deliveryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    ...Shadows.sm,
  },
  deliveryText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.success,
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 16,
    marginBottom: 2,
  },
  unitText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  mrp: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  addButtonContainer: {
    marginLeft: 8,
  },
  addButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButtonActive: {
    opacity: 0.9,
  },
  addButtonGradient: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});