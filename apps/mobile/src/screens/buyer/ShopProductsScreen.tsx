import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import shopService from '../../services/shopService';
import { getProductImageUrl } from '../../utils/image';
import { useTheme } from '../../theme';


type Props = NativeStackScreenProps<any, 'ShopProducts'>;

type ProductItem = {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  images?: string[];
  averageRating?: number;
  inStock?: boolean;
};

const ShopProductsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const styles = getStyles(colors, radius, shadows, isDarkMode);
  const { shopId, shopName } = route.params as { shopId: string; shopName?: string };

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await shopService.getProducts(shopId, {
        page: 1,
        sort: 'newest',
      });

      const payload = response?.data || {};
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.products)
          ? payload.products
          : [];

      setProducts(list);
    } catch (error) {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const title = useMemo(() => shopName || 'Shop Products', [shopName]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{products.length} products</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProducts(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={30} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No products available</Text>
            </View>
          }
          renderItem={({ item }) => {
            const imageUri = getProductImageUrl(item.images);
            const hasDiscount = Boolean(item.mrp && item.mrp > item.price);

            return (
              <TouchableOpacity
                onPress={() => navigation.push('ProductDetail', { productId: item.id })}
                activeOpacity={0.86}
                style={styles.card}
              >
                <View style={styles.imageWrap}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={styles.imageFallback}>
                      <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                </View>

                <View style={styles.infoWrap}>
                  <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₹{Number(item.price || 0).toFixed(0)}</Text>
                    {hasDiscount ? (
                      <Text style={styles.mrp}>₹{Number(item.mrp || 0).toFixed(0)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.metaRow}>
                    {typeof item.averageRating === 'number' ? (
                      <View style={styles.ratingPill}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={styles.ratingText}>{item.averageRating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.stockText, { color: item.inStock === false ? '#EF4444' : '#10B981' }]}>
                      {item.inStock === false ? 'Out of stock' : 'In stock'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const getStyles = (colors: any, radius: any, shadows: any, isDarkMode: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 56,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.border,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    headerSubtitle: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    loaderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: 12,
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    imageWrap: {
      width: 96,
      height: 96,
      backgroundColor: colors.border,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoWrap: {
      flex: 1,
      padding: 10,
    },
    productName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
      minHeight: 36,
    },
    priceRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    price: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    mrp: {
      color: colors.textSecondary,
      fontSize: 12,
      textDecorationLine: 'line-through',
      fontWeight: '500',
    },
    metaRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ratingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    stockText: {
      fontSize: 12,
      fontWeight: '700',
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
};

export default ShopProductsScreen;
