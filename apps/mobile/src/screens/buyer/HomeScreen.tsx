import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import MapPickerModal from '../../components/ui/MapPickerModal';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';

// Store imports
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useSearchStore } from '../../store/searchStore';

// Service imports
import productService from '../../services/productService';
import shopService from '../../services/shopService';

// Theme & Utils
import { useTheme } from '../../theme';
import { formatPrice } from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Local 3D Assets Mapping ────────────────────────────────────────────────
const IMAGES = {
  avatar: require('../../assets/avatar.png'),
  productsIcon: require('../../assets/products_icon.png'),
  shopsIcon: require('../../assets/shops_icon.png'),
  exploreIcon: require('../../assets/explore_icon.png'),
  catFruitsVeggies: require('../../assets/cat_fruits_veggies.png'),
  catDairyEggs: require('../../assets/cat_dairy_eggs.png'),
  catSnacksMunchies: require('../../assets/cat_snacks_munchies.png'),
  catBeverages: require('../../assets/cat_beverages.png'),
  catElectronics: require('../../assets/cat_electronics.png'),
  catFashion: require('../../assets/cat_fashion.png'),
  catHome: require('../../assets/cat_home.png'),
  catBeauty: require('../../assets/cat_beauty.png'),
  catSports: require('../../assets/cat_sports.png'),
  catToys: require('../../assets/cat_toys.png'),
  dealSaver: require('../../assets/deal_saver.png'),
  dealLightning: require('../../assets/deal_lightning.png'),
  prodMilk: require('../../assets/prod_milk.png'),
  prodBread: require('../../assets/prod_bread.png'),
  prodBananas: require('../../assets/prod_bananas.png'),
  prodApple: require('../../assets/prod_apple.png'),
};

// ─── Preset Locations (Bengaluru - Matches Seeding) ──────────────────────────
const PRESET_LOCATIONS = [
  { label: 'Home - Residency Road, Bengaluru', lat: 12.9770, lng: 77.6030, city: 'Bengaluru', pincode: '560001' },
  { label: 'Office - Green Layout, Bengaluru', lat: 12.9660, lng: 77.6110, city: 'Bengaluru', pincode: '560025' },
  { label: 'Indiranagar - Bengaluru', lat: 12.9784, lng: 77.6408, city: 'Bengaluru', pincode: '560038' },
  { label: 'Koramangala - Bengaluru', lat: 12.9352, lng: 77.6244, city: 'Bengaluru', pincode: '560034' },
];

