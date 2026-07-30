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

const WishlistScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={{ padding: Spacing.screenHorizontal, paddingVertical: Spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="heart-outline" size={44} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySub}>Tap the heart on any product to save it here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
            activeOpacity={0.85}
            style={styles.itemCard}
          >
            <Image
              source={{ uri: item.image || 'https://placehold.co/120x120/F1F5F9/64748B?text=Product' }}
              style={styles.itemImage}
              resizeMode="cover"
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              {!!item.shopName && <Text style={styles.shopName}>{item.shopName}</Text>}
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.productId)} style={styles.removeBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h4, color: Colors.gray[900] },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Spacing.radius.md,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.gray[100],
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: Colors.gray[900],
  },
  shopName: {
    ...Typography.caption,
    color: Colors.gray[600],
  },
  price: {
    ...Typography.bodyBold,
    color: Colors.primary,
    marginTop: 2,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${Colors.error}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.h5,
    color: Colors.gray[900],
    marginTop: Spacing.md,
  },
  emptySub: {
    ...Typography.body,
    color: Colors.gray[600],
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

export default WishlistScreen;
