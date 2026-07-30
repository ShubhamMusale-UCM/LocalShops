// screens/auth/RoleSelectionScreen.tsx
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryFaded: 'rgba(13,148,136,0.08)',
  primaryLight: '#CCFBF1',
  success: '#10B981',
  successFaded: 'rgba(16,185,129,0.08)',
  info: '#3B82F6',
  infoFaded: 'rgba(59,130,246,0.08)',
  warning: '#F59E0B',
  warningFaded: 'rgba(245,158,11,0.08)',
  purple: '#8B5CF6',
  purpleFaded: 'rgba(139,92,246,0.08)',
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
  background: '#F8FAFC',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

const STATUS_BAR_HEIGHT = Platform.select({
  ios: 44,
  android: StatusBar.currentHeight ?? 24,
  default: 44,
});

// ─── Role Config ──────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'BUYER',
    emoji: '🛍️',
    icon: 'bag-handle-outline' as const,
    iconFilled: 'bag-handle' as const,
    title: 'Shop & Discover',
    subtitle: 'For customers',
    desc: 'Find amazing local shops, browse products, and get fast delivery to your doorstep.',
    color: DS.primary,
    faded: DS.primaryFaded,
    light: DS.primaryLight,
    perks: ['Browse local shops', 'Fast delivery', 'Exclusive deals'],
  },
  {
    id: 'SELLER',
    emoji: '🏪',
    icon: 'storefront-outline' as const,
    iconFilled: 'storefront' as const,
    title: 'Sell & Grow',
    subtitle: 'For shop owners',
    desc: 'List your products, manage inventory, and reach thousands of local customers.',
    color: DS.purple,
    faded: DS.purpleFaded,
    light: '#EDE9FE',
    perks: ['Easy listing tools', 'Sales analytics', 'Order management'],
  },
  {
    id: 'DELIVERY_PARTNER',
    emoji: '🚴',
    icon: 'bicycle-outline' as const,
    iconFilled: 'bicycle' as const,
    title: 'Deliver & Earn',
    subtitle: 'For delivery partners',
    desc: 'Earn money on your own schedule by delivering orders in your neighbourhood.',
    color: DS.warning,
    faded: DS.warningFaded,
    light: '#FEF3C7',
    perks: ['Flexible hours', 'Daily earnings', 'Easy navigation'],
  },
];

type Props = NativeStackScreenProps<any, 'RoleSelection'>;

