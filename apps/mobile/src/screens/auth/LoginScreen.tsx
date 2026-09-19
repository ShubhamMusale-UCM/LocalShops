import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { validatePhone } from '../../utils/validators';
import authService from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

type Props = { navigation: NativeStackNavigationProp<any> };

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isGuest = useAuthStore((s) => s.isGuest);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDismiss = navigation.canGoBack() || isGuest;

  const handleDismissOrSkip = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      useAuthStore.getState().continueAsGuest();
    }
  };

  const handleSendOTP = async () => {
    setError('');
    if (!validatePhone(phone)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.sendOTP(phone);
      const message = String(response?.data?.message || '');
      const devOtp = __DEV__ ? (message.match(/(\d{6})/) || [])[1] || '' : '';
      navigation.navigate('OTPVerification', { phone, devOtp });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Modal Dismiss Button if navigated as modal */}
      {canDismiss && (
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={handleDismissOrSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close and return to browsing"
        >
          <Ionicons name="close" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        {/* Logo & Brand */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🏪</Text>
          </View>
          <Text style={styles.brandName}>CityLocalShop</Text>
          <Text style={styles.tagline}>Discover Local, Shop Smart</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Login / Sign Up</Text>
          <Text style={styles.subtitle}>
            Enter your mobile number to get started
          </Text>

          <Input
            label="Mobile Number"
            placeholder="Enter 10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={(text) => {
              setPhone(text.replace(/[^0-9]/g, ''));
              setError('');
            }}
            error={error}
            leftIcon={<Text style={styles.countryCode}>+91</Text>}
          />

          <Button
            title="Get OTP"
            onPress={handleSendOTP}
            loading={loading}
            fullWidth
            disabled={phone.length !== 10}
          />

          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>

          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleDismissOrSkip}
          >
            <Text style={styles.skipButtonText}>
              {navigation.canGoBack() ? 'Back to Browsing' : 'Skip & Browse'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  closeButton: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoContainer: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.primaryFaded,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  logoEmoji: { fontSize: 40 },
  brandName: { ...Typography.h1, color: Colors.primary },
  tagline: { ...Typography.body, color: Colors.gray[500], marginTop: Spacing.xs },
  form: { marginTop: Spacing.xl },
  title: { ...Typography.h3, color: Colors.gray[900], marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.gray[500], marginBottom: Spacing.xxl },
  countryCode: { ...Typography.bodyBold, color: Colors.gray[700] },
  termsText: {
    ...Typography.bodySmall, color: Colors.gray[500],
    textAlign: 'center', marginTop: Spacing.xl, lineHeight: 20,
  },
  link: { color: Colors.primary, fontWeight: '500' },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.bodyBold,
    color: Colors.primary,
    marginRight: Spacing.xs,
  },
});

export default LoginScreen;
