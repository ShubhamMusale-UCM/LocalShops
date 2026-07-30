// screens/auth/RegisterScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Pressable,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { API_BASE_URL } from '../../utils/constants';
import authService from '../../services/authService';
import { validateName, validateEmail } from '../../utils/validators';

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryFaded: 'rgba(13,148,136,0.08)',
  primaryLight: '#CCFBF1',
  success: '#10B981',
  successFaded: 'rgba(16,185,129,0.08)',
  error: '#EF4444',
  errorFaded: 'rgba(239,68,68,0.08)',
  warning: '#F59E0B',
  warningFaded: 'rgba(245,158,11,0.08)',
  info: '#3B82F6',
  gray900: '#1F2937',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F1F5F9',
  inputBorder: '#E2E8F0',
  background: '#F8FAFC',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

const STATUS_BAR_HEIGHT = Platform.select({
  ios: 44,
  android: StatusBar.currentHeight ?? 24,
  default: 44,
});

type Props = NativeStackScreenProps<any, 'Register'>;

// ─── Progress Steps ───────────────────────────────────────────────────────────
const ProgressHeader: React.FC<{ step: number; total: number }> = ({
  step,
  total,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: step / total,
      damping: 14,
      stiffness: 100,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={pStyles.progressContainer}>
      <View style={pStyles.progressTrack}>
        <Animated.View style={[pStyles.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={pStyles.progressText}>
        {step}/{total} steps
      </Text>
    </View>
  );
};

const pStyles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: DS.gray200,
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: DS.primary,
    borderRadius: DS.radius.full,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.gray500,
    width: 40,
    textAlign: 'right',
  },
});

