// screens/buyer/NewArrivalsScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { getCategoryIcon } from '../../theme/iconography';
import { Card } from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../../theme';
import { formatPrice, formatDistance } from '../../utils/formatters';
import { getProductImageUrl, getSingleImageUrl } from '../../utils/image';
import adsService from '../../services/adsService';
import productService from '../../services/productService';
import { CATEGORIES } from '@citylocalshop/shared';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const GRID_COLUMNS = 2;

type NewArrivalsRouteParams = {
  NewArrivals: {
    lat: number;
    lng: number;
    radius: number;
  };
};

type NewArrivalsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<NewArrivalsRouteParams, 'NewArrivals'>;
};

interface Product {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  discount?: number;
  image?: string;
  images?: string[];
  shop?: { id: string; name: string };
  shopDistance_km?: number;
  category?: string;
  isSponsored?: boolean;
  sponsoredListingId?: string | null;
  inStock?: boolean;
  unit?: string;
}

// ─── Quantity Stepper (ADD → - qty +) ───────────────────
const QuantityStepper: React.FC<{
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  mrp?: number;
  image: string;
  unit: string;
}> = ({ productId, shopId, shopName, name, price, mrp, image, unit }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const cartItem = cartItems.find((ci) => ci.productId === productId);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = () => {
    addItem({
      productId,
      shopId,
      shopName,
      name,
      price,
      mrp,
      image,
      unit,
      inStock: true,
    });
  };

  const handleIncrease = () => {
    updateQuantity(productId, quantity + 1);
  };

  const handleDecrease = () => {
    if (quantity === 1) {
      removeItem(productId);
    } else {
      updateQuantity(productId, quantity - 1);
    }
  };

  if (quantity === 0) {
    return (
      <TouchableOpacity
        onPress={handleAdd}
        activeOpacity={0.8}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>ADD</Text>
        <View style={styles.addPlusIcon}>
          <Ionicons name="add" size={10} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.stepperContainer}>
      <TouchableOpacity
        onPress={handleDecrease}
        style={styles.stepperBtn}
        activeOpacity={0.7}
      >
        <Ionicons
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={quantity === 1 ? 13 : 15}
          color={colors.textInverse}
        />
      </TouchableOpacity>

      <Text style={styles.stepperCount}>{quantity}</Text>

      <TouchableOpacity
        onPress={handleIncrease}
        style={styles.stepperBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={15} color={colors.textInverse} />
      </TouchableOpacity>
    </View>
  );
};

// ─── Product Card (Vertical Grid) ───────────────────────
const ProductCard: React.FC<{
  item: Product;
  onPress: () => void;
}> = ({ item, onPress }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const [imageError, setImageError] = useState(false);
  const discount = typeof item.discount === 'number'
    ? Math.max(0, Math.round(item.discount))
    : (item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0);
  const imageUri = Array.isArray(item.images) && item.images.length > 0
    ? getProductImageUrl(item.images)
    : getSingleImageUrl(item.image);
  const isSponsored = Boolean(item.isSponsored);
  const showImage = Boolean(imageUri) && !imageError;

  useEffect(() => {
    setImageError(false);
  }, [imageUri]);

  return (
    <Animated.View
      entering={FadeInDown}
      layout={Layout}
      style={{ width: CARD_WIDTH }}
    >
      <Card
        onPress={onPress}
        style={styles.productCard}
        padding={Spacing.sm}
        shadow="md"
      >
        {/* Image */}
        <View style={styles.imageWrapper}>
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.productPhoto}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.productImageEmpty}>
              <Ionicons name="cube-outline" size={30} color={colors.primary} />
            </View>
          )}

          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          )}

          {isSponsored && (
            <View style={styles.sponsoredBadge}>
              <Ionicons name="megaphone" size={9} color={colors.textInverse} />
              <Text style={styles.sponsoredText}>Sponsored</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{formatPrice(item.price)}</Text>
            {item.mrp && item.mrp > item.price && (
              <Text style={styles.mrp}>₹{formatPrice(item.mrp)}</Text>
            )}
          </View>

          {item.shop && (
            <Text style={styles.shopName} numberOfLines={1}>
              {item.shop.name}
            </Text>
          )}

          {item.shopDistance_km !== undefined && (
            <Text style={styles.distance}>
              {formatDistance(item.shopDistance_km)}
            </Text>
          )}
        </View>

        {/* Stepper */}
        <View style={styles.stepperWrapper}>
          <QuantityStepper
            productId={item.id}
            shopId={item.shop?.id || ''}
            shopName={item.shop?.name || ''}
            name={item.name}
            price={item.price}
            mrp={item.mrp}
            image={imageUri}
            unit={item.unit || ''}
          />
        </View>
      </Card>
    </Animated.View>
  );
};

