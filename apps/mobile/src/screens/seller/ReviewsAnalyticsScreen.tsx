import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { GlassPanel, GlassCard } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { TouchSpring } from '../../components/ui/TouchSpring';
import { useAuthStore } from '../../store/authStore';
import shopService from '../../services/shopService';
import reviewService, { ShopReviewsResponse, ReviewResponse } from '../../services/reviewService';

export default function ReviewsAnalyticsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const isDark = isDarkMode;
  const user = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [reviewsData, setReviewsData] = useState<ShopReviewsResponse | null>(null);
  const [shopStats, setShopStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const shopsResponse = await shopService.getMyShops();
      const shops = shopsResponse?.data || [];
      if (shops && shops.length > 0) {
        const shop = shops[0];
        setShopStats({
          averageRating: shop.averageRating,
          totalReviews: shop.totalReviews,
        });
        
        const data = await reviewService.getShopReviews(shop.id, { limit: 50 });
        setReviewsData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? '#050814' : '#F8FAFC';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const textSub = isDark ? '#94A3B8' : '#64748B';

  const renderHeader = () => {
    if (!reviewsData) return null;

    const avg = shopStats?.averageRating || 0;
    const total = shopStats?.totalReviews || 0;

    const distribution = reviewsData.ratingDistribution || [];
    const maxCount = Math.max(...distribution.map(d => d.count), 1);

    return (
      <View style={{ marginBottom: 24 }}>
        <GlassCard intensity={20} style={styles.summaryCard}>
          <Text style={[styles.sectionTitle, { color: text }]}>Overall Rating</Text>
          
          <View style={styles.ratingRow}>
            <View style={styles.ratingLeft}>
              <Text style={styles.bigRating}>{avg.toFixed(1)}</Text>
              <View style={styles.starsRow}>
                {[1,2,3,4,5].map(s => (
                  <Ionicons 
                    key={s} 
                    name={s <= Math.round(avg) ? 'star' : 'star-outline'} 
                    size={16} 
                    color={s <= Math.round(avg) ? '#F59E0B' : 'rgba(255,255,255,0.2)'} 
                  />
                ))}
              </View>
              <Text style={[styles.totalReviews, { color: textSub }]}>Based on {total} reviews</Text>
            </View>

            <View style={styles.ratingRight}>
              {[5,4,3,2,1].map(r => {
                const item = distribution.find(d => d.rating === r) || { rating: r, count: 0 };
                const pct = (item.count / maxCount) * 100;
                return (
                  <View key={r} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: textSub }]}>{r}</Text>
                    <Ionicons name="star" size={10} color={textSub} style={{ marginRight: 6 }} />
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: r >= 4 ? '#22C55E' : r === 3 ? '#F59E0B' : '#EF4444' }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>Recent Reviews</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: ReviewResponse, index: number }) => {
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <GlassCard intensity={15} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewerInfo}>
              <View style={styles.avatarWrap}>
                {item.user?.avatar ? (
                  <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person" size={16} color="#FFF" />
                )}
              </View>
              <View>
                <Text style={[styles.reviewerName, { color: text }]}>{item.user?.name || 'Customer'}</Text>
                <Text style={[styles.reviewDate, { color: textSub }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.rating}.0</Text>
            </View>
          </View>

          {item.title ? <Text style={[styles.reviewTitle, { color: text }]}>{item.title}</Text> : null}
          <Text style={[styles.reviewComment, { color: textSub }]}>{item.comment}</Text>
          
          {item.photos && item.photos.length > 0 && (
            <View style={styles.photosRow}>
              {item.photos.map((p, i) => (
                <Image key={i} source={{ uri: p }} style={styles.reviewPhoto} />
              ))}
            </View>
          )}

          {/* Sentiment Badge (Seller only insight) */}
          <View style={[styles.sentimentBadge, { 
            backgroundColor: item.sentiment === 'POSITIVE' ? 'rgba(34,197,94,0.1)' : item.sentiment === 'NEGATIVE' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
            borderColor: item.sentiment === 'POSITIVE' ? 'rgba(34,197,94,0.3)' : item.sentiment === 'NEGATIVE' ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.3)',
          }]}>
            <Ionicons 
              name={item.sentiment === 'POSITIVE' ? 'trending-up' : item.sentiment === 'NEGATIVE' ? 'trending-down' : 'remove'} 
              size={12} 
              color={item.sentiment === 'POSITIVE' ? '#22C55E' : item.sentiment === 'NEGATIVE' ? '#EF4444' : '#94A3B8'} 
            />
            <Text style={[styles.sentimentText, { 
              color: item.sentiment === 'POSITIVE' ? '#22C55E' : item.sentiment === 'NEGATIVE' ? '#EF4444' : '#94A3B8'
            }]}>
              {item.sentiment} SENTIMENT
            </Text>
          </View>

        </GlassCard>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientOrbs />

      <GlassPanel intensity={30} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchSpring onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backBtnInner}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </View>
        </TouchSpring>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Reviews & Ratings</Text>
        </View>
        <View style={{ width: 44 }} />
      </GlassPanel>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      ) : (
        <FlatList
          data={reviewsData?.reviews || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={textSub} />
              <Text style={[styles.emptyTitle, { color: text }]}>No Reviews Yet</Text>
              <Text style={[styles.emptySub, { color: textSub }]}>When customers leave reviews, they will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { width: 44, height: 44 },
  backBtnInner: {
    flex: 1, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  
  summaryCard: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingLeft: { alignItems: 'center', flex: 1 },
  bigRating: { fontSize: 48, fontWeight: '900', color: '#FFF', letterSpacing: -2 },
  starsRow: { flexDirection: 'row', gap: 4, marginVertical: 8 },
  totalReviews: { fontSize: 13, fontWeight: '500' },
  
  ratingRight: { flex: 1.5, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { fontSize: 12, fontWeight: '700', width: 12 },
  barBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  reviewCard: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 16 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  reviewerName: { fontSize: 14, fontWeight: '700' },
  reviewDate: { fontSize: 12, marginTop: 2 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  ratingText: { fontSize: 12, fontWeight: '800', color: '#F59E0B' },
  
  reviewTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  reviewComment: { fontSize: 14, lineHeight: 22 },
  
  photosRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reviewPhoto: { width: 64, height: 64, borderRadius: 12 },

  sentimentBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  sentimentText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});