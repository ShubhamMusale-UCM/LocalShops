import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';

interface ButtonProps {
  title?: string;
  label?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title, label, onPress, variant = 'primary', size = 'md',
  disabled = false, loading = false, icon, fullWidth = false, style, textStyle,
}) => {
  const buttonText = title ?? label ?? '';
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary': return { backgroundColor: Colors.primary };
      case 'secondary': return { backgroundColor: Colors.secondary };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary };
      case 'ghost': return { backgroundColor: 'transparent' };
      case 'danger': return { backgroundColor: Colors.error };
      default: return { backgroundColor: Colors.primary };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'outline': return Colors.primary;
      case 'ghost': return Colors.primary;
      default: return Colors.white;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm': return { height: 36, paddingHorizontal: 16 };
      case 'lg': return { height: 56, paddingHorizontal: 28 };
      default: return { height: 48, paddingHorizontal: 24 };
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        fullWidth && { width: '100%' },
        disabled && { opacity: 0.5 },
        variant !== 'ghost' && variant !== 'outline' && Shadows.sm,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={[
            Typography.label,
            { color: getTextColor() },
            size === 'sm' && Typography.labelSmall,
            icon ? { marginLeft: 8 } : {},
            textStyle,
          ]}>
            {buttonText}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.radius.sm,
  },
});

export default Button;
