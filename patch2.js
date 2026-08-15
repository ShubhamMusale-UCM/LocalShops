const fs = require('fs');
const path = require('path');

const homeScreenPath = path.join(__dirname, 'apps/mobile/src/screens/buyer/HomeScreen.tsx');
let code = fs.readFileSync(homeScreenPath, 'utf8');

// 1. Search Section Replacement (Lines 504 - 528 approx)
const searchRegex = /<TouchableOpacity[\s\S]*?onPress=\{\(\) => setShowSearchOverlay\(true\)\}[\s\S]*?<\/TouchableOpacity>/;
const newSearchSection = `
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
                <Ionicons name="mic" size={16} color={BRAND.citrus} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
`;
code = code.replace(searchRegex, newSearchSection.trim());

// 2. Banner Section Replacement (Hero Feature Banner)
const bannerRegex = /\{\/\*\s*───\s*Promo Banners\s*───\s*\*\/\s*\}[\s\S]*?<\/ScrollView>/;
const newBannerSection = `
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
                  <Ionicons name="sparkles" size={10} color={BRAND.citrus} />
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
`;
code = code.replace(bannerRegex, newBannerSection.trim());

// 3. Category Chips Replacement (Horizontal Pill Scroll)
const categoryRegex = /\{\/\*\s*───\s*Categories Row\s*───\s*\*\/\s*\}[\s\S]*?(?=\{\/\*\s*───\s*2x2 Bento Collections)/;
const newCategorySection = `
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
                  <Ionicons name={isActive ? "apps" : "headset"} size={14} color={isActive ? "#FFF" : BRAND.citrus} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat.name}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
`;
code = code.replace(categoryRegex, newCategorySection.trim());

// 4. Trending Deals & Shops Layout Updates
const shopsRegex = /\{\/\*\s*───\s*Shops Near You\s*───\s*\*\/\s*\}[\s\S]*?(?=\{\/\*\s*───\s*Trending Products Near You\s*───\s*\/\})/;
const newShopsSection = `
        {/* ─── Spotlight Carousel Strip ─── */}
        <View style={styles.spotlightSectionHeader}>
          <View>
            <Text style={styles.spotlightTitle}>Spotlight</Text>
            <Text style={styles.spotlightSubtitle}>Featured gear of the week</Text>
          </View>
        </View>
        
        {loadingData ? (
          <ActivityIndicator size="small" color={BRAND.citrus} style={{ marginVertical: 20 }} />
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
`;
code = code.replace(shopsRegex, newShopsSection.trim() + '\n\n');

// 5. Products Section -> 2 Column Grid
const productsRegex = /\{\/\*\s*───\s*Trending Products Near You\s*───\s*\*\/\s*\}[\s\S]*?(?=\s*<\/ScrollView>\s*\{showAddressModal)/;
const newProductsSection = `
        {/* ─── Popular Devices (2-Column Grid) ─── */}
        <View style={styles.spotlightSectionHeader}>
          <View>
            <Text style={styles.spotlightTitle}>Popular Devices</Text>
            <Text style={styles.spotlightSubtitle}>Curated for your workflow</Text>
          </View>
        </View>

        {loadingData ? (
          <ActivityIndicator size="small" color={BRAND.citrus} style={{ marginVertical: 20 }} />
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
                      <TouchableOpacity style={styles.popularAddBtn}>
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
code = code.replace(productsRegex, newProductsSection.trim() + '\n\n        ');

// Remove Bento & Promo Cards
const bentoRegex = /\{\/\*\s*───\s*2x2 Bento Collections\s*───\s*\*\/\s*\}[\s\S]*?(?=\{\/\*\s*───\s*Dual Side Promo Cards\s*───\s*\*\/\s*\})/;
code = code.replace(bentoRegex, '');
const promoRegex = /\{\/\*\s*───\s*Dual Side Promo Cards\s*───\s*\*\/\s*\}[\s\S]*?(?=\{\/\*\s*───\s*Spotlight Carousel Strip)/;
code = code.replace(promoRegex, '');

fs.writeFileSync(homeScreenPath, code);
console.log('JSX structure replaced successfully.');
