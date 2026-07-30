import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';

export type AuthStackParamList = {
  Login: undefined;
  OTPVerification: { phone: string };
  Register: { phone: string };
  RoleSelection: { phone: string; name: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="OTPVerification" component={OTPVerificationScreen as any} />
    <Stack.Screen name="Register" component={RegisterScreen as any} />
    <Stack.Screen name="RoleSelection" component={RoleSelectionScreen as any} />
  </Stack.Navigator>
);
