import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import shopService from '../../services/shopService';
import adsService from '../../services/adsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  image: string;
  price: number;
}

interface PromotionCampaignAnalytics {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  budget: number;
  spent: number;
  clicks: number;
  conversions: number;
  revenue: number;
  impressions: number;
  searchAppearances: number;
  ctr: number;
  cpc: number;
  budgetRemaining: number;
  isActive: boolean;
  isLive?: boolean;
  isDeletedProduct?: boolean;
  state?: 'LIVE' | 'HISTORY';
  topKeywords: { keyword: string; impressions: number; clicks: number }[];
}

type CampaignFilter = 'ALL' | 'ACTIVE' | 'HISTORY';

const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13, 148, 136, 0.08)',
  success: '#10B981',
  successFaded: 'rgba(16, 185, 129, 0.08)',
  error: '#EF4444',
  errorFaded: 'rgba(239, 68, 68, 0.08)',
  warning: '#F59E0B',
  warningFaded: 'rgba(245, 158, 11, 0.08)',
  info: '#3B82F6',
  infoFaded: 'rgba(59, 130, 246, 0.08)',
  purple: '#8B5CF6',
  purpleFaded: 'rgba(139, 92, 246, 0.08)',
  gray900: '#1F2937',
  gray700: '#4B5563',
  gray500: '#9CA3AF',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

const SPRING_SOFT = { damping: 15, stiffness: 180, useNativeDriver: true as true };
const SPRING_SNAP = { damping: 12, stiffness: 220, useNativeDriver: true as true };