// ─── Role Card ────────────────────────────────────────────────────────────────
const RoleCard: React.FC<{
  role: (typeof ROLES)[0];
  index: number;
  isSelected: boolean;
  onPress: () => void;
}> = ({ role, index, isSelected, onPress }) => {
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const selectedScale = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Stagger entry
  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(entryAnim, {
          toValue: 1,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200 + index * 100);
  }, []);

  // Selected state animation
  useEffect(() => {
    Animated.spring(selectedScale, {
      toValue: isSelected ? 1 : 0,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

    // Glow animation when selected
    if (isSelected) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });

  return (
    <Animated.View
      style={[
        {
          opacity: entryAnim,
          transform: [{ translateY: entryTranslate }, { scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.roleCard,
          isSelected && {
            borderColor: role.color,
            borderWidth: 2,
            backgroundColor: role.faded,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={role.title}
      >
        {/* Selected glow bg */}
        {isSelected && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: role.color,
                opacity: glowOpacity,
                borderRadius: DS.radius.lg,
              },
            ]}
          />
        )}

        {/* Left: Emoji icon box */}
        <View
          style={[
            styles.roleIconBox,
            {
              backgroundColor: isSelected ? role.color : role.faded,
            },
          ]}
        >
          <Text style={styles.roleEmoji}>{role.emoji}</Text>
        </View>

        {/* Center: Content */}
        <View style={styles.roleContent}>
          <View style={styles.roleTitleRow}>
            <Text
              style={[
                styles.roleTitle,
                isSelected && { color: role.color },
              ]}
            >
              {role.title}
            </Text>
            <View
              style={[
                styles.roleSubtitlePill,
                { backgroundColor: isSelected ? role.color + '18' : DS.gray100 },
              ]}
            >
              <Text
                style={[
                  styles.roleSubtitleText,
                  { color: isSelected ? role.color : DS.gray500 },
                ]}
              >
                {role.subtitle}
              </Text>
            </View>
          </View>
          <Text style={styles.roleDesc} numberOfLines={2}>
            {role.desc}
          </Text>

          {/* Perks */}
          <View style={styles.perksRow}>
            {role.perks.map((perk, i) => (
              <View key={i} style={styles.perkChip}>
                <View
                  style={[
                    styles.perkDot,
                    { backgroundColor: isSelected ? role.color : DS.gray400 },
                  ]}
                />
                <Text
                  style={[
                    styles.perkText,
                    isSelected && { color: role.color },
                  ]}
                >
                  {perk}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right: Radio + Arrow */}
        <View style={styles.roleRight}>
          <Animated.View
            style={[
              styles.radioOuter,
              isSelected && {
                borderColor: role.color,
                backgroundColor: role.color + '15',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.radioInner,
                {
                  backgroundColor: role.color,
                  transform: [{ scale: selectedScale }],
                },
              ]}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RoleSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phone, name } = route.params as { phone: string; name: string };
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ── Animations ──
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-24)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(30)).current;
  const ctaScale = useRef(new Animated.Value(0.95)).current;

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
        Animated.spring(ctaScale, {
          toValue: 1,
          damping: 14,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, 500);
  }, []);

  // CTA entry when role selected
  useEffect(() => {
    if (selectedRole) {
      Animated.spring(ctaScale, {
        toValue: 1.02,
        damping: 10,
        stiffness: 200,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(ctaScale, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [selectedRole]);

  const handleSelect = (roleId: string) => {
    setSelectedRole((prev) => (prev === roleId ? null : roleId));
  };

  const handleContinue = () => {
    if (!selectedRole) return;
    setConfirming(true);
    setTimeout(() => {
      navigation.navigate('Register', { phone, name, role: selectedRole });
      setConfirming(false);
    }, 300);
  };

  const selectedRoleData = ROLES.find((r) => r.id === selectedRole);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={DS.background} />
      <View style={styles.container}>
        {/* Background decoration */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerTranslate }],
                marginTop: STATUS_BAR_HEIGHT + 16,
              },
            ]}
          >
            {/* Greeting */}
            {name ? (
              <View style={styles.greetingRow}>
                <Text style={styles.greetingWave}>👋</Text>
                <Text style={styles.greetingText}>Hey, {name.split(' ')[0]}!</Text>
              </View>
            ) : null}

            <Text style={styles.title}>How will you use{'\n'}CityLocalShop?</Text>
            <Text style={styles.subtitle}>
              Choose your role — you can always switch later
            </Text>

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {[1, 2, 3].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.stepDot,
                    step === 3 && styles.stepDotActive,
                  ]}
                />
              ))}
              <Text style={styles.stepText}>Step 3 of 3</Text>
            </View>
          </Animated.View>

          {/* ── Role Cards ── */}
          <View style={styles.rolesList}>
            {ROLES.map((role, index) => (
              <RoleCard
                key={role.id}
                role={role}
                index={index}
                isSelected={selectedRole === role.id}
                onPress={() => handleSelect(role.id)}
              />
            ))}
          </View>

          {/* Bottom padding for CTA */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* ── Floating CTA ── */}
        <Animated.View
          style={[
            styles.ctaContainer,
            {
              opacity: ctaOpacity,
              transform: [
                { translateY: ctaTranslate },
                { scale: ctaScale },
              ],
            },
          ]}
        >
          {selectedRoleData ? (
            <View style={styles.ctaSelected}>
              <View style={styles.ctaSelectedInfo}>
                <Text style={styles.ctaSelectedEmoji}>
                  {selectedRoleData.emoji}
                </Text>
                <View>
                  <Text style={styles.ctaSelectedLabel}>Selected role</Text>
                  <Text style={styles.ctaSelectedTitle}>
                    {selectedRoleData.title}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={handleContinue}
            disabled={!selectedRole || confirming}
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedRole && styles.ctaButtonDisabled,
              selectedRoleData && {
                backgroundColor: selectedRoleData.color,
              },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue with selected role"
            accessibilityState={{ disabled: !selectedRole }}
          >
            <Text style={styles.ctaButtonText}>
              {confirming
                ? 'Setting up…'
                : selectedRole
                ? 'Continue →'
                : 'Select a role to continue'}
            </Text>
            {selectedRole && !confirming && (
              <Ionicons name="arrow-forward" size={18} color={DS.white} />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Background
  bgCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: DS.primaryFaded,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(139,92,246,0.05)',
  },

  // Header
  header: {
    marginBottom: 28,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  greetingWave: {
    fontSize: 22,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '600',
    color: DS.gray600,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.7,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: DS.gray500,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: DS.radius.full,
    backgroundColor: DS.gray200,
  },
  stepDotActive: {
    backgroundColor: DS.primary,
    width: 32,
  },
  stepText: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Role Cards
  rolesList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: DS.white,
    borderRadius: DS.radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: DS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    minHeight: 44,
  },
  roleIconBox: {
    width: 52,
    height: 52,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  roleEmoji: {
    fontSize: 26,
  },
  roleContent: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.gray900,
    letterSpacing: -0.2,
  },
  roleSubtitlePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
  },
  roleSubtitleText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  roleDesc: {
    fontSize: 12,
    color: DS.gray500,
    lineHeight: 18,
    fontWeight: '400',
    marginTop: 2,
  },
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  perkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  perkDot: {
    width: 5,
    height: 5,
    borderRadius: DS.radius.full,
  },
  perkText: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
  },
  roleRight: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    flexShrink: 0,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: DS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DS.white,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  ctaSelected: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaSelectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ctaSelectedEmoji: {
    fontSize: 28,
  },
  ctaSelectedLabel: {
    fontSize: 11,
    color: DS.gray500,
    fontWeight: '500',
  },
  ctaSelectedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.gray900,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DS.primary,
    paddingVertical: 16,
    borderRadius: DS.radius.xl,
    minHeight: 56,
  },
  ctaButtonDisabled: {
    backgroundColor: DS.gray200,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.white,
    letterSpacing: -0.2,
  },
});

export default RoleSelectionScreen;