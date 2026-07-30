import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

interface SentimentBadgeProps {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  score?: number;
  size?: 'small' | 'medium' | 'large';
}

const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment, score, size = 'small' }) => {
  const getSentimentConfig = () => {
    switch (sentiment) {
      case 'POSITIVE':
        return {
          icon: 'happy-outline' as const,
          label: 'Positive',
          bgColor: colors.success + '15',
          textColor: colors.success,
          borderColor: colors.success,
        };
      case 'NEUTRAL':
        return {
          icon: 'help-outline' as const,
          label: 'Neutral',
          bgColor: colors.warning + '15',
          textColor: colors.warning,
          borderColor: colors.warning,
        };
      case 'NEGATIVE':
        return {
          icon: 'sad-outline' as const,
          label: 'Negative',
          bgColor: colors.error + '15',
          textColor: colors.error,
          borderColor: colors.error,
        };
    }
  };

  const config = getSentimentConfig();

  const sizeConfig = {
    small: { padding: spacing.xs, fontSize: 12, iconSize: 14 },
    medium: { padding: spacing.sm, fontSize: 14, iconSize: 16 },
    large: { padding: spacing.md, fontSize: 16, iconSize: 18 },
  };

  const currentSize = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingHorizontal: currentSize.padding,
          paddingVertical: currentSize.padding / 2,
        },
      ]}
    >
      <Ionicons name={config.icon} size={currentSize.iconSize} color={config.textColor} />
      <Text style={[styles.text, { color: config.textColor, fontSize: currentSize.fontSize }]}>
        {config.label}
        {score !== undefined && ` (${(score * 100).toFixed(0)}%)`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
});

export default SentimentBadge;
