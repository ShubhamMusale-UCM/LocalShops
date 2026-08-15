const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Reset HomeScreen.tsx
execSync('git checkout apps/mobile/src/screens/buyer/HomeScreen.tsx', { cwd: __dirname });

const homeScreenPath = path.join(__dirname, 'apps/mobile/src/screens/buyer/HomeScreen.tsx');
let code = fs.readFileSync(homeScreenPath, 'utf8');

// 2. Add showSearchOverlay state if missing
if (!code.includes('showSearchOverlay')) {
  code = code.replace(
    'const [showAddressModal, setShowAddressModal] = useState<boolean>(false);',
    'const [showAddressModal, setShowAddressModal] = useState<boolean>(false);\n  const [showSearchOverlay, setShowSearchOverlay] = useState<boolean>(false);'
  );
}

// 3. Inject Imports
if (!code.includes('import AmbientOrbs')) {
  code = code.replace(
    "import { Ionicons } from '@expo/vector-icons';",
    "import { Ionicons } from '@expo/vector-icons';\nimport AmbientOrbs from '../../components/ui/AmbientOrbs';\nimport CircularSearchOverlay from '../../components/ui/CircularSearchOverlay';\nimport { BlurView } from 'expo-blur';"
  );
}

// 4. Header Replacement
const headerRegex = /<View style=\{\[styles\.container[\s\S]*?<ScrollView/;
const newHeader = `<View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#050814' }]}>
      <AmbientOrbs />
      <StatusBar barStyle="light-content" />

      {/* ─── Premium Glass Header ─── */}
      <View style={[styles.header, { zIndex: 40 }]}>
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFillObject, { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Profile')} style={{ position: 'relative' }}>
            <Image source={IMAGES.avatar} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, backgroundColor: '#22C55E', borderRadius: 6, borderWidth: 2, borderColor: '#050814' }} />
          </TouchableOpacity>
          <View style={{ justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Welcome back</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF' }}>{user?.name ? user.name.split(' ')[0] : 'Guest'}</Text>
          </View>
          <View style={{ flex: 1 }} />
          
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.glassButtonIcon}>
              <Ionicons name="moon-outline" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassButtonIcon} onPress={() => Alert.alert('Notifications', 'No new notifications right now!')}>
              <Ionicons name="notifications-outline" size={18} color="#FFF" />
              <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4, borderColor: '#050814' }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView`;

code = code.replace(headerRegex, newHeader);

// 5. Body Content Replacement
const bodyRegex = /\{\/\*\s*───\s*Greeting Section\s*───\s*\*\/\s*\}[\s\S]*?(?=<\/ScrollView>\s*\{\/\*\s*───\s*Location Selector Modal)/;
const newBody = `
        {/* ─── Search Section ─── */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainerOuter}>
            <View style={styles.searchContainerGlowBg} />
            <TouchableOpacity
              style={styles.searchContainer}
              activeOpacity={0.9}
              onPress={() => setShowSearchOverlay(true)}
            >
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
              <Text style={styles.searchPlaceholderText}>
                {SEARCH_PLACEHOLDERS[placeholderIndex]}
              </Text>
              <View style={styles.searchMicButton}>
                <Ionicons name="mic" size={16} color="#0D9488" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Hero Feature Banner ─── */}
        <View style={styles.heroBannerWrapper}>
          <TouchableOpacity 
            style={styles.heroBannerCard} 
            activeOpacity={0.95} 
            onPress={() => navigation.navigate('Categories')}
          >
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80' }} 
              style={styles.heroBannerImage}
            />
            <LinearGradient
              colors={['rgba(5,8,20,0.9)', 'rgba(5,8,20,0.3)', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.heroBannerOverlay}
            >
              <View style={styles.heroBannerContent}>
                <View style={styles.heroBadgeTag}>
                  <Ionicons name="sparkles" size={10} color="#0D9488" />
                  <Text style={styles.heroBadgeText}>SPATIAL FLAGSHIP</Text>
                </View>
                <Text style={styles.heroTitleText}>Vision Pro Studio</Text>
                <Text style={styles.heroSubtitleText} numberOfLines={2}>
                  Spatial computing transforms digital interactions seamlessly into your physical space.
                </Text>
                <View style={styles.heroFooterRow}>
                  <Text style={styles.heroPriceText}>$3,499</Text>
                  <TouchableOpacity style={styles.heroCtaButton}>
                    <Ionicons name="cube" size={16} color="#000" />
                    <Text style={styles.heroCtaText}>Try AR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ─── Category Chips ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {categoryItems.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChipItem,
                  isActive && styles.categoryChipItemActive
                ]}
                activeOpacity={0.8}
                onPress={() => handleCategoryPress(cat.id)}
              >
                <BlurView intensity={isActive ? 0 : 20} tint="dark" style={styles.categoryChipBlur}>
                  <Ionicons name={isActive ? "apps" : "headset"} size={14} color={isActive ? "#FFF" : "#0D9488"} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat.name}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── Spotlight Carousel Strip ─── */}
        <View style={styles.spotlightSectionHeader}>
          <View>
            <Text style={styles.spotlightTitle}>Spotlight</Text>
            <Text style={styles.spotlightSubtitle}>Featured gear of the week</Text>
          </View>
        </View>
        
        {loadingData ? (
          <ActivityIndicator size="small" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : !nearbyShops || nearbyShops.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitleText}>No shops found</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spotlightHorizontalList}
            snapToInterval={296}
            decelerationRate="fast"
          >
            {nearbyShops.map((shop) => {
              if (!shop) return null;
              const saved = isShopWishlisted(shop.id);
              return (
                <TouchableOpacity
                  key={shop.id || String(Math.random())}
                  style={styles.spotlightCardItem}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ShopProfile', { shopId: shop.id })}
                >
                  <BlurView intensity={24} tint="dark" style={styles.spotlightCardBlur}>
                    <View style={styles.spotlightImageWrapper}>
                      <Image source={{ uri: shop.logo || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' }} style={styles.spotlightImage} />
                      <View style={styles.spotlightBadge}>
                        <Text style={styles.spotlightBadgeText}>STUDIO RIG</Text>
                      </View>
                    </View>
                    <Text style={styles.spotlightShopName} numberOfLines={1}>{shop.name || 'Local Store'}</Text>
                    <Text style={styles.spotlightShopDesc} numberOfLines={1}>{shop.time || '10-15 mins'} • {typeof shop.distance === 'number' ? shop.distance.toFixed(1) : '1.2'} km</Text>
                    <View style={styles.spotlightFooter}>
                      <Text style={styles.spotlightPrice}>⭐ {shop.rating || '4.5'}</Text>
                      <TouchableOpacity style={styles.spotlightAddBtn}>
                        <Text style={styles.spotlightAddBtnText}>Visit</Text>
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ─── Popular Devices (2-Column Grid) ─── */}
        <View style={styles.spotlightSectionHeader}>
          <View>
            <Text style={styles.spotlightTitle}>Popular Devices</Text>
            <Text style={styles.spotlightSubtitle}>Curated for your workflow</Text>
          </View>
        </View>

        {loadingData ? (
          <ActivityIndicator size="small" color="#0D9488" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.popularGridContainer}>
            {displayProducts.map((prod) => {
              if (!prod) return null;
              const hasRealImage = Array.isArray(prod.images) && prod.images.length > 0 && prod.images[0];
              const imgSource = hasRealImage ? { uri: prod.images[0] } : IMAGES.prodMilk;
              
              return (
                <TouchableOpacity
                  key={prod.id || String(Math.random())}
                  style={styles.popularGridCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ProductDetail', { productId: prod.id })}
                >
                  <BlurView intensity={20} tint="dark" style={styles.popularCardBlur}>
                    <View style={styles.popularImageWrapper}>
                      <Image source={imgSource} style={styles.popularImage} />
                      <TouchableOpacity style={styles.popularHeartBtn}>
                        <Ionicons name="heart-outline" size={14} color="rgba(255,255,255,0.8)" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.popularCategoryTag}>{prod.category || 'Acoustics'}</Text>
                    <Text style={styles.popularTitle} numberOfLines={1}>{prod.name}</Text>
                    <Text style={styles.popularSub} numberOfLines={1}>{prod.unit || 'Noise Cancelling'}</Text>
                    
                    <View style={styles.popularFooter}>
                      <Text style={styles.popularPriceText}>{formatPrice(prod.price || 0)}</Text>
                      <TouchableOpacity 
                        style={styles.popularAddBtn}
                        onPress={() => handleAddProductToCart(prod)}
                      >
                        <Ionicons name="add" size={14} color="#000" />
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
`;

code = code.replace(bodyRegex, newBody);

// 6. Inject CircularSearchOverlay
const modalIndex = code.indexOf('{/* ─── Location Selector Modal ─── */}');
if (modalIndex !== -1) {
  const overlayCode = `
      <CircularSearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        onSearch={(query) => {
          setShowSearchOverlay(false);
          navigation.navigate('Search', { initialQuery: query });
        }}
      />
      `;
  code = code.slice(0, modalIndex) + overlayCode + code.slice(modalIndex);
}

// 7. Inject Styles Safely: Rename duplicate keys in old getStyles instead of regex deleting them
code = code.replace(/searchSection:\s*\{/, 'legacySearchSection: {');
code = code.replace(/searchContainer:\s*\{/, 'legacySearchContainer: {');
code = code.replace(/searchPlaceholderText:\s*\{/, 'legacySearchPlaceholderText: {');

const stylesRegex = /(const getStyles =[\s\S]*?return StyleSheet\.create\(\{)/;
const newStyles = `
    glassButtonIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchSection: {
      paddingHorizontal: 24,
      marginTop: 8,
      marginBottom: 20,
    },
    searchContainerOuter: {
      position: 'relative',
    },
    searchContainerGlowBg: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      borderRadius: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchPlaceholderText: {
      flex: 1,
      fontSize: 14,
      color: 'rgba(255,255,255,0.4)',
      fontWeight: '500',
    },
    searchMicButton: {
      width: 32,
      height: 32,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroBannerWrapper: {
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    heroBannerCard: {
      width: '100%',
      height: 260,
      borderRadius: 32,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    heroBannerImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    heroBannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      padding: 24,
      justifyContent: 'flex-end',
    },
    heroBannerContent: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    heroBadgeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      marginBottom: 12,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFF',
      marginLeft: 6,
      letterSpacing: 1.5,
    },
    heroTitleText: {
      fontSize: 32,
      fontWeight: '800',
      color: '#FFF',
      marginBottom: 6,
    },
    heroSubtitleText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: 16,
      maxWidth: '85%',
    },
    heroFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroPriceText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFF',
    },
    heroCtaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    heroCtaText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#000',
      marginLeft: 8,
    },
    categoryChipsScroll: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 12,
    },
    categoryChipItem: {
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    categoryChipItemActive: {
      backgroundColor: '#2563EB',
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    categoryChipBlur: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
    },
    categoryChipTextActive: {
      color: '#FFF',
    },
    spotlightSectionHeader: {
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    spotlightTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFF',
    },
    spotlightSubtitle: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.5)',
      marginTop: 2,
    },
    spotlightHorizontalList: {
      paddingHorizontal: 24,
      paddingBottom: 32,
      gap: 16,
    },
    spotlightCardItem: {
      width: 280,
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
    },
    spotlightCardBlur: {
      padding: 16,
    },
    spotlightImageWrapper: {
      width: '100%',
      height: 144,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 12,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    spotlightImage: {
      width: '100%',
      height: '100%',
    },
    spotlightBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    spotlightBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#bef264',
      letterSpacing: 1,
    },
    spotlightShopName: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFF',
      marginBottom: 2,
    },
    spotlightShopDesc: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 12,
    },
    spotlightFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: 12,
    },
    spotlightPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFF',
    },
    spotlightAddBtn: {
      backgroundColor: '#FFF',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
    },
    spotlightAddBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#000',
    },
    popularGridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      justifyContent: 'space-between',
      paddingBottom: 40,
    },
    popularGridCard: {
      width: '48%',
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      marginBottom: 16,
    },
    popularCardBlur: {
      padding: 14,
    },
    popularImageWrapper: {
      width: '100%',
      height: 144,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 12,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    popularImage: {
      width: '100%',
      height: '100%',
    },
    popularHeartBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    popularCategoryTag: {
      fontSize: 9,
      fontWeight: '800',
      color: '#0D9488',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    popularTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFF',
      marginBottom: 4,
    },
    popularSub: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 12,
    },
    popularFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: 12,
    },
    popularPriceText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFF',
    },
    popularAddBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
`;

code = code.replace(stylesRegex, (match) => {
  return match + '\n' + newStyles;
});

fs.writeFileSync(homeScreenPath, code);
console.log('Clean patch applied.');
