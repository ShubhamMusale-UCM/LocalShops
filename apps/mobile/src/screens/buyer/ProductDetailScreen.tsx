import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  Layout,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { Typography } from '../../theme/typography';


import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { formatPrice, formatDistance, isShopOpen, formatRating } from '../../utils/formatters';
import { openDirections, openWhatsApp, makeCall } from '../../utils/helpers';
import { getProductImageUrl, getSingleImageUrl, sanitizeImageUrl } from '../../utils/image';
import { useTheme } from '../../theme';
import productService from '../../services/productService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 300;
const COLLAPSED_HEADER_HEIGHT = 100;

type Props = NativeStackScreenProps<any, 'ProductDetail'>;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ProductDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const { productId } = route.params as { productId: string };
  const insets = useSafeAreaInsets();

  // State management
  const [product, setProduct] = useState<any>(null);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);
  const addButtonScale = useSharedValue(1);

  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem);
  const cartItem = useMemo(
    () => cartItems.find((item) => item.productId === product?.id),
    [cartItems, product?.id]
  );
  const isWishlisted = useMemo(
    () => wishlistItems.some((item) => item.productId === product?.id),
    [wishlistItems, product?.id]
  );
  const galleryImages = useMemo(() => {
    const normalized = Array.isArray(product?.images)
      ? product.images.map((img: string) => sanitizeImageUrl(img)).filter(Boolean)
      : [];

    return normalized.length
      ? (normalized as string[])
      : ['https://placehold.co/900x900/F1F5F9/64748B?text=Product'];
  }, [product?.images]);

  useEffect(() => {
    setQuantity(cartItem?.quantity || 1);
  }, [cartItem?.quantity]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (galleryImages.length <= 1) {
      if (slideTimerRef.current) {
        clearInterval(slideTimerRef.current);
        slideTimerRef.current = null;
      }
      return;
    }

    slideTimerRef.current = setInterval(() => {
      setSelectedImageIndex((index) => (index + 1) % galleryImages.length);
    }, 3500);

    return () => {
      if (slideTimerRef.current) {
        clearInterval(slideTimerRef.current);
        slideTimerRef.current = null;
      }
    };
  }, [galleryImages.length]);

  // Data fetching
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const [prodRes, compRes] = await Promise.all([
          productService.getById(productId),
          productService.compare(productId),
        ]);

        setProduct(prodRes.data);
        setComparisons(compRes.data || []);
      } catch (error) {
        console.error('Product fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Handlers
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        title: product.name,
        message: `Check out ${product.name} at ₹${product.price} on CityLocalShop!`,
        url: `https://citylocalshop.com/product/${product.id}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleToggleWishlist = () => {
    if (!product) return;

    toggleWishlistItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price || 0),
      image: getProductImageUrl(product.images),
      shopName: product.shop?.name,
    });
  };

  const goToPrevImage = useCallback(() => {
    setSelectedImageIndex((index) => {
      const total = galleryImages.length;
      return total <= 1 ? index : (index - 1 + total) % total;
    });
  }, [galleryImages.length]);

  const goToNextImage = useCallback(() => {
    setSelectedImageIndex((index) => {
      const total = galleryImages.length;
      return total <= 1 ? index : (index + 1) % total;
    });
  }, [galleryImages.length]);

  const handleAddToCart = useCallback(() => {
    if (!product) return;

    const shop = product.shop;

    if (cartItem) {
      updateQuantity(product.id, quantity);
    } else {
      addItem({
        productId: product.id,
        shopId: product.shopId,
        shopName: shop?.name || '',
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        image: getProductImageUrl(product.images),
        unit: product.unit,
        inStock: product.inStock,
      });
    }

    addButtonScale.value = withSequence(
      withSpring(0.95),
      withSpring(1)
    );

    // Show success feedback
    Alert.alert(
      'Added to Cart',
      `${product.name} has been added to your cart.`,
      [{ text: 'View Cart', onPress: () => navigation.navigate('Cart') }, { text: 'Continue', style: 'cancel' }]
    );
  }, [product, addItem, updateQuantity, quantity, cartItem]);

  const incrementQuantity = useCallback(() => {
    setQuantity((value) => value + 1);
  }, []);

  const decrementQuantity = useCallback(() => {
    setQuantity((value) => Math.max(1, value - 1));
  }, []);

  const handleNavigateToShop = useCallback((shopId: string) => {
    navigation.navigate('ShopProfile', { shopId });
  }, [navigation]);

  const handleNavigateToComparison = useCallback((comparisonProductId: string) => {
    navigation.push('ProductDetail', { productId: comparisonProductId });
  }, [navigation]);

  const handleWhatsAppContact = useCallback((whatsapp: string) => {
    if (!product) return;
    openWhatsApp(whatsapp, `Hi, I'm interested in ${product.name}`);
  }, [product]);

  const handleCallShop = useCallback((phone: string) => {
    makeCall(phone);
  }, []);

  const handleGetDirections = useCallback((lat: number, lng: number, name: string) => {
    openDirections(lat, lng, name);
  }, []);

  // Calculate discount
  const calculateDiscount = useCallback((price: number, mrp: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  }, []);

  // Animation styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [0, -50]) }],
  }));

  const addButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addButtonScale.value }],
  }));

  // Render functions
  const renderLoading = () => (
    <View style={styles.container}>
      <SkeletonCard />
    </View>
  );

  const renderNotFound = () => (
    <View style={[styles.container, styles.center]}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyText}>Product not found</Text>
      <Button title="Go Back" onPress={handleGoBack} style={styles.goBackButton} />
    </View>
  );

  const renderBackButton = () => (
    <Animated.View style={[styles.backButtonContainer, { top: insets.top + 12 }, headerAnimatedStyle]}>
      <TouchableOpacity style={styles.iconButton} onPress={handleGoBack} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={22} color="#1F2937" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton} onPress={handleShare} activeOpacity={0.8}>
        <Ionicons name="share-outline" size={22} color="#1F2937" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderImageGallery = () => {
    const images = galleryImages;
    const selectedIndex = Math.min(selectedImageIndex, images.length - 1);

    return (
      <View style={styles.galleryContainer}>
        <Animated.Image
          source={{ uri: images[selectedIndex] }}
          style={styles.heroImage}
          resizeMode="contain"
        />

        {images.length > 1 && (
          <>
            <TouchableOpacity style={[styles.galleryNavBtn, styles.galleryNavLeft]} onPress={goToPrevImage}>
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.galleryNavBtn, styles.galleryNavRight]} onPress={goToNextImage}>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.galleryDotsWrap}>
              {images.map((_, index) => (
                <View key={index} style={[styles.galleryDot, index === selectedIndex && styles.galleryDotActive]} />
              ))}
            </View>
          </>
        )}

        {images.length > 1 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={images}
            keyExtractor={(_, idx) => String(idx)}
            style={styles.thumbnailContainer}
            contentContainerStyle={styles.thumbnailContent}
            renderItem={({ item: img, index }) => (
              <TouchableOpacity
                onPress={() => setSelectedImageIndex(index)}
                style={[
                  styles.thumbnail,
                  selectedImageIndex === index && styles.thumbnailActive
                ]}
              >
                <Image source={{ uri: getSingleImageUrl(img) }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  };

  const renderProductInfo = () => {
    const hasBrand = Boolean(product.brand);
    const hasMRP = product.mrp && product.mrp > product.price;
    const discount = hasMRP
      ? product.discount || calculateDiscount(product.price, product.mrp)
      : 0;

    return (
      <Animated.View entering={FadeInDown} style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.productName}>{product.name}</Text>
          <TouchableOpacity onPress={handleToggleWishlist} style={styles.wishlistIcon}>
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={24}
              color={isWishlisted ? '#EF4444' : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {hasBrand && (
          <Badge text={product.brand} variant="secondary" style={styles.brandBadge} />
        )}

        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {hasMRP && (
              <Text style={styles.mrp}>₹{product.mrp}</Text>
            )}
            {discount > 0 && (
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.discountBadge}
              >
                <Text style={styles.discountText}>{discount}% OFF</Text>
              </LinearGradient>
            )}
          </View>

          {hasMRP && (
            <Text style={styles.savingsText}>
              You save ₹{(product.mrp - product.price).toFixed(2)} ({discount}%)
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>⭐ {formatRating(product.averageRating || 0)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>{product._count?.reviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>{product._count?.orderItems || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
        </View>

        <View style={styles.deliveryInfo}>
          <Ionicons name="time-outline" size={20} color={colors.success} />
          <Text style={styles.deliveryText}>
            Delivery in 10-15 minutes • Free delivery above ₹500
          </Text>
        </View>

        <Text style={styles.description}>{product.description}</Text>
      </Animated.View>
    );
  };

  const renderShopCard = () => {
    const shop = product.shop;
    if (!shop) return null;

    const openStatus = isShopOpen(shop.operatingHours);
    const rating = formatRating(shop.averageRating || 0);

    return (
      <Animated.View entering={FadeInUp.delay(100)}>
        <Card style={styles.shopCard} shadow="md">
          <TouchableOpacity
            onPress={() => handleNavigateToShop(shop.id)}
            style={styles.shopRow}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isDarkMode ? [colors.background, colors.background] : ['#CCFBF1', '#F0FDF4']}
              style={styles.shopAvatar}
            >
              {sanitizeImageUrl(shop.logo) ? (
                <Image source={{ uri: getSingleImageUrl(shop.logo) }} style={styles.shopAvatarImage} />
              ) : (
                <Ionicons name="storefront" size={28} color={colors.primary} />
              )}
            </LinearGradient>

            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{shop.name}</Text>

              <View style={styles.shopMeta}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.shopRating}>{rating}</Text>
                </View>
                <View style={styles.dot} />
                <View style={[styles.statusDot, { backgroundColor: openStatus.isOpen ? colors.success : colors.error }]} />
                <Text style={[styles.openText, { color: openStatus.isOpen ? colors.success : colors.error }]}>
                  {openStatus.message}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.shopActions}>
            {shop.whatsapp && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleWhatsAppContact(shop.whatsapp)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#25D366', '#128C7E']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCallShop(shop.phone)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.actionGradient}
              >
                <Ionicons name="call-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionText}>Call</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleGetDirections(shop.latitude, shop.longitude, shop.name)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.actionGradient}
              >
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionText}>Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderComparisons = () => {
    if (comparisons.length === 0) return null;

    return (
      <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
        <Text style={styles.sectionTitle}>
          Better Prices Nearby ({comparisons.length} shops)
        </Text>

        {comparisons.map((comp, idx) => {
          const shopRating = formatRating(comp.shop?.averageRating || 0);
          const priceDiff = comp.price < product.price ? product.price - comp.price : 0;

          return (
            <Card
              key={comp.id}
              style={styles.compareCard}
              shadow="sm"
              onPress={() => handleNavigateToComparison(comp.id)}
            >
              <View style={styles.compareRow}>
                <View style={styles.compareInfo}>
                  <Text style={styles.compareName} numberOfLines={1}>
                    {comp.shop?.name}
                  </Text>
                  <View style={styles.compareRatingRow}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={styles.compareRating}>{shopRating}</Text>
                    <Text style={styles.compareDistance}>
                      • {formatDistance(comp.shopDistance_km || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.comparePriceContainer}>
                  <Text style={styles.comparePrice}>
                    {formatPrice(comp.price)}
                  </Text>
                  {priceDiff > 0 && (
                    <Text style={styles.priceDiff}>Save ₹{priceDiff}</Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </Card>
          );
        })}
      </Animated.View>
    );
  };

  const renderBottomBar = () => (
    <Animated.View
      entering={FadeInUp.delay(60)}
      style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }, shadows.xl]}
    >
      <View style={styles.bottomLeft}>
        <Text style={styles.bottomPrice}>
          {formatPrice(product.price * quantity)}
        </Text>
        {product.mrp && product.mrp > product.price && (
          <Text style={styles.bottomMrp}>₹{(product.mrp * quantity).toFixed(2)}</Text>
        )}
        <Text style={styles.pricePerUnit}>
          {product.unit || 'per item'}
        </Text>
      </View>

      <View style={styles.bottomRight}>
        <View style={styles.quantityStepper}>
          <TouchableOpacity
            onPress={decrementQuantity}
            style={styles.quantityBtn}
            activeOpacity={0.8}
            disabled={quantity <= 1}
          >
            <Ionicons
              name="remove"
              size={18}
              color={quantity <= 1 ? colors.textSecondary : '#FFFFFF'}
            />
          </TouchableOpacity>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <TouchableOpacity
            onPress={incrementQuantity}
            style={styles.quantityBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Animated.View style={addButtonAnimatedStyle}>
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={!product.inStock}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={product.inStock ? [colors.primary, colors.primary + 'DD'] : ['#9CA3AF', '#6B7280']}
              style={styles.addToCartButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.addToCartText}>
                {cartItem ? 'Update Cart' : 'Add to Cart'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );

  // Main render logic
  if (loading) {
    return renderLoading();
  }

  if (!product) {
    return renderNotFound();
  }

  return (
    <View style={styles.container}>
      <AnimatedScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {renderImageGallery()}
        {renderProductInfo()}
        {renderShopCard()}
        {renderComparisons()}
        <View style={{ height: 100 }} />
      </AnimatedScrollView>

      {renderBackButton()}
      {renderBottomBar()}
    </View>
  );
};

const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    scrollView: {
      flex: 1,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    backButtonContainer: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      zIndex: 10,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface + 'F0',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    galleryContainer: {
      backgroundColor: colors.surface,
    },
    heroImage: {
      width: '100%',
      height: 340,
      backgroundColor: colors.background,
    },
    galleryNavBtn: {
      position: 'absolute',
      top: '45%',
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(15,23,42,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    galleryNavLeft: {
      left: 16,
    },
    galleryNavRight: {
      right: 16,
    },
    galleryDotsWrap: {
      position: 'absolute',
      bottom: 84,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    galleryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    galleryDotActive: {
      width: 16,
      borderRadius: 8,
      backgroundColor: '#FFFFFF',
    },
    thumbnailContainer: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
    },
    thumbnailContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      overflow: 'hidden',
      ...shadows.sm,
    },
    thumbnailActive: {
      borderColor: colors.primary,
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    infoContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      marginTop: -20,
      padding: 16,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    productName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 16,
      lineHeight: 32,
    },
    wishlistIcon: {
      padding: 4,
    },
    brandBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    priceSection: {
      marginTop: 16,
      paddingVertical: 8,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    price: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
    },
    mrp: {
      fontSize: 16,
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    discountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    discountText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    savingsText: {
      fontSize: 13,
      color: colors.success,
      fontWeight: '600',
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderRadius: radius.md
    },
    stat: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border
    },
    deliveryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      padding: 12,
      backgroundColor: isDarkMode ? '#102F20' : '#F0FDF4',
      borderRadius: radius.md,
    },
    deliveryText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.success,
      flex: 1,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 16,
      lineHeight: 22,
    },
    shopCard: {
      margin: 16,
      padding: 16,
    },
    shopRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    shopAvatar: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
      overflow: 'hidden',
    },
    shopAvatarImage: {
      width: '100%',
      height: '100%',
    },
    shopInfo: {
      flex: 1,
    },
    shopName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    shopMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shopRating: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.border,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    openText: {
      fontSize: 13,
      fontWeight: '500',
    },
    shopActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    actionBtn: {
      flex: 1,
      marginHorizontal: 4,
      borderRadius: 10,
      overflow: 'hidden',
    },
    actionGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    compareCard: {
      marginBottom: 8,
      padding: 12,
    },
    compareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    compareInfo: {
      flex: 1,
    },
    compareName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    compareRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    compareRating: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    compareDistance: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    comparePriceContainer: {
      alignItems: 'flex-end',
      marginRight: 8,
    },
    comparePrice: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    priceDiff: {
      fontSize: 11,
      color: colors.success,
      fontWeight: '600',
      marginTop: 2,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      ...shadows.lg,
    },
    bottomLeft: {
      flex: 1,
    },
    bottomPrice: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
    },
    bottomMrp: {
      fontSize: 13,
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
      marginTop: 2,
    },
    pricePerUnit: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    bottomRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    quantityStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    quantityBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quantityValue: {
      minWidth: 32,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    addToCartButton: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    addToCartText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    goBackButton: {
      marginTop: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
      textAlign: 'center',
    },
  });
};

export default ProductDetailScreen;
