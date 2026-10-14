import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

// Seller Screens
import SellerDashboard from '../screens/seller/SellerDashboard';
import ManageProductsScreen from '../screens/seller/ManageProductsScreen';
import OrderManagementScreen from '../screens/seller/OrderManagementScreen';
import ReviewsAnalyticsScreen from '../screens/seller/ReviewsAnalyticsScreen';
import SellerProfileScreen from '../screens/seller/SellerProfileScreen';
import AddProductScreen from '../screens/seller/AddProductScreen';
import PromoteProductScreen from '../screens/seller/PromoteProductScreen';
import ShopCustomizationScreen from '../screens/seller/ShopCustomizationScreen';
import NotificationCampaignScreen from '../screens/seller/NotificationCampaignScreen';
import EarningsBreakdownScreen from '../screens/seller/EarningsBreakdownScreen';
import SubscriptionScreen from '../screens/seller/SubscriptionScreen';
import SellerTermsConditionsScreen from '../screens/seller/SellerTermsConditionsScreen';
import SellerPrivacyPolicyScreen from '../screens/seller/SellerPrivacyPolicyScreen';
import SellerHelpSupportScreen from '../screens/seller/SellerHelpSupportScreen';
import AddServicesScreen from '../screens/seller/AddServicesScreen';
import StoreSettingsScreen from '../screens/seller/StoreSettingsScreen';
import ManageFlashSalesScreen from '../screens/seller/ManageFlashSalesScreen';
import SellerAudienceScreen from '../screens/seller/SellerAudienceScreen';
import SellerAdWalletScreen from '../screens/seller/SellerAdWalletScreen';
import { orderService } from '../services/orderService';
import { getPrimarySellerShop } from '../services/sellerShopContext';



// Tab Bar
import { TabBarVisibilityProvider } from '../contexts/TabBarVisibilityContext';
import AnimatedTabBar from '../components/navigation/AnimatedTabBar';

const Tab = createBottomTabNavigator();
const SellerStack = createNativeStackNavigator();

const BADGE_REFRESH_INTERVAL_MS = 60_000;
const BADGE_MIN_REFRESH_GAP_MS = 30_000;
const BADGE_BACKOFF_ON_429_MS = 120_000;

const TERMINAL_ORDER_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'REFUNDED']);

const buildSellerOrderSeenKey = (shopId: string) => `seller-orders-last-seen:${shopId}`;

const extractOrders = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  return [];
};

const getCreatedAtMs = (createdAt: unknown): number => {
  const value = typeof createdAt === 'string' || createdAt instanceof Date
    ? new Date(createdAt).getTime()
    : 0;
  return Number.isFinite(value) ? value : 0;
};


// ─── Seller Tab Navigator ───────────────────────────────
export const SellerTabNavigator = () => {
  const [badgeCounts, setBadgeCounts] = React.useState<Record<string, number>>({});
  const lastBadgeRefreshAtRef = React.useRef(0);
  const isBadgeRefreshInFlightRef = React.useRef(false);
  const badgeBackoffUntilRef = React.useRef(0);

  const refreshOrderBadge = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now < badgeBackoffUntilRef.current) return;
    if (isBadgeRefreshInFlightRef.current) return;
    if (!force && now - lastBadgeRefreshAtRef.current < BADGE_MIN_REFRESH_GAP_MS) return;

    isBadgeRefreshInFlightRef.current = true;
    try {
      const currentShop = await getPrimarySellerShop();
      const currentShopId = currentShop?.id || null;
      if (!currentShopId) {
        setBadgeCounts((prev) => ({ ...prev, Orders: 0 }));
        return;
      }

      const response = await orderService.getShopOrders(currentShopId, 1);
      const orders = extractOrders(response?.data);
      const lastSeenRaw = await AsyncStorage.getItem(buildSellerOrderSeenKey(currentShopId));
      const lastSeenAt = Number(lastSeenRaw || '0');

      const unseenCount = orders.filter((order) => {
        const status = String(order?.status || '');
        if (TERMINAL_ORDER_STATUSES.has(status)) {
          return false;
        }
        return getCreatedAtMs(order?.createdAt) > lastSeenAt;
      }).length;

      setBadgeCounts((prev) => ({ ...prev, Orders: unseenCount }));
      lastBadgeRefreshAtRef.current = Date.now();
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status === 429) {
        badgeBackoffUntilRef.current = Date.now() + BADGE_BACKOFF_ON_429_MS;
        return;
      }
      console.warn('Failed to refresh seller order badge:', error);
    } finally {
      isBadgeRefreshInFlightRef.current = false;
    }
  }, []);

  const markOrdersAsSeen = React.useCallback(async () => {
    const currentShop = await getPrimarySellerShop();
    const currentShopId = currentShop?.id || null;
    if (!currentShopId) return;

    await AsyncStorage.setItem(buildSellerOrderSeenKey(currentShopId), String(Date.now()));
    setBadgeCounts((prev) => ({ ...prev, Orders: 0 }));
  }, []);

  React.useEffect(() => {
    refreshOrderBadge(true);
    const interval = setInterval(() => {
      refreshOrderBadge();
    }, BADGE_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshOrderBadge]);

  return (
    <TabBarVisibilityProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
        screenListeners={({ route }) => ({
          focus: () => {
            if (route.name === 'Orders') {
              markOrdersAsSeen();
              return;
            }
            refreshOrderBadge();
          },
        })}
        tabBar={(props) => <AnimatedTabBar {...props} badgeCounts={badgeCounts} />}
      >
        <Tab.Screen name="Dashboard" component={SellerDashboard} />
        <Tab.Screen name="Products" component={ManageProductsScreen} />
        <Tab.Screen name="Orders" component={OrderManagementScreen} />
        <Tab.Screen name="Analytics" component={ReviewsAnalyticsScreen} />
        <Tab.Screen name="SellerProfile" component={SellerProfileScreen} />
      </Tab.Navigator>
    </TabBarVisibilityProvider>
  );
};

// ─── Seller Stack (wraps tabs + detail screens) ─────────
export const SellerStackNavigator = () => (
  <SellerStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <SellerStack.Screen name="SellerTabs" component={SellerTabNavigator} />
    <SellerStack.Screen name="AddProduct" component={AddProductScreen} />
    <SellerStack.Screen
      name="PromoteProduct"
      component={PromoteProductScreen}
    />
    <SellerStack.Screen
      name="ShopCustomization"
      component={ShopCustomizationScreen}
    />
    <SellerStack.Screen
      name="NotificationCampaign"
      component={NotificationCampaignScreen}
    />
    <SellerStack.Screen
      name="EarningsBreakdown"
      component={EarningsBreakdownScreen}
    />
    <SellerStack.Screen name="Subscription" component={SubscriptionScreen} />
    <SellerStack.Screen name="SellerAdWallet" component={SellerAdWalletScreen} />
    <SellerStack.Screen name="SellerTermsConditions" component={SellerTermsConditionsScreen} />
    <SellerStack.Screen name="SellerPrivacyPolicy" component={SellerPrivacyPolicyScreen} />
    <SellerStack.Screen name="SellerHelpSupport" component={SellerHelpSupportScreen} />
    <SellerStack.Screen name="AddServices" component={AddServicesScreen} />
    <SellerStack.Screen name="StoreSettings" component={StoreSettingsScreen} />
    <SellerStack.Screen name="ManageFlashSales" component={ManageFlashSalesScreen} />
    <SellerStack.Screen name="SellerAudience" component={SellerAudienceScreen} />
  </SellerStack.Navigator>
);

