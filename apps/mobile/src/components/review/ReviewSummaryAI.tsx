import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

interface ReviewSummaryProps {
  shopId: string;
  isLoading?: boolean;
  summary?: {
    summary: string;
    positiveSentiment: number;
    neutralSentiment: number;
    negativeSentiment: number;
    topIssues: string[];
    topStrengths: string[];
  };
}

const ReviewSummaryAI: React.FC<ReviewSummaryProps> = ({
  shopId,
  isLoading = false,
  summary,
}) => {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing customer reviews...</Text>
        </View>
      </View>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Review Summary</Text>
          <Text style={styles.headerSubtitle}>Based on customer feedback</Text>
        </View>
      </View>

      {/* Summary Text */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryText}>{summary.summary}</Text>
      </View>

      {/* Sentiment Distribution */}
      <View style={styles.sentimentContainer}>
        <Text style={styles.sectionTitle}>Customer Sentiment</Text>
        <View style={styles.sentimentRow}>
          <SentimentIndicator
            emoji="😊"
            label="Positive"
            percentage={Math.round(summary.positiveSentiment * 100)}
            color={colors.success}
          />
          <SentimentIndicator
            emoji="😐"
            label="Neutral"
            percentage={Math.round(summary.neutralSentiment * 100)}
            color={colors.warning}
          />
          <SentimentIndicator
            emoji="😞"
            label="Negative"
            percentage={Math.round(summary.negativeSentiment * 100)}
            color={colors.error}
          />
        </View>
      </View>

      {/* Top Strengths */}
      {summary.topStrengths.length > 0 && (
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Ionicons name="thumbs-up" size={16} color={colors.success} />
            <Text style={[styles.sectionTitle, { marginLeft: spacing.sm }]}>
              Top Strengths
            </Text>
          </View>
          {summary.topStrengths.slice(0, 3).map((strength, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listItemText}>{strength}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top Issues */}
      {summary.topIssues.length > 0 && (
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.sectionTitle, { marginLeft: spacing.sm }]}>
              Areas to Improve
            </Text>
          </View>
          {summary.topIssues.slice(0, 3).map((issue, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listItemText}>{issue}</Text>
            </View>
          ))}
        </View>
      )}

      {/* AI Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.gray500} />
        <Text style={styles.disclaimerText}>
          AI-generated summary based on customer reviews. Always read individual reviews for
          complete context.
        </Text>
      </View>
    </View>
  );
};

interface SentimentIndicatorProps {
  emoji: string;
  label: string;
  percentage: number;
  color: string;
}

const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({
  emoji,
  label,
  percentage,
  color,
}) => (
  <View style={styles.sentimentItem}>
    <Text style={styles.sentimentEmoji}>{emoji}</Text>
    <Text style={[styles.sentimentLabel, { color }]}>{percentage}%</Text>
    <Text style={styles.sentimentName}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary + '08',
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.gray600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '20',
  },
  headerIcon: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.gray600,
  },
  summarySection: {
    marginBottom: spacing.md,
  },
  summaryText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 21,
    fontWeight: '500',
  },
  sentimentContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  sentimentRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: spacing.md,
  },
  sentimentItem: {
    alignItems: 'center',
  },
  sentimentEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  sentimentLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sentimentName: {
    fontSize: 12,
    color: colors.gray600,
  },
  listSection: {
    marginBottom: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 6,
  },
  bullet: {
    color: colors.gray600,
    marginRight: spacing.sm,
    fontSize: 16,
  },
  listItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 18,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white + '60',
    padding: spacing.sm,
    borderRadius: 6,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.gray600,
    lineHeight: 15,
  },
});

export default ReviewSummaryAI;
