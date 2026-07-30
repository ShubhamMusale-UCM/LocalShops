import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { colors, spacing, typography } from '../../theme';

interface RatingDistribution {
  rating: number;
  count: number;
}

interface SentimentChartProps {
  data: RatingDistribution[];
  totalReviews: number;
  averageRating: number;
}

const SentimentChart: React.FC<SentimentChartProps> = ({
  data,
  totalReviews,
  averageRating,
}) => {
  const chartData = {
    labels: ['5⭐', '4⭐', '3⭐', '2⭐', '1⭐'],
    datasets: [
      {
        data: [
          data.find(d => d.rating === 5)?.count || 0,
          data.find(d => d.rating === 4)?.count || 0,
          data.find(d => d.rating === 3)?.count || 0,
          data.find(d => d.rating === 2)?.count || 0,
          data.find(d => d.rating === 1)?.count || 0,
        ],
      },
    ],
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      {/* Header with average rating */}
      <View style={styles.header}>
        <View style={styles.averageSection}>
          <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
          <Text style={styles.averageLabel}>out of 5</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                style={[
                  styles.star,
                  {
                    color:
                      star <= Math.round(averageRating) ? colors.warning : colors.gray300,
                  },
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          <Text style={styles.totalReviews}>Based on {totalReviews} reviews</Text>
        </View>
      </View>

      {/* Rating distribution bar chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Rating Distribution</Text>
        {data
          .sort((a, b) => b.rating - a.rating)
          .map((item) => {
            const percentage = totalReviews > 0 ? (item.count / totalReviews) * 100 : 0;
            return (
              <View key={item.rating} style={styles.barRow}>
                <Text style={styles.ratingLabel}>{item.rating}⭐</Text>
                <View style={styles.barBackground}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${Math.max(percentage, 2)}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.percentage}>{percentage.toFixed(0)}%</Text>
                <Text style={styles.count}>({item.count})</Text>
              </View>
            );
          })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  header: {
    marginBottom: spacing.lg,
  },
  averageSection: {
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.gray900,
  },
  averageLabel: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  star: {
    fontSize: 18,
  },
  totalReviews: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: spacing.sm,
  },
  chartContainer: {
    marginTop: spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  ratingLabel: {
    width: 30,
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  barBackground: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  percentage: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  count: {
    width: 30,
    textAlign: 'right',
    fontSize: 12,
    color: colors.gray500,
  },
});

export default SentimentChart;