const AnimatedPressable: React.FC<{
  onPress?: () => void;
  style?: any;
  containerStyle?: any;
  activeOpacity?: number;
  children: React.ReactNode;
}> = ({ onPress, style, containerStyle, activeOpacity = 0.9, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, ...SPRING_SNAP }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, ...SPRING_SOFT }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={activeOpacity}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const AnimatedEntry: React.FC<{
  delay: number;
  children: React.ReactNode;
  style?: any;
}> = ({ delay, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 14,
        stiffness: 140,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

const getSafeImageUri = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') return null;
  return normalized;
};

export default function PromoteProductScreen() {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dailyBudget, setDailyBudget] = useState('500');
  const [bidPerClick, setBidPerClick] = useState('10');
  const [duration, setDuration] = useState('30');
  const [loading, setLoading] = useState(true);
  const [activeAds, setActiveAds] = useState(0);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewBudgetAmount, setRenewBudgetAmount] = useState('500');
  const [selectedCampaignForRenew, setSelectedCampaignForRenew] = useState<PromotionCampaignAnalytics | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [campaignAnalytics, setCampaignAnalytics] = useState<PromotionCampaignAnalytics[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('ALL');
  const [dailyMetrics, setDailyMetrics] = useState<{date: string; impressions: number; clicks: number}[]>([]);

  const { onScroll: _onScroll, scrollEventThrottle } = useHideTabBarOnScroll();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({ inputRange: [40, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  // Frosted circular back button interpolation on scroll
  const backBg = scrollY.interpolate({
    inputRange: [40, 80],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(13, 148, 136, 0.08)'],
    extrapolate: 'clamp',
  });
  const backBorder = scrollY.interpolate({
    inputRange: [40, 80],
    outputRange: ['rgba(255, 255, 255, 0.3)', 'rgba(13, 148, 136, 0.15)'],
    extrapolate: 'clamp',
  });
  const backIconColor = scrollY.interpolate({
    inputRange: [40, 80],
    outputRange: ['#FFFFFF', '#0D9488'],
    extrapolate: 'clamp',
  });

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    try {
      setLoading(true);
      const myShopsResponse = await shopService.getMyShops();
      const myShops = Array.isArray(myShopsResponse.data)
        ? myShopsResponse.data
        : myShopsResponse.data?.shops || [];

      if (!myShops.length) {
        setProducts([]);
        setActiveAds(0);
        return;
      }

      const primaryShop = myShops[0];
      setShopId(primaryShop.id);

      const ads = await adsService.getShopAds(primaryShop.id);
      const promotionAnalytics = await adsService.getShopPromotionAnalytics(primaryShop.id);
      const metrics = await adsService.getShopDailyMetrics(primaryShop.id);

      const productsResponse = await shopService.getProducts(primaryShop.id, { page: 1, sort: 'newest' });
      const productList = Array.isArray(productsResponse.data)
        ? productsResponse.data
        : productsResponse.data?.products || [];

      const normalizedProducts: Product[] = productList.map((product: any) => ({
        id: product.id,
        name: product.name,
        image: product.images?.[0] || product.image || 'https://placehold.co/100x100/F1F5F9/64748B?text=Product',
        price: product.price,
      }));

      setProducts(normalizedProducts);
      setActiveAds(
        Number(
          promotionAnalytics?.summary?.activeCampaigns ||
          (Array.isArray(ads) ? ads.filter((ad: any) => ad?.isLive).length : 0)
        )
      );
      setCampaignAnalytics(Array.isArray(promotionAnalytics?.campaigns) ? promotionAnalytics.campaigns : []);
      setAnalyticsSummary(promotionAnalytics?.summary || null);
      setDailyMetrics(Array.isArray(metrics) ? metrics : []);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = async () => {
    if (!selectedProduct || !shopId) return;

    const parsedDailyBudget = Number(dailyBudget);
    const parsedBidPerClick = Number(bidPerClick);
    const parsedDuration = Number(duration);

    if (!Number.isFinite(parsedDailyBudget) || parsedDailyBudget < 100) {
      Alert.alert('Invalid Budget', 'Daily budget should be at least ₹100.');
      return;
    }
    if (!Number.isFinite(parsedBidPerClick) || parsedBidPerClick < 1) {
      Alert.alert('Invalid Bid', 'Bid per click should be at least ₹1.');
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1) {
      Alert.alert('Invalid Duration', 'Duration should be at least 1 day.');
      return;
    }

    try {
      await adsService.createAd({
        productId: selectedProduct.id,
        shopId,
        title: `Promoted: ${selectedProduct.name}`,
        description: `Boost visibility for ${selectedProduct.name}`,
        budget: parsedDailyBudget * parsedDuration,
        budgetPerDay: parsedDailyBudget,
        bidPerClick: parsedBidPerClick,
        duration: parsedDuration,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + parsedDuration * 24 * 60 * 60 * 1000).toISOString(),
      } as any);

      setShowModal(false);
      Alert.alert('Ad Created', 'Your promotion is active and eligible for boosted ranking.');
      setShowModal(false);
      loadProducts();
    } catch (error) {
      Alert.alert('Error', 'Failed to create promotion campaign');
    }
  };

  const handleRenewBudget = async () => {
    if (!selectedCampaignForRenew) return;

    const parsedRenewBudget = Number(renewBudgetAmount);
    if (!Number.isFinite(parsedRenewBudget) || parsedRenewBudget < 100) {
      Alert.alert('Invalid Budget', 'Renew budget should be at least ₹100.');
      return;
    }

    try {
      await adsService.renewBudget(selectedCampaignForRenew.id, parsedRenewBudget);
      Alert.alert('Success', 'Campaign budget renewed successfully!');
      setShowRenewModal(false);
      loadProducts();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to renew campaign budget');
    }
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e: any) => _onScroll(e),
  });

  const generateAnalyticsChart = (dataPoints: number[], width: number, height: number) => {
    if (dataPoints.length < 2) return { line: '', closed: '', points: [] };
    const max = Math.max(...dataPoints, 1);
    const min = Math.min(...dataPoints, 0);
    const range = max - min;
    const xStep = width / (dataPoints.length - 1);

    const points = dataPoints.map((val, index) => {
      const x = index * xStep;
      const y = height - ((val - min) / range) * (height - 12) - 6;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const closed = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { line, closed, points };
  };

  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 64;
  const ctrTrend = dailyMetrics.map(m => m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0);
  const chartData = ctrTrend.length >= 2 ? ctrTrend : [0, 0];
  const { line: chartLine, closed: chartClosed, points: chartPoints } = generateAnalyticsChart(chartData, chartWidth, chartHeight);

  const estimatedMonthlySpend = (parseFloat(dailyBudget) * parseInt(duration)).toFixed(0);
  const estimatedClicks = (parseFloat(estimatedMonthlySpend) / parseFloat(bidPerClick)).toFixed(0);
  const liveCampaigns = campaignAnalytics.filter((campaign) => Boolean(campaign.isLive));
  const historyCampaigns = campaignAnalytics.filter((campaign) => !campaign.isLive);
  const filteredCampaigns = campaignAnalytics.filter((campaign) => {
    if (campaignFilter === 'ACTIVE') return Boolean(campaign.isLive);
    if (campaignFilter === 'HISTORY') return !campaign.isLive;
    return true;
  });
  const selectedProductImageUri = getSafeImageUri(selectedProduct?.image);

  const renderCampaignCard = (campaign: PromotionCampaignAnalytics) => {
    const campaignImageUri = getSafeImageUri(campaign.productImage);
    const isLive = Boolean(campaign.isLive);
    const isDeletedProduct = Boolean(campaign.isDeletedProduct);
    const badgeBackground = isDeletedProduct
      ? DS.error + '15'
      : isLive
        ? DS.success + '15'
        : DS.gray300 + '50';
    const badgeColor = isDeletedProduct
      ? DS.error
      : isLive
        ? DS.success
        : DS.gray500;
    const badgeLabel = isDeletedProduct ? 'DELETED' : isLive ? 'LIVE' : 'COMPLETED';

    // Calculate progress
    const spentAmount = campaign.spent || 0;
    const totalBudget = campaign.budget || 1;
    const ratio = Math.min(1, spentAmount / totalBudget);
    const percentage = Math.round(ratio * 100);

    return (
      <View key={campaign.id} style={s.campaignCard}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={s.campaignImageWrap}>
            {campaignImageUri ? (
              <Image source={{ uri: campaignImageUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cube-outline" size={20} color={DS.gray500} />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={s.campaignTitle} numberOfLines={1}>
                {campaign.productName}
              </Text>
              <View style={[s.campaignBadge, { backgroundColor: badgeBackground }]}>
                {isLive && <View style={s.campaignLivePulse} />}
                <Text style={[s.campaignBadgeText, { color: badgeColor }]}>
                  {badgeLabel}
                </Text>
              </View>
            </View>

            <View style={s.campaignMetricsRow}>
              <View style={s.campaignMiniMetric}>
                <Text style={s.miniMetricVal}>{campaign.searchAppearances.toLocaleString()}</Text>
                <Text style={s.miniMetricLbl}>Impressions</Text>
              </View>
              <View style={s.campaignMiniMetric}>
                <Text style={s.miniMetricVal}>{campaign.clicks.toLocaleString()}</Text>
                <Text style={s.miniMetricLbl}>Clicks</Text>
              </View>
              <View style={s.campaignMiniMetric}>
                <Text style={s.miniMetricVal}>{campaign.conversions.toLocaleString()}</Text>
                <Text style={s.miniMetricLbl}>Conversions</Text>
              </View>
              <View style={s.campaignMiniMetric}>
                <Text style={s.miniMetricVal}>{campaign.ctr.toFixed(2)}%</Text>
                <Text style={s.miniMetricLbl}>CTR</Text>
              </View>
              <View style={s.campaignMiniMetric}>
                <Text style={s.miniMetricVal}>₹{campaign.cpc.toFixed(1)}</Text>
                <Text style={s.miniMetricLbl}>CPC</Text>
              </View>
            </View>

            {/* Spent progress bar */}
            <View style={s.progressContainer}>
              <View style={s.progressTextRow}>
                <Text style={s.progressText}>Spent: ₹{spentAmount.toLocaleString()} / ₹{totalBudget.toLocaleString()}</Text>
                <Text style={s.progressPercentText}>{percentage}%</Text>
              </View>
              <View style={s.progressBarTrack}>
                <View style={[s.progressBarFill, { width: `${percentage}%`, backgroundColor: isLive ? DS.primary : DS.gray500 }]} />
              </View>
            </View>

            {campaign.isDeletedProduct && (
              <Text style={{ fontSize: 11, color: DS.error, marginTop: 6, fontWeight: '600' }}>
                Product was deleted. Campaign archived.
              </Text>
            )}
            {campaign.topKeywords?.length ? (
              <View style={s.keywordsRow}>
                <Ionicons name="search" size={10} color={DS.primary} />
                <Text style={s.keywordsText} numberOfLines={1}>
                  Keywords: {campaign.topKeywords.map(k => k.keyword).join(', ')}
                </Text>
              </View>
            ) : null}
            {!isLive && !campaign.isDeletedProduct && (
              <Button
                title="Renew Budget"
                variant="outline"
                onPress={() => {
                  setSelectedCampaignForRenew(campaign);
                  setShowRenewModal(true);
                }}
                style={{ marginTop: 12, borderColor: DS.primary, paddingVertical: 8, minHeight: 36 }}
                textStyle={{ color: DS.primary, fontSize: 13 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUri = getSafeImageUri(item.image);

    return (
      <AnimatedPressable
        onPress={() => {
          setSelectedProduct(item);
          setShowModal(true);
        }}
        activeOpacity={0.9}
        style={s.gridProductCard}
        containerStyle={{ width: '48%' }}
      >
        <View style={s.gridProductImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={24} color={DS.gray500} />
            </View>
          )}
          <View style={s.gridProductPriceBadge}>
            <Text style={s.gridProductPriceText}>₹{item.price}</Text>
          </View>
        </View>
        <View style={{ padding: 12 }}>
          <Text style={s.gridProductTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={s.gridPromoteButton}>
            <Text style={s.gridPromoteButtonText}>Boost Item</Text>
            <Ionicons name="rocket-sharp" size={12} color="#FFF" />
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.background }}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  const totalSpentVal = Number(analyticsSummary?.totalSpent || 0);
  const activeAdsVal = Number(analyticsSummary?.activeCampaigns || activeAds);
  const monthlyBudgetVal = Number(analyticsSummary?.totalBudget || activeAdsVal * 5000);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Floating Header on Scroll */}
      <View style={s.stickyHeader}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: headerOpacity }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.97)', borderBottomWidth: 1, borderBottomColor: DS.border }]} />
          )}
        </Animated.View>
        <View style={s.stickyHeaderInner}>
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Animated.View style={[s.backIconRing, { backgroundColor: backBg, borderColor: backBorder }]}>
                <Animated.Text style={{ color: backIconColor }}>
                  <Ionicons name="chevron-back" size={22} />
                </Animated.Text>
              </Animated.View>
            </TouchableOpacity>
          )}
          <Animated.Text style={[s.stickyTitle, { opacity: headerOpacity }]}>
            Promote Products
          </Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadProducts}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header Hero Section */}
        <View style={s.heroSection}>
          <LinearGradient colors={['#0D9488', '#0F766E']} style={StyleSheet.absoluteFill} />

          <View style={s.heroContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="megaphone-sharp" size={24} color="#FFF" />
              <Text style={s.heroTitle}>Promote Products</Text>
            </View>
            <Text style={s.heroSub}>Boost your local sales and visibility instantly</Text>

            <View style={s.heroStatsRow}>
              <View style={s.heroStatItem}>
                <Text style={s.heroStatLabel}>Active Ads</Text>
                <Text style={s.heroStatVal}>{activeAdsVal}</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStatItem}>
                <Text style={s.heroStatLabel}>Monthly Budget</Text>
                <Text style={s.heroStatVal}>₹{monthlyBudgetVal.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Promotion Analytics Spline Visual & Grid */}
        <View style={{ paddingHorizontal: 16, marginTop: -20, zIndex: 5 }}>
          <Card style={s.analyticsGridCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionHeader}>Ad Reach & ROI Indicator</Text>
              <View style={s.ctrTrendBadge}>
                <Ionicons name="trending-up" size={12} color={DS.success} />
                <Text style={s.ctrTrendBadgeText}>CTR Up 12%</Text>
              </View>
            </View>

            {/* Sparkline Graph */}
            {chartLine ? (
              <View style={s.chartContainer}>
                <Svg width={chartWidth} height={chartHeight}>
                  <Defs>
                    <SvgGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#0D9488" stopOpacity={0.25} />
                      <Stop offset="100%" stopColor="#0D9488" stopOpacity={0.0} />
                    </SvgGradient>
                  </Defs>
                  {/* Closed Area */}
                  <Path d={chartClosed} fill="url(#chartGrad)" />
                  {/* Line */}
                  <Path d={chartLine} fill="none" stroke={DS.primary} strokeWidth="3" />
                  {/* Circles representing points */}
                  {chartPoints.map((p, idx) => (
                    <Circle key={idx} cx={p.x} cy={p.y} r={idx === chartPoints.length - 1 ? 5 : 3.5} fill={DS.primaryDark} stroke="#FFF" strokeWidth="1.5" />
                  ))}
                </Svg>
              </View>
            ) : null}

            <View style={s.gridRowDivider} />

            <View style={s.gridRow}>
              <View style={s.gridItem}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Ionicons name="eye-outline" size={18} color={DS.info} />
                </View>
                <View>
                  <Text style={s.gridItemLbl}>Appearances</Text>
                  <Text style={s.gridItemVal}>
                    {Number(analyticsSummary?.totalSearchAppearances || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={s.gridItem}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(13, 148, 136, 0.1)' }]}>
                  <Ionicons name="hand-left-outline" size={18} color={DS.primary} />
                </View>
                <View>
                  <Text style={s.gridItemLbl}>Total Clicks</Text>
                  <Text style={s.gridItemVal}>
                    {Number(analyticsSummary?.totalClicks || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.gridRowDivider} />

            <View style={s.gridRow}>
              <View style={s.gridItem}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                  <Ionicons name="stats-chart-outline" size={18} color={DS.purple} />
                </View>
                <View>
                  <Text style={s.gridItemLbl}>Overall CTR</Text>
                  <Text style={[s.gridItemVal, { color: DS.primary }]}>
                    {Number(analyticsSummary?.overallCtr || 0).toFixed(2)}%
                  </Text>
                </View>
              </View>
              <View style={s.gridItem}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="wallet-outline" size={18} color={DS.warning} />
                </View>
                <View>
                  <Text style={s.gridItemLbl}>Total Spent</Text>
                  <Text style={[s.gridItemVal, { color: DS.warning }]}>
                    ₹{totalSpentVal.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Campaign Lists */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          {campaignAnalytics.length > 0 ? (
            <>
              {/* Premium Pill Shaped Filter Chips with Counts & Icons */}
              <View style={s.pillTabContainer}>
                {[
                  { key: 'ALL', label: 'All', count: campaignAnalytics.length, icon: 'list-outline' },
                  { key: 'ACTIVE', label: 'Active', count: liveCampaigns.length, icon: 'play-circle-outline' },
                  { key: 'HISTORY', label: 'History', count: historyCampaigns.length, icon: 'time-outline' },
                ].map((filter) => {
                  const isActive = campaignFilter === (filter.key as CampaignFilter);
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      onPress={() => setCampaignFilter(filter.key as CampaignFilter)}
                      style={[
                        s.filterChip,
                        isActive ? s.filterChipActive : s.filterChipInactive
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={filter.icon as any}
                        size={15}
                        color={isActive ? '#FFFFFF' : DS.gray700}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[s.filterChipText, isActive ? s.filterChipTextActive : s.filterChipTextInactive]}>
                        {filter.label}
                      </Text>
                      <View style={[
                        s.filterBadge,
                        isActive ? s.filterBadgeActive : s.filterBadgeInactive
                      ]}>
                        <Text style={[s.filterBadgeText, isActive ? s.filterBadgeTextActive : s.filterBadgeTextInactive]}>
                          {filter.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredCampaigns.length > 0 ? (
                filteredCampaigns.map((campaign, index) => (
                  <AnimatedEntry key={campaign.id} delay={index * 80}>
                    {renderCampaignCard(campaign)}
                  </AnimatedEntry>
                ))
              ) : (
                <Card style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={40} color={DS.gray300} style={{ marginBottom: 8 }} />
                  <Text style={s.emptyStateText}>
                    {campaignFilter === 'ACTIVE'
                      ? 'No active campaigns right now.'
                      : 'No completed campaigns yet.'}
                  </Text>
                </Card>
              )}
            </>
          ) : (
            <Card style={{ padding: 24, alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="rocket-outline" size={44} color={DS.gray300} style={{ marginBottom: 12 }} />
              <Text style={[s.emptyStateText, { fontWeight: '600' }]}>
                No Promoted Products Yet
              </Text>
              <Text style={[s.emptyStateSub, { textAlign: 'center', marginTop: 4 }]}>
                Create your first advertising campaign below to boost search placement and drive customer visits.
              </Text>
            </Card>
          )}
        </View>

        {/* Select a product grid list */}
        <View style={{ padding: 16 }}>
          <Text style={s.sectionHeader}>Select a product to promote</Text>
          {products.length > 0 ? (
            <View style={s.productGrid}>
              {products.map((prod, index) => renderProduct({ item: prod }))}
            </View>
          ) : (
            <Card style={{ padding: 20, alignItems: 'center' }}>
              <Text style={s.emptyStateText}>No products available to promote.</Text>
            </Card>
          )}
        </View>

        {/* Ad Tips */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Card style={s.tipsCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={s.tipsIconWrap}>
                <Ionicons name="bulb" size={18} color={DS.warning} />
              </View>
              <Text style={[s.sectionHeader, { marginBottom: 0 }]}>Ad Performance Tips</Text>
            </View>
            <View style={{ gap: 12 }}>
              {[
                { title: 'Set realistic daily budgets', desc: 'Starting at ₹100 - ₹250 helps test customer response without high costs.' },
                { title: 'Optimize Click Bid (CPC)', desc: 'Higher bid amounts improve search visibility and page placements.' },
                { title: 'Track performance daily', desc: 'Monitor CTR closely. High impressions with low clicks indicates a bad photo or title.' },
                { title: 'Use HD product photos', desc: 'Bright, clean shots have up to 75% higher CTR compared to blurry ones.' },
              ].map((tip, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={s.tipBullet} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.tipTitle}>{tip.title}</Text>
                    <Text style={s.tipDesc}>{tip.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </Animated.ScrollView>

      {/* Premium Sliding bottom sheet Modal for Creating Ad */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setShowModal(false)} />
          <View style={s.modalContent}>
            {/* Grab Handle */}
            <View style={s.modalGrabHandle} />

            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Set Up Campaign</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color={DS.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {selectedProduct && (
                <>
                  {/* Selected Product Card */}
                  <View style={s.modalProductCard}>
                    <View style={s.modalProductImgWrap}>
                      {selectedProductImageUri ? (
                        <Image source={{ uri: selectedProductImageUri }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="image-outline" size={22} color={DS.gray500} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalProductTitle} numberOfLines={1}>{selectedProduct.name}</Text>
                      <Text style={s.modalProductPrice}>₹{selectedProduct.price}</Text>
                    </View>
                  </View>

                  {/* Interactive Slider for Daily Budget */}
                  <View style={s.inputContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={s.sliderLabel}>Daily Budget: <Text style={s.sliderLabelVal}>₹{dailyBudget}</Text></Text>
                      <Text style={s.sliderLabelHint}>Min ₹100</Text>
                    </View>
                    <Slider
                      minimumValue={100}
                      maximumValue={2000}
                      step={50}
                      value={Number(dailyBudget)}
                      onValueChange={(val) => setDailyBudget(String(Math.round(val)))}
                      minimumTrackTintColor={DS.primary}
                      maximumTrackTintColor={DS.gray200}
                      thumbTintColor={DS.primary}
                      style={s.sliderControl}
                    />
                    <View style={s.chipsRow}>
                      {['100', '250', '500', '1000'].map((val) => {
                        const isSel = dailyBudget === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[s.chip, isSel && s.chipActive]}
                            onPress={() => setDailyBudget(val)}
                          >
                            <Text style={[s.chipText, isSel && s.chipTextActive]}>₹{val}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Duration Slider / Select */}
                  <View style={s.inputContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={s.sliderLabel}>Duration: <Text style={s.sliderLabelVal}>{duration} Days</Text></Text>
                      <Text style={s.sliderLabelHint}>Min 1 Day</Text>
                    </View>
                    <Slider
                      minimumValue={1}
                      maximumValue={90}
                      step={1}
                      value={Number(duration)}
                      onValueChange={(val) => setDuration(String(Math.round(val)))}
                      minimumTrackTintColor={DS.primary}
                      maximumTrackTintColor={DS.gray200}
                      thumbTintColor={DS.primary}
                      style={s.sliderControl}
                    />
                    <View style={s.chipsRow}>
                      {['7', '15', '30', '60'].map((val) => {
                        const isSel = duration === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[s.chip, isSel && s.chipActive]}
                            onPress={() => setDuration(val)}
                          >
                            <Text style={[s.chipText, isSel && s.chipTextActive]}>{val} Days</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Bid Per Click Slider / Input */}
                  <View style={s.inputContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={s.sliderLabel}>Bid Per Click / CPC: <Text style={s.sliderLabelVal}>₹{bidPerClick}</Text></Text>
                      <Text style={s.sliderLabelHint}>Recommended ₹10</Text>
                    </View>
                    <Slider
                      minimumValue={1}
                      maximumValue={50}
                      step={1}
                      value={Number(bidPerClick)}
                      onValueChange={(val) => setBidPerClick(String(Math.round(val)))}
                      minimumTrackTintColor={DS.primary}
                      maximumTrackTintColor={DS.gray200}
                      thumbTintColor={DS.primary}
                      style={s.sliderControl}
                    />
                    <Text style={s.inputSubHint}>A higher CPC bid guarantees top ranking placement in local queries.</Text>
                  </View>

                  {/* Estimates Cards */}
                  <View style={s.estimatesContainer}>
                    <LinearGradient colors={['#F0FDFA', '#CCFBF1']} style={StyleSheet.absoluteFill} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, zIndex: 1 }}>
                      <Ionicons name="sparkles" size={16} color={DS.primary} />
                      <Text style={s.estimatesHeader}>Campaign Estimations</Text>
                    </View>
                    <View style={[s.estimateRow, { zIndex: 1 }]}>
                      <Text style={s.estimateLbl}>Estimated Spend:</Text>
                      <Text style={s.estimateVal}>₹{estimatedMonthlySpend}</Text>
                    </View>
                    <View style={[s.estimateRow, { zIndex: 1 }]}>
                      <Text style={s.estimateLbl}>Estimated Clicks:</Text>
                      <Text style={s.estimateVal}>{estimatedClicks}</Text>
                    </View>
                    <Text style={[s.estimatesDisclaimer, { zIndex: 1 }]}>*Actual metrics vary based on search query competition and location radius.</Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={s.modalActions}>
                    <Button
                      title="Cancel"
                      variant="outline"
                      onPress={() => setShowModal(false)}
                      style={{ flex: 1, borderColor: DS.gray300, minHeight: 44 }}
                      textStyle={{ color: DS.gray700 }}
                    />
                    <Button
                      title="Launch Promotion"
                      variant="primary"
                      onPress={handleCreateAd}
                      style={{ flex: 1.3, backgroundColor: DS.primary, minHeight: 44 }}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Renew Budget Modal */}
      <Modal visible={showRenewModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { maxHeight: '50%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Renew Campaign Budget</Text>
              <TouchableOpacity onPress={() => setShowRenewModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={24} color={DS.gray500} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <View style={s.inputContainer}>
                <Text style={s.sliderLabel}>Additional Budget (₹)</Text>
                <TextInput
                  style={s.textInput}
                  keyboardType="numeric"
                  value={renewBudgetAmount}
                  onChangeText={setRenewBudgetAmount}
                  placeholder="Min ₹100"
                  placeholderTextColor={DS.gray500}
                />
                <Text style={s.inputSubHint}>Extend this campaign's lifespan by injecting more budget.</Text>
              </View>

              <View style={s.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowRenewModal(false)}
                  style={{ flex: 1, borderColor: DS.gray300, minHeight: 44 }}
                  textStyle={{ color: DS.gray700 }}
                />
                <Button
                  title="Renew"
                  variant="primary"
                  onPress={handleRenewBudget}
                  style={{ flex: 1.3, backgroundColor: DS.primary, minHeight: 44 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const paddingTop = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.background },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: paddingTop + 44,
  },
  stickyHeaderInner: {
    flex: 1,
    marginTop: paddingTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: paddingTop + 2,
    zIndex: 11,
  },
  backIconRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stickyTitle: { fontSize: 17, fontWeight: '700', color: DS.gray900 },

  scrollContent: { paddingBottom: 40 },

  heroSection: {
    paddingTop: paddingTop + 30,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroContent: {
    paddingHorizontal: 16,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontWeight: '500' },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  heroStatVal: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  heroStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.25)' },

  analyticsGridCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  ctrTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 3,
  },
  ctrTrendBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: DS.success,
  },
  chartContainer: {
    height: 66,
    marginVertical: 8,
    justifyContent: 'flex-end',
  },
  sectionHeader: { fontSize: 16, fontWeight: '800', color: DS.gray900, marginBottom: 12, letterSpacing: -0.2 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  gridRowDivider: { height: 1, backgroundColor: DS.border, marginVertical: 6 },
  gridItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemLbl: { fontSize: 11, fontWeight: '600', color: DS.gray500, textTransform: 'uppercase', letterSpacing: 0.3 },
  gridItemVal: { fontSize: 16, fontWeight: '800', color: DS.gray900, marginTop: 2 },

  pillTabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
  },
  filterChipActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primaryDark,
  },
  filterChipInactive: {
    backgroundColor: DS.gray50,
    borderColor: DS.border,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipTextInactive: { color: DS.gray900 },
  filterBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeInactive: {
    backgroundColor: DS.gray200,
  },
  filterBadgeText: { fontSize: 11, fontWeight: '800' },
  filterBadgeTextActive: { color: '#FFFFFF' },
  filterBadgeTextInactive: { color: DS.gray700 },

  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  campaignImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: DS.gray100,
    overflow: 'hidden',
  },
  campaignTitle: { fontSize: 15, fontWeight: '700', color: DS.gray900, flex: 1 },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  campaignLivePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DS.success,
  },
  campaignBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  campaignMetricsRow: {
    flexDirection: 'row',
    backgroundColor: DS.gray50,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  campaignMiniMetric: { alignItems: 'center', flex: 1 },
  miniMetricVal: { fontSize: 12, fontWeight: '700', color: DS.gray900 },
  miniMetricLbl: { fontSize: 9, color: DS.gray500, marginTop: 1, textTransform: 'uppercase', fontWeight: '600' },

  progressContainer: { marginTop: 12 },
  progressBarTrack: { height: 6, backgroundColor: DS.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 10, fontWeight: '500', color: DS.gray500 },
  progressPercentText: { fontSize: 10, fontWeight: '700', color: DS.gray900 },

  keywordsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  keywordsText: { fontSize: 11, fontStyle: 'italic', color: DS.gray500, flex: 1 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridProductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DS.border,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  gridProductImageWrap: {
    width: '100%',
    aspectRatio: 1.25,
    backgroundColor: DS.gray100,
  },
  gridProductPriceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gridProductPriceText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gridProductTitle: { fontSize: 14, fontWeight: '700', color: DS.gray900, marginBottom: 4 },
  gridPromoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: DS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: 6,
    minHeight: 32,
  },
  gridPromoteButtonText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  emptyStateText: { fontSize: 14, color: DS.gray500, fontWeight: '500' },
  emptyStateSub: { fontSize: 12, color: DS.gray500 },

  tipsCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: DS.border },
  tipsIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.warning, marginTop: 6 },
  tipTitle: { fontSize: 13, fontWeight: '600', color: DS.gray900 },
  tipDesc: { fontSize: 12, color: DS.gray500, marginTop: 2, lineHeight: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalGrabHandle: {
    width: 36,
    height: 5,
    backgroundColor: DS.gray300,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginVertical: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: DS.gray900 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalProductCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: DS.gray50,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DS.border,
  },
  modalProductImgWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: DS.gray100,
    overflow: 'hidden',
  },
  modalProductTitle: { fontSize: 14, fontWeight: '700', color: DS.gray900 },
  modalProductPrice: { fontSize: 13, fontWeight: '600', color: DS.primary, marginTop: 2 },

  textInput: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 16,
    color: DS.gray900,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  inputContainer: { marginBottom: 16 },
  sliderLabel: { fontSize: 13, fontWeight: '700', color: DS.gray900 },
  sliderLabelVal: { color: DS.primary, fontWeight: '800' },
  sliderLabelHint: { fontSize: 11, color: DS.gray500, fontWeight: '600' },
  sliderControl: { width: '100%', height: 40 },
  inputSubHint: { fontSize: 11, color: DS.gray500, marginTop: 4, fontWeight: '500', lineHeight: 16 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DS.gray50,
    borderWidth: 1,
    borderColor: DS.border,
  },
  chipActive: {
    backgroundColor: DS.primary,
    borderColor: DS.primaryDark,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: DS.gray700 },
  chipTextActive: { color: '#FFFFFF' },

  estimatesContainer: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  estimatesHeader: { fontSize: 13, fontWeight: '700', color: DS.primaryDark },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  estimateLbl: { fontSize: 12, fontWeight: '600', color: DS.gray700 },
  estimateVal: { fontSize: 13, fontWeight: '800', color: DS.gray900 },
  estimatesDisclaimer: { fontSize: 10, color: DS.gray500, fontStyle: 'italic', marginTop: 12 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, paddingBottom: 16 },
});
