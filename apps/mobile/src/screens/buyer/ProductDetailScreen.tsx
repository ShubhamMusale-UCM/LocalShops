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
import { useAuthStore } from '../../store/authStore';
import { formatPrice, formatDistance, isShopOpen, formatRating } from '../../utils/formatters';
import { openDirections, openWhatsApp, makeCall } from '../../utils/helpers';
import { getProductImageUrl, getSingleImageUrl, sanitizeImageUrl } from '../../utils/image';
import { useTheme } from '../../theme';
import productService from '../../services/productService';
import telemetryService from '../../services/telemetryService';
import { MorphingButton } from '../../components/ui/MorphingButton';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { KineticOrbProjectile } from '../../components/ui/KineticOrbProjectile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 300;
const COLLAPSED_HEADER_HEIGHT = 100;

type Props = NativeStackScreenProps<any, 'ProductDetail'>;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ProductDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const { productId, campaignId, keyword } = route.params as { productId: string, campaignId?: string, keyword?: string };
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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

  useEffect(() => {
    if (campaignId && productId) {
      telemetryService.trackView(campaignId, productId);
    }
  }, [campaignId, productId]);

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
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
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
        campaignId: campaignId || undefined,
      });

      // Fire cart_add synchronously — only on first add, no stale closure risk
      if (campaignId) {
        telemetryService.trackCartAdd(campaignId, product.id, keyword);
      }
    }
  }, [product, addItem, updateQuantity, quantity, cartItem, campaignId, keyword]);

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
      <GlassPanel intensity={40} style={styles.iconButtonWrapper}>
        <TouchableOpacity style={styles.iconButton} onPress={handleGoBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
        </TouchableOpacity>
      </GlassPanel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassPanel intensity={40} style={styles.iconButtonWrapper}>
          <TouchableOpacity style={styles.iconButton} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={22} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
          </TouchableOpacity>
        </GlassPanel>
        <GlassPanel intensity={40} style={styles.iconButtonWrapper}>
          <TouchableOpacity style={styles.iconButton} onPress={handleToggleWishlist} activeOpacity={0.8}>
            <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={22} color={isWishlisted ? '#EF4444' : '#FFFFFF'} />
          </TouchableOpacity>
        </GlassPanel>
      </View>
    </Animated.View>
  );

  const renderImageGallery = () => {
    const images = galleryImages;
    const selectedIndex = Math.min(selectedImageIndex, images.length - 1);

    return (
      <View style={styles.galleryContainer}>
        <GlassCard intensity={20} style={styles.imageCard}>
          <Animated.Image
            source={{ uri: images[selectedIndex] }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </GlassCard>

        {images.length > 1 && (
          <View style={styles.thumbnailContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={images}
              keyExtractor={(_, idx) => String(idx)}
              contentContainerStyle={styles.thumbnailContent}
              renderItem={({ item: img, index }) => (
                <TouchableOpacity
                  onPress={() => setSelectedImageIndex(index)}
                  activeOpacity={0.8}
                >
                  <GlassCard intensity={30} style={[styles.thumbnail, selectedImageIndex === index && styles.thumbnailActive]}>
                    <Image source={{ uri: getSingleImageUrl(img) }} style={styles.thumbnailImage} />
                  </GlassCard>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    );
  };

  const renderProductInfo = () => {
    return (
      <Animated.View entering={FadeInDown} style={styles.infoContainer}>
        <View style={styles.metaRow}>
          <View style={styles.stockBadge}>
            <View style={styles.stockDot} />
            <Text style={styles.stockText}>IN STOCK • EXPRESS AIR</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={styles.ratingText}>{formatRating(product.averageRating || 0)}</Text>
          </View>
        </View>

        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.description}>{product.description}</Text>

        <View style={styles.statsRow}>
          <GlassPanel intensity={20} style={styles.statPanel}>
            <Text style={styles.statValue}>{product._count?.reviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </GlassPanel>
          <GlassPanel intensity={20} style={styles.statPanel}>
            <Text style={styles.statValue}>{product._count?.orderItems || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </GlassPanel>
          <GlassPanel intensity={20} style={styles.statPanel}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Verified</Text>
          </GlassPanel>
        </View>

        <GlassCard intensity={25} style={styles.deliveryInfoCard}>
          <View style={styles.deliveryIconWrapper}>
            <Ionicons name="rocket-outline" size={20} color="#38BDF8" />
          </View>
          <View style={styles.deliveryTextWrapper}>
            <Text style={styles.deliveryTitle}>Lightning Delivery</Text>
            <Text style={styles.deliverySub}>Expected in 10-15 minutes</Text>
          </View>
        </GlassCard>
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
        <GlassCard style={styles.shopCard} intensity={25} onPress={() => handleNavigateToShop(shop.id)}>
          <View style={styles.shopRow}>
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

            <Ionicons name="chevron-forward" size={20} color="#06B6D4" />
          </View>

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
                  <Ionicons name="logo-whatsapp" size={18} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
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
                <Ionicons name="call-outline" size={18} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
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
                <Ionicons name="navigate-outline" size={18} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
                <Text style={styles.actionText}>Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </GlassCard>
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
            <GlassCard
              key={comp.id}
              style={styles.compareCard}
              intensity={25}
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

                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </GlassCard>
          );
        })}
      </Animated.View>
    );
  };

  const renderReviews = () => {
    if (!product?.reviews || product.reviews.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        {product.reviews.map((review: any) => (
          <GlassCard key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewerInfo}>
                {review.user?.avatar ? (
                  <Image source={{ uri: sanitizeImageUrl(review.user.avatar) || undefined }} style={styles.reviewerAvatar} />
                ) : (
                  <View style={[styles.reviewerAvatar, styles.reviewerAvatarPlaceholder]}>
                    <Text style={styles.reviewerAvatarText}>{review.user?.name?.charAt(0) || 'U'}</Text>
                  </View>
                )}
                <View style={styles.reviewerMeta}>
                  <Text style={styles.reviewerName}>{review.user?.name || 'Anonymous'}</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.rating ? 'star' : 'star-outline'}
                        size={12}
                        color="#FBBF24"
                      />
                    ))}
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              {review.isVerifiedPurchase && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                </View>
              )}
            </View>
            
            {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
            <Text style={styles.reviewComment}>{review.comment}</Text>
            
            {review.photos && review.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotos}>
                {review.photos.map((photo: string, idx: number) => (
                  <Image key={idx} source={{ uri: sanitizeImageUrl(photo) || undefined }} style={styles.reviewPhoto} />
                ))}
              </ScrollView>
            )}
          </GlassCard>
        ))}
      </Animated.View>
    );
  };

  const renderBottomBar = () => (
    <Animated.View
      entering={FadeInUp.delay(60)}
      style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}
    >
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[styles.bottomBarContent, { paddingBottom: insets.bottom + 12 }]}>
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
              <Ionicons name="add" size={18} color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
            </TouchableOpacity>
          </View>

          <MorphingButton
            title={cartItem ? 'Update Cart' : 'Add to Cart'}
            onPress={handleAddToCart}
            defaultBgColor={product.inStock ? '#06B6D4' : '#9CA3AF'}
            defaultTextColor="#FFFFFF"
            activeBgColor="#22C55E" // success green
            icon={cartItem ? 'refresh-outline' : 'cart-outline'}
            style={{ flex: 1, marginLeft: 16 }}
          />
        </View>
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
      <AmbientOrbs />
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
        {renderReviews()}
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
      backgroundColor: isDarkMode ? '#050814' : '#F8FAFC'
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
    iconButtonWrapper: {
      borderRadius: 99,
      overflow: 'hidden',
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    galleryContainer: {
      marginTop: 64,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    imageCard: {
      width: '100%',
      height: 280,
      borderRadius: 32,
      overflow: 'hidden',
      padding: 0,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    thumbnailContainer: {
      marginTop: 16,
    },
    thumbnailContent: {
      gap: 12,
    },
    thumbnail: {
      width: 64,
      height: 64,
      borderRadius: 16,
      padding: 0,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    thumbnailActive: {
      borderColor: '#38BDF8',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    infoContainer: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    stockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      gap: 6,
    },
    stockDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34D399',
    },
    stockText: {
      fontSize: 10,
      fontFamily: 'Outfit_700Bold',
      color: '#34D399',
      letterSpacing: 0.5,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingText: {
      fontSize: 14,
      fontFamily: 'Outfit_700Bold',
      color: '#FBBF24',
    },
    productName: {
      fontSize: 28,
      fontFamily: 'Outfit_700Bold',
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
      marginBottom: 8,
      lineHeight: 34,
    },
    description: {
      fontSize: 14,
      fontFamily: 'Inter_300Light',
      color: 'rgba(255,255,255,0.6)',
      lineHeight: 22,
      marginBottom: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    statPanel: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    statValue: {
      fontSize: 18,
      fontFamily: 'Outfit_700Bold',
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.5)',
      marginTop: 4,
    },
    deliveryInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    deliveryIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deliveryTextWrapper: {
      flex: 1,
    },
    deliveryTitle: {
      fontSize: 14,
      fontFamily: 'Outfit_700Bold',
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
      marginBottom: 2,
    },
    deliverySub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: 'rgba(255,255,255,0.5)',
    },
    shopCard: {
      margin: 16,
      borderWidth: 0,
    },
    shopRow: {
      padding: 16,
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
      marginTop: 0,
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)'
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
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 24,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: 'Outfit_700Bold',
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
      marginBottom: 16,
    },
    compareCard: {
      marginBottom: 8,
      borderWidth: 0,
    },
    compareRow: {
      padding: 12,
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
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.15)',
      overflow: 'hidden',
    },
    bottomBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
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
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
    },
    addToCartButton: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    addToCartText: {
      color: isDarkMode ? '#FFFFFF' : '#0F172A',
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
    reviewCard: {
      padding: 16,
      marginBottom: 12,
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    reviewerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reviewerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    reviewerAvatarPlaceholder: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    reviewerAvatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    reviewerMeta: {
      justifyContent: 'center',
    },
    reviewerName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    reviewDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 6,
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
    },
    reviewTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    reviewComment: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    reviewPhotos: {
      flexDirection: 'row',
    },
    reviewPhoto: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 8,
    },
  });
};

export default ProductDetailScreen;
