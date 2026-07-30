// screens/buyer/ShopProfileScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  Share,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SkeletonCard, Skeleton, SkeletonHeader } from '../../components/ui/Skeleton';
import {
  formatPrice,
  formatRating,
  isShopOpen,
  formatDistance,
} from '../../utils/formatters';
import {
  openDirections,
  openWhatsApp,
  makeCall,
  shareContent,
} from '../../utils/helpers';
import { getProductImageUrl, sanitizeImageUrl } from '../../utils/image';
import shopService from '../../services/shopService';
import { useTheme } from '../../theme';

// ─── Design System ────────────────────────────────────────────────────────────
const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.primary,
      zIndex: 100,
      paddingBottom: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    stickyHeaderTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    cover: {
      height: COVER_HEIGHT,
      position: 'relative',
      overflow: 'hidden',
    },
    coverBg: {
      backgroundColor: colors.primaryDark,
    },
    coverOverlay: {
      backgroundColor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(7,89,83,0.85)',
    },
    coverCircle1: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(255,255,255,0.04)',
      top: -60,
      right: -60,
    },
    coverCircle2: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.03)',
      bottom: -40,
      left: -40,
    },
    coverCircle3: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.04)',
      top: 80,
      left: SCREEN_WIDTH * 0.3,
    },
    coverActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 12,
    },
    coverActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
      minHeight: 44,
      minWidth: 44,
    },
    coverActionRight: {
      flexDirection: 'row',
      gap: 10,
    },
    coverContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 24,
    },
    logoWrapper: {
      position: 'relative',
      marginBottom: 14,
    },
    logoRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.30)',
      padding: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoContainer: {
      width: '100%',
      height: '100%',
      borderRadius: 40,
      overflow: 'hidden',
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    logoFallback: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFaded,
    },
    onlineDot: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    coverTextBlock: {
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    shopName: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 4,
    },
    shopCategory: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      fontWeight: '400',
      textTransform: 'capitalize',
      marginBottom: 12,
    },
    coverBadges: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    coverBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    verifiedBadge: {
      backgroundColor: 'rgba(16,185,129,0.18)',
      borderColor: 'rgba(16,185,129,0.25)',
    },
    deliveryBadge: {
      backgroundColor: 'rgba(13,148,136,0.20)',
      borderColor: 'rgba(13,148,136,0.25)',
    },
    coverBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    openDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginTop: -24,
      borderRadius: radius.lg,
      paddingVertical: 16,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
      zIndex: 10,
    },
    statPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    statIconBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    statTextBlock: {
      alignItems: 'flex-start',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
      lineHeight: 20,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '500',
      lineHeight: 14,
    },
    statsCardDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    actionsRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 20,
      gap: 4,
    },
    actionBtnPressable: {
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
    },
    actionIconBox: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    sectionDivider: {
      height: 8,
      backgroundColor: colors.background,
      marginVertical: 4,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    sectionIconBox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primaryFaded,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sectionCountPill: {
      backgroundColor: colors.primaryFaded,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    sectionCountText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    sectionAction: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    aboutText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
      fontWeight: '400',
      marginBottom: 14,
    },
    addressCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    addressIconBox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryFaded,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    addressText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
      lineHeight: 18,
      marginBottom: 2,
    },
    addressCity: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    addressMapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.primaryFaded,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
      alignSelf: 'flex-start',
    },
    addressMapText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    hoursCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hoursHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hoursTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    openStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    openStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    openStatusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    productsListPadding: {
      paddingRight: 20,
      gap: 12,
    },
    productMiniCard: {
      width: 160,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    productMiniImage: {
      height: 120,
      backgroundColor: colors.background,
      position: 'relative',
    },
    productMiniPhoto: {
      width: '100%',
      height: '100%',
    },
    productMiniPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFaded,
    },
    miniDiscountBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: colors.error,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    miniDiscountText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    productMiniInfo: {
      padding: 10,
      gap: 4,
    },
    productMiniName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 18,
      minHeight: 36,
    },
    productMiniPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    productMiniPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.3,
    },
    productMiniRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    productMiniRatingText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning,
    },
    emptyProducts: {
      alignItems: 'center',
      paddingVertical: 28,
    },
    emptyProductsIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyProductsText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    emptyProductsHint: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '400',
    },
    trustCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: isDarkMode ? '#102F20' : colors.successFaded,
      borderRadius: radius.md,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(16,185,129,0.30)' : 'rgba(16,185,129,0.15)',
      borderLeftWidth: 3,
      borderLeftColor: colors.success,
    },
    trustIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(16,185,129,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    trustTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.success,
      marginBottom: 4,
    },
    trustSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      fontWeight: '400',
    },
    floatingCta: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      ...shadows.lg,
    },
    floatingCtaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      paddingVertical: 16,
      minHeight: 56,
    },
    floatingCtaBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    skeletonContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
      gap: 16,
    },
    skeletonStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: -24,
      marginHorizontal: 20,
      ...shadows.md,
    },
    skeletonStat: {
      alignItems: 'center',
      flex: 1,
    },
    skeletonActions: {
      flexDirection: 'row',
      paddingVertical: 20,
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    skeletonAction: {
      alignItems: 'center',
      flex: 1,
    },
    notFoundContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    notFoundIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    notFoundTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    notFoundSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    notFoundBtn: {
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    notFoundBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
  });
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 280;

