const fs = require('fs');

function run() {
  let code = fs.readFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', 'utf8');

  // 1. Replace main View with LinearGradient Background
  const mainContainerTarget = `<View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />`;
  const mainContainerReplacement = `<View style={[styles.container, { paddingTop: insets.top, backgroundColor: BRAND.forest }]}>
      <LinearGradient
        colors={[BRAND.forestSoft, BRAND.forest]}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />`;
  code = code.replace(mainContainerTarget, mainContainerReplacement);

  // 2. Wrap Header in BlurView
  const headerStartTarget = `<Animated.View style={[styles.header, headerAnimatedStyle]}>`;
  const headerStartReplacement = `<Animated.View style={[styles.header, headerAnimatedStyle]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />`;
  code = code.replace(headerStartTarget, headerStartReplacement);

  // 3. Search Bar Redesign
  const searchBarTarget = `<View style={styles.searchSection}>
          <TouchableOpacity
            style={styles.searchContainer}
            activeOpacity={0.9}
            onPress={() => setShowSearchOverlay(true)}
          >
            <Ionicons name="search" size={20} color={BRAND.citrus} />
            <Text style={styles.searchPlaceholderText}>
              {SEARCH_PLACEHOLDERS[placeholderIndex]}
            </Text>
            <Ionicons name="mic-outline" size={20} color={BRAND.inkSoft} />
          </TouchableOpacity>`;
  const searchBarReplacement = `<Animated.View entering={FadeInDown.delay(100).springify().damping(15)} style={styles.searchSection}>
          <TouchableOpacity
            style={[styles.searchContainer, { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}
            activeOpacity={0.9}
            onPress={() => setShowSearchOverlay(true)}
          >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="search" size={20} color={BRAND.citrus} />
            <Text style={styles.searchPlaceholderText}>
              {SEARCH_PLACEHOLDERS[placeholderIndex]}
            </Text>
            <View style={{backgroundColor: BRAND.citrus, padding: 6, borderRadius: 16}}>
              <Ionicons name="mic-outline" size={16} color={'#fff'} />
            </View>
          </TouchableOpacity>`;
  code = code.replace(searchBarTarget, searchBarReplacement);

  // 4. Update the card style in getStyles to be translucent
  const cardStyleTarget = `backgroundColor: BRAND.mintCard,`;
  const cardStyleReplacement = `backgroundColor: 'rgba(21, 26, 45, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',`;
  code = code.replace(new RegExp(cardStyleTarget, 'g'), cardStyleReplacement);
  
  // 5. Update spacing
  code = code.replace(/gap: 12/g, 'gap: 16');
  code = code.replace(/gap: 8/g, 'gap: 12');
  code = code.replace(/padding: 12/g, 'padding: 16');
  code = code.replace(/marginTop: 20/g, 'marginTop: 28');

  // 6. Make Category and Product cards use BlurView
  const categoryCardTarget = `<View style={styles.categoryCard}>`;
  const categoryCardReplacement = `<View style={[styles.categoryCard, { overflow: 'hidden' }]}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />`;
  code = code.replace(new RegExp(categoryCardTarget, 'g'), categoryCardReplacement);

  const productCardTarget = `<View style={styles.trendingCard}>`;
  const productCardReplacement = `<View style={[styles.trendingCard, { overflow: 'hidden' }]}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />`;
  code = code.replace(new RegExp(productCardTarget, 'g'), productCardReplacement);

  const shopCardTarget = `<View style={styles.shopCard}>`;
  const shopCardReplacement = `<View style={[styles.shopCard, { overflow: 'hidden' }]}>
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />`;
  code = code.replace(new RegExp(shopCardTarget, 'g'), shopCardReplacement);

  fs.writeFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', code);
  console.log('Glassmorphism patch complete.');
}

run();
