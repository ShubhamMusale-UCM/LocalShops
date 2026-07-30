import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ProfileScreen from '../screens/buyer/ProfileScreen';

const Tab = createBottomTabNavigator();

const TabIcon = ({ icon, label, focused }: { icon: keyof typeof Ionicons.glyphMap; label: string; focused: boolean }) => (
  <View style={styles.tabItem}>
    <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
      <Ionicons name={icon} size={20} color={focused ? Colors.primary : Colors.gray[500]} />
    </View>
    <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
  </View>
);

export const AdminTabNavigator = () => (
  <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarShowLabel: false }}>
    <Tab.Screen
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{ tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="shield-checkmark-outline" label="Admin" focused={focused} /> }}
    />
    <Tab.Screen
      name="AdminProfile"
      component={ProfileScreen}
      options={{ tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="person-outline" label="Profile" focused={focused} /> }}
    />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 32,
    backgroundColor: Colors.white,
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    paddingTop: 4,
    paddingBottom: 4,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    minHeight: 34,
    minWidth: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapFocused: { backgroundColor: Colors.primaryFaded },
  label: { ...Typography.caption, color: Colors.gray[500], marginTop: 2 },
  labelFocused: { color: Colors.primary, fontWeight: '600' },
});
