/**
 * CategoriesScreen — Premium redesign matching Blinkit/Instamart style
 * Fully dynamic light/dark mode with Teal (#0D9488) design system & 3D Category Image Assets
 */
import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInRight,
  Easing,
} from 'react-native-reanimated';
import { CATEGORIES } from '@citylocalshop/shared';
import { useSearchStore } from '../../store/searchStore';
import { useTheme } from '../../theme';
import { useHideTabBarOnScroll } from '../../hooks/useHideTabBarOnScroll';
import CircularSearchOverlay from '../../components/ui/CircularSearchOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Local 3D Image Assets Mapping ──────────────────────────────────────────
const CATEGORY_IMAGES: Record<string, any> = {
  grocery: require('../../assets/cat_fruits_veggies.png'),
  electronics: require('../../assets/cat_electronics.png'),
  clothing: require('../../assets/cat_fashion.png'),
  furniture: require('../../assets/cat_home.png'),
  food: require('../../assets/prod_bread.png'),
  hotels: require('../../assets/bubble_chair.png'),
  health: require('../../assets/bubble_perfume.png'),
  beauty: require('../../assets/cat_beauty.png'),
  jewellery: require('../../assets/bubble_watch.png'),
  books: require('../../assets/bubble_camera.png'),
  sports: require('../../assets/cat_sports.png'),
  automotive: require('../../assets/bubble_game.png'),
  hardware: require('../../assets/bubble_chair.png'),
  pets: require('../../assets/cat_toys.png'),
  services: require('../../assets/explore_icon.png'),
  property: require('../../assets/explore_icon.png'),
  tours: require('../../assets/explore_icon.png'),
  places: require('../../assets/explore_icon.png'),
  secondhand: require('../../assets/explore_icon.png'),
};

const SUB_PALETTES = [
  { bg: '#F0FDFA', text: '#0D9488' },
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#FDF4FF', text: '#C026D3' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFDF5', text: '#059669' },
  { bg: '#FEF2F2', text: '#DC2626' },
  { bg: '#FEFCE8', text: '#CA8A04' },
];

const GRID_SPACING = 16;
const TILE_SIZE = (SCREEN_WIDTH - GRID_SPACING * 4) / 3;

const PressableScale: React.FC<{
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
}> = ({ onPress, style, children }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 70 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }}
      style={style}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

export default function CategoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const setCategory = useSearchStore((s) => s.setCategory);
  const { colors, isDarkMode } = useTheme();

  const [search, setSearch] = useState('');
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(CATEGORIES[0].id);

  const { onScroll, scrollEventThrottle } = useHideTabBarOnScroll();

  const fadeAnim = useSharedValue(0);
  const translateYAnim = useSharedValue(20);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.value = withTiming(1, { duration: 400 });
      translateYAnim.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.exp) });
      return () => {
        fadeAnim.value = 0;
        translateYAnim.value = 20;
      };
    }, [])
  );

  const screenAnimStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: fadeAnim.value,
    transform: [{ translateY: translateYAnim.value }],
  }));

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      setCategory(categoryId);
      navigation.navigate('Search');
    },
    [setCategory, navigation],
  );

  // Global search filtering
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    let results: Array<{ type: 'parent' | 'sub'; parentId: string; title: string }> = [];
    
    CATEGORIES.forEach(cat => {
      if (cat.name.toLowerCase().includes(term)) {
        results.push({ type: 'parent', parentId: cat.id, title: cat.name });
      }
      cat.subCategories?.forEach(sub => {
        if (sub.toLowerCase().includes(term)) {
          results.push({ type: 'sub', parentId: cat.id, title: sub });
        }
      });
    });
    return results;
  }, [search]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background }, screenAnimStyle]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* ─── Premium Header & Search ─── */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => setShowSearchOverlay(true)}
          style={[styles.searchBarWrapper, { backgroundColor: isDarkMode ? colors.surface : '#F8FAFC', borderColor: isDarkMode ? '#0F766E' : '#CCFBF1' }]}
        >
          <Ionicons name="search" size={20} color="#0D9488" />
          <Text style={[styles.searchInput, { color: colors.textSecondary, paddingTop: 14 }]}>
            Search groceries, food, services...
          </Text>
        </TouchableOpacity>
      </View>

      {search.trim().length > 0 ? (
        /* ─── Global Search Results View ─── */
        <FlatList
          data={searchResults}
          keyExtractor={(item, idx) => `${item.parentId}-${item.title}-${idx}`}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No results found</Text>
              <Text style={[styles.emptyStateSub, { color: colors.textSecondary }]}>Try a different search term</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 20).springify()}>
              <TouchableOpacity
                style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => handleSubCategorySelect(item.parentId, item.type === 'sub' ? item.title : undefined)}
              >
                <View style={[styles.searchResultIconBox, { backgroundColor: item.type === 'parent' ? (isDarkMode ? 'rgba(5,150,105,0.25)' : '#ECFDF5') : colors.surface }]}>
                  <Ionicons name={item.type === 'parent' ? 'grid' : 'list'} size={16} color={item.type === 'parent' ? '#059669' : colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textSecondary }]}>in {CATEGORIES.find(c => c.id === item.parentId)?.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      ) : (
        /* ─── 3-Column Grid Layout ─── */
        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: GRID_SPACING, paddingBottom: insets.bottom + 100 }}
          columnWrapperStyle={{ gap: GRID_SPACING, marginBottom: GRID_SPACING }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          renderItem={({ item, index }) => {
            const catImg = CATEGORY_IMAGES[item.id] || CATEGORY_IMAGES.grocery;
            return (
              <Animated.View entering={FadeInDown.delay(index * 20).springify()}>
                <PressableScale onPress={() => handleCategorySelect(item.id)}>
                  <View style={[styles.categoryTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.categoryTileIconBox, { backgroundColor: colors.background }]}>
                      <Image source={catImg} style={styles.categoryTileImage} resizeMode="contain" />
                    </View>
                    <Text style={[styles.categoryTileText, { color: colors.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                </PressableScale>
              </Animated.View>
            );
          }}
        />
      )}
      
      <CircularSearchOverlay 
        visible={showSearchOverlay} 
        onClose={() => setShowSearchOverlay(false)} 
        onSearch={(queryText) => {
          setShowSearchOverlay(false);
          setCategory('all');
          useSearchStore.getState().setQuery(queryText);
          navigation.navigate('Search');
        }}
        placeholder="Search groceries, food, services..."
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 1.15,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileIconBox: {
    width: TILE_SIZE * 0.5,
    height: TILE_SIZE * 0.5,
    borderRadius: (TILE_SIZE * 0.5) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryTileImage: {
    width: '65%',
    height: '65%',
    tintColor: '#22D3EE',
  },
  categoryTileText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchResultIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchResultSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 13,
    marginTop: 6,
  },
});