// ─── Referral Code Input ──────────────────────────────────────────────────────
const ReferralInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.parallel([
      Animated.spring(heightAnim, {
        toValue,
        damping: 14,
        stiffness: 120,
        useNativeDriver: false,
      }),
      Animated.spring(rotateAnim, {
        toValue,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.referralContainer}>
      <Pressable
        onPress={toggle}
        style={styles.referralToggle}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <View style={styles.referralToggleLeft}>
          <View style={styles.referralIconBox}>
            <Ionicons name="gift-outline" size={16} color={DS.primary} />
          </View>
          <View>
            <Text style={styles.referralTitle}>Have a referral code?</Text>
            <Text style={styles.referralSubtitle}>
              {value ? `Code applied: ${value}` : 'Get extra benefits on signup'}
            </Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={DS.gray500} />
        </Animated.View>
      </Pressable>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <View style={styles.referralInputWrapper}>
          <Input
            placeholder="Enter referral code (e.g. SAVE20)"
            value={value}
            onChangeText={(t) => onChange(t.toUpperCase())}
            autoCapitalize="characters"
            leftIcon={
              <Ionicons name="ticket-outline" size={18} color={DS.gray400} />
            }
            rightIcon={
              value ? (
                <Ionicons name="checkmark-circle" size={18} color={DS.success} />
              ) : undefined
            }
          />
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Phone Verified Card ──────────────────────────────────────────────────────
const PhoneVerifiedCard: React.FC<{ phone: string }> = ({ phone }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600);
  }, []);

  return (
    <Animated.View
      style={[
        styles.phoneCard,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.phoneCardLeft}>
        <View style={styles.phoneCardIcon}>
          <Ionicons name="phone-portrait-outline" size={18} color={DS.primary} />
        </View>
        <View>
          <Text style={styles.phoneCardLabel}>Verified Mobile</Text>
          <Text style={styles.phoneCardNumber}>+91 {phone}</Text>
        </View>
      </View>
      <View style={styles.phoneCardBadge}>
        <Ionicons name="shield-checkmark" size={12} color={DS.success} />
        <Text style={styles.phoneCardBadgeText}>Verified</Text>
      </View>
    </Animated.View>
  );
};

// ─── Form Field Row ───────────────────────────────────────────────────────────
const FormSection: React.FC<{
  index: number;
  children: React.ReactNode;
  label?: string;
}> = ({ index, children, label }) => {
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(entryAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300 + index * 80);
  }, []);

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateY: entryTranslate }],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RegisterScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phone, idToken } = route.params as {
    phone: string;
    idToken: string;
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const login = useAuthStore((s) => s.login);
  const currentCity = useLocationStore((state) => state.city);

  // ── Animations ──
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-20)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(24)).current;
  const errorBannerScale = useRef(new Animated.Value(0.95)).current;
  const errorBannerOpacity = useRef(new Animated.Value(0)).current;

  // ── Entry Animations ──
  useEffect(() => {
    StatusBar.setBarStyle('dark-content');

    Animated.parallel([
      Animated.spring(headerOpacity, {
        toValue: 1,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslate, {
        toValue: 0,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(ctaTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, 700);
  }, []);

  // ── Error banner animation ──
  useEffect(() => {
    if (errors.general) {
      Animated.parallel([
        Animated.spring(errorBannerScale, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(errorBannerOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(errorBannerOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => errorBannerScale.setValue(0.95));
    }
  }, [errors.general]);

  // ── Validation ──
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!validateName(name)) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (email && !validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Register ──
  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const registerPayload = {
        phone,
        name: name.trim(),
        email: email.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        idToken,
        city: currentCity || undefined,
      };

      const response = await authService.register(registerPayload as any);
      const data = response?.data;

      login(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      setErrors({
        general:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          err?.message ??
          'Registration failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Name char count ──
  const nameLength = name.trim().length;
  const isNameValid = nameLength >= 2;
  const isFormReady = name.trim().length > 0;

  // ── Completion percentage ──
  const completedFields = [
    name.trim().length >= 2,
    email.trim().length > 0,
    referralCode.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" backgroundColor={DS.background} />
      <View style={{ flex: 1, backgroundColor: DS.background }}>
        {/* Background decoration */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: STATUS_BAR_HEIGHT + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerTranslate }],
              },
            ]}
          >
            {/* Back button */}
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.backBtnInner}>
                <Ionicons name="arrow-back" size={18} color={DS.gray700} />
              </View>
            </Pressable>

            {/* Progress */}
            <ProgressHeader step={completedFields + 1} total={3} />

            {/* Title block */}
            <View style={styles.titleRow}>
              <View style={styles.titleIconBox}>
                <Ionicons name="person-add-outline" size={24} color={DS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Quick setup — takes less than a minute
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Error Banner ── */}
          {errors.general ? (
            <Animated.View
              style={[
                styles.errorBanner,
                {
                  opacity: errorBannerOpacity,
                  transform: [{ scale: errorBannerScale }],
                },
              ]}
            >
              <View style={styles.errorBannerLeft}>
                <View style={styles.errorIconCircle}>
                  <Ionicons name="alert-circle" size={16} color={DS.error} />
                </View>
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setErrors({})}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={DS.error} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* ── Form ── */}
          <View style={styles.form}>
            {/* Phone verified card */}
            <PhoneVerifiedCard phone={phone} />

            {/* Name */}
            <FormSection index={0}>
              <Input
                label="Full Name"
                placeholder="e.g. Priya Sharma"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setErrors((e) => ({ ...e, name: '', general: '' }));
                }}
                error={errors.name}
                autoCapitalize="words"
                required
                showCharCount
                maxLength={50}
                leftIcon={
                  <Ionicons name="person-outline" size={18} color={DS.gray400} />
                }
                rightIcon={
                  isNameValid ? (
                    <Ionicons name="checkmark-circle" size={18} color={DS.success} />
                  ) : undefined
                }
                hint="This will appear on your profile and orders"
              />
            </FormSection>

            {/* Email */}
            <FormSection index={1}>
              <Input
                label="Email Address"
                placeholder="e.g. priya@gmail.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrors((e) => ({ ...e, email: '', general: '' }));
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                optional
                leftIcon={
                  <Ionicons name="mail-outline" size={18} color={DS.gray400} />
                }
                hint="For order confirmations and exclusive deals"
              />
            </FormSection>

            {/* Referral */}
            <FormSection index={2}>
              <ReferralInput
                value={referralCode}
                onChange={setReferralCode}
              />
            </FormSection>

            {/* City info */}
            {currentCity ? (
              <FormSection index={3}>
                <View style={styles.cityCard}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={DS.primary}
                  />
                  <Text style={styles.cityText}>
                    Shopping near{' '}
                    <Text style={styles.cityName}>{currentCity}</Text>
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.cityChange}>Change</Text>
                  </TouchableOpacity>
                </View>
              </FormSection>
            ) : null}

            {/* T&C note */}
            <FormSection index={4}>
              <Text style={styles.tcNote}>
                By creating an account, you agree to our{' '}
                <Text style={styles.tcLink}>Terms of Service</Text> and{' '}
                <Text style={styles.tcLink}>Privacy Policy</Text>
              </Text>
            </FormSection>

            {/* Bottom padding */}
            <View style={{ height: 100 }} />
          </View>
        </ScrollView>

        {/* ── Floating CTA ── */}
        <Animated.View
          style={[
            styles.ctaContainer,
            {
              opacity: ctaOpacity,
              transform: [{ translateY: ctaTranslate }],
            },
          ]}
        >
          {/* Name preview */}
          {isFormReady && (
            <View style={styles.ctaPreview}>
              <View style={styles.ctaAvatar}>
                <Text style={styles.ctaAvatarText}>
                  {name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaPreviewLabel}>Creating account as</Text>
                <Text style={styles.ctaPreviewName} numberOfLines={1}>
                  {name.trim() || '—'}
                </Text>
              </View>
              {email ? (
                <View style={styles.emailChip}>
                  <Ionicons name="mail-outline" size={11} color={DS.primary} />
                  <Text style={styles.emailChipText}>Email added</Text>
                </View>
              ) : null}
            </View>
          )}

          <Button
            title={loading ? 'Creating Account…' : 'Create Account →'}
            onPress={handleRegister}
            loading={loading}
            fullWidth
            disabled={!isFormReady || loading}
          />
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Background
  bgCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: DS.primaryFaded,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 200,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245,158,11,0.05)',
  },

  // Header
  header: {
    marginBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  backBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  titleIconBox: {
    width: 52,
    height: 52,
    borderRadius: DS.radius.md,
    backgroundColor: DS.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.12)',
    flexShrink: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: DS.gray500,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DS.errorFaded,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
    borderRadius: DS.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  errorIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorBannerText: {
    fontSize: 13,
    color: DS.error,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  // Form
  form: {
    gap: 0,
  },

  // Phone card
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DS.white,
    borderRadius: DS.radius.lg,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  phoneCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  phoneCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.12)',
  },
  phoneCardLabel: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
    marginBottom: 2,
  },
  phoneCardNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: 0.5,
  },
  phoneCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DS.successFaded,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DS.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
  },
  phoneCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.success,
  },

  // Referral
  referralContainer: {
    backgroundColor: DS.white,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    minHeight: 56,
  },
  referralToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: DS.radius.sm,
    backgroundColor: DS.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.gray900,
    marginBottom: 2,
  },
  referralSubtitle: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '400',
  },
  referralInputWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: DS.border,
    paddingTop: 14,
  },

  // City card
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DS.primaryFaded,
    borderRadius: DS.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.12)',
    marginBottom: 16,
  },
  cityText: {
    fontSize: 13,
    color: DS.gray600,
    fontWeight: '400',
    flex: 1,
  },
  cityName: {
    fontWeight: '700',
    color: DS.primary,
  },
  cityChange: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.primary,
    textDecorationLine: 'underline',
  },

  // T&C
  tcNote: {
    fontSize: 12,
    color: DS.gray400,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  tcLink: {
    color: DS.primary,
    fontWeight: '600',
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DS.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: DS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
    gap: 12,
  },
  ctaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DS.primaryFaded,
    borderWidth: 2,
    borderColor: DS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.primary,
  },
  ctaPreviewLabel: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '400',
  },
  ctaPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.gray900,
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DS.primaryFaded,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
  },
  emailChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.primary,
  },
});

export default RegisterScreen;