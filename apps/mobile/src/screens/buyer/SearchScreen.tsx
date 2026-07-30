// screens/buyer/SearchScreen.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useSearchStore } from '../../store/searchStore';
import { useLocationStore } from '../../store/locationStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { formatPrice, formatDistance } from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/image';
import { getCategoryIcon } from '../../theme/iconography';
import productService from '../../services/productService';
import adsService from '../../services/adsService';
import { CATEGORIES } from '@citylocalshop/shared';
import { useTheme } from '../../theme';

// ─── Design System & Dynamic Stylesheet ──────────────────────────────────────────
const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchBarWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    backIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: radius.full,
      paddingHorizontal: 14,
      height: 44,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 8,
    },
    searchBarFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '400',
      paddingVertical: 0,
      includeFontPadding: false,
    },
    clearBtn: {
      padding: 2,
    },
    clearCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.textSecondary + '60',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
      position: 'relative',
    },
    filterDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    chipScroll: {
      backgroundColor: colors.surface,
      paddingVertical: 2,
    },
    chipList: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      gap: 5,
      minHeight: 34,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: 0.1,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    chipActiveDot: {
      width: 5,
      height: 5,
      borderRadius: radius.full,
      backgroundColor: 'rgba(255,255,255,0.6)',
      marginLeft: 2,
    },
    voiceHintBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginBottom: 8,
      marginTop: 2,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    voiceHintText: {
      flex: 1,
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    resultsHeaderLeft: {
      flex: 1,
    },
    resultCountText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    resultCountNum: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    resultQuery: {
      color: colors.primary,
      fontWeight: '600',
    },
    clearFilterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    clearFilterText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    gridContent: {
      paddingTop: 4,
    },
    gridRow: {
      paddingHorizontal: 16,
      gap: 12,
      justifyContent: 'space-between',
    },
    skeletonContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    productImageBox: {
      height: 120,
      backgroundColor: colors.background,
      position: 'relative',
      overflow: 'hidden',
    },
    productPhoto: {
      width: '100%',
      height: '100%',
    },
    productImageFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '15',
    },
    imageGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 30,
      backgroundColor: 'rgba(0,0,0,0.04)',
    },
    discountBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: colors.error,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    discountText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    sponsoredBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    sponsoredText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    wishlistBtn: {
      position: 'absolute',
      top: 34,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.90)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    productInfo: {
      padding: 10,
      gap: 3,
    },
    shopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    productShop: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '500',
      flex: 1,
    },
    productName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 18,
      minHeight: 36,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.3,
    },
    originalPrice: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    ratingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(245,158,11,0.10)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    ratingText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.warning || '#F59E0B',
    },
    distancePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    distanceText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
    },
    recentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    recentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    recentHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recentHeaderIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    clearAllText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
      minHeight: 48,
    },
    recentIconBox: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    recentText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    trendingSection: {
      marginTop: 24,
      gap: 12,
    },
    trendingChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    trendingChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    trendingChipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 64,
      paddingHorizontal: 32,
    },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 6,
    },
    emptyQuery: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyHint: {
      fontSize: 13,
      color: colors.textSecondary + '80',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 24,
    },
    emptyAction: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyActionText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    initialContainer: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 48,
      paddingHorizontal: 24,
    },
    initialIconBox: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    initialTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    initialSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    suggestionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'center',
    },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    suggestionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
};
// ─── Constants ────────────────────────────────────────────────────────────────
const DEBOUNCE_DELAY = 500;
const SKELETON_COUNT = 4;
const GRID_COLUMNS = 2;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

const STATUS_BAR_HEIGHT = Platform.select({
  ios: 0,
  android: StatusBar.currentHeight ?? 24,
  default: 0,
});

type SearchRouteParams = {
  Search: {
    category?: string;
    autoFocusSearch?: boolean;
    preferVoiceInput?: boolean;
  };
};

// ─── Animated Category Chip ───────────────────────────────────────────────────
const CategoryChip: React.FC<{
  item: any;
  isActive: boolean;
  onPress: () => void;
  index: number;
}> = ({ item, isActive, onPress, index }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(entryAnim, {
          toValue: 1,
          damping: 14,
          stiffness: 160,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }, index * 50);
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const categoryName = item.name.split(' ')[0];

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateX: entryTranslate }, { scale: scaleAnim }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.chip,
          isActive && styles.chipActive,
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={categoryName}
      >
        <Ionicons
          name={getCategoryIcon(item.id) as any}
          size={13}
          color={isActive ? '#FFFFFF' : colors.primary}
        />
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {categoryName}
        </Text>
        {isActive && (
          <View style={styles.chipActiveDot} />
        )}
      </Pressable>
    </Animated.View>
  );
};

// ─── Recent Search Item ───────────────────────────────────────────────────────
const RecentSearchItem: React.FC<{
  text: string;
  index: number;
  onPress: () => void;
  onRemove?: () => void;
}> = ({ text, index, onPress, onRemove }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(12)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(entryAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }, index * 60);
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateY: entryTranslate }, { scale: pressScale }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.recentItem}
        accessibilityRole="button"
        accessibilityLabel={`Search for ${text}`}
      >
        <View style={styles.recentIconBox}>
          <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
        </View>
        <Text style={styles.recentText} numberOfLines={1}>
          {text}
        </Text>
        <Ionicons
          name="add-outline"
          size={14}
          color={colors.border}
          style={{ transform: [{ rotate: '45deg' }] }}
        />
      </Pressable>
    </Animated.View>
  );
};

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard: React.FC<{
  item: any;
  index: number;
  onPress: () => void;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}> = ({ item, index, onPress, isWishlisted, onToggleWishlist }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(24)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const [imageError, setImageError] = useState(false);

  const hasDiscount = item.discount > 0;
  const hasDistance = item.shopDistance_km !== undefined;
  const isSponsored = Boolean(item.isSponsored);
  const imageUri = getProductImageUrl(item.images);
  const showImage = imageUri && !imageError;

  useEffect(() => {
    setImageError(false);
  }, [imageUri]);

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(entryAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }, Math.min(index * 80, 400));
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.96,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const originalPrice = hasDiscount
    ? Math.round(item.price / (1 - item.discount / 100))
    : null;

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateY: entryTranslate }, { scale: pressScale }],
        width: CARD_WIDTH,
        marginBottom: 12,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.productCard}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatPrice(item.price)}`}
      >
        {/* Image area */}
        <View style={styles.productImageBox}>
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.productPhoto}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.productImageFallback}>
              <Ionicons name="cube-outline" size={32} color={colors.primary} />
            </View>
          )}

          {/* Gradient overlay at bottom of image */}
          <View style={styles.imageGradient} />

          {/* Discount badge */}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount}% OFF</Text>
            </View>
          )}

          {isSponsored && (
            <View style={styles.sponsoredBadge}>
              <Ionicons name="megaphone" size={10} color="#FFFFFF" />
              <Text style={styles.sponsoredText}>Sponsored</Text>
            </View>
          )}

          {/* Wishlist button */}
          <TouchableOpacity
            onPress={(event: any) => {
              event?.stopPropagation?.();
              onToggleWishlist();
            }}
            style={styles.wishlistBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={14} color={isWishlisted ? colors.error : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Info area */}
        <View style={styles.productInfo}>
          {/* Shop name */}
          {item.shop?.name ? (
            <View style={styles.shopRow}>
              <Ionicons name="storefront-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.productShop} numberOfLines={1}>
                {item.shop.name}
              </Text>
            </View>
          ) : null}

          {/* Product name */}
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Price row */}
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
            {originalPrice ? (
              <Text style={styles.originalPrice}>
                {formatPrice(originalPrice)}
              </Text>
            ) : null}
          </View>

          {/* Distance + rating row */}
          <View style={styles.metaRow}>
            {item.averageRating ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={9} color={colors.warning || '#F59E0B'} />
                <Text style={styles.ratingText}>
                  {item.averageRating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {hasDistance ? (
              <View style={styles.distancePill}>
                <Ionicons name="location-outline" size={9} color={colors.primary} />
                <Text style={styles.distanceText}>
                  {formatDistance(item.shopDistance_km)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState: React.FC<{
  query: string;
  onClear: () => void;
}> = ({ query, onClear }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.emptyContainer,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.emptyIconCircle}>
        <Ionicons name="search-outline" size={36} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptySubtitle}>
        We couldn't find anything for{' '}
        <Text style={styles.emptyQuery}>"{query}"</Text>
      </Text>
      <Text style={styles.emptyHint}>
        Try different keywords or check your spelling
      </Text>
      <TouchableOpacity onPress={onClear} style={styles.emptyAction}>
        <Text style={styles.emptyActionText}>Clear Search</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Initial State ────────────────────────────────────────────────────────────
const InitialState: React.FC = () => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const suggestions = [
    { icon: 'pizza-outline', label: 'Food & Groceries' },
    { icon: 'shirt-outline', label: 'Fashion' },
    { icon: 'phone-portrait-outline', label: 'Electronics' },
    { icon: 'flower-outline', label: 'Home & Garden' },
  ];

  return (
    <Animated.View style={[styles.initialContainer, { opacity: opacityAnim }]}>
      <View style={styles.initialIconBox}>
        <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.initialTitle}>Discover Local</Text>
      <Text style={styles.initialSubtitle}>
        Search products from shops near you
      </Text>

      <View style={styles.suggestionsGrid}>
        {suggestions.map((s, i) => (
          <View key={i} style={styles.suggestionChip}>
            <Ionicons name={s.icon as any} size={16} color={colors.primary} />
            <Text style={styles.suggestionText}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

// ─── Skeleton Grid ────────────────────────────────────────────────────────────
const SkeletonGrid: React.FC = () => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: opacityAnim }}>
      <View style={styles.skeletonGrid}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <View key={i} style={{ width: CARD_WIDTH }}>
            <SkeletonCard imageHeight={120} lines={2} style={{ marginBottom: 12 }} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const SearchScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const route = useRoute<RouteProp<SearchRouteParams, 'Search'>>();
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useLocationStore();
  const {
    query,
    setQuery,
    addRecentSearch,
    recentSearches,
    selectedCategory,
    setCategory,
    filters,
  } = useSearchStore();

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceHintVisible, setVoiceHintVisible] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem);

  const inputRef = useRef<TextInput>(null);
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const searchRequestIdRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedRouteSignatureRef = useRef('');

  useFocusEffect(
    useCallback(() => {
      let focusTimer: ReturnType<typeof setTimeout> | null = null;

      const task = InteractionManager.runAfterInteractions(() => {
        // Small delay improves keyboard reliability after navigation transitions.
        focusTimer = setTimeout(() => {
          inputRef.current?.focus();
        }, 80);
      });

      return () => {
        task.cancel();
        if (focusTimer) {
          clearTimeout(focusTimer);
        }
      };
    }, []),
  );

  // Entry animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Search bar focus animation
  const handleFocusAnim = (focused: boolean) => {
    Animated.spring(searchBarScale, {
      toValue: focused ? 1.01 : 1,
      damping: 14,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  // ── Search logic ──
  const executeSearch = useCallback(
    async (searchQuery: string, categoryOverride?: string | null) => {
      const effectiveCategory = categoryOverride !== undefined ? categoryOverride : selectedCategory;
      const hasQuery = searchQuery.trim();
      const hasCategory = effectiveCategory;

      if (!hasQuery && !hasCategory) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        setResultCount(0);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setLoading(true);
      setSearched(true);

      try {
        const safeLat = typeof latitude === 'number' && Number.isFinite(latitude)
          ? latitude
          : undefined;
        const safeLng = typeof longitude === 'number' && Number.isFinite(longitude)
          ? longitude
          : undefined;

        const searchParams = {
          q: hasQuery || undefined,
          lat: safeLat,
          lng: safeLng,
          radius: filters.radius,
          category: effectiveCategory || undefined,
          sort: filters.sort,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          limit: 50,
        };

        const res = await productService.search(searchParams);
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        const products = res.data?.products || [];
        const total = Number(res.data?.pagination?.total || products.length);
        setResults(products);
        setResultCount(total);

        if (hasQuery) {
          addRecentSearch(searchQuery.trim());
        }
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        const status = (error as any)?.response?.status;
        if (status !== 400) {
          console.error('Search error:', error);
        }
        setResults([]);
        setResultCount(0);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [latitude, longitude, filters, selectedCategory, addRecentSearch],
  );

  const performSearch = useCallback(
    (searchQuery: string, categoryOverride?: string | null) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      searchTimerRef.current = setTimeout(() => {
        executeSearch(searchQuery, categoryOverride);
      }, DEBOUNCE_DELAY);
    },
    [executeSearch],
  );

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const params = route.params || {};
    const signature = JSON.stringify(params);
    if (signature === appliedRouteSignatureRef.current) {
      return;
    }

    appliedRouteSignatureRef.current = signature;

    const routeCategory = typeof params.category === 'string' ? params.category : null;
    if (routeCategory && routeCategory !== selectedCategory) {
      setCategory(routeCategory);
      performSearch(query, routeCategory);
    }

    if (params.autoFocusSearch) {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 80);
      });
    }

    if (params.preferVoiceInput) {
      setVoiceHintVisible(true);
    }
  }, [performSearch, query, route.params, selectedCategory, setCategory]);

  useEffect(() => {
    if (!voiceHintVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setVoiceHintVisible(false);
    }, 3500);

    return () => {
      clearTimeout(timer);
    };
  }, [voiceHintVisible]);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      performSearch(text, selectedCategory);
    },
    [setQuery, performSearch, selectedCategory],
  );

  const handleClearSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    searchRequestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setSearched(false);
    setResultCount(0);
    setLoading(false);
    inputRef.current?.focus();
  }, [setQuery]);

  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const newCategory = selectedCategory === categoryId ? null : categoryId;
      setCategory(newCategory);
      performSearch(query, newCategory);
    },
    [selectedCategory, setCategory, query, performSearch],
  );

  const navigateToProductDetail = useCallback(
    async (productId: string, sponsoredListingId?: string | null) => {
      if (sponsoredListingId) {
        try {
          await adsService.trackClick(sponsoredListingId);
        } catch (error) {
          console.warn('Sponsored click tracking failed:', error);
        }
      }
      navigation.navigate('ProductDetail', { productId });
    },
    [navigation],
  );

  const handleToggleWishlist = useCallback(
    (item: any) => {
      toggleWishlistItem({
        productId: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image: getProductImageUrl(item.images),
        shopName: item.shop?.name,
      });
    },
    [toggleWishlistItem],
  );

  // ── Render: Search bar ──
  const renderSearchBar = () => (
    <Animated.View
      style={[
        styles.searchBarWrapper,
        {
          opacity: headerOpacity,
          transform: [{ scale: searchBarScale }],
          paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0),
        },
      ]}
    >
      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backIconBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
      </Pressable>

      {/* Search input container */}
      <Animated.View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
        <Ionicons
          name="search-outline"
          size={18}
          color={isFocused ? colors.primary : colors.textSecondary}
        />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search products, shops..."
          placeholderTextColor={colors.textSecondary}
          autoFocus={false}
          showSoftInputOnFocus
          value={query}
          onChangeText={handleSearch}
          onFocus={() => {
            setIsFocused(true);
            handleFocusAnim(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            handleFocusAnim(false);
          }}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable
            onPress={handleClearSearch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
          >
            <View style={styles.clearCircle}>
              <Ionicons name="close" size={10} color="#FFFFFF" />
            </View>
          </Pressable>
        )}
      </Animated.View>

      {/* Filter button */}
      <Pressable
        style={styles.filterBtn}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
        {(filters.minPrice || filters.maxPrice) && (
          <View style={styles.filterDot} />
        )}
      </Pressable>
    </Animated.View>
  );

  // ── Render: Category chips ──
  const renderCategoryChips = () => (
    <Animated.View style={{ opacity: contentOpacity }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CategoryChip
            item={item}
            isActive={selectedCategory === item.id}
            onPress={() => handleCategoryToggle(item.id)}
            index={index}
          />
        )}
        contentContainerStyle={styles.chipList}
        style={styles.chipScroll}
      />
    </Animated.View>
  );

  // ── Render: Result count bar ──
  const renderResultsHeader = () => {
    if (!searched || loading) return null;

    return (
      <View style={styles.resultsHeader}>
        <View style={styles.resultsHeaderLeft}>
          <Text style={styles.resultCountText}>
            <Text style={styles.resultCountNum}>{resultCount}</Text>
            {' '}result{resultCount !== 1 ? 's' : ''}
            {query ? (
              <>
                {' for '}
                <Text style={styles.resultQuery}>"{query}"</Text>
              </>
            ) : null}
          </Text>
        </View>
        {selectedCategory && (
          <TouchableOpacity
            onPress={() => {
              setCategory(null);
              performSearch(query, null);
            }}
            style={styles.clearFilterBtn}
          >
            <Text style={styles.clearFilterText}>Clear filter</Text>
            <Ionicons name="close-circle" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render: Recent searches ──
  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return <InitialState />;

    return (
      <View style={styles.recentContainer}>
        {/* Section header */}
        <View style={styles.recentHeader}>
          <View style={styles.recentHeaderLeft}>
            <View style={styles.recentHeaderIcon}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
          </View>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* Items */}
        {recentSearches.slice(0, 8).map((text, index) => (
          <RecentSearchItem
            key={`${text}-${index}`}
            text={text}
            index={index}
            onPress={() => handleSearch(text)}
          />
        ))}

        {/* Trending hint */}
        <View style={styles.trendingSection}>
          <View style={styles.recentHeaderLeft}>
            <View style={[styles.recentHeaderIcon, { backgroundColor: 'rgba(245,158,11,0.10)' }]}>
              <Ionicons name="trending-up-outline" size={14} color={colors.warning || '#F59E0B'} />
            </View>
            <Text style={styles.sectionTitle}>Trending Near You</Text>
          </View>
          <View style={styles.trendingChips}>
            {['Fresh Vegetables', 'Handmade Crafts', 'Local Bakery'].map((t, i) => (
              <TouchableOpacity
                key={i}
                style={styles.trendingChip}
                onPress={() => handleSearch(t)}
              >
                <Text style={styles.trendingChipText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // ── Main content renderer ──
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          <SkeletonGrid />
        </View>
      );
    }

    if (searched && results.length === 0) {
      return <EmptyState query={query} onClear={handleClearSearch} />;
    }

    if (!searched) {
      return renderRecentSearches();
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item, index }) => (
          <ProductCard
            item={item}
            index={index}
            onPress={() => navigateToProductDetail(item.id, item.sponsoredListingId)}
            isWishlisted={wishlistItems.some((entry) => entry.productId === item.id)}
            onToggleWishlist={() => handleToggleWishlist(item)}
          />
        )}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderResultsHeader}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      {/* ── Search Header ── */}
      {renderSearchBar()}

      {/* ── Category Chips ── */}
      {renderCategoryChips()}

      {voiceHintVisible && (
        <View style={styles.voiceHintBanner}>
          <Ionicons name="mic-outline" size={14} color={colors.primary} />
          <Text style={styles.voiceHintText}>
            Tap your keyboard mic to speak your search.
          </Text>
        </View>
      )}

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Content ── */}
      <Animated.View style={[{ flex: 1 }, { opacity: contentOpacity }]}>
        {renderContent()}
      </Animated.View>
    </View>
  );
};


export default SearchScreen;
