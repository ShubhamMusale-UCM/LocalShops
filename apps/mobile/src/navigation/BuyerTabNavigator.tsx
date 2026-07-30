import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/buyer/HomeScreen';
import SearchScreen from '../screens/buyer/SearchScreen';
import CategoriesScreen from '../screens/buyer/CategoriesScreen';
import BuyerOrdersScreen from '../screens/buyer/BuyerOrdersScreen';
import CartScreen from '../screens/buyer/CartScreen';
import ProfileScreen from '../screens/buyer/ProfileScreen';
import { useCartStore } from '../store/cartStore';
import { TabBarVisibilityProvider } from '../contexts/TabBarVisibilityContext';
import AnimatedTabBar from '../components/navigation/AnimatedTabBar';

const Tab = createBottomTabNavigator();

export const BuyerTabNavigator = () => {
  const itemCount = useCartStore((s) => s.getItemCount());

  return (
    <TabBarVisibilityProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
        tabBar={(props) => {
          const activeRoute = props.state.routes[props.state.index]?.name;
          if (activeRoute === 'Cart') {
            return null;
          }

          return (
            <AnimatedTabBar
              {...props}
              badgeCounts={{ Cart: itemCount }}
            />
          );
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Categories" component={CategoriesScreen} />
        <Tab.Screen name="Orders" component={BuyerOrdersScreen} />
        <Tab.Screen name="Cart" component={CartScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </TabBarVisibilityProvider>
  );
};
