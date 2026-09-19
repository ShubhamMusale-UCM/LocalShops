import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { useWishlistStore } from '../../store/wishlistStore';
import { formatPrice } from '../../utils/formatters';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';

const WishlistScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AmbientOrbs />
        <View style={{ zIndex: 10 }}>
          <GlassPanel intensity={40} style={{ borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={styles.header}>
              <GlassButton onPress={() => navigation.goBack()} style={styles.backBtn} intensity={20}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </GlassButton>
              <Text style={styles.headerTitle}>Wishlist</Text>
              <View style={{ width: 40 }} />
            </View>
          </GlassPanel>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="heart" size={44} color="#06B6D4" />
          </View>
          <Text style={styles.emptyTitle}>Save your favorites</Text>
          <Text style={styles.emptySub}>Log in to add items to your wishlist and access them anytime.</Text>
          <GlassButton 
            onPress={() => navigation.navigate('Auth')} 
            style={{ width: '100%', height: 48, borderRadius: 24, marginTop: 24, overflow: 'hidden' }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="log-in-outline" size={20} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>Log In or Register</Text>
            </View>
          </GlassButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      <View style={{ zIndex: 10 }}>
        <GlassPanel intensity={40} style={{ borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <View style={styles.header}>
            <GlassButton onPress={() => navigation.goBack()} style={styles.backBtn} intensity={20}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </GlassButton>
            <Text style={styles.headerTitle}>Wishlist</Text>
            <View style={{ width: 40 }} />
          </View>
        </GlassPanel>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={{ padding: Spacing.screenHorizontal, paddingVertical: Spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyWrap}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="heart-outline" size={44} color="#06B6D4" />
            </View>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySub}>Tap the heart on any product to save it here.</Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
              activeOpacity={0.85}
            >
              <GlassCard intensity={20} style={styles.itemCard}>
                <Image
                  source={{ uri: item.image || 'https://placehold.co/120x120/1E293B/94A3B8?text=Product' }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {!!item.shopName && <Text style={styles.shopName}>{item.shopName}</Text>}
                  <Text style={styles.price}>{formatPrice(item.price)}</Text>
                </View>
                <GlassButton onPress={() => removeItem(item.productId)} style={styles.removeBtn} intensity={30}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </GlassButton>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050814' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h4, color: '#FFFFFF' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
  },
  shopName: {
    ...Typography.caption,
    color: '#94A3B8',
  },
  price: {
    ...Typography.bodyBold,
    color: '#06B6D4',
    marginTop: 2,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6,182,212,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.h5,
    color: '#FFFFFF',
    marginTop: Spacing.lg,
  },
  emptySub: {
    ...Typography.body,
    color: '#94A3B8',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

export default WishlistScreen;
