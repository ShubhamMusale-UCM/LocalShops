import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Animated,
  RefreshControl,
  Dimensions,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { Card } from '../../components/ui/Card';
import productService from '../../services/productService';
import shopService from '../../services/shopService';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design System Constants ────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  success: '#10B981',
  successDark: '#059669',
  error: '#EF4444',
  errorDark: '#DC2626',
  warning: '#F59E0B',
  warningDark: '#D97706',
  info: '#3B82F6',
  gray900: '#1F2937',
  gray800: '#374151',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  inputBorder: '#E2E8F0',
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

interface Product {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  stock: number;
  image: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  unit?: string;
}

type FilterType = 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
type SortType = 'name' | 'price_low' | 'price_high' | 'stock';

// ─── Animated Filter Chip ───────────────────────────────
const FilterChip: React.FC<{
  label: string;
  isActive: boolean;
  count: number;
  onPress: () => void;
  icon?: string;
  activeColor?: string;
}> = ({ label, isActive, count, onPress, icon, activeColor = DS.primary }) => {
  const pressScale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(pressScale, {
            toValue: 0.93,
            damping: 15,
            stiffness: 200,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(pressScale, {
            toValue: 1,
            damping: 15,
            stiffness: 200,
            useNativeDriver: true,
          }).start()
        }
        activeOpacity={1}
        style={[
          styles.filterChip,
          isActive && [styles.filterChipActive, { backgroundColor: activeColor, borderColor: activeColor }],
        ]}
      >
        {icon && (
          <Ionicons
            name={icon as any}
            size={14}
            color={isActive ? '#FFFFFF' : DS.gray600}
          />
        )}
        <Text
          style={[
            styles.filterChipText,
            isActive && styles.filterChipTextActive,
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            styles.filterChipBadge,
            isActive && styles.filterChipBadgeActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipBadgeText,
              isActive && styles.filterChipBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Product Card Component ─────────────────────────────
const ProductCard: React.FC<{
  item: Product;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (product: Product) => void;
  swipeableRefs: React.MutableRefObject<Map<string, Swipeable>>;
}> = ({ item, index, onEdit, onDelete, onDuplicate, swipeableRefs }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 70,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getStockConfig = (stock: number) => {
    if (stock === 0)
      return {
        label: 'Out of Stock',
        color: DS.error,
        bg: '#FEE2E2',
        icon: 'close-circle',
      };
    if (stock <= 5)
      return {
        label: `Only ${stock} left`,
        color: DS.warning,
        bg: '#FEF3C7',
        icon: 'alert-circle',
      };
    return {
      label: `${stock} in stock`,
      color: DS.success,
      bg: '#D1FAE5',
      icon: 'checkmark-circle',
    };
  };

  const stockConfig = getStockConfig(item.stock);
  const discount =
    item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0;

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={styles.swipeBtn}
        onPress={() => onEdit(item.id)}
      >
        <LinearGradient
          colors={[DS.info, '#2563EB']}
          style={styles.swipeBtnGradient}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.swipeBtnText}>Edit</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.swipeBtn}
        onPress={() => onDelete(item.id, item.name)}
      >
        <LinearGradient
          colors={[DS.error, DS.errorDark]}
          style={styles.swipeBtnGradient}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.swipeBtnText}>Delete</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pressScale }],
        marginBottom: 12,
      }}
    >
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          onPressIn={() =>
            Animated.spring(pressScale, {
              toValue: 0.98,
              damping: 15,
              stiffness: 200,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(pressScale, {
              toValue: 1,
              damping: 15,
              stiffness: 200,
              useNativeDriver: true,
            }).start()
          }
          activeOpacity={1}
          onPress={() => onEdit(item.id)}
          style={styles.productCard}
        >
          {/* Image */}
          <View style={styles.productImageWrap}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[DS.gray100, DS.gray200]}
                style={styles.productImagePlaceholder}
              >
                <Ionicons name="image-outline" size={28} color={DS.gray400} />
              </LinearGradient>
            )}
            {discount > 0 && (
              <View style={styles.discountTag}>
                <Text style={styles.discountTagText}>{discount}%</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.productInfo}>
            <View style={styles.productTopRow}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.productActions}>
                <TouchableOpacity
                  onPress={() => onDuplicate(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.copyBtn}
                >
                  <Ionicons name="copy-outline" size={16} color={DS.gray400} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(item.id, item.name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={16} color={DS.error} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.productCategory}>{item.category}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.productPrice}>₹{item.price.toFixed(0)}</Text>
              {item.mrp && item.mrp > item.price && (
                <Text style={styles.productMrp}>₹{item.mrp.toFixed(0)}</Text>
              )}
              {item.unit && (
                <Text style={styles.productUnit}>/{item.unit}</Text>
              )}
            </View>

            <View style={styles.productFooterRow}>
              <View style={[styles.stockPill, { backgroundColor: stockConfig.bg }]}>
                <Ionicons
                  name={stockConfig.icon as any}
                  size={12}
                  color={stockConfig.color}
                />
                <Text style={[styles.stockPillText, { color: stockConfig.color }]}>
                  {stockConfig.label}
                </Text>
              </View>
              {typeof item.rating === 'number' && item.rating > 0 && (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={11} color="#FBBF24" />
                  <Text style={styles.ratingPillText}>
                    {item.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
};

// ─── Main Component ─────────────────────────────────────
const ManageProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab bar visibility on scroll
  const { onScroll, scrollEventThrottle } = useHideTabBarOnScroll();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<FilterType>('ALL');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [showSortModal, setShowSortModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }).start();
    }, [])
  );

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchQuery, filterBy, sortBy]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const myShopsResponse = await shopService.getMyShops();
      const myShops = Array.isArray(myShopsResponse.data)
        ? myShopsResponse.data
        : myShopsResponse.data?.shops || [];

      if (!myShops.length) {
        setCurrentShopId(null);
        setProducts([]);
        return;
      }

      const shopId = myShops[0].id;
      setCurrentShopId(shopId);

      const productResponse = await shopService.getProducts(shopId, {
        sort: 'newest',
        page: 1,
      });
      const productList = Array.isArray(productResponse.data)
        ? productResponse.data
        : productResponse.data?.products || [];

      const normalizedProducts: Product[] = productList.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        mrp: p.mrp,
        stock: p.quantity ?? (p.inStock ? 1 : 0),
        image: Array.isArray(p.images) && p.images.length ? p.images[0] : '',
        category: p.category,
        rating: p.averageRating,
        unit: p.unit || 'pcs',
      }));

      setProducts(normalizedProducts);
    } catch (error: any) {
      const message =
        error?.response?.data?.error || 'Failed to load products';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
  };

  const filterAndSortProducts = () => {
    let result = [...products];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (filterBy === 'LOW_STOCK') result = result.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (filterBy === 'OUT_OF_STOCK') result = result.filter((p) => p.stock === 0);

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price_low':
          return a.price - b.price;
        case 'price_high':
          return b.price - a.price;
        case 'stock':
          return a.stock - b.stock;
        default:
          return 0;
      }
    });

    setFilteredProducts(result);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productService.delete(id);
            await loadProducts();
          } catch {
            Alert.alert('Error', 'Failed to delete product');
          }
        },
      },
    ]);
  };

  const handleEdit = (productId: string) => {
    navigation.navigate('AddProduct', { productId, isEditing: true });
  };

  const handleDuplicate = (product: Product) => {
    Alert.alert('Duplicate Product', `Create a copy of "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          try {
            await productService.create(currentShopId!, {
              name: `${product.name} (Copy)`,
              description: product.name,
              price: product.price,
              mrp: product.mrp,
              images: [product.image],
              category: product.category,
              quantity: product.stock,
              unit: product.unit,
            });
            await loadProducts();
            Alert.alert('Success', 'Product duplicated successfully');
          } catch {
            Alert.alert('Error', 'Failed to duplicate product');
          }
        },
      },
    ]);
  };

  const getFilterCount = (type: FilterType) => {
    switch (type) {
      case 'LOW_STOCK':
        return products.filter((p) => p.stock > 0 && p.stock <= 5).length;
      case 'OUT_OF_STOCK':
        return products.filter((p) => p.stock === 0).length;
      default:
        return products.length;
    }
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'name':
        return 'Name';
      case 'price_low':
        return 'Price ↑';
      case 'price_high':
        return 'Price ↓';
      case 'stock':
        return 'Stock ↑';
      default:
        return 'Sort';
    }
  };

  const sortOptions: { value: SortType; label: string; icon: string }[] = [
    { value: 'name', label: 'Name (A → Z)', icon: 'text-outline' },
    { value: 'price_low', label: 'Price (Low → High)', icon: 'trending-up-outline' },
    { value: 'price_high', label: 'Price (High → Low)', icon: 'trending-down-outline' },
    { value: 'stock', label: 'Stock (Low → High)', icon: 'layers-outline' },
  ];

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBg}>
        <Ionicons name="cube-outline" size={52} color={DS.gray400} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No results found' : 'No products yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try a different search term or filter'
          : 'Add your first product to start selling'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.emptyAddBtn}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <LinearGradient
            colors={['#35C095', '#0E8D6D']}
            style={styles.emptyAddGradient}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.emptyAddText}>Add Product</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ─── Header ────────────────────── */}
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Products</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddProduct')}
          style={styles.headerBtn}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ─── Search + Sort ─────────────── */}
      <Animated.View
        style={[styles.searchSection, { opacity: searchAnim }]}
      >
        <View
          style={[
            styles.searchBar,
            searchFocused && styles.searchBarFocused,
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={searchFocused ? DS.primary : DS.gray500}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={DS.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={DS.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortTrigger}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={DS.primary} />
          <Text style={styles.sortTriggerText}>{getSortLabel()}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Filter Chips (FIXED) ──────── */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <FilterChip
            label="All"
            isActive={filterBy === 'ALL'}
            count={getFilterCount('ALL')}
            onPress={() => setFilterBy('ALL')}
            icon="grid-outline"
          />
          <FilterChip
            label="Low Stock"
            isActive={filterBy === 'LOW_STOCK'}
            count={getFilterCount('LOW_STOCK')}
            onPress={() => setFilterBy('LOW_STOCK')}
            icon="alert-circle-outline"
            activeColor={DS.warning}
          />
          <FilterChip
            label="Out of Stock"
            isActive={filterBy === 'OUT_OF_STOCK'}
            count={getFilterCount('OUT_OF_STOCK')}
            onPress={() => setFilterBy('OUT_OF_STOCK')}
            icon="close-circle-outline"
            activeColor={DS.error}
          />
        </ScrollView>
      </View>

      {/* ─── Product List ──────────────── */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={DS.primary} />
          <Text style={styles.loaderText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={({ item, index }) => (
            <ProductCard
              item={item}
              index={index}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              swipeableRefs={swipeableRefs}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[DS.primary]}
              tintColor={DS.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* ─── Sort Modal ────────────────── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalSheet}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Sort Products</Text>

            {sortOptions.map((opt, idx) => {
              const isSelected = sortBy === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.sortItem,
                    isSelected && styles.sortItemActive,
                    idx === sortOptions.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setSortBy(opt.value);
                    setShowSortModal(false);
                  }}
                >
                  <View style={styles.sortItemLeft}>
                    <View
                      style={[
                        styles.sortItemIcon,
                        isSelected && { backgroundColor: DS.primaryLight },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? DS.primary : DS.gray500}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sortItemLabel,
                        isSelected && styles.sortItemLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={DS.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop:
      Platform.OS === 'ios'
        ? 54
        : StatusBar.currentHeight
        ? StatusBar.currentHeight + 12
        : 44,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Search
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: DS.card,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.background,
    borderRadius: DS.radius.md,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: DS.inputBorder,
    height: 44,
    gap: 8,
  },
  searchBarFocused: {
    borderColor: DS.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DS.gray900,
    paddingVertical: 0,
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: DS.primaryLight,
    borderRadius: DS.radius.md,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.15)',
  },
  sortTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.primary,
  },

  // Filter Chips (FIXED)
  filterRow: {
    backgroundColor: DS.card,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    paddingVertical: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    backgroundColor: DS.gray50,
    borderWidth: 1.2,
    borderColor: DS.gray300,
  },
  filterChipActive: {
    borderColor: DS.primary,
    backgroundColor: DS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.gray700,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipBadge: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: DS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.gray600,
  },
  filterChipBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Product List
  productList: {
    padding: 16,
    paddingBottom: 100,
  },

  // Product Card
  productCard: {
    flexDirection: 'row',
    backgroundColor: DS.card,
    borderRadius: DS.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageWrap: {
    position: 'relative',
    marginRight: 14,
  },
  productImage: {
    width: 76,
    height: 76,
    borderRadius: DS.radius.md,
    backgroundColor: DS.gray100,
  },
  productImagePlaceholder: {
    width: 76,
    height: 76,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTag: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: DS.error,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: DS.error,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  discountTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.gray900,
    flex: 1,
    marginRight: 8,
  },
  copyBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: DS.gray50,
  },
  deleteBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  productCategory: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.gray500,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: DS.primary,
    letterSpacing: -0.3,
  },
  productMrp: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.gray400,
    textDecorationLine: 'line-through',
  },
  productUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: DS.gray500,
  },
  productFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: DS.radius.full,
  },
  ratingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.warningDark,
  },

  // Swipe Actions
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginLeft: 8,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  swipeBtn: {
    width: 68,
    overflow: 'hidden',
  },
  swipeBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Loader
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.gray500,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: DS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.gray900,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.gray500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAddBtn: {
    borderRadius: DS.radius.md,
    overflow: 'hidden',
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyAddText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sort Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: DS.card,
    borderTopLeftRadius: DS.radius.xl,
    borderTopRightRadius: DS.radius.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.gray300,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.gray900,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sortItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  sortItemActive: {
    backgroundColor: DS.primaryLight + '40',
  },
  sortItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sortItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: DS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: DS.gray700,
  },
  sortItemLabelActive: {
    fontWeight: '700',
    color: DS.primary,
  },
});

export default ManageProductsScreen;