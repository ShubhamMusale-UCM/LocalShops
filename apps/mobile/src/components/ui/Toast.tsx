// components/ui/Toast.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ViewStyle,
} from 'react-native';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const DESIGN = {
  colors: {
    success: '#10B981',
    successDark: '#059669',
    successBg: '#ECFDF5',
    successBorder: 'rgba(16,185,129,0.25)',
    successText: '#065F46',

    error: '#EF4444',
    errorDark: '#DC2626',
    errorBg: '#FEF2F2',
    errorBorder: 'rgba(239,68,68,0.25)',
    errorText: '#991B1B',

    warning: '#F59E0B',
    warningDark: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: 'rgba(245,158,11,0.25)',
    warningText: '#92400E',

    info: '#3B82F6',
    infoDark: '#2563EB',
    infoBg: '#EFF6FF',
    infoBorder: 'rgba(59,130,246,0.25)',
    infoText: '#1E40AF',

    white: '#FFFFFF',
    gray900: '#1F2937',
    gray500: '#9CA3AF',
  },
  radius: {
    lg: 16,
    full: 999,
  },
  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
};

// ─── Toast Config ─────────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: {
    bg: DESIGN.colors.successBg,
    border: DESIGN.colors.successBorder,
    iconBg: DESIGN.colors.success,
    text: DESIGN.colors.successText,
    accent: DESIGN.colors.success,
    icon: '✓',
    label: 'Success',
  },
  error: {
    bg: DESIGN.colors.errorBg,
    border: DESIGN.colors.errorBorder,
    iconBg: DESIGN.colors.error,
    text: DESIGN.colors.errorText,
    accent: DESIGN.colors.error,
    icon: '✕',
    label: 'Error',
  },
  warning: {
    bg: DESIGN.colors.warningBg,
    border: DESIGN.colors.warningBorder,
    iconBg: DESIGN.colors.warning,
    text: DESIGN.colors.warningText,
    accent: DESIGN.colors.warning,
    icon: '!',
    label: 'Warning',
  },
  info: {
    bg: DESIGN.colors.infoBg,
    border: DESIGN.colors.infoBorder,
    iconBg: DESIGN.colors.info,
    text: DESIGN.colors.infoText,
    accent: DESIGN.colors.info,
    icon: 'i',
    label: 'Info',
  },
};

// ─── Platform-aware top offset ────────────────────────────────────────────────
const TOP_OFFSET = Platform.select({
  ios: 54,
  android: (StatusBar.currentHeight ?? 24) + 12,
  default: 54,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type?: keyof typeof TOAST_CONFIG;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  // Enhanced props
  title?: string;
  position?: 'top' | 'bottom';
  showProgress?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  visible,
  onDismiss,
  duration = 3000,
  title,
  position = 'top',
  showProgress = true,
}) => {
  // ── Animations ──
  const translateY = useRef(
    new Animated.Value(position === 'top' ? -120 : 120),
  ).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);

  const config = TOAST_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Reset progress
      progress.setValue(1);

      // Entry animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Progress bar drain
      if (showProgress) {
        progressAnim.current = Animated.timing(progress, {
          toValue: 0,
          duration,
          useNativeDriver: false,
        });
        progressAnim.current.start();
      }

      // Auto dismiss
      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => {
        clearTimeout(timer);
        progressAnim.current?.stop();
      };
    } else {
      dismiss();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -120 : 120,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 0.92,
        damping: 14,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (!visible) return null;

  const positionStyle: ViewStyle =
    position === 'top'
      ? { top: TOP_OFFSET }
      : { bottom: 100 };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        positionStyle,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={onDismiss}
        activeOpacity={0.95}
        style={[
          styles.container,
          {
            backgroundColor: config.bg,
            borderColor: config.border,
          },
          DESIGN.shadow,
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {/* Left accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: config.accent }]}
        />

        {/* Icon circle */}
        <View
          style={[styles.iconCircle, { backgroundColor: config.iconBg }]}
        >
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {title ? (
            <Text
              style={[styles.title, { color: config.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            <Text
              style={[styles.typeLabel, { color: config.accent }]}
              numberOfLines={1}
            >
              {config.label}
            </Text>
          )}
          <Text
            style={[styles.message, { color: config.text }]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>

        {/* Dismiss button */}
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss notification"
        >
          <Text style={[styles.dismissText, { color: config.accent }]}>
            ✕
          </Text>
        </TouchableOpacity>

        {/* Progress bar */}
        {showProgress && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                  backgroundColor: config.accent,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DESIGN.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 60,
    backgroundColor: '#FFFFFF',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 10,
    flexShrink: 0,
  },
  iconText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 1,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    opacity: 0.85,
  },
  dismissBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
  },
});

export default Toast;