const SEARCH_PLACEHOLDERS = [
  'Search "milk", "bread", "eggs"...',
  'Search fresh green apples...',
  'Search snacks & munchies...',
  'Search fruit juices & soda...'
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const { onScroll, scrollEventThrottle } = useHideTabBarOnScroll();

  // Store bindings
  const user = useAuthStore((s) => s.user);
  const { latitude, longitude, address, setLocation } = useLocationStore();
  const setCategoryStore = useSearchStore((s) => s.setCategory);

  // Cart operations
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  // Wishlist operations
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem);

  // State variables
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [radiusRange, setRadiusRange] = useState<number>(50);
  const [tempRadius, setTempRadius] = useState<number>(50);
  const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
  const [bannerIndex, setBannerIndex] = useState<number>(0);

  // Modals & Loaders
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);
  const [showQuickOrderModal, setShowQuickOrderModal] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);

  // API Data
  const [nearbyShops, setNearbyShops] = useState<any[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);

  // Default location setter
  useEffect(() => {
    if (!latitude || !longitude) {
      setLocation(12.9770, 77.6030, 'Home - Residency Road, Bengaluru', 'Bengaluru', '560001');
    }
  }, [latitude, longitude, setLocation]);

  const lat = latitude || 12.9770;
  const lng = longitude || 77.6030;

  // Load backend data safely
  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);
      const shopRes = await shopService.getNearby({ lat, lng, radius: radiusRange, limit: 30 });
      const shopData = shopRes?.data;

      if (shopData?.shops && Array.isArray(shopData.shops)) {
        setNearbyShops(shopData.shops);
      } else if (Array.isArray(shopData)) {
        setNearbyShops(shopData);
      } else {
        setNearbyShops([]);
      }

      const prodRes = await productService.getTrending(lat, lng, radiusRange);
      const prodData = prodRes?.data;
      if (prodData?.products && Array.isArray(prodData.products)) {
        setTrendingProducts(prodData.products);
      } else if (Array.isArray(prodData)) {
        setTrendingProducts(prodData);
      } else {
        setTrendingProducts([]);
      }
    } catch (err) {
      console.log('[HomeScreen] API load error caught safely:', err);
      setNearbyShops([]);
      setTrendingProducts([]);
    } finally {
      setLoadingData(false);
    }
  }, [lat, lng, radiusRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Promo Banners data
  const banners = useMemo(() => [
    {
      id: 'b2',
      badge: 'LIGHTNING DEAL',
      title: 'Up to 50% discount\non daily essentials',
      gradient: ['#991B1B', '#DC2626'],
      image: IMAGES.dealLightning,
    },
    {
      id: 'b3',
      badge: 'FARM FRESH',
      title: 'Fresh farm veggies\ndelivered in 10 mins',
      gradient: ['#047857', '#10B981'],
      image: IMAGES.dealSaver,
    },
  ], []);

  // Safe Banner Scroll Handler
  const handleBannerScroll = (event: any) => {
    const slideSize = event?.nativeEvent?.layoutMeasurement?.width;
    if (!slideSize || slideSize <= 0) return;
    const contentOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(contentOffset / slideSize);
    if (index >= 0 && index < banners.length && index !== bannerIndex) {
      setBannerIndex(index);
    }
  };

  // Rotating search placeholder text
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Location presets handler
  const handleSelectPresetLocation = (loc: typeof PRESET_LOCATIONS[0]) => {
    setLocation(loc.lat, loc.lng, loc.label, loc.city, loc.pincode);
    setShowAddressModal(false);
  };

  // GPS current location getter
  const handleGetCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable GPS location permissions in your device settings.'
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude: currentLat, longitude: currentLng } = position.coords;

      let addressStr = 'Current Location';
      let cityStr = 'Bengaluru';
      let pincodeStr = '560001';

      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: currentLat,
          longitude: currentLng,
        });

        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          cityStr = place.city || place.subregion || 'Bengaluru';
          pincodeStr = place.postalCode || '560001';
          addressStr = [place.name, place.street, place.district, place.city]
            .filter(Boolean)
            .join(', ') || 'Current Location';
        }
      } catch (gErr) {
        console.log('Geocoding notice:', gErr);
      }

      setLocation(currentLat, currentLng, addressStr, cityStr, pincodeStr);
      setShowAddressModal(false);
      Alert.alert('Location Updated', `Set to: ${addressStr}`);
    } catch (err: any) {
      console.log('GPS Error:', err);
      Alert.alert('GPS Error', 'Unable to retrieve current location. Please choose a preset.');
    } finally {
      setLoadingLocation(false);
    }
  };

  // Cart helper
  const handleAddProductToCart = (prod: any) => {
    if (!prod) return;
    addItem({
      productId: prod.id || String(Date.now()),
      shopId: prod.shopId || 's1',
      shopName: prod.shop?.name || 'Local Store',
      name: prod.name || 'Item',
      price: prod.price || 0,
      mrp: prod.mrp || (prod.price ? prod.price + 10 : 10),
      image: prod.images ? getProductImageUrl(prod.images) : '',
      unit: prod.unit || '1 unit',
      inStock: true,
    });
  };

  // Wishlist helper
  const handleToggleShopWishlist = (shop: any) => {
    if (!shop) return;
    toggleWishlistItem({
      productId: shop.id,
      name: shop.name || 'Shop',
      price: 0,
      image: shop.logo || '',
      shopName: shop.name || 'Shop',
    });
  };

  const isShopWishlisted = (shopId: string) => {
    return wishlistItems.some((w) => w.productId === shopId);
  };

  // Safe category filtering
  const displayProducts = useMemo(() => {
    if (!Array.isArray(trendingProducts)) return [];
    if (activeCategory === 'all') return trendingProducts;
    return trendingProducts.filter((p: any) => {
      if (!p || typeof p !== 'object') return false;
      const cat = p.category;
      if (typeof cat !== 'string') return false;
      return cat.toLowerCase().includes(activeCategory.toLowerCase());
    });
  }, [activeCategory, trendingProducts]);

  // Categories List with 3D Image Assets & Matching Squircle Shape Containers
  const categoryItems = useMemo(() => [
    {
      id: 'all',
      name: 'All',
      image: IMAGES.productsIcon,
      bg: isDarkMode ? '#1E293B' : '#F0FDFA',
      color: '#0D9488',
      gradient: ['#0D9488', '#0F766E'],
      badge: 'ALL ⚡',
      badgeBg: isDarkMode ? 'rgba(13,148,136,0.3)' : '#CCFBF1',
      badgeColor: isDarkMode ? '#CCFBF1' : '#0F766E'
    },
    {
      id: 'fruits-veg',
      name: 'Fruits &\nVeggies',
      image: IMAGES.catFruitsVeggies,
      bg: isDarkMode ? '#1E293B' : '#ECFDF5',
      color: '#059669',
      gradient: ['#10B981', '#047857'],
      badge: 'FRESH 🥗',
      badgeBg: isDarkMode ? 'rgba(5,150,105,0.3)' : '#D1FAE5',
      badgeColor: isDarkMode ? '#6EE7B7' : '#065F46'
    },
    {
      id: 'dairy-eggs',
      name: 'Dairy &\nEggs',
      image: IMAGES.catDairyEggs,
      bg: isDarkMode ? '#1E293B' : '#FEF3C7',
      color: '#D97706',
      gradient: ['#F59E0B', '#B45309'],
      badge: 'HOT 🔥',
      badgeBg: isDarkMode ? 'rgba(217,119,6,0.3)' : '#FEF3C7',
      badgeColor: isDarkMode ? '#FCD34D' : '#92400E'
    },
    {
      id: 'snacks-munchies',
      name: 'Snacks &\nMunchies',
      image: IMAGES.catSnacksMunchies,
      bg: isDarkMode ? '#1E293B' : '#FFEDD5',
      color: '#EA580C',
      gradient: ['#F97316', '#C2410C'],
      badge: 'DEALS 🏷️',
      badgeBg: isDarkMode ? 'rgba(234,88,12,0.3)' : '#FFEDD5',
      badgeColor: isDarkMode ? '#FDBA74' : '#9A3412'
    },
    {
      id: 'beverages',
      name: 'Drinks &\nJuices',
      image: IMAGES.catBeverages,
      bg: isDarkMode ? '#1E293B' : '#E0E7FF',
      color: '#4F46E5',
      gradient: ['#6366F1', '#3730A3'],
      badge: 'CHILL 🥤',
      badgeBg: isDarkMode ? 'rgba(79,70,229,0.3)' : '#E0E7FF',
      badgeColor: isDarkMode ? '#C7D2FE' : '#3730A3'
    },
    {
      id: 'electronics',
      name: 'Electronics &\nGadgets',
      image: IMAGES.catElectronics,
      bg: isDarkMode ? '#1E293B' : '#EFF6FF',
      color: '#2563EB',
      gradient: ['#3B82F6', '#1D4ED8'],
      badge: 'TECH ⚡',
      badgeBg: isDarkMode ? 'rgba(37,99,235,0.3)' : '#DBEAFE',
      badgeColor: isDarkMode ? '#93C5FD' : '#1E40AF'
    },
    {
      id: 'more',
      name: 'More\nCategories',
      image: IMAGES.exploreIcon,
      bg: isDarkMode ? '#1E293B' : '#F1F5F9',
      color: '#64748B',
      gradient: ['#64748B', '#334155'],
      badge: 'VIEW 🌟',
      badgeBg: isDarkMode ? 'rgba(100,116,139,0.3)' : '#F1F5F9',
      badgeColor: isDarkMode ? '#CBD5E1' : '#334155'
    },
  ], [isDarkMode]);

  // Bento Collections Data
  const bentoCollections = [
    {
      id: 'c1',
      title: 'Farm Fresh',
      subtitle: 'Organics & Veggies',
      gradient: ['#0F766E', '#0D9488'],
      categoryId: 'fruits-veg',
      image: IMAGES.catFruitsVeggies,
    },
    {
      id: 'c2',
      title: 'Daily Dairy',
      subtitle: 'Milk, Eggs & Butter',
      gradient: ['#D97706', '#F59E0B'],
      categoryId: 'dairy-eggs',
      image: IMAGES.catDairyEggs,
    },
    {
      id: 'c3',
      title: 'Snack Attack',
      subtitle: 'Chips, Nuts & Biscuits',
      gradient: ['#C026D3', '#E11D48'],
      categoryId: 'snacks-munchies',
      image: IMAGES.catSnacksMunchies,
    },
    {
      id: 'c4',
      title: 'Cool Drinks',
      subtitle: 'Juices, Sodas & Shakes',
      gradient: ['#2563EB', '#3B82F6'],
      categoryId: 'beverages',
      image: IMAGES.catBeverages,
    },
  ];

  const handleCategoryPress = (catId: string) => {
    if (catId === 'more') {
      navigation.navigate('Categories');
      return;
    }
    setActiveCategory(catId);
    setCategoryStore(catId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* ─── Premium Header Bar ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.locationPill}
          activeOpacity={0.85}
          onPress={() => setShowAddressModal(true)}
        >
          <View style={styles.deliveryBadge}>
            <Text style={styles.deliveryBadgeText}>BOOKING PLATFORM</Text>
          </View>

          <View style={styles.locationTextCol}>
            <View style={styles.locationTitleRow}>
              <Text style={styles.locationHeaderLabel}>Your Location</Text>
              <Ionicons name="chevron-down" size={13} color="#0D9488" style={{ marginLeft: 3 }} />
            </View>
            <Text style={styles.locationValueText} numberOfLines={1}>
              {address ? (address.length > 32 ? `${address.substring(0, 30)}...` : address) : 'Select Your Location'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Notifications', 'No new notifications right now!')}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <View style={styles.unreadBadgeDot} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatarBorder}>
              <Image source={IMAGES.avatar} style={styles.avatarImage} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0D9488']} />
        }
      >
        {/* ─── Greeting Section ─── */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>
            Hey {user?.name ? user.name.split(' ')[0] : 'there'}! 👋
          </Text>
          <Text style={styles.greetingSubtitle}>Order fresh groceries & essentials nearby</Text>
        </View>

        {/* ─── Floating Search Bar ─── */}
        <View style={styles.searchSection}>
          <TouchableOpacity
            style={styles.searchContainer}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={20} color="#0D9488" />
            <Text style={styles.searchPlaceholderText}>
              {SEARCH_PLACEHOLDERS[placeholderIndex]}
            </Text>
            <Ionicons name="mic-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterIconButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Search', { autoFocusSearch: false })}
          >
            <Ionicons name="options-outline" size={20} color="#0D9488" />
          </TouchableOpacity>
        </View>

        {/* ─── Store Distance Range Filter ─── */}
        <View style={styles.radiusFilterCard}>
          <View style={styles.radiusHeaderRow}>
            <View style={styles.radiusTitleBox}>
              <Ionicons name="location-outline" size={16} color="#0D9488" />
              <Text style={styles.radiusTitleText}>Store Radius</Text>
            </View>
            <View style={styles.radiusPillBadge}>
              <Text style={styles.radiusPillText}>{tempRadius} km</Text>
            </View>
          </View>
          <View style={styles.sliderContainerRow}>
            <Text style={styles.sliderBoundaryText}>1 km</Text>
            <Slider
              style={styles.radiusSlider}
              minimumValue={1}
              maximumValue={500}
              step={5}
              value={tempRadius}
              onValueChange={(val) => setTempRadius(Math.round(val))}
              onSlidingComplete={(val) => {
                const rounded = Math.round(val);
                setRadiusRange(rounded);
              }}
              minimumTrackTintColor="#0D9488"
              maximumTrackTintColor={isDarkMode ? '#334155' : '#E2E8F0'}
              thumbTintColor="#0D9488"
            />
            <Text style={styles.sliderBoundaryText}>500 km</Text>
          </View>
        </View>

        {/* ─── Promo Banners Carousel ─── */}
        <View style={styles.bannerWrapper}>
          <FlatList
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleBannerScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
                <View style={styles.bannerCardContainer}>
                  <LinearGradient
                    colors={item.gradient as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerGradientBackground}
                  >
                    <View style={styles.bannerTextColumn}>
                      <View style={styles.bannerBadgePill}>
                        <Text style={styles.bannerBadgePillText}>{item.badge}</Text>
                      </View>
                      <Text style={styles.bannerHeadlineText}>{item.title}</Text>
                      <TouchableOpacity
                        style={styles.bannerCtaButton}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('Search')}
                      >
                        <Text style={styles.bannerCtaText}>Shop Now</Text>
                        <Ionicons name="arrow-forward" size={12} color="#0D9488" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.bannerImageColumn}>
                      <Image source={item.image} style={styles.bannerRiderGraphic} resizeMode="contain" />
                    </View>
                  </LinearGradient>
                </View>
              </View>
            )}
          />

          <View style={styles.carouselPaginationDots}>
            {banners.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.paginationDot,
                  bannerIndex === idx && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* ─── Quick Actions Grid (3 Columns) ─── */}
        <View style={styles.quickActionGridContainer}>
          <TouchableOpacity
            style={styles.quickActionTile}
            activeOpacity={0.85}
            onPress={() => setActiveCategory('all')}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: isDarkMode ? 'rgba(204,251,241,0.15)' : '#CCFBF1' }]}>
              <Image source={IMAGES.productsIcon} style={styles.quickActionImage} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionTitleText}>Products</Text>
            <Text style={styles.quickActionSubtext}>Near you</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionTile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Categories')}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: isDarkMode ? 'rgba(254,243,199,0.15)' : '#FEF3C7' }]}>
              <Image source={IMAGES.shopsIcon} style={styles.quickActionImage} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionTitleText}>Stores</Text>
            <Text style={styles.quickActionSubtext}>Open now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionTile}
            activeOpacity={0.85}
            onPress={() => setShowQuickOrderModal(true)}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: isDarkMode ? 'rgba(224,231,255,0.15)' : '#E0E7FF' }]}>
              <Image source={IMAGES.exploreIcon} style={styles.quickActionImage} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionTitleText}>Bundles</Text>
            <Text style={styles.quickActionSubtext}>Instant deals</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Creative & Interactive Browse Categories Section ─── */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionHeaderTitleText}>Browse Categories</Text>
            <View style={styles.sectionHeaderBadge}>
              <Text style={styles.sectionHeaderBadgeText}>INTERACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
            <Text style={styles.sectionSeeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesHorizontalScroll}
        >
          {categoryItems.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryPillContainer}
                activeOpacity={0.85}
                onPress={() => handleCategoryPress(cat.id)}
              >
                {/* Offer / Status Badge Tag */}
                <View style={[styles.categoryBadgeTag, { backgroundColor: cat.badgeBg }]}>
                  <Text style={[styles.categoryBadgeTagText, { color: cat.badgeColor }]}>{cat.badge}</Text>
                </View>

                {/* Dual-Tone Outer Ring Icon Wrapper */}
                <LinearGradient
                  colors={isActive ? (cat.gradient as [string, string, ...string[]]) : [cat.bg, isDarkMode ? '#1E293B' : '#FFFFFF']}
                  style={[
                    styles.categoryIconRingGradient,
                    isActive && styles.categoryIconRingGradientActive
                  ]}
                >
                  <View style={[styles.categoryIconCircleInner, { backgroundColor: cat.bg }]}>
                    <Image source={cat.image} style={styles.categoryGraphicImage} resizeMode="contain" />
                  </View>
                </LinearGradient>

                <Text
                  style={[
                    styles.categoryLabelText,
                    isActive && styles.categoryLabelTextActive
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── 2x2 Bento Collections Grid ─── */}
        <View style={styles.bentoSectionContainer}>
          <Text style={styles.bentoSectionTitle}>Curated Collections</Text>
          <View style={styles.bentoGridWrapper}>
            {bentoCollections.map((col) => (
              <TouchableOpacity
                key={col.id}
                style={styles.bentoCardItem}
                activeOpacity={0.9}
                onPress={() => handleCategoryPress(col.categoryId)}
              >
                <LinearGradient
                  colors={col.gradient as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bentoGradientCard}
                >
                  <View style={styles.bentoTextCol}>
                    <Text style={styles.bentoCardTitle}>{col.title}</Text>
                    <Text style={styles.bentoCardSub}>{col.subtitle}</Text>
                    <View style={styles.bentoArrowBtn}>
                      <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
                    </View>
                  </View>
                  <Image source={col.image} style={styles.bentoGraphic} resizeMode="contain" />
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Dual Side Promo Cards ─── */}
        <View style={styles.dualPromoRowContainer}>
          <TouchableOpacity
            style={[styles.dualPromoCardTile, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Search')}
          >
            <View style={styles.dualPromoTextWrapper}>
              <Text style={[styles.dualPromoHeadline, { color: isDarkMode ? '#6EE7B7' : '#047857' }]}>Super Saver</Text>
              <Text style={[styles.dualPromoSub, { color: isDarkMode ? '#A7F3D0' : '#475569' }]}>Deals up to 40% OFF</Text>
              <Text style={[styles.dualPromoLinkBtn, { color: isDarkMode ? '#34D399' : '#059669' }]}>Explore →</Text>
            </View>
            <Image source={IMAGES.dealSaver} style={styles.dualPromoIllustration} resizeMode="contain" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dualPromoCardTile, { backgroundColor: isDarkMode ? '#7F1D1D' : '#FEE2E2' }]}
            activeOpacity={0.9}
            onPress={() => setShowQuickOrderModal(true)}
          >
            <View style={styles.dualPromoTextWrapper}>
              <Text style={[styles.dualPromoHeadline, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}>Instant Booking</Text>
              <Text style={[styles.dualPromoSub, { color: isDarkMode ? '#FECACA' : '#475569' }]}>Book now, pick up fast</Text>
              <Text style={[styles.dualPromoLinkBtn, { color: isDarkMode ? '#F87171' : '#DC2626' }]}>Book Now →</Text>
            </View>
            <Image source={IMAGES.dealLightning} style={styles.dualPromoIllustration} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        {/* ─── Shops Near You ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitleText}>Shops Near You</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
            <Text style={styles.sectionSeeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <ActivityIndicator size="small" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : !nearbyShops || nearbyShops.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="storefront-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyStateTitleText}>No shops found in this area</Text>
            <Text style={styles.emptyStateSubtext}>Try increasing your store search radius above</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shopsHorizontalList}
          >
            {nearbyShops.map((shop: any) => {
              if (!shop) return null;
              const saved = isShopWishlisted(shop.id);
              const logoColor = shop.logoColor || '#0D9488';
              const logoLetter = shop.logoLetter || (shop.name ? shop.name.charAt(0).toUpperCase() : 'S');

              return (
                <TouchableOpacity
                  key={shop.id || String(Math.random())}
                  style={styles.shopCardItem}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ShopProfile', { shopId: shop.id })}
                >
                  <View style={styles.shopTopRow}>
                    {shop.logo ? (
                      <Image source={{ uri: shop.logo }} style={styles.shopAvatarImage} />
                    ) : (
                      <View style={[styles.shopAvatarLetterContainer, { backgroundColor: logoColor }]}>
                        <Text style={styles.shopAvatarLetterText}>{logoLetter}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleToggleShopWishlist(shop)}
                      style={styles.shopHeartButton}
                    >
                      <Ionicons
                        name={saved ? 'heart' : 'heart-outline'}
                        size={16}
                        color={saved ? '#EF4444' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.shopNameText} numberOfLines={1}>
                    {shop.name || 'Local Store'}
                  </Text>

                  <View style={styles.shopMetaRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.shopRatingNumber}>
                      {shop.rating || shop.averageRating || '4.5'}
                    </Text>
                    <Text style={styles.shopReviewCount}>
                      ({shop.reviews || shop.totalReviews || '120'})
                    </Text>
                  </View>

                  <Text style={styles.shopDistanceTimeText} numberOfLines={1}>
                    {shop.time || '10-15 mins'} • {typeof shop.distance === 'number' ? `${shop.distance.toFixed(1)} km` : (shop.distance || '1.2 km')}
                  </Text>


                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ─── Trending Products Near You ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitleText}>Trending Products</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.sectionSeeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Active Category Filter Reset Chip */}
        {activeCategory !== 'all' && (
          <View style={styles.activeFilterChipBar}>
            <View style={styles.activeFilterChipTitleBox}>
              <Ionicons name="funnel" size={12} color="#0D9488" />
              <Text style={styles.activeFilterChipText}>
                Showing: <Text style={{ fontWeight: '800' }}>{activeCategory}</Text> ({displayProducts.length})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.activeFilterResetBtn}
              onPress={() => setActiveCategory('all')}
            >
              <Text style={styles.activeFilterResetText}>Reset to All ✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadingData ? (
          <ActivityIndicator size="small" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : displayProducts.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="bag-handle-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyStateTitleText}>No products found for this category</Text>
            <Text style={styles.emptyStateSubtext}>Try switching category filter to All</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsHorizontalList}
          >
            {displayProducts.map((prod: any) => {
              if (!prod) return null;
              const cartItem = cartItems.find((item) => item.productId === prod.id);
              const qty = cartItem?.quantity || 0;

              const hasRealImage = Array.isArray(prod.images) && prod.images.length > 0 && prod.images[0];
              let fallbackImg: any = null;
              if (!hasRealImage) {
                const nm = (prod.name || '').toLowerCase();
                if (nm.includes('milk')) fallbackImg = IMAGES.prodMilk;
                else if (nm.includes('bread')) fallbackImg = IMAGES.prodBread;
                else if (nm.includes('banana')) fallbackImg = IMAGES.prodBananas;
                else fallbackImg = IMAGES.prodApple;
              }

              return (
                <TouchableOpacity
                  key={prod.id || String(Math.random())}
                  style={styles.productCardItem}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ProductDetail', { productId: prod.id })}
                >
                  <View style={styles.productImageFrame}>
                    {hasRealImage ? (
                      <Image source={{ uri: prod.images[0] }} style={styles.productGraphicImage} resizeMode="contain" />
                    ) : (
                      <Image source={fallbackImg} style={styles.productGraphicImage} resizeMode="contain" />
                    )}
                    <TouchableOpacity style={styles.productHeartIconBtn}>
                      <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.productInfoWrapper}>
                    <Text style={styles.productTitleText} numberOfLines={2}>
                      {prod.name || 'Product'}
                    </Text>
                    <Text style={styles.productUnitText}>{prod.unit || '1 unit'}</Text>
                  </View>

                  <View style={styles.productFooterRow}>
                    <Text style={styles.productPriceText}>
                      {formatPrice(prod.price || 0)}
                    </Text>

                    {qty > 0 ? (
                      <View style={styles.quantityStepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperDecreaseBtn}
                          onPress={() => updateQuantity(prod.id, qty - 1)}
                        >
                          <Ionicons name="remove" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.stepperCountText}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.stepperIncreaseBtn}
                          onPress={() => updateQuantity(prod.id, qty + 1)}
                        >
                          <Ionicons name="add" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addToCartButton}
                        activeOpacity={0.8}
                        onPress={() => handleAddProductToCart(prod)}
                      >
                        <Text style={styles.addToCartButtonText}>ADD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      {/* ─── Location Selector Modal ─── */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdropOverlay}
          activeOpacity={1}
          onPress={() => setShowAddressModal(false)}
        >
          <View style={styles.modalBottomSheetContainer}>
            <View style={styles.bottomSheetDragHandle} />
            <View style={styles.bottomSheetHeaderRow}>
              <Text style={styles.bottomSheetHeaderTitle}>Select Your Address</Text>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={() => setShowAddressModal(false)}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.locationOptionRow}
              onPress={handleGetCurrentLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? (
                <ActivityIndicator size="small" color="#0D9488" />
              ) : (
                <Ionicons name="locate" size={20} color="#0D9488" />
              )}
              <Text style={styles.locationOptionTextPrimary}>Use Current Location (GPS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationOptionRow}
              onPress={() => {
                setShowAddressModal(false);
                setShowMapPicker(true);
              }}
            >
              <Ionicons name="map-outline" size={20} color="#0D9488" />
              <Text style={styles.locationOptionTextPrimary}>Pick Location on Map</Text>
            </TouchableOpacity>

            <Text style={styles.savedAddressesSublabel}>Preset Addresses</Text>

            {PRESET_LOCATIONS.map((loc) => {
              const isSelected = address === loc.label;
              return (
                <TouchableOpacity
                  key={loc.label}
                  style={styles.presetLocationRow}
                  onPress={() => handleSelectPresetLocation(loc)}
                >
                  <Ionicons name="home-outline" size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
                  <Text
                    style={[
                      styles.presetLocationText,
                      isSelected && styles.presetLocationTextSelected
                    ]}
                    numberOfLines={1}
                  >
                    {loc.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Instant Combo Bundles Modal ─── */}
      <Modal
        visible={showQuickOrderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickOrderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdropOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickOrderModal(false)}
        >
          <View style={styles.modalBottomSheetContainer}>
            <View style={styles.bottomSheetDragHandle} />
            <View style={styles.bottomSheetHeaderRow}>
              <Text style={styles.bottomSheetHeaderTitle}>Instant Combo Bundles</Text>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={() => setShowQuickOrderModal(false)}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.presetLocationRow}
              onPress={() => {
                addItem({ productId: 'p1', shopId: 's1', shopName: 'Blinkit Store', name: 'Organic Whole Milk', price: 45, unit: '500 ml', image: '', inStock: true });
                addItem({ productId: 'p2', shopId: 's1', shopName: 'Blinkit Store', name: 'Whole Wheat Bread', price: 55, unit: '400 g', image: '', inStock: true });
                setShowQuickOrderModal(false);
                Alert.alert('Bundle Added', 'Breakfast Bundle added to Cart!');
              }}
            >
              <Text style={styles.presetLocationText}>🍳 Breakfast Combo (Milk + Bread) • ₹90</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetLocationRow}
              onPress={() => {
                addItem({ productId: 'p3', shopId: 's1', shopName: 'Blinkit Store', name: 'Premium Bananas', price: 60, unit: '1 kg', image: '', inStock: true });
                addItem({ productId: 'p4', shopId: 's1', shopName: 'Blinkit Store', name: 'Royal Gala Red Apple', price: 180, unit: '4 pcs', image: '', inStock: true });
                setShowQuickOrderModal(false);
                Alert.alert('Bundle Added', 'Fruit Basket Combo added to Cart!');
              }}
            >
              <Text style={styles.presetLocationText}>🥗 Fruit Basket Combo (Apples + Bananas) • ₹220</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Map Picker Modal */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onSelectLocation={(latVal, lngVal, addressStr, cityStr, pincodeStr) => {
          setLocation(latVal, lngVal, addressStr, cityStr, pincodeStr);
          Alert.alert('Location Updated', `Set to: ${addressStr}`);
        }}
      />
    </View>
  );
}

// ─── Stylesheet Builder with Dynamic Dark/Light Theme Colors ──────────────────
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
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '74%',
      gap: 10,
    },
    deliveryBadge: {
      backgroundColor: isDarkMode ? 'rgba(13,148,136,0.25)' : 'rgba(13,148,136,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(13,148,136,0.3)',
    },
    deliveryBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#0D9488',
      letterSpacing: 0.3,
    },
    locationTextCol: {
      flexDirection: 'column',
      justifyContent: 'center',
    },
    locationTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    locationHeaderLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    locationValueText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDarkMode ? colors.surface : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    unreadBadgeDot: {
      position: 'absolute',
      top: 9,
      right: 9,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
    },
    avatarBorder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#0D9488',
      padding: 1,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 19,
    },
    greetingSection: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    greetingTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    greetingSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
    },
    searchSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 14,
      gap: 10,
    },
    searchContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#0F766E' : '#CCFBF1',
      height: 46,
      paddingHorizontal: 16,
      gap: 10,
      shadowColor: '#0D9488',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.2 : 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    searchPlaceholderText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    filterIconButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#0F766E' : '#CCFBF1',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    radiusFilterCard: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    radiusHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    radiusTitleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    radiusTitleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    radiusPillBadge: {
      backgroundColor: isDarkMode ? 'rgba(13,148,136,0.3)' : '#CCFBF1',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    radiusPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#0D9488',
    },
    sliderContainerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    radiusSlider: {
      flex: 1,
      height: 28,
      marginHorizontal: 6,
    },
    sliderBoundaryText: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    bannerWrapper: {
      marginBottom: 16,
    },
    bannerCardContainer: {
      height: 136,
      borderRadius: 20,
      overflow: 'hidden',
    },
    bannerGradientBackground: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: 18,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerTextColumn: {
      flex: 1.3,
      justifyContent: 'center',
    },
    bannerBadgePill: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
      marginBottom: 6,
    },
    bannerBadgePillText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    bannerHeadlineText: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 22,
      letterSpacing: -0.4,
    },
    bannerCtaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      marginTop: 10,
    },
    bannerCtaText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#0D9488',
    },
    bannerImageColumn: {
      flex: 0.7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerRiderGraphic: {
      width: 96,
      height: 96,
    },
    carouselPaginationDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      gap: 6,
    },
    paginationDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDarkMode ? '#475569' : '#CBD5E1',
    },
    paginationDotActive: {
      width: 16,
      backgroundColor: '#0D9488',
    },
    quickActionGridContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 22,
      gap: 12,
    },
    quickActionTile: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    quickActionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    quickActionImage: {
      width: 32,
      height: 32,
    },
    quickActionTitleText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.text,
    },
    quickActionSubtext: {
      fontSize: 9.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    sectionHeaderTitleText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    sectionHeaderBadge: {
      backgroundColor: isDarkMode ? 'rgba(5,150,105,0.25)' : '#DCFCE7',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    sectionHeaderBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: isDarkMode ? '#6EE7B7' : '#059669',
      letterSpacing: 0.5,
    },
    sectionSeeAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#0D9488',
    },
    categoriesHorizontalScroll: {
      paddingLeft: 16,
      paddingRight: 8,
      marginBottom: 18,
      gap: 14,
    },
    categoryPillContainer: {
      alignItems: 'center',
      width: 76,
      position: 'relative',
    },
    categoryBadgeTag: {
      position: 'absolute',
      top: -4,
      zIndex: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    categoryBadgeTagText: {
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    categoryIconRingGradient: {
      width: 66,
      height: 66,
      borderRadius: 33,
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      marginBottom: 6,
    },
    categoryIconRingGradientActive: {
      shadowColor: '#0D9488',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    categoryIconCircleInner: {
      width: '100%',
      height: '100%',
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryGraphicImage: {
      width: 38,
      height: 38,
    },
    categoryLabelText: {
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 13,
    },
    categoryLabelTextActive: {
      color: '#0D9488',
      fontWeight: '800',
    },
    bentoSectionContainer: {
      paddingHorizontal: 16,
      marginBottom: 22,
    },
    bentoSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
      letterSpacing: -0.2,
    },
    bentoGridWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
    },
    bentoCardItem: {
      width: '48.5%',
      height: 84,
      borderRadius: 16,
      overflow: 'hidden',
    },
    bentoGradientCard: {
      flex: 1,
      flexDirection: 'row',
      padding: 10,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bentoTextCol: {
      flex: 1.2,
    },
    bentoCardTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    bentoCardSub: {
      fontSize: 8.5,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2,
      fontWeight: '500',
    },
    bentoArrowBtn: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    bentoGraphic: {
      width: 40,
      height: 40,
    },
    dualPromoRowContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 22,
      gap: 12,
    },
    dualPromoCardTile: {
      flex: 1,
      height: 88,
      borderRadius: 16,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dualPromoTextWrapper: {
      flex: 1.3,
    },
    dualPromoHeadline: {
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    dualPromoSub: {
      fontSize: 9,
      marginTop: 2,
      fontWeight: '500',
    },
    dualPromoLinkBtn: {
      fontSize: 10,
      fontWeight: '800',
      marginTop: 6,
    },
    dualPromoIllustration: {
      width: 44,
      height: 44,
    },
    shopsHorizontalList: {
      paddingLeft: 16,
      paddingRight: 8,
      marginBottom: 24,
    },
    shopCardItem: {
      width: 156,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
      marginRight: 12,
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    shopTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
    },
    shopAvatarImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    shopAvatarLetterContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopAvatarLetterText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    shopHeartButton: {
      padding: 4,
    },
    shopNameText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
      marginTop: 8,
    },
    shopMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
      gap: 4,
    },
    shopRatingNumber: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    shopReviewCount: {
      fontSize: 9,
      color: colors.textSecondary,
    },
    shopDistanceTimeText: {
      fontSize: 9,
      color: colors.textSecondary,
      marginTop: 2,
    },
    freeDeliveryBadgeContainer: {
      backgroundColor: isDarkMode ? 'rgba(13,148,136,0.3)' : '#CCFBF1',
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 6,
    },
    freeDeliveryBadgeText: {
      fontSize: 8,
      fontWeight: '800',
      color: '#0D9488',
    },
    activeFilterChipBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: isDarkMode ? 'rgba(13,148,136,0.3)' : '#CCFBF1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    activeFilterChipTitleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    activeFilterChipText: {
      fontSize: 11,
      color: isDarkMode ? '#CCFBF1' : '#0F766E',
    },
    activeFilterResetBtn: {
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    activeFilterResetText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#0D9488',
    },
    productsHorizontalList: {
      paddingLeft: 16,
      paddingRight: 8,
      marginBottom: 24,
    },
    productCardItem: {
      width: 140,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 10,
      marginRight: 12,
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    productImageFrame: {
      height: 94,
      backgroundColor: isDarkMode ? colors.surface : '#F8FAFC',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    productGraphicImage: {
      width: '80%',
      height: '80%',
    },
    productHeartIconBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    productInfoWrapper: {
      marginTop: 6,
    },
    productTitleText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text,
      height: 30,
      lineHeight: 15,
    },
    productUnitText: {
      fontSize: 9,
      color: colors.textSecondary,
      marginTop: 2,
    },
    productFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    productPriceText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },
    addToCartButton: {
      borderWidth: 1.5,
      borderColor: '#0D9488',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      backgroundColor: colors.card,
    },
    addToCartButtonText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#0D9488',
    },
    quantityStepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0D9488',
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    stepperDecreaseBtn: {
      paddingHorizontal: 4,
    },
    stepperIncreaseBtn: {
      paddingHorizontal: 4,
    },
    stepperCountText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      marginHorizontal: 3,
    },
    emptyStateCard: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginBottom: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyStateTitleText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
    },
    emptyStateSubtext: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 4,
    },
    modalBackdropOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalBottomSheetContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomSheetDragHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 14,
    },
    bottomSheetHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    bottomSheetHeaderTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    closeIconButton: {
      padding: 4,
    },
    locationOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    locationOptionTextPrimary: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0D9488',
      marginLeft: 10,
    },
    savedAddressesSublabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    presetLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    presetLocationText: {
      fontSize: 12.5,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    presetLocationTextSelected: {
      color: '#0D9488',
      fontWeight: '800',
    },
  });
};
