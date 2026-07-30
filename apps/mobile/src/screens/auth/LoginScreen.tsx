import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { validatePhone } from '../../utils/validators';
import authService from '../../services/authService';

type Props = { navigation: NativeStackNavigationProp<any> };

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const devOtp = (message.match(/(\d{6})/) || [])[1] || '';
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
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
});

export default LoginScreen;
