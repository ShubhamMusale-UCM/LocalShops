import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  StatusBar,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import {
  Search, Mic, Bell, MapPin, X, Heart, Plus, Minus, ArrowRight,
  ChevronDown, SlidersHorizontal, Package, Store, Sparkles, Locate,
  Star, Home as HomeIcon
} from 'lucide-react-native';

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
import adsService from '../../services/adsService';
import telemetryService from '../../services/telemetryService';

// Theme & Utils
import { useTheme } from '../../theme';
import { formatPrice } from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Global Spring Config for 1:1 Apple/Spatial Tactile Feel
const SPATIAL_SPRING = {
  damping: 16,
  mass: 1,
  stiffness: 150,
  overshootClamping: false,
};

// ─── Spatial Components ───────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TactileView = ({ children, style, onPress, disabled = false, scaleValue = 0.94 }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(scaleValue, SPATIAL_SPRING);
      }}
      onPressOut={() => {
        if (!disabled) scale.value = withSpring(1, SPATIAL_SPRING);
      }}
      onPress={onPress}
      disabled={disabled}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

const GlassCard = ({ children, style, isDark, intensity = 40, gradient }: any) => (
  <View style={[{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }, style]}>
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={gradient || (isDark ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)'])}
      style={StyleSheet.absoluteFill}
    />
    {children}
  </View>
);

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
  dealSaver: require('../../assets/deal_saver.png'),
  dealLightning: require('../../assets/deal_lightning.png'),
  prodMilk: require('../../assets/prod_milk.png'),
  prodBread: require('../../assets/prod_bread.png'),
  prodBananas: require('../../assets/prod_bananas.png'),
  prodApple: require('../../assets/prod_apple.png'),
};

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
  'Search spatial tech...'
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { onScroll, scrollEventThrottle } = useHideTabBarOnScroll();

  // Glass Theme Tokens
  const theme = useMemo(() => ({
    bg: isDarkMode ? '#050814' : '#e2e8f0',
    card: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.65)',
    text: isDarkMode ? '#FFFFFF' : '#0f172a',
    textMuted: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(15, 23, 42, 0.55)',
    primary: '#2563EB',
    accent: isDarkMode ? '#06B6D4' : '#0284c7',
    purple: isDarkMode ? '#8B5CF6' : '#7c3aed',
    success: isDarkMode ? '#22C55E' : '#059669',
    danger: '#EF4444',
    border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)',
    input: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
  }), [isDarkMode]);

  const user = useAuthStore((s) => s.user);
  const { latitude, longitude, address, setLocation } = useLocationStore();
  const setCategoryStore = useSearchStore((s) => s.setCategory);

  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem);

  const [activeCategory, setActiveCategory] = useState('all');
  const [radiusRange, setRadiusRange] = useState(50);
  const [tempRadius, setTempRadius] = useState(50);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [nearbyShops, setNearbyShops] = useState<any[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!latitude || !longitude) {
      setLocation(12.9770, 77.6030, 'Home - Residency Road, Bengaluru', 'Bengaluru', '560001');
    }
  }, [latitude, longitude, setLocation]);

  const lat = latitude || 12.9770;
  const lng = longitude || 77.6030;

  // Memoize location to 2 decimal places (approx 1.1km precision) 
  // so small GPS jitter doesn't trigger continuous infinite API calls.
  const memoLat = Math.round(lat * 100) / 100;
  const memoLng = Math.round(lng * 100) / 100;

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      try {
        const shopRes = await shopService.getNearby({ lat: memoLat, lng: memoLng, radius: radiusRange, limit: 30 });
        const shopData = shopRes?.data;
        if (shopData?.shops && Array.isArray(shopData.shops)) setNearbyShops(shopData.shops);
        else if (Array.isArray(shopData)) setNearbyShops(shopData);
        else setNearbyShops([]);
      } catch {
        setNearbyShops([]);
      }

      try {
        const [prodRes, adRes] = await Promise.all([
          productService.getTrending(memoLat, memoLng, radiusRange),
          adsService.getTrending(30, undefined, activeCategory !== 'all' ? activeCategory : undefined, memoLat, memoLng)
        ]);

        const prodData = prodRes?.data;
        let products: any[] = [];
        
        if (prodData?.products && Array.isArray(prodData.products)) {
          products = prodData.products;
        } else if (Array.isArray(prodData)) {
          products = prodData;
        }
        
        // Merge sponsored ads and remove duplicates
        const adProducts = Array.isArray(adRes) ? adRes : [];
        const combined = [...adProducts, ...products].filter(
          (v, i, a) => a.findIndex((t) => t.id === v.id) === i
        );
        
        setTrendingProducts(combined);
        
        // Track impressions for sponsored items
        combined
          .filter((p: any) => p.isBoosted && p.campaignId)
          .forEach((p: any) => {
            telemetryService.trackImpression(p.campaignId, p.id, undefined);
          });
      } catch (err) {
        console.warn('Failed to load trending', err);
        setTrendingProducts([]);
      }
    } finally {
      setLoadingData(false);
    }
  }, [memoLat, memoLng, radiusRange]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const banners = useMemo(() => [
    { id: 'b2', badge: 'LIGHTNING DEAL', title: 'Up to 50% discount\non essentials', gradient: ['#991B1B', '#DC2626'], image: IMAGES.dealLightning },
    { id: 'b3', badge: 'FARM FRESH', title: 'Fresh farm veggies\nin 10 mins', gradient: ['#047857', '#10B981'], image: IMAGES.dealSaver },
  ], []);

  const handleBannerScroll = (event: any) => {
    const slideSize = event?.nativeEvent?.layoutMeasurement?.width;
    if (!slideSize || slideSize <= 0) return;
    const contentOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(contentOffset / slideSize);
    if (index >= 0 && index < banners.length && index !== bannerIndex) setBannerIndex(index);
  };

  useEffect(() => {
    const timer = setInterval(() => { setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length); }, 4000);
    return () => clearInterval(timer);
  }, []);

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    cartItems.forEach(i => { map[i.productId] = i.quantity; });
    return map;
  }, [cartItems]);

  const wishlistSet = useMemo(() => {
    return new Set(wishlistItems.map((w) => w.productId));
  }, [wishlistItems]);

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Location Permission Required', 'Please enable GPS location permissions.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: currentLat, longitude: currentLng } = position.coords;
      let addressStr = 'Current Location', cityStr = 'Bengaluru', pincodeStr = '560001';
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: currentLat, longitude: currentLng });
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          cityStr = place.city || place.subregion || 'Bengaluru';
          pincodeStr = place.postalCode || '560001';
          addressStr = [place.name, place.street, place.district, place.city].filter(Boolean).join(', ') || 'Current Location';
        }
      } catch (gErr) { console.log('Geocoding notice:', gErr); }
      setLocation(currentLat, currentLng, addressStr, cityStr, pincodeStr);
      setShowAddressModal(false);
      Alert.alert('Location Updated', `Set to: ${addressStr}`);
    } catch (err: any) {
      Alert.alert('GPS Error', 'Unable to retrieve current location.');
    } finally {
      setLoadingLocation(false);
    }
  }, [setLocation]);

  const handleAddProductToCart = useCallback((prod: any) => {
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
      campaignId: prod.campaignId || undefined,
    });
  }, [addItem]);

  const handleToggleShopWishlist = useCallback((shop: any) => {
    if (!shop) return;
    toggleWishlistItem({
      productId: shop.id,
      shopName: shop.name || 'Local Store',
      name: shop.name || 'Store',
      price: 0,
      image: shop.logo || '',
    });
  }, [toggleWishlistItem]);

  const displayProducts = useMemo(() => {
    if (!Array.isArray(trendingProducts)) return [];
    if (activeCategory === 'all') return trendingProducts;

    const catLower = activeCategory.toLowerCase();
    return trendingProducts.filter((p: any) => {
      const pCat = (p?.category || '').toLowerCase();
      const pSub = (p?.subCategory || '').toLowerCase();
      const pName = (p?.name || '').toLowerCase();
      const tags = Array.isArray(p?.tags) ? p.tags.join(' ').toLowerCase() : '';

      if (catLower === 'fruits-veg') {
        return pCat.includes('fruit') || pCat.includes('veg') || pCat.includes('grocery') || pCat.includes('fresh') || tags.includes('fresh');
      }
      if (catLower === 'dairy-eggs') {
        return pCat.includes('dairy') || pSub.includes('dairy') || pName.includes('milk') || pName.includes('egg') || pCat.includes('grocery');
      }
      if (catLower === 'beverages') {
        return pCat.includes('bev') || pCat.includes('drink') || pCat.includes('juice') || tags.includes('drink');
      }
      if (catLower === 'electronics') {
        return pCat.includes('elec') || pCat.includes('tech') || pCat.includes('gadget') || pCat.includes('services');
      }
      return pCat.includes(catLower) || pSub.includes(catLower) || tags.includes(catLower);
    });
  }, [activeCategory, trendingProducts]);

  const categoryItems = useMemo(() => [
    { id: 'all', name: 'All', icon: <Package size={14} color={theme.text} />, bg: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
    { id: 'fruits-veg', name: 'Fresh', icon: <Sparkles size={14} color={theme.accent} />, bg: isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#D1FAE5' },
    { id: 'beverages', name: 'Drinks', icon: <Store size={14} color={theme.purple} />, bg: isDarkMode ? 'rgba(139, 92, 246, 0.15)' : '#EDE9FE' },
    { id: 'electronics', name: 'Tech', icon: <Sparkles size={14} color={theme.accent} />, bg: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : '#CCFBF1' },
    { id: 'more', name: 'More', icon: <SlidersHorizontal size={14} color={theme.textMuted} />, bg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' },
  ], [isDarkMode, theme]);

  const bentoCollections = useMemo(() => [
    { id: 'c1', title: 'Farm Fresh', subtitle: 'Organics & Veggies', gradient: ['#0F766E', '#0D9488'], categoryId: 'fruits-veg', image: IMAGES.catFruitsVeggies },
    { id: 'c2', title: 'Daily Dairy', subtitle: 'Milk, Eggs & Butter', gradient: ['#D97706', '#F59E0B'], categoryId: 'dairy-eggs', image: IMAGES.catDairyEggs },
    { id: 'c3', title: 'Snack Attack', subtitle: 'Chips & Nuts', gradient: ['#C026D3', '#E11D48'], categoryId: 'snacks-munchies', image: IMAGES.catSnacksMunchies },
    { id: 'c4', title: 'Cool Drinks', subtitle: 'Juices & Sodas', gradient: ['#2563EB', '#3B82F6'], categoryId: 'beverages', image: IMAGES.catBeverages },
  ], []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* ─── Ambient Orbs Background ─── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={[styles.ambientOrb, { backgroundColor: '#2563EB', top: '-5%', left: '-10%' }]} />
        <View style={[styles.ambientOrb, { backgroundColor: '#06B6D4', top: '35%', right: '-15%' }]} />
        <View style={[styles.ambientOrb, { backgroundColor: '#8B5CF6', bottom: '-10%', left: '10%' }]} />
      </View>

      {/* ─── Floating Dual-Capsule Navbar ─── */}
      <View style={[styles.floatingHeader, { top: insets.top + 10 }]}>
        <TactileView onPress={() => setShowAddressModal(true)} style={styles.leftPod}>
          <BlurView intensity={isDarkMode ? 40 : 80} tint={isDarkMode ? 'dark' : 'light'} style={styles.podBlur}>
            <View style={styles.avatarWrapper}>
              <Image source={IMAGES.avatar} style={styles.avatarImage} />
              <View style={styles.liveIndicatorRing}>
                <View style={styles.liveIndicatorDot} />
              </View>
            </View>
            <View style={{ marginLeft: 8, paddingRight: 8, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.podSubtitle, { color: theme.textMuted }]}>Delivering to</Text>
                <ChevronDown size={10} color={theme.accent} />
              </View>
              <Text style={[styles.podTitle, { color: theme.text }]} numberOfLines={1}>
                {address ? (address.length > 15 ? `${address.substring(0, 15)}...` : address) : 'Select Location'}
              </Text>
            </View>
          </BlurView>
        </TactileView>

        <View style={styles.rightPod}>
          <BlurView intensity={isDarkMode ? 40 : 80} tint={isDarkMode ? 'dark' : 'light'} style={styles.podBlurRow}>
            <TactileView onPress={() => navigation.navigate('Search', { autoFocusSearch: false })} style={styles.podIconBtn}>
              <SlidersHorizontal size={18} color={theme.textMuted} />
            </TactileView>
            <View style={[styles.podDivider, { backgroundColor: theme.border }]} />
            
            <TactileView onPress={() => Alert.alert('Notifications', 'No new alerts.')} style={styles.podIconBtn}>
              <Bell size={18} color={theme.textMuted} />
              <View style={styles.notificationDot} />
            </TactileView>
          </BlurView>
        </View>
      </View>

      {/* ─── Main Content ScrollView ─── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
      >
        <View style={styles.greetingSection}>
          <Text style={[styles.greetingTitle, { color: theme.text }]}>Hey {user?.name ? user.name.split(' ')[0] : 'there'}! 👋</Text>
          <Text style={[styles.greetingSubtitle, { color: theme.textMuted }]}>Order fresh essentials nearby</Text>
        </View>

        {/* Search Glass Bar */}
        <TactileView onPress={() => navigation.navigate('Search')} style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <GlassCard isDark={isDarkMode} intensity={isDarkMode ? 30 : 80} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Search size={20} color={theme.textMuted} style={{ marginRight: 12 }} />
            <Text style={[styles.searchPlaceholder, { color: theme.textMuted }]}>{SEARCH_PLACEHOLDERS[placeholderIndex]}</Text>
            <View style={[styles.micBtn, { backgroundColor: theme.input }]}>
              <Mic size={16} color={theme.accent} />
            </View>
          </GlassCard>
        </TactileView>

        {/* Radius Filter Glass */}
        <GlassCard isDark={isDarkMode} intensity={isDarkMode ? 20 : 60} style={styles.radiusFilterCard}>
          <View style={styles.radiusHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color={theme.accent} />
              <Text style={[styles.radiusTitleText, { color: theme.text }]}>Store Radius</Text>
            </View>
            <View style={[styles.radiusPillBadge, { backgroundColor: isDarkMode ? 'rgba(6,182,212,0.2)' : '#E0F2FE' }]}>
              <Text style={[styles.radiusPillText, { color: theme.accent }]}>{tempRadius} km</Text>
            </View>
          </View>
          <View style={styles.sliderContainerRow}>
            <Text style={styles.sliderBoundaryText}>1km</Text>
            <Slider
              style={styles.radiusSlider}
              minimumValue={1} maximumValue={500} step={5}
              value={tempRadius}
              onValueChange={(val) => setTempRadius(Math.round(val))}
              onSlidingComplete={(val) => setRadiusRange(Math.round(val))}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.accent}
            />
            <Text style={styles.sliderBoundaryText}>500km</Text>
          </View>
        </GlassCard>

        {/* Promo Banners */}
        <View style={styles.bannerWrapper}>
          <FlatList
            data={banners} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onScroll={handleBannerScroll} scrollEventThrottle={16} keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
                <TactileView onPress={() => navigation.navigate('Search')}>
                  <GlassCard isDark={isDarkMode} style={styles.bannerCardContainer}>
                    <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bannerGradientBackground}>
                      <View style={styles.bannerTextColumn}>
                        <View style={styles.bannerBadgePill}>
                          <Sparkles size={10} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bannerBadgePillText}>{item.badge}</Text>
                        </View>
                        <Text style={styles.bannerHeadlineText}>{item.title}</Text>
                        <View style={styles.bannerCtaButton}>
                          <Text style={styles.bannerCtaText}>Shop Now</Text>
                          <ArrowRight size={12} color="#000" style={{ marginLeft: 4 }} />
                        </View>
                      </View>
                      <Image source={item.image} style={styles.bannerRiderGraphic} resizeMode="contain" />
                    </LinearGradient>
                  </GlassCard>
                </TactileView>
              </View>
            )}
          />
          <View style={styles.carouselPaginationDots}>
            {banners.map((_, idx) => (
              <View key={idx} style={[styles.paginationDot, bannerIndex === idx && { backgroundColor: theme.accent, width: 16 }]} />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionGridContainer}>
          {[
            { icon: IMAGES.productsIcon, title: 'Products', sub: 'Near you', action: () => setActiveCategory('all'), bg: isDarkMode ? 'rgba(204,251,241,0.1)' : '#CCFBF1' },
            { icon: IMAGES.shopsIcon, title: 'Stores', sub: 'Open now', action: () => navigation.navigate('Categories'), bg: isDarkMode ? 'rgba(254,243,199,0.1)' : '#FEF3C7' },
            { icon: IMAGES.exploreIcon, title: 'Bundles', sub: 'Instant deals', action: () => setShowQuickOrderModal(true), bg: isDarkMode ? 'rgba(224,231,255,0.1)' : '#E0E7FF' },
          ].map((item, i) => (
            <TactileView key={i} onPress={item.action} style={{ flex: 1 }}>
              <GlassCard isDark={isDarkMode} intensity={20} style={styles.quickActionTile}>
                <View style={[styles.quickActionIconBox, { backgroundColor: item.bg }]}>
                  <Image source={item.icon} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
                <Text style={[styles.quickActionTitleText, { color: theme.text }]}>{item.title}</Text>
                <Text style={styles.quickActionSubtext}>{item.sub}</Text>
              </GlassCard>
            </TactileView>
          ))}
        </View>

        {/* Glass Category Chips */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderTitleText, { color: theme.text }]}>Browse Categories</Text>
          <TactileView onPress={() => navigation.navigate('Categories')}>
            <Text style={[styles.sectionSeeAllText, { color: theme.accent }]}>View All</Text>
          </TactileView>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesHorizontalScroll}>
          {categoryItems.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <TactileView key={cat.id} onPress={() => { if (cat.id === 'more') navigation.navigate('Categories'); else { setActiveCategory(cat.id); setCategoryStore(cat.id); } }}>
                <GlassCard 
                  isDark={isDarkMode} 
                  intensity={isActive ? 60 : 20} 
                  style={[styles.glassChip, { borderColor: isActive ? theme.accent : theme.border, backgroundColor: isActive ? (isDarkMode ? 'rgba(6,182,212,0.2)' : '#E0F2FE') : 'transparent' }]}
                >
                  <View style={[styles.chipIconBox, { backgroundColor: cat.bg }]}>
                    {cat.icon}
                  </View>
                  <Text style={[styles.chipText, { color: isActive ? theme.text : theme.textMuted }]}>{cat.name}</Text>
                </GlassCard>
              </TactileView>
            );
          })}
        </ScrollView>

        {/* Bento Curations */}
        <Text style={[styles.bentoSectionTitle, { color: theme.text }]}>Curated Collections</Text>
        <View style={styles.bentoGridWrapper}>
          {bentoCollections.map(col => (
            <TactileView key={col.id} onPress={() => setActiveCategory(col.categoryId)} style={styles.bentoCardItem}>
              <LinearGradient colors={col.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bentoGradientCard}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.bentoCardTitle}>{col.title}</Text>
                  <Text style={styles.bentoCardSub}>{col.subtitle}</Text>
                </View>
                <Image source={col.image} style={{ width: 40, height: 40 }} resizeMode="contain" />
              </LinearGradient>
            </TactileView>
          ))}
        </View>

        {/* Dual Promo Cards */}
        <View style={styles.dualPromoRowContainer}>
          <TactileView onPress={() => navigation.navigate('Search')} style={{ flex: 1 }}>
            <GlassCard isDark={isDarkMode} style={[styles.dualPromoCardTile, { backgroundColor: isDarkMode ? 'rgba(5,150,105,0.2)' : '#ECFDF5' }]}>
              <View style={{ flex: 1.3 }}>
                <Text style={[styles.dualPromoHeadline, { color: isDarkMode ? '#6EE7B7' : '#047857' }]}>Super Saver</Text>
                <Text style={[styles.dualPromoSub, { color: isDarkMode ? '#A7F3D0' : '#475569' }]}>Up to 40% OFF</Text>
              </View>
              <Image source={IMAGES.dealSaver} style={styles.dualPromoIllustration} resizeMode="contain" />
            </GlassCard>
          </TactileView>
          <TactileView onPress={() => setShowQuickOrderModal(true)} style={{ flex: 1 }}>
            <GlassCard isDark={isDarkMode} style={[styles.dualPromoCardTile, { backgroundColor: isDarkMode ? 'rgba(220,38,38,0.2)' : '#FEE2E2' }]}>
              <View style={{ flex: 1.3 }}>
                <Text style={[styles.dualPromoHeadline, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}>Instant Book</Text>
                <Text style={[styles.dualPromoSub, { color: isDarkMode ? '#FECACA' : '#475569' }]}>Pick up fast</Text>
              </View>
              <Image source={IMAGES.dealLightning} style={styles.dualPromoIllustration} resizeMode="contain" />
            </GlassCard>
          </TactileView>
        </View>

        {/* Spotlight QShops */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeaderTitleText, { color: theme.primary }]}>Spotlight</Text>
            <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>Featured QShops near you</Text>
          </View>
          <TactileView onPress={() => navigation.navigate('Categories')}>
            <Text style={[styles.sectionSeeAllText, { color: theme.accent }]}>See All</Text>
          </TactileView>
        </View>

        {loadingData ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
        ) : nearbyShops.length === 0 ? (
          <GlassCard isDark={isDarkMode} intensity={20} style={[styles.emptyStateCard, { marginHorizontal: 16, marginBottom: 24 }]}>
            <Store size={28} color={theme.textMuted} />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Shops Nearby</Text>
            <Text style={[styles.emptyStateSub, { color: theme.textMuted }]}>Try increasing the Store Radius above, or check back later.</Text>
          </GlassCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, marginBottom: 24 }}>
            {nearbyShops.map(shop => {
              const saved = wishlistSet.has(shop.id);
              const logoColor = shop.logoColor || theme.primary;
              const logoLetter = shop.logoLetter || (shop.name ? shop.name.charAt(0).toUpperCase() : 'S');
              return (
                <TactileView key={shop.id} onPress={() => navigation.navigate('ShopProfile', { shopId: shop.id })}>
                  <GlassCard isDark={isDarkMode} intensity={20} style={styles.shopCardItem}>
                    <View style={styles.shopTopRow}>
                      {shop.logo ? <Image source={{ uri: shop.logo }} style={styles.shopAvatarImage} /> : 
                        <View style={[styles.shopAvatarLetterContainer, { backgroundColor: logoColor }]}><Text style={styles.shopAvatarLetterText}>{logoLetter}</Text></View>}
                      <TactileView onPress={() => handleToggleShopWishlist(shop)} style={styles.shopHeartButton}>
                        <Heart size={16} color={saved ? theme.danger : theme.textMuted} fill={saved ? theme.danger : 'transparent'} />
                      </TactileView>
                    </View>
                    <Text style={[styles.shopNameText, { color: theme.text }]} numberOfLines={1}>{shop.name || 'Store'}</Text>
                    <View style={styles.shopMetaRow}>
                      <Star size={12} color="#F59E0B" fill="#F59E0B" />
                      <Text style={[styles.shopRatingNumber, { color: theme.text }]}>{shop.averageRating || shop.rating || '4.5'}</Text>
                      <Text style={[styles.shopReviewCount, { color: theme.textMuted }]}>({shop._count?.reviews || shop.reviews || '0'})</Text>
                    </View>
                    <Text style={[styles.shopDistanceTimeText, { color: theme.textMuted }]}>
                      {typeof shop.distance_km === 'number' ? `${shop.distance_km.toFixed(1)} km` : shop.time ? `${shop.time} • 1.2 km` : '~nearby'}
                    </Text>
                  </GlassCard>
                </TactileView>
              );
            })}
          </ScrollView>
        )}

        {/* Trending Products */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderTitleText, { color: theme.text }]}>Trending Products</Text>
          <TactileView onPress={() => navigation.navigate('Search')}>
            <Text style={[styles.sectionSeeAllText, { color: theme.accent }]}>See All</Text>
          </TactileView>
        </View>

        {loadingData ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
        ) : displayProducts.length === 0 ? (
          <GlassCard isDark={isDarkMode} intensity={20} style={[styles.emptyStateCard, { marginHorizontal: 16, marginBottom: 24 }]}>
            <Package size={28} color={theme.textMuted} />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Products Found</Text>
            <Text style={[styles.emptyStateSub, { color: theme.textMuted }]}>{activeCategory !== 'all' ? 'Try switching to "All" category.' : 'Sellers in your area haven\'t listed products yet.'}</Text>
            <TactileView onPress={() => navigation.navigate('Search')} style={[styles.emptyStateCta, { borderColor: theme.accent }]}>
              <Text style={[styles.emptyStateCtaText, { color: theme.accent }]}>Browse All</Text>
            </TactileView>
          </GlassCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, marginBottom: 24 }}>
            {displayProducts.map(prod => {
              const qty = cartQtyMap[prod.id] || 0;
              const hasImg = prod.images && prod.images.length > 0;
              return (
                <TactileView key={prod.id} onPress={() => {
                  if (prod.campaignId) {
                    telemetryService.trackClick(prod.campaignId, prod.id);
                  }
                  navigation.navigate('ProductDetail', { 
                    productId: prod.id,
                    campaignId: prod.campaignId || undefined
                  });
                }}>
                  <GlassCard isDark={isDarkMode} intensity={20} style={styles.productCardItem}>
                    <View style={[styles.productImageFrame, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)' }]}>
                      <Image source={hasImg ? { uri: prod.images[0] } : IMAGES.prodMilk} style={styles.productGraphicImage} resizeMode="contain" />
                      <TactileView style={[styles.productHeartIconBtn, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        <Heart size={12} color={theme.textMuted} />
                      </TactileView>
                    </View>
                    <View style={styles.productInfoWrapper}>
                      <Text style={[styles.productTitleText, { color: theme.text }]} numberOfLines={2}>{prod.name || 'Product'}</Text>
                      <Text style={[styles.productUnitText, { color: theme.textMuted }]}>{prod.unit || '1 unit'}</Text>
                    </View>
                    <View style={styles.productFooterRow}>
                      <Text style={[styles.productPriceText, { color: theme.text }]}>{formatPrice(prod.price || 0)}</Text>
                      {qty > 0 ? (
                        <View style={[styles.quantityStepperContainer, { backgroundColor: theme.accent }]}>
                          <TactileView onPress={() => updateQuantity(prod.id, qty - 1)} style={{ padding: 4 }}><Minus size={12} color="#FFF" /></TactileView>
                          <Text style={styles.stepperCountText}>{qty}</Text>
                          <TactileView onPress={() => updateQuantity(prod.id, qty + 1)} style={{ padding: 4 }}><Plus size={12} color="#FFF" /></TactileView>
                        </View>
                      ) : (
                        <TactileView onPress={() => handleAddProductToCart(prod)} style={[styles.addToCartButton, { borderColor: theme.accent }]}>
                          <Text style={[styles.addToCartButtonText, { color: theme.accent }]}>ADD</Text>
                        </TactileView>
                      )}
                    </View>
                  </GlassCard>
                </TactileView>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      {/* ─── Bottom Sheet Modals ─── */}
      <Modal visible={showAddressModal} transparent animationType="slide">
        <View style={styles.modalBackdropOverlay}>
          <BlurView intensity={isDarkMode ? 30 : 60} tint="dark" style={StyleSheet.absoluteFill} />
          <GlassCard isDark={isDarkMode} style={[styles.modalBottomSheetContainer, { backgroundColor: theme.bg }]}>
            <View style={[styles.bottomSheetDragHandle, { backgroundColor: theme.border }]} />
            <View style={styles.bottomSheetHeaderRow}>
              <Text style={[styles.bottomSheetHeaderTitle, { color: theme.text }]}>Select Location</Text>
              <TactileView onPress={() => setShowAddressModal(false)} style={styles.closeIconButton}>
                <X size={22} color={theme.text} />
              </TactileView>
            </View>
            <TactileView onPress={handleGetCurrentLocation} style={[styles.locationOptionRow, { borderBottomColor: theme.border }]}>
              {loadingLocation ? <ActivityIndicator size="small" color={theme.accent} /> : <Locate size={20} color={theme.accent} />}
              <Text style={[styles.locationOptionTextPrimary, { color: theme.accent }]}>Use Current Location (GPS)</Text>
            </TactileView>
            <TactileView onPress={() => { setShowAddressModal(false); setShowMapPicker(true); }} style={[styles.locationOptionRow, { borderBottomColor: theme.border }]}>
              <MapPin size={20} color={theme.accent} />
              <Text style={[styles.locationOptionTextPrimary, { color: theme.accent }]}>Pick Location on Map</Text>
            </TactileView>
            <Text style={[styles.savedAddressesSublabel, { color: theme.textMuted }]}>Preset Addresses</Text>
            {PRESET_LOCATIONS.map((loc) => (
              <TactileView key={loc.label} onPress={() => { setLocation(loc.lat, loc.lng, loc.label, loc.city, loc.pincode); setShowAddressModal(false); }} style={[styles.presetLocationRow, { borderBottomColor: theme.border }]}>
                <HomeIcon size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.presetLocationText, { color: address === loc.label ? theme.accent : theme.text }]} numberOfLines={1}>{loc.label}</Text>
              </TactileView>
            ))}
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={showQuickOrderModal} transparent animationType="slide">
        <View style={styles.modalBackdropOverlay}>
          <BlurView intensity={isDarkMode ? 30 : 60} tint="dark" style={StyleSheet.absoluteFill} />
          <GlassCard isDark={isDarkMode} style={[styles.modalBottomSheetContainer, { backgroundColor: theme.bg }]}>
            <View style={[styles.bottomSheetDragHandle, { backgroundColor: theme.border }]} />
            <View style={styles.bottomSheetHeaderRow}>
              <Text style={[styles.bottomSheetHeaderTitle, { color: theme.text }]}>Instant Combo Bundles</Text>
              <TactileView onPress={() => setShowQuickOrderModal(false)} style={styles.closeIconButton}>
                <X size={22} color={theme.text} />
              </TactileView>
            </View>
            <TactileView onPress={() => { setShowQuickOrderModal(false); Alert.alert('Added', 'Breakfast Combo added!'); }} style={[styles.presetLocationRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.presetLocationText, { color: theme.text }]}>🍳 Breakfast Combo (Milk + Bread) • ₹90</Text>
            </TactileView>
            <TactileView onPress={() => { setShowQuickOrderModal(false); Alert.alert('Added', 'Fruit Basket added!'); }} style={[styles.presetLocationRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.presetLocationText, { color: theme.text }]}>🥗 Fruit Basket Combo (Apples + Bananas) • ₹220</Text>
            </TactileView>
          </GlassCard>
        </View>
      </Modal>

      <MapPickerModal visible={showMapPicker} onClose={() => setShowMapPicker(false)} initialLatitude={latitude} initialLongitude={longitude} onSelectLocation={(l, lg, a, c, p) => setLocation(l, lg, a, c, p)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambientOrb: {
    position: 'absolute',
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    borderRadius: 999,
    opacity: 0.25,
  },
  floatingHeader: {
    position: 'absolute', left: 16, right: 16, zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  leftPod: { borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  podBlur: { flexDirection: 'row', alignItems: 'center', padding: 6, paddingRight: 12, backgroundColor: 'rgba(0,0,0,0.2)' },
  avatarWrapper: { position: 'relative' },
  avatarImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#06B6D4' },
  liveIndicatorRing: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#050814', alignItems: 'center', justifyContent: 'center' },
  liveIndicatorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  podTitle: { fontSize: 13, fontWeight: '800', maxWidth: 120 },
  podSubtitle: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rightPod: { borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  podBlurRow: { flexDirection: 'row', alignItems: 'center', padding: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  podIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  podDivider: { width: 1, height: 16, marginHorizontal: 2 },
  notificationDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  greetingSection: { paddingHorizontal: 16, paddingBottom: 16 },
  greetingTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  greetingSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  searchPlaceholder: { flex: 1, fontSize: 13, fontWeight: '500' },
  micBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radiusFilterCard: { marginHorizontal: 16, borderRadius: 16, padding: 14, marginBottom: 16 },
  radiusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  radiusTitleText: { fontSize: 12, fontWeight: '700' },
  radiusPillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  radiusPillText: { fontSize: 11, fontWeight: '800' },
  sliderContainerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radiusSlider: { flex: 1, height: 28, marginHorizontal: 6 },
  sliderBoundaryText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  bannerWrapper: { marginBottom: 16 },
  bannerCardContainer: { height: 140, borderRadius: 24, overflow: 'hidden', borderWidth: 0 },
  bannerGradientBackground: { flex: 1, flexDirection: 'row', padding: 18, alignItems: 'center' },
  bannerTextColumn: { flex: 1.3, justifyContent: 'center' },
  bannerBadgePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, marginBottom: 8 },
  bannerBadgePillText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  bannerHeadlineText: { fontSize: 18, fontWeight: '800', color: '#FFF', lineHeight: 22 },
  bannerCtaButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, marginTop: 10 },
  bannerCtaText: { fontSize: 11, fontWeight: '800', color: '#000' },
  bannerRiderGraphic: { flex: 0.7, height: 96 },
  carouselPaginationDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.5)' },
  quickActionGridContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 22, gap: 12 },
  quickActionTile: { height: 100, borderRadius: 20, padding: 12, alignItems: 'center', justifyContent: 'center' },
  quickActionIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionTitleText: { fontSize: 12, fontWeight: '800' },
  quickActionSubtext: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionHeaderTitleText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sectionSeeAllText: { fontSize: 12, fontWeight: '700' },
  categoriesHorizontalScroll: { paddingLeft: 16, paddingRight: 8, marginBottom: 22, gap: 12 },
  glassChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, gap: 8 },
  chipIconBox: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  bentoSectionTitle: { fontSize: 16, fontWeight: '800', marginHorizontal: 16, marginBottom: 12 },
  bentoGridWrapper: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, justifyContent: 'space-between', marginBottom: 22 },
  bentoCardItem: { width: '48%', height: 84, borderRadius: 20, overflow: 'hidden' },
  bentoGradientCard: { flex: 1, flexDirection: 'row', padding: 12, alignItems: 'center' },
  bentoCardTitle: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  bentoCardSub: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  dualPromoRowContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  dualPromoCardTile: { height: 90, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center' },
  dualPromoHeadline: { fontSize: 12, fontWeight: '800', lineHeight: 15 },
  dualPromoSub: { fontSize: 9, marginTop: 4, fontWeight: '500' },
  dualPromoIllustration: { width: 44, height: 44, flex: 0.7 },
  shopCardItem: { width: 160, borderRadius: 20, padding: 12, justifyContent: 'space-between' },
  shopTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  shopAvatarLetterContainer: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shopAvatarLetterText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  shopHeartButton: { padding: 4 },
  shopNameText: { fontSize: 13, fontWeight: '800', marginTop: 10 },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  shopRatingNumber: { fontSize: 11, fontWeight: '700' },
  shopReviewCount: { fontSize: 9 },
  shopDistanceTimeText: { fontSize: 9, marginTop: 4 },
  productCardItem: { width: 140, borderRadius: 20, padding: 10 },
  productImageFrame: { height: 100, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  productGraphicImage: { width: '80%', height: '80%' },
  productHeartIconBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  productInfoWrapper: { marginTop: 8 },
  productTitleText: { fontSize: 12, fontWeight: '700', height: 32, lineHeight: 16 },
  productUnitText: { fontSize: 9, marginTop: 2 },
  productFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  productPriceText: { fontSize: 13, fontWeight: '800' },
  addToCartButton: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  addToCartButtonText: { fontSize: 10, fontWeight: '800' },
  quantityStepperContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2 },
  stepperCountText: { fontSize: 11, fontWeight: '800', color: '#FFF', marginHorizontal: 6 },
  emptyStateCard: { padding: 24, borderRadius: 20, alignItems: 'center', gap: 8, marginBottom: 24 },
  emptyStateTitle: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  emptyStateSub: { fontSize: 11, textAlign: 'center', lineHeight: 16, opacity: 0.8 },
  emptyStateCta: { marginTop: 8, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  emptyStateCtaText: { fontSize: 12, fontWeight: '700' },
  modalBackdropOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBottomSheetContainer: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, paddingBottom: 40, borderTopWidth: 1 },
  bottomSheetDragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  bottomSheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bottomSheetHeaderTitle: { fontSize: 18, fontWeight: '800' },
  closeIconButton: { padding: 4 },
  locationOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  locationOptionTextPrimary: { fontSize: 14, fontWeight: '700', marginLeft: 12 },
  savedAddressesSublabel: { fontSize: 11, fontWeight: '700', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  presetLocationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  presetLocationText: { fontSize: 13, fontWeight: '600', flex: 1 },
});
