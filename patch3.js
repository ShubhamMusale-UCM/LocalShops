const fs = require('fs');
const path = require('path');

const homeScreenPath = path.join(__dirname, 'apps/mobile/src/screens/buyer/HomeScreen.tsx');
let code = fs.readFileSync(homeScreenPath, 'utf8');

const stylesRegex = /(const getStyles =[\s\S]*?return StyleSheet\.create\(\{)/;
const newStyles = `
    // Search Section
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
      filter: 'blur(12px)',
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

    // Hero Banner
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

    // Category Chips
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

    // Spotlight section
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
      color: BRAND.lime,
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

    // Popular Grid Section
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
      color: BRAND.citrus,
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
console.log('Styles inserted successfully.');
