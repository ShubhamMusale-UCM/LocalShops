import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { View } from 'react-native';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { ForceUpdateScreen } from '../screens/system/ForceUpdateScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { AuthNavigator } from './AuthNavigator';
import { BuyerTabNavigator } from './BuyerTabNavigator';
import { SellerStackNavigator } from './SellerTabNavigator';
import { AdminTabNavigator } from './AdminTabNavigator';
import ProductDetailScreen from '../screens/buyer/ProductDetailScreen';
import ShopProfileScreen from '../screens/buyer/ShopProfileScreen';
import ShopProductsScreen from '../screens/buyer/ShopProductsScreen';
import TrendingAllScreen from '../screens/buyer/TrendingAllScreen';

import CartScreen from '../screens/buyer/CartScreen';
import CheckoutScreen from '../screens/buyer/CheckoutScreen';
import PaymentScreen from '../screens/buyer/PaymentScreen';
import OrderTrackingScreen from '../screens/buyer/OrderTrackingScreen';
import BuyerOrdersScreen from '../screens/buyer/BuyerOrdersScreen';
import WishlistScreen from '../screens/buyer/WishlistScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import TermsOfServiceScreen from '../screens/buyer/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/buyer/PrivacyPolicyScreen';
import RefundPolicyScreen from '../screens/buyer/RefundPolicyScreen';
import TermsAndConditionsScreen from '../screens/buyer/TermsAndConditionsScreen';
import HelpScreen from '../screens/buyer/HelpScreen';

const Stack = createNativeStackNavigator();

const linking: LinkingOptions<any> = {
  prefixes: ['citylocalshop://', 'https://app.citylocalshop.com'],
  config: {
    screens: {

      OrderDetail: 'orders/:orderId',
      SellerOrderDetail: 'seller/orders/:orderId',
      ShopProfile: 'shop/:shopId',
      ProductDetail: 'product/:productId',
    },
  },
};

export const RootNavigator = () => {
  const { isAuthenticated, user, activeRole } = useAuthStore();
  const { needsUpdate, loading: configLoading } = useSystemConfig();

  const getMainNavigator = () => {
    if (!isAuthenticated) return AuthNavigator;
    if (user?.role === 'SELLER' && activeRole === 'BUYER') return BuyerTabNavigator;
    switch (activeRole || user?.role) {
      case 'SELLER': return SellerStackNavigator;
      case 'ADMIN': return AdminTabNavigator;
      default: return BuyerTabNavigator;
    }
  };

  const MainNavigatorComponent = getMainNavigator();
  const mainKey = `main-${activeRole || user?.role || 'guest'}`;

  // If app requires forced update, lock the screen out entirely.
  if (needsUpdate && !configLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ForceUpdateScreen />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainNavigatorComponent} key={mainKey} />
          {/* Shared screens accessible from any tab */}
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ShopProfile"
            component={ShopProfileScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ShopProducts"
            component={ShopProductsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TrendingAll"
            component={TrendingAllScreen}
            options={{ animation: 'slide_from_right' }}
          />

          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="BuyerOrders"
            component={BuyerOrdersScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Wishlist"
            component={WishlistScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="RefundPolicy"
            component={RefundPolicyScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TermsAndConditions"
            component={TermsAndConditionsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};