type Props = NativeStackScreenProps<any, 'ShopProfile'>;

// ─── Action Button ────────────────────────────────────────────────────────────
const ActionButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
  index?: number;
}> = ({
  icon,
  label,
  onPress,
  color,
  bgColor,
  index = 0,
}) => {
    const { colors, radius, shadows, isDarkMode } = useTheme();
    const styles = getStyles(colors, radius, shadows, isDarkMode);
    const activeColor = color || colors.primary;
    const activeBg = bgColor || colors.primaryFaded;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const entryAnim = useRef(new Animated.Value(0)).current;
    const entryTranslate = useRef(new Animated.Value(16)).current;

    useEffect(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(entryAnim, {
            toValue: 1,
            damping: 14,
            stiffness: 160,
            useNativeDriver: true,
          }),
          Animated.spring(entryTranslate, {
            toValue: 0,
            damping: 14,
            stiffness: 160,
            useNativeDriver: true,
          }),
        ]).start();
      }, 400 + index * 80);
    }, []);

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.90,
        damping: 12,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 10,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={{
          opacity: entryAnim,
          transform: [{ translateY: entryTranslate }, { scale: scaleAnim }],
          alignItems: 'center',
          flex: 1,
        }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.actionBtnPressable}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={[styles.actionIconBox, { backgroundColor: activeBg }]}>
            <Ionicons name={icon as any} size={22} color={activeColor} />
          </View>
          <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        </Pressable>
      </Animated.View>
    );
  };

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill: React.FC<{
  icon: string;
  value: string;
  label: string;
  color?: string;
  bgColor?: string;
  index?: number;
}> = ({
  icon,
  value,
  label,
  color,
  bgColor,
  index = 0,
}) => {
    const { colors, radius, shadows, isDarkMode } = useTheme();
    const styles = getStyles(colors, radius, shadows, isDarkMode);
    const activeColor = color || colors.primary;
    const activeBg = bgColor || colors.primaryFaded;
    const entryAnim = useRef(new Animated.Value(0)).current;
    const entryScale = useRef(new Animated.Value(0.85)).current;

    useEffect(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(entryAnim, {
            toValue: 1,
            damping: 14,
            stiffness: 160,
            useNativeDriver: true,
          }),
          Animated.spring(entryScale, {
            toValue: 1,
            damping: 12,
            stiffness: 180,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300 + index * 70);
    }, []);

    return (
      <Animated.View
        style={[
          styles.statPill,
          {
            opacity: entryAnim,
            transform: [{ scale: entryScale }],
          },
        ]}
      >
        <View style={[styles.statIconBox, { backgroundColor: activeBg }]}>
          <Ionicons name={icon as any} size={14} color={activeColor} />
        </View>
        <View style={styles.statTextBlock}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      </Animated.View>
    );
  };

