// components/ui/Input.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Animated,
  TouchableOpacity,
  Platform,
  TextStyle,
} from 'react-native';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const DESIGN = {
  colors: {
    primary: '#0D9488',
    primaryDark: '#0F766E',
    primaryFaded: 'rgba(13,148,136,0.08)',
    primaryLight: '#CCFBF1',
    error: '#EF4444',
    errorFaded: 'rgba(239,68,68,0.08)',
    success: '#10B981',
    successFaded: 'rgba(16,185,129,0.08)',
    warning: '#F59E0B',

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
    inputBorder: '#E2E8F0',
    inputBg: '#FFFFFF',
    inputBgFocused: '#FFFFFF',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type InputVariant = 'default' | 'filled' | 'underline' | 'search';
type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  success?: boolean;
  successMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  // Enhanced props
  variant?: InputVariant;
  size?: InputSize;
  required?: boolean;
  optional?: boolean;
  showCharCount?: boolean;
  maxLength?: number;
  floatingLabel?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  loading?: boolean;
}

// ─── Helper: Clear button ─────────────────────────────────────────────────────
const ClearButton: React.FC<{
  onPress: () => void;
  visible: boolean;
}> = ({ onPress, visible }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: visible ? 1 : 0,
        damping: 14,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity
        onPress={onPress}
        style={styles.clearBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Clear input"
        accessibilityRole="button"
      >
        <View style={styles.clearCircle}>
          <Text style={styles.clearText}>✕</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  success,
  successMessage,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  variant = 'default',
  size = 'md',
  required = false,
  optional = false,
  showCharCount = false,
  maxLength,
  floatingLabel = false,
  clearable = false,
  onClear,
  loading = false,
  value,
  onChangeText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(
    (value as string) ?? '',
  );

  // ── Animations ──
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(
    new Animated.Value(
      floatingLabel && (value as string)?.length ? 1 : 0,
    ),
  ).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Sync external value
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value as string);
    }
  }, [value]);

  // Border animation on focus
  useEffect(() => {
    Animated.spring(borderColorAnim, {
      toValue: isFocused ? 1 : 0,
      damping: 14,
      stiffness: 180,
      useNativeDriver: false,
    }).start();

    // Subtle scale on focus
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.005 : 1,
      damping: 14,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

    // Floating label animation
    if (floatingLabel) {
      Animated.spring(labelAnim, {
        toValue: isFocused || internalValue.length > 0 ? 1 : 0,
        damping: 14,
        stiffness: 180,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused, internalValue, floatingLabel]);

  // Shake on error
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 4,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -4,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error]);

  // ── State getters ──
  const isError = !!error;
  const isSuccess = success && !isError;
  const hasValue = internalValue.length > 0;
  const charCount = internalValue.length;

  // ── Border color interpolation ──
  const getBorderColor = () => {
    if (isError) return DESIGN.colors.error;
    if (isSuccess) return DESIGN.colors.success;
    if (isFocused) return DESIGN.colors.primary;
    return DESIGN.colors.inputBorder;
  };

  const getBackgroundColor = () => {
    if (variant === 'filled') {
      if (isError) return DESIGN.colors.errorFaded;
      if (isSuccess) return DESIGN.colors.successFaded;
      if (isFocused) return DESIGN.colors.primaryFaded;
      return DESIGN.colors.gray50;
    }
    if (variant === 'search') return DESIGN.colors.gray100;
    return DESIGN.colors.inputBg;
  };

  // ── Size styles ──
  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return { height: 40, paddingHorizontal: 12, fontSize: 13 };
      case 'md':
        return { height: 48, paddingHorizontal: 14, fontSize: 14 };
      case 'lg':
        return { height: 56, paddingHorizontal: 16, fontSize: 15 };
    }
  };

  const sizeStyle = getSizeStyle();

  // ── Variant-specific container style ──
  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
    };

    switch (variant) {
      case 'underline':
        return {
          ...base,
          borderRadius: 0,
          borderTopWidth: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderBottomWidth: 1.5,
          backgroundColor: 'transparent',
        };
      case 'search':
        return {
          ...base,
          borderWidth: 0,
          borderRadius: DESIGN.radius.full,
        };
      default:
        return {
          ...base,
          borderWidth: isFocused || isError || isSuccess ? 1.5 : 1,
          borderRadius: DESIGN.radius.md,
        };
    }
  };

  // ── Handle change ──
  const handleChange = (text: string) => {
    setInternalValue(text);
    onChangeText?.(text);
  };

  // ── Handle clear ──
  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    onClear?.();
  };

  // ── Floating label ──
  const floatingTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sizeStyle.height / 2 - 9, -9],
  });
  const floatingFontSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 11],
  });
  const floatingColor = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DESIGN.colors.gray400, DESIGN.colors.primary],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { transform: [{ translateX: shakeAnim }] },
      ]}
    >
      {/* ── Label ── */}
      {label && !floatingLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && (
              <Text style={styles.requiredStar}> *</Text>
            )}
          </Text>
          {optional && (
            <Text style={styles.optionalTag}>Optional</Text>
          )}
        </View>
      )}

      {/* ── Input wrapper ── */}
      <Animated.View
        style={[
          styles.inputWrapper,
          getContainerStyle(),
          { height: floatingLabel ? sizeStyle.height + 4 : sizeStyle.height },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Floating label overlay */}
        {floatingLabel && label && (
          <Animated.Text
            style={[
              styles.floatingLabel,
              {
                top: floatingTop,
                fontSize: floatingFontSize,
                color: isError
                  ? DESIGN.colors.error
                  : (floatingColor as any),
                left: leftIcon ? 44 : 14,
                backgroundColor: getBackgroundColor(),
              },
            ]}
          >
            {label}
            {required && (
              <Text style={styles.requiredStar}> *</Text>
            )}
          </Animated.Text>
        )}

        {/* Left icon */}
        {leftIcon && (
          <View style={[styles.iconContainer, styles.iconLeft]}>
            {leftIcon}
          </View>
        )}

        {/* TextInput */}
        <TextInput
          style={[
            styles.input,
            {
              fontSize: sizeStyle.fontSize,
              paddingHorizontal: leftIcon ? 0 : sizeStyle.paddingHorizontal,
              paddingLeft: leftIcon ? 8 : sizeStyle.paddingHorizontal,
              paddingRight:
                clearable && hasValue
                  ? 0
                  : rightIcon
                  ? 0
                  : sizeStyle.paddingHorizontal,
              color: DESIGN.colors.gray900,
            },
            inputStyle,
          ]}
          placeholderTextColor={DESIGN.colors.gray400}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={internalValue}
          onChangeText={handleChange}
          maxLength={maxLength}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...props}
        />

        {/* Clear button */}
        {clearable && (
          <ClearButton
            visible={hasValue && isFocused}
            onPress={handleClear}
          />
        )}

        {/* Right icon / success indicator */}
        {!clearable && rightIcon && (
          <View style={[styles.iconContainer, styles.iconRight]}>
            {rightIcon}
          </View>
        )}

        {/* Success icon */}
        {isSuccess && !rightIcon && !clearable && (
          <Animated.View style={[styles.iconContainer, styles.iconRight]}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
          </Animated.View>
        )}

        {/* Error icon */}
        {isError && !rightIcon && !clearable && (
          <View style={[styles.iconContainer, styles.iconRight]}>
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── Bottom row: error/hint + char count ── */}
      <View style={styles.bottomRow}>
        {/* Error message */}
        {isError && (
          <View style={styles.feedbackRow}>
            <Text style={styles.errorDot}>•</Text>
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
        )}

        {/* Success message */}
        {isSuccess && successMessage && (
          <View style={styles.feedbackRow}>
            <Text style={styles.successDot}>✓</Text>
            <Text style={styles.successText} numberOfLines={1}>
              {successMessage}
            </Text>
          </View>
        )}

        {/* Hint text */}
        {!isError && !isSuccess && hint && (
          <Text style={styles.hintText} numberOfLines={2}>
            {hint}
          </Text>
        )}

        {/* Char count */}
        {showCharCount && maxLength && (
          <Text
            style={[
              styles.charCount,
              charCount >= maxLength && styles.charCountLimit,
              !isError && !isSuccess && !hint && { marginLeft: 'auto' },
            ]}
          >
            {charCount}/{maxLength}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN.colors.gray700,
    letterSpacing: 0.1,
  },
  requiredStar: {
    color: DESIGN.colors.error,
    fontWeight: '700',
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '500',
    color: DESIGN.colors.gray500,
    backgroundColor: DESIGN.colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.full,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  input: {
    flex: 1,
    height: '100%',
    fontWeight: '400',
    lineHeight: Platform.select({ ios: 0, android: 20 }),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  iconContainer: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  iconLeft: {
    paddingLeft: 12,
    paddingRight: 0,
  },
  iconRight: {
    paddingRight: 12,
    paddingLeft: 4,
  },
  floatingLabel: {
    position: 'absolute',
    zIndex: 10,
    fontWeight: '500',
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  // Clear button
  clearBtn: {
    paddingHorizontal: 10,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DESIGN.colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 9,
    color: DESIGN.colors.white,
    fontWeight: '700',
    lineHeight: 13,
  },
  // Success / Error icons
  successIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DESIGN.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    fontSize: 11,
    color: DESIGN.colors.white,
    fontWeight: '800',
    lineHeight: 16,
  },
  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DESIGN.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    fontSize: 12,
    color: DESIGN.colors.white,
    fontWeight: '800',
    lineHeight: 16,
  },
  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
    minHeight: 16,
    gap: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 4,
  },
  errorDot: {
    fontSize: 16,
    color: DESIGN.colors.error,
    lineHeight: 18,
    marginTop: -1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: DESIGN.colors.error,
    lineHeight: 17,
    flex: 1,
  },
  successDot: {
    fontSize: 11,
    color: DESIGN.colors.success,
    fontWeight: '700',
    lineHeight: 17,
  },
  successText: {
    fontSize: 12,
    fontWeight: '500',
    color: DESIGN.colors.success,
    lineHeight: 17,
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '400',
    color: DESIGN.colors.gray500,
    lineHeight: 17,
    flex: 1,
  },
  charCount: {
    fontSize: 11,
    fontWeight: '500',
    color: DESIGN.colors.gray500,
    lineHeight: 17,
    textAlign: 'right',
  },
  charCountLimit: {
    color: DESIGN.colors.error,
    fontWeight: '600',
  },
});

export default Input;