// ─── Main Screen ────────────────────────────────────────
const NewArrivalsScreen: React.FC<any> = ({ navigation, route }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const insets = useSafeAreaInsets();
  const params = route.params || { lat: 0, lng: 0, radius: 50 };

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const fetchTrendingProducts = async () => {
      try {
        const requestId = ++requestIdRef.current;
        setLoading(true);

        const [searchRes, sponsoredRes] = await Promise.allSettled([
          productService.search({
            lat: params.lat,
            lng: params.lng,
            radius: params.radius,
            sort: 'newest',
            limit: 50,
          }),
          adsService.getTrending(12),
        ]);

        if (requestId !== requestIdRef.current) return;

        let loadedProducts: Product[] =
          searchRes.status === 'fulfilled'
            ? (searchRes.value?.data?.products || [])
            : [];

        if (loadedProducts.length === 0) {
          const fallback = await productService.search({
            sort: 'newest',
            limit: 24,
          });
          loadedProducts = fallback?.data?.products || [];
        }

        const sponsoredProducts: Product[] =
          sponsoredRes.status === 'fulfilled' && Array.isArray(sponsoredRes.value)
            ? sponsoredRes.value.map((item: any) => ({
              ...item,
              isSponsored: true,
            }))
            : [];

        const byId = new Map<string, Product>();

        for (const item of sponsoredProducts) {
          if (!item?.id) continue;
          byId.set(item.id, item);
        }

        for (const item of loadedProducts) {
          if (!item?.id) continue;
          const existing = byId.get(item.id);
          byId.set(item.id, {
            ...(existing || {}),
            ...item,
            isSponsored: Boolean(existing?.isSponsored || item.isSponsored),
            sponsoredListingId:
              existing?.sponsoredListingId || item.sponsoredListingId || null,
          });
        }

        setProducts(Array.from(byId.values()));
      } catch (error) {
        console.error('Failed to fetch trending products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingProducts();
  }, [params]);

  const filteredProducts = selectedCategoryId
    ? products.filter((p) => p.category === selectedCategoryId)
    : products;

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
    [navigation]
  );

  const handleCategoryPress = useCallback((categoryId: string) => {
    setSelectedCategoryId((current) =>
      current === categoryId ? null : categoryId
    );
  }, []);

  const renderHeader = () => (
    <View>
      <Text style={styles.sectionTitle}>
        {selectedCategoryId
          ? CATEGORIES.find((c) => c.id === selectedCategoryId)?.name ||
          'New Products'
          : 'New Arrivals Near You'}
      </Text>
      <Text style={styles.sectionSubtitle}>
        {filteredProducts.length} products available
      </Text>

      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES.slice(0, 12)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isActive = selectedCategoryId === item.id;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => handleCategoryPress(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={getCategoryIcon(item.id)}
                size={16}
                color={isActive ? colors.textInverse : colors.primary}
              />
              <Text
                style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                numberOfLines={1}
              >
                {item.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.categoryList}
        style={styles.categoryScroll}
      />
    </View>
  );

  const renderProductCard = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard
        item={item}
        onPress={() => navigateToProductDetail(item.id, item.sponsoredListingId)}
      />
    ),
    [navigateToProductDetail]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.md },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Arrivals</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Products Grid */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: CARD_WIDTH }}>
              <SkeletonCard imageHeight={108} lines={2} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderProductCard}
          ListHeaderComponent={renderHeader}
          ListHeaderComponentStyle={styles.listHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sad-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.screenHorizontal,
      paddingBottom: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    listHeader: {
      paddingHorizontal: Spacing.screenHorizontal,
      paddingVertical: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.md,
    },
    categoryScroll: {
      marginBottom: Spacing.lg,
    },
    categoryList: {
      gap: 8,
      paddingRight: Spacing.screenHorizontal,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: 'rgba(13,148,136,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(13,148,136,0.15)',
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    categoryChipTextActive: {
      color: colors.surface,
    },
    gridRow: {
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.screenHorizontal,
      marginBottom: 10,
      gap: 12,
    },
    productCard: {
      borderRadius: Spacing.radius.lg,
      overflow: 'hidden',
    },
    imageWrapper: {
      position: 'relative',
      width: '100%',
      height: 108,
      backgroundColor: colors.border,
      borderRadius: 8,
      marginBottom: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    productPhoto: {
      width: '100%',
      height: '100%',
    },
    productImageEmpty: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    discountBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.error,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    discountText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.surface,
    },
    sponsoredBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: '#0F766E',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    sponsoredText: {
      fontSize: 9,
      color: colors.surface,
      fontWeight: '700',
    },
    productInfo: {
      marginBottom: 5,
    },
    productName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 15,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    price: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    mrp: {
      fontSize: 10,
      color: colors.textTertiary,
      textDecorationLine: 'line-through',
    },
    shopName: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    distance: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1,
    },
    stepperWrapper: {
      marginTop: 6,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    addButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    addPlusIcon: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.success,
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: 4,
      gap: 4,
    },
    stepperBtn: {
      width: 20,
      height: 20,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperCount: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.surface,
      textAlign: 'center',
    },
    skeletonContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.screenHorizontal,
      gap: 12,
      paddingBottom: 80,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 300,
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
};

export default NewArrivalsScreen;
