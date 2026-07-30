// screens/auth/OTPVerificationScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { OTP_LENGTH, OTP_RESEND_COOLDOWN } from '../../utils/constants';
import authService from '../../services/authService';
import { useTheme } from '../../theme';

const STATUS_BAR_HEIGHT = Platform.select({
  ios: 44,
  android: StatusBar.currentHeight ?? 24,
  default: 44,
});

type Props = NativeStackScreenProps<any, 'OTPVerification'>;

export default function OTPVerificationScreen({ navigation, route }: Props) {
  const { colors, isDarkMode: isDark } = useTheme();

  const { phone, devOtp: initialDevOtp } = route.params as {
    phone: string;
    devOtp?: string;
  };

  const [otpCode, setOtpCode] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string>(initialDevOtp ?? '');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [resendTimer, setResendTimer] = useState<number>(OTP_RESEND_COOLDOWN);
  const [isFocused, setIsFocused] = useState<boolean>(true);

  const inputRef = useRef<TextInput>(null);
  const login = useAuthStore((s) => s.login);

  // Auto focus input on screen mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Verify OTP Action
  const handleVerifyOTP = useCallback(async (codeToVerify: string) => {
    if (codeToVerify.length !== OTP_LENGTH || loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await authService.verifyOTP(phone, codeToVerify);
      const data = response?.data;

      setIsSuccess(true);

      setTimeout(() => {
        if (data?.isNewUser) {
          navigation.navigate('Register', {
            phone: data.phone,
            idToken: data.tempToken,
          });
        } else {
          login(data.user, data.accessToken, data.refreshToken);
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      }, 500);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        err?.message ??
        'Invalid OTP. Please try again.';
      setError(message);
      setIsSuccess(false);
      setOtpCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }, [phone, loading, navigation, login]);

  // Handle TextInput Change
  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setOtpCode(cleaned);
    setError('');
    setIsSuccess(false);

    if (cleaned.length === OTP_LENGTH) {
      handleVerifyOTP(cleaned);
    }
  };

  // Handle Dev OTP Auto-Fill
  const handleAutoFillDevOtp = () => {
    if (!devOtp) return;
    const cleaned = devOtp.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setOtpCode(cleaned);
    setError('');
    if (cleaned.length === OTP_LENGTH) {
      handleVerifyOTP(cleaned);
    }
  };

  // Resend OTP Action
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    try {
      const response = await authService.sendOTP(phone);
      const message = String(response?.data?.message ?? '');
      const nextDevOtp = (message.match(/(\d{6})/) ?? [])[1] ?? '';
      if (nextDevOtp) setDevOtp(nextDevOtp);
      setResendTimer(OTP_RESEND_COOLDOWN);
      setError('');
      setOtpCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          err?.response?.data?.message ??
          err?.message ??
          'Failed to resend OTP',
      );
    }
  };

  const isOTPComplete = otpCode.length === OTP_LENGTH;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Banner ── */}
        <LinearGradient
          colors={['#0F766E', '#0D9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          {/* Back button */}
          <View style={[styles.backRow, { marginTop: STATUS_BAR_HEIGHT + 4 }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backBtnFrosted,
                pressed && { opacity: 0.8 },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Header Graphic & Title */}
          <View style={styles.headerTextWrap}>
            <View style={styles.headerIconRing}>
              <Ionicons name="shield-checkmark" size={32} color="#CCFBF1" />
            </View>
            <Text style={styles.heroTitle}>Verify Number</Text>
            <Text style={styles.heroSubtitle}>
              Enter the 6-digit verification code
            </Text>
          </View>
        </LinearGradient>

        {/* ── Main Container Body ── */}
        <View style={styles.bodyWrap}>
          {/* Phone pill row */}
          <View style={[styles.phonePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="phone-portrait-outline" size={16} color="#0D9488" />
            <Text style={[styles.phoneText, { color: colors.text }]}>+91 {phone}</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Dev OTP Auto-Fill Banner */}
          {devOtp ? (
            <TouchableOpacity
              style={[
                styles.devBanner,
                {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
                  borderColor: isDark ? 'rgba(245,158,11,0.30)' : '#FDE68A',
                },
              ]}
              activeOpacity={0.85}
              onPress={handleAutoFillDevOtp}
            >
              <View style={styles.devBannerLeft}>
                <Ionicons name="flash" size={16} color="#D97706" />
                <Text style={styles.devLabel}>DEV CODE:</Text>
                <Text style={styles.devOtpValue}>{devOtp}</Text>
              </View>
              <View style={styles.devAutoFillBadge}>
                <Text style={styles.devAutoFillText}>TAP TO FILL</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Single Invisible Input overlaying 6 Cell Boxes */}
          <View style={styles.otpSection}>
            <Pressable
              style={styles.otpBoxesRow}
              onPress={() => inputRef.current?.focus()}
            >
              {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                const digit = otpCode[index] || '';
                const isCellFocused = isFocused && (index === otpCode.length || (index === OTP_LENGTH - 1 && otpCode.length === OTP_LENGTH));
                const isFilled = digit.length > 0;

                let cellBorderColor = colors.border;
                let cellBgColor = colors.card;

                if (error) {
                  cellBorderColor = '#EF4444';
                  cellBgColor = isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2';
                } else if (isSuccess) {
                  cellBorderColor = '#10B981';
                  cellBgColor = isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5';
                } else if (isCellFocused) {
                  cellBorderColor = '#0D9488';
                  cellBgColor = isDark ? 'rgba(13,148,136,0.15)' : '#F0FDFA';
                } else if (isFilled) {
                  cellBorderColor = '#0D9488';
                  cellBgColor = isDark ? 'rgba(13,148,136,0.10)' : '#CCFBF1';
                }

                return (
                  <View
                    key={index}
                    style={[
                      styles.otpCellBox,
                      {
                        borderColor: cellBorderColor,
                        backgroundColor: cellBgColor,
                        borderWidth: isCellFocused || isFilled ? 2 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.otpCellText,
                        {
                          color: error ? '#EF4444' : isSuccess ? '#10B981' : colors.text,
                        },
                      ]}
                    >
                      {digit}
                    </Text>
                    {isCellFocused && !digit && (
                      <View style={styles.activeCursorLine} />
                    )}
                  </View>
                );
              })}
            </Pressable>

            {/* Real Hidden TextInput handling single focus & native keyboard */}
            <TextInput
              ref={inputRef}
              value={otpCode}
              onChangeText={handleTextChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              style={styles.hiddenSingleInput}
              caretHidden
              autoFocus
            />

            {/* Error Message Display */}
            {error ? (
              <View style={styles.errorInnerCard}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Message Display */}
            {isSuccess ? (
              <View style={styles.successInnerCard}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successText}>OTP Verified! Redirecting...</Text>
              </View>
            ) : null}
          </View>

          {/* CTA Section */}
          <View style={styles.ctaSection}>
            <Button
              title={isSuccess ? '✓ Verified!' : 'Verify OTP'}
              onPress={() => handleVerifyOTP(otpCode)}
              loading={loading}
              fullWidth
              disabled={!isOTPComplete || isSuccess}
            />

            {/* Resend OTP Section */}
            <View style={styles.resendSection}>
              <Text style={[styles.resendPrefixText, { color: colors.textSecondary }]}>
                Didn't receive the code?
              </Text>

              {resendTimer > 0 ? (
                <View style={[styles.timerBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="time-outline" size={16} color="#0D9488" />
                  <Text style={[styles.timerText, { color: colors.text }]}>
                    Resend in <Text style={{ color: '#0D9488', fontWeight: '800' }}>{resendTimer}s</Text>
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOTP}
                  style={styles.resendButtonPill}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color="#0D9488" />
                  <Text style={styles.resendButtonText}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.helpFooterText, { color: colors.textSecondary }]}>
              Having trouble?{' '}
              <Text style={styles.helpLinkText}>Contact Support</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  heroBanner: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backRow: {
    marginBottom: 12,
  },
  backBtnFrosted: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTextWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  headerIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#CCFBF1',
    fontWeight: '500',
    textAlign: 'center',
  },
  bodyWrap: {
    paddingHorizontal: 20,
    marginTop: -16,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  phoneText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  changeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0D9488',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  devBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  devOtpValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 3,
  },
  devAutoFillBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devAutoFillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  otpSection: {
    marginBottom: 24,
    position: 'relative',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpCellBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  otpCellText: {
    fontSize: 22,
    fontWeight: '800',
  },
  activeCursorLine: {
    width: 2,
    height: 22,
    backgroundColor: '#0D9488',
    borderRadius: 1,
  },
  hiddenSingleInput: {
    position: 'absolute',
    width: '100%',
    height: 56,
    opacity: 0,
  },
  errorInnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#EF4444',
    flex: 1,
  },
  successInnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  successText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#10B981',
  },
  ctaSection: {
    gap: 18,
  },
  resendSection: {
    alignItems: 'center',
    gap: 10,
  },
  resendPrefixText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resendButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.25)',
  },
  resendButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0D9488',
  },
  helpFooterText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  helpLinkText: {
    fontWeight: '700',
    color: '#0D9488',
  },
});