// ─── Product Mini Card ────────────────────────────────────────────────────────
const ProductMiniCard: React.FC<{
  item: any;
  index: number;
  onPress: () => void;
}> = ({ item, index, onPress }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const entryAnim = useRef(new Animated.Value(0)).current;
  const entryTranslate = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(entryAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(entryTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600 + index * 80);
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 12,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const imageUri = getProductImageUrl(item.images);
  const showImage = imageUri && !imageError;

  useEffect(() => {
    setImageError(false);
  }, [imageUri]);

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateX: entryTranslate }, { scale: pressScale }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.productMiniCard}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatPrice(item.price)}`}
      >
        {/* Image */}
        <View style={styles.productMiniImage}>
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.productMiniPhoto}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.productMiniPlaceholder}>
              <Ionicons name="cube-outline" size={28} color={colors.primary} />
            </View>
          )}
          {item.discount > 0 && (
            <View style={styles.miniDiscountBadge}>
              <Text style={styles.miniDiscountText}>{item.discount}%</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.productMiniInfo}>
          <Text style={styles.productMiniName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.productMiniPriceRow}>
            <Text style={styles.productMiniPrice}>
              {formatPrice(item.price)}
            </Text>
          </View>
          {item.averageRating ? (
            <View style={styles.productMiniRating}>
              <Ionicons name="star" size={10} color={colors.warning} />
              <Text style={styles.productMiniRatingText}>
                {item.averageRating.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Shop Header Cover ────────────────────────────────────────────────────────
const ShopCover: React.FC<{
  shop: any;
  openStatus: { isOpen: boolean; message: string };
  onBack: () => void;
  onShare: () => void;
}> = ({ shop, openStatus, onBack, onShare }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const [logoError, setLogoError] = useState(false);
  const logoUri = sanitizeImageUrl(shop.logo);
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 12,
        stiffness: 160,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslate, {
          toValue: 0,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);
  }, []);

  return (
    <View style={styles.cover}>
      {/* Gradient background layers */}
      <View style={[StyleSheet.absoluteFillObject, styles.coverBg]} />
      <View style={[StyleSheet.absoluteFillObject, styles.coverOverlay]} />

      {/* Decorative circles */}
      <View style={styles.coverCircle1} />
      <View style={styles.coverCircle2} />
      <View style={styles.coverCircle3} />

      {/* Top action buttons */}
      <View style={styles.coverActions}>
        <Pressable
          onPress={onBack}
          style={styles.coverActionBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color='#FFFFFF' />
        </Pressable>

        <View style={styles.coverActionRight}>
          <Pressable
            onPress={onShare}
            style={styles.coverActionBtn}
            accessibilityLabel="Share shop"
          >
            <Ionicons name="share-outline" size={18} color='#FFFFFF' />
          </Pressable>
        </View>
      </View>

      {/* Shop info */}
      <View style={styles.coverContent}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoRing}>
            <View style={styles.logoContainer}>
              {logoUri && !logoError ? (
                <Image
                  source={{ uri: logoUri }}
                  style={styles.logoImage}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <View style={styles.logoFallback}>
                  <Ionicons name="storefront" size={32} color={colors.primary} />
                </View>
              )}
            </View>
          </View>

          {/* Online indicator */}
          <View
            style={[
              styles.onlineDot,
              {
                backgroundColor: openStatus.isOpen ? colors.success : colors.textTertiary,
              },
            ]}
          />
        </Animated.View>

        {/* Text info */}
        <Animated.View
          style={[
            styles.coverTextBlock,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
          <Text style={styles.shopCategory}>
            {shop.category?.replace(/_/g, ' ')?.toLowerCase()}
          </Text>

          {/* Badges row */}
          <View style={styles.coverBadges}>
            {shop.isVerified && (
              <View style={[styles.coverBadge, styles.verifiedBadge]}>
                <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                <Text style={[styles.coverBadgeText, { color: colors.success }]}>
                  Verified
                </Text>
              </View>
            )}
            <View
              style={[
                styles.coverBadge,
                {
                  backgroundColor: openStatus.isOpen ? colors.success + '22' : colors.error + '22',
                },
              ]}
            >
              <View
                style={[
                  styles.openDot,
                  {
                    backgroundColor: openStatus.isOpen ? colors.success : colors.error,
                  },
                ]}
              />
              <Text
                style={[
                  styles.coverBadgeText,
                  {
                    color: openStatus.isOpen ? colors.success : colors.error,
                  },
                ]}
              >
                {openStatus.message}
              </Text>
            </View>
            {shop.deliveryEnabled && (
              <View style={[styles.coverBadge, styles.deliveryBadge]}>
                <Ionicons name="bicycle-outline" size={11} color={colors.primary} />
                <Text style={[styles.coverBadgeText, { color: colors.primary }]}>
                  Delivery
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const ShopSkeleton: React.FC = () => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  return (
    <View style={styles.container}>
      {/* Cover skeleton */}
      <Skeleton width="100%" height={COVER_HEIGHT} borderRadius={0} />
      <View style={styles.skeletonContent}>
        {/* Stats skeleton */}
        <View style={styles.skeletonStats}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonStat}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <Skeleton width={50} height={12} borderRadius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        {/* Actions skeleton */}
        <View style={styles.skeletonActions}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonAction}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <Skeleton width={36} height={10} borderRadius={5} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
        {/* Cards skeleton */}
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>

  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: string;
  title: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}> = ({ icon, title, count, action }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon as any} size={14} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.sectionAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>

  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ShopProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const { shopId } = route.params as { shopId: string };
  const insets = useSafeAreaInsets();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    const load = async () => {
      try {
        const res = await shopService.getById(shopId);
        setShop(res.data);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => StatusBar.setBarStyle('dark-content');
  }, [shopId]);

  const handleShare = useCallback(() => {
    if (shop) {
      shareContent(shop.name, `Check out ${shop.name} on CityLocalShop! 🏪`);
    }
  }, [shop]);

  if (loading) return <ShopSkeleton />;

  if (!shop) {
    return (
      <View style={styles.notFoundContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.notFoundIconCircle}>
          <Ionicons name="storefront-outline" size={40} color={colors.textTertiary} />
        </View>
        <Text style={styles.notFoundTitle}>Shop Not Found</Text>
        <Text style={styles.notFoundSubtitle}>
          This shop may have been removed or is temporarily unavailable.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.notFoundBtn}
        >
          <Text style={styles.notFoundBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openStatus = isShopOpen(shop.operatingHours);
  const productCount = Array.isArray(shop.products)
    ? shop.products.length
    : (shop._count?.products ?? 0);
  const openShopProducts = () =>
    navigation.push('ShopProducts', {
      shopId,
      shopName: shop.name,
    });

  // Sticky header opacity
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 100, COVER_HEIGHT - 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Sticky Header (appears on scroll) ── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerBgOpacity,
            paddingTop: insets.top,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
          {shop.name}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Cover Header ── */}
        <ShopCover
          shop={shop}
          openStatus={openStatus}
          onBack={() => navigation.goBack()}
          onShare={handleShare}
        />

        {/* ── Stats Card (floats above cover) ── */}
        <View style={styles.statsCard}>
          <StatPill
            icon="star"
            value={formatRating(shop.averageRating)}
            label={`${shop.totalReviews ?? 0} reviews`}
            color={colors.warning}
            bgColor={colors.warningFaded}
            index={0}
          />
          <View style={styles.statsCardDivider} />
          <StatPill
            icon="cube-outline"
            value={String(productCount)}
            label="Products"
            color={colors.primary}
            bgColor={colors.primaryFaded}
            index={1}
          />
          <View style={styles.statsCardDivider} />
          <StatPill
            icon="shield-checkmark-outline"
            value={shop.trustScore?.toFixed(1) ?? '0'}
            label="Trust Score"
            color={colors.success}
            bgColor={colors.successFaded}
            index={2}
          />
        </View>

        <Animated.View style={{ opacity: contentOpacity }}>
          {/* ── Action Buttons ── */}
          <View style={styles.actionsRow}>
            <ActionButton
              icon="call-outline"
              label="Call"
              onPress={() => makeCall(shop.phone)}
              color={colors.primary}
              bgColor={colors.primaryFaded}
              index={0}
            />
            {shop.whatsapp && (
              <ActionButton
                icon="logo-whatsapp"
                label="WhatsApp"
                onPress={() => openWhatsApp(shop.whatsapp)}
                color={colors.success}
                bgColor={colors.successFaded}
                index={1}
              />
            )}
            <ActionButton
              icon="navigate-outline"
              label="Directions"
              onPress={() =>
                openDirections(shop.latitude, shop.longitude, shop.name)
              }
              color={colors.info}
              bgColor={colors.infoFaded}
              index={2}
            />
            <ActionButton
              icon="share-social-outline"
              label="Share"
              onPress={handleShare}
              color={colors.purple}
              bgColor={colors.purpleFaded}
              index={3}
            />
          </View>

          {/* ── Divider ── */}
          <View style={styles.sectionDivider} />

          {/* ── About Section ── */}
          <View style={styles.section}>
            <SectionHeader icon="information-circle-outline" title="About" />

            <Text style={styles.aboutText}>
              {shop.description || 'No description provided yet.'}
            </Text>

            {/* Address card */}
            <View style={styles.addressCard}>
              <View style={styles.addressIconBox}>
                <Ionicons name="location" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressText}>
                  {shop.address}
                </Text>
                <Text style={styles.addressCity}>
                  {shop.city} — {shop.pincode}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  openDirections(shop.latitude, shop.longitude, shop.name)
                }
                style={styles.addressMapBtn}
              >
                <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                <Text style={styles.addressMapText}>Map</Text>
              </TouchableOpacity>
            </View>

            {/* Operating hours */}
            {shop.operatingHours && (
              <View style={styles.hoursCard}>
                <View style={styles.hoursHeader}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.hoursTitle}>Operating Hours</Text>
                  <View
                    style={[
                      styles.openStatusPill,
                      {
                        backgroundColor: openStatus.isOpen ? colors.success + '22' : colors.error + '22',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.openStatusDot,
                        {
                          backgroundColor: openStatus.isOpen ? colors.success : colors.error,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.openStatusText,
                        {
                          color: openStatus.isOpen ? colors.success : colors.error,
                        },
                      ]}
                    >
                      {openStatus.message}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ── Divider ── */}
          <View style={styles.sectionDivider} />

          {/* ── Products Section ── */}
          <View style={styles.section}>
            <SectionHeader
              icon="cube-outline"
              title="Products"
              count={productCount}
              action={
                productCount > 5
                  ? {
                    label: 'See all →',
                    onPress: openShopProducts,
                  }
                  : undefined
              }
            />

            {shop.products && shop.products.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={shop.products}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.productsListPadding}
                renderItem={({ item, index }) => (
                  <ProductMiniCard
                    item={item}
                    index={index}
                    onPress={() =>
                      navigation.push('ProductDetail', {
                        productId: item.id,
                      })
                    }
                  />
                )}
              />
            ) : (
              <View style={styles.emptyProducts}>
                <View style={styles.emptyProductsIcon}>
                  <Ionicons
                    name="cube-outline"
                    size={28}
                    color={colors.textTertiary}
                  />
                </View>
                <Text style={styles.emptyProductsText}>
                  No products listed yet
                </Text>
                <Text style={styles.emptyProductsHint}>
                  Check back soon!
                </Text>
              </View>
            )}
          </View>

          {/* ── Trust & Safety ── */}
          {shop.isVerified && (
            <>
              <View style={styles.sectionDivider} />
              <View style={styles.section}>
                <View style={styles.trustCard}>
                  <View style={styles.trustIconBox}>
                    <Ionicons
                      name="shield-checkmark"
                      size={24}
                      color={colors.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>
                      Verified Shop
                    </Text>
                    <Text style={styles.trustSubtitle}>
                      This shop has been verified by CityLocalShop and meets
                      our quality standards.
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Bottom space */}
          <View style={{ height: insets.bottom + 100 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Floating CTA ── */}
      {openStatus.isOpen && (
        <Animated.View
          style={[
            styles.floatingCta,
            {
              paddingBottom: insets.bottom + 12,
              opacity: contentOpacity,
            },
          ]}
        >
          <TouchableOpacity
            onPress={openShopProducts}
            style={styles.floatingCtaBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="bag-outline" size={20} color='#FFFFFF' />
            <Text style={styles.floatingCtaBtnText}>
              Shop Now · {productCount} items
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default ShopProfileScreen;