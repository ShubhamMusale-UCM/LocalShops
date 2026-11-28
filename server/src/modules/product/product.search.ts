import prisma from '../../config/database';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import { Prisma } from '@prisma/client';
import { evaluateGeoTarget } from '../ads/ads.targeting';

const normalizeSignedS3Url = (value: string): string => {
  try {
    const url = new URL(value);
    const hasAwsSignature =
      url.searchParams.has('X-Amz-Algorithm') ||
      url.searchParams.has('X-Amz-Credential') ||
      url.searchParams.has('X-Amz-Signature');

    if (hasAwsSignature) {
      url.search = '';
      return url.toString();
    }

    return value;
  } catch {
    return value;
  }
};

const normalizeProductImages = <T extends { images?: unknown }>(product: T): T => {
  if (!Array.isArray(product.images)) return product;

  const images = product.images
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (/^https?:\/\//i.test(item) ? normalizeSignedS3Url(item) : item));

  return { 
    ...product, 
    images,
    image: images[0] || (product as any).image || ''
  };
};

const isSponsoredActive = (listing: any): boolean => {
  if (!listing) return false;

  const now = new Date();
  const start = listing.startDate ? new Date(listing.startDate) : null;
  const end = listing.endDate ? new Date(listing.endDate) : null;

  const withinWindow = (!start || start <= now) && (!end || end >= now);
  const hasBudget =
    typeof listing.budget === 'number' && typeof listing.spent === 'number'
      ? listing.spent < listing.budget
      : true;

  return Boolean(listing.isActive) && withinWindow && hasBudget;
};

const SEARCH_CATEGORY_ALIASES: Record<string, string[]> = {
  grocery: ['grocery', 'groceries', 'pantry', 'produce', 'organic pantry', 'organic pantry & grocery'],
  dairy: ['dairy', 'milk', 'eggs', 'dairy & eggs', 'dairy & pasture eggs'],
  bakery: ['bakery', 'boulangerie', 'breads', 'artisan bakery'],
  snacks: ['snacks', 'roasters', 'spices', 'pantry essentials', 'roasters & snacks', 'roasters, spices & snacks'],
  beverages: ['beverages', 'drinks', 'tonics', 'coffee', 'cold brews & beverages'],
  food: ['food', 'restaurants', 'restaurant', 'cafe', 'dining', 'restaurants & cafe', 'restaurants, cafes & dining'],
  electronics: ['electronics', 'tech', 'tech gear', 'gadgets', 'cameras & tech', 'tech gear & electronics'],
  audio: ['audio', 'audio gear', 'hifi', 'headphones', 'speakers', 'spatial audio & hi-fi'],
  wearable: ['wearable', 'wearables', 'smartwatch', 'watches', 'wearables & spatial tech'],
  accessories: ['accessories', 'tech accessories', 'cables', 'chargers', 'tech accessories & edc'],
  furniture: ['furniture', 'home', 'home living', 'home & living', 'home & furniture', 'decor', 'living', 'home living & furniture'],
  kitchen: ['kitchen', 'ceramics', 'tableware', 'diningware', 'ceramics & kitchen', 'ceramics, kitchen & dining'],
  design: ['design', 'smart home', 'lighting', 'architectural', 'smart home & architectural'],
  art: ['art', 'crafts', 'artisanal', 'artisanal crafts', 'artisanal crafts & fine art'],
  garden: ['garden', 'botanicals', 'plants', 'home & garden', 'botanicals & home garden'],
  clothing: ['clothing', 'fashion', 'apparel', 'footwear', 'fashion & apparel', 'fashion & studio apparel'],
  jewellery: ['jewellery', 'jewelry', 'gems', 'fine & artisan jewellery'],
  beauty: ['beauty', 'spa', 'cosmetics', 'salon', 'beauty & spa', 'beauty & makeup', 'beauty, salon & spa'],
  care: ['care', 'body', 'apothecary', 'skincare', 'botanical apothecary & body'],
  health: ['health', 'wellness', 'pharmacy', 'fitness', 'health & wellness', 'wellness & health', 'health, wellness & pharmacy'],
  sports: ['sports', 'gym', 'cycling', 'athletics', 'sports & outdoors', 'sports & gear', 'sports, cycling & fitness'],
  books: ['books', 'stationery', 'bookstore', 'books & media', 'books & paper', 'books, vinyl & stationery'],
  toys: ['toys', 'games', 'board games', 'toys & games', 'toys, board games & stem'],
  education: ['education', 'workshops', 'courses', 'classes', 'education & labs', 'workshops, courses & labs'],
  pets: ['pets', 'pet', 'pet care', 'pet supplies', 'pet care & barkery'],
  hardware: ['hardware', 'tools', 'hardware & precision tools'],
  automotive: ['automotive', 'vehicles', 'vehicle', 'moto', 'auto', 'moto & auto', 'automotive & moto atelier'],
  secondhand: ['secondhand', 'refurbished', 'used', 'pre-owned', 'refurbished goods', 'second hand market', 'refurbished & pre-owned'],
  property: ['property', 'real-estate', 'real estate', 'rentals', 'real estate & studio lofts'],
  hotels: ['hotels', 'hotel', 'stays', 'lodges', 'hotels & stays', 'boutique hotels & stays'],
  tours: ['tours', 'treks', 'tour packages', 'tours & treks', 'tours, treks & heritage walks'],
  places: ['places', 'landmarks', 'places to visit', 'landmarks & cultural venues'],
  services: ['services', 'service', 'home services', 'local services', 'pro services', 'home & atelier pro services'],
};

interface SearchParams {
  query?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  subCategory?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

/**
 * Full-text search with geo-spatial filtering
 */
export const searchProducts = async (params: SearchParams) => {
  const {
    query,
    latitude,
    longitude,
    radius = 50,
    city,
    minPrice,
    maxPrice,
    category,
    subCategory,
    brand,
    inStock,
    sort = 'relevance',
    page = 1,
    limit = 20,
  } = params;

  const shopWhereBase: any = { isActive: true };

  const where: any = {
    isActive: true,
    shop: { ...shopWhereBase },
  };

  // Text search filter
  if (query) {
    const fuzzyMatches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id FROM "Product" p
      LEFT JOIN "Shop" s ON p."shopId" = s.id
      WHERE word_similarity(${query}, p.name) >= 0.15 
         OR word_similarity(${query}, p.description) >= 0.15
         OR word_similarity(${query}, p.brand) >= 0.15
         OR word_similarity(${query}, s.name) >= 0.15
         OR p.name ILIKE ${'%' + query + '%'}
         OR p.description ILIKE ${'%' + query + '%'}
         OR p.brand ILIKE ${'%' + query + '%'}
         OR s.name ILIKE ${'%' + query + '%'}
      ORDER BY p."createdAt" DESC
      LIMIT 500
    `;
    const fuzzyIds = fuzzyMatches.map(m => m.id);

    where.OR = [
      { id: { in: fuzzyIds } },
      { tags: { hasSome: query.toLowerCase().split(' ') } },
    ];
  }

  // Geo filter
  const hasGeo = latitude !== undefined && longitude !== undefined;
  if (hasGeo) {
    const bbox = getBoundingBox(latitude, longitude, radius);
    where.shop = {
      ...shopWhereBase,
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };
  }

  // Price filter
  if (minPrice !== undefined) where.price = { ...where.price, gte: minPrice };
  if (maxPrice !== undefined) where.price = { ...where.price, lte: maxPrice };

  // Category & Subcategory filter (with canonical alias expansion so buyer & seller categories always link)
  if (category && category !== 'all') {
    const key = category.trim().toLowerCase();
    const aliases = Array.from(new Set([category.trim(), key, ...(SEARCH_CATEGORY_ALIASES[key] || [])]));
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: aliases.map(alias => ({
          category: { equals: alias, mode: 'insensitive' as const },
        })),
      },
    ];
  }
  if (subCategory && subCategory !== 'all' && subCategory !== 'All') {
    const cleanSub = subCategory.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { subCategory: { equals: cleanSub, mode: 'insensitive' as const } },
          { subCategory: { contains: cleanSub, mode: 'insensitive' as const } },
          { name: { contains: cleanSub, mode: 'insensitive' as const } },
        ],
      },
    ];
  }
  if (brand) where.brand = { contains: brand, mode: 'insensitive' };
  if (inStock !== undefined) where.inStock = inStock;

  // Sort (prioritize in-stock and pre-bookable items above sold-out items on default discovery feeds)
  let orderBy: any;
  switch (sort) {
    case 'price_asc': orderBy = { price: 'asc' }; break;
    case 'price_desc': orderBy = { price: 'desc' }; break;
    case 'rating': orderBy = { averageRating: 'desc' }; break;
    case 'popularity': orderBy = { orderCount: 'desc' }; break;
    case 'newest': orderBy = [{ inStock: 'desc' }, { allowPrebook: 'desc' }, { createdAt: 'desc' }]; break;
    case 'relevance': orderBy = [{ inStock: 'desc' }, { allowPrebook: 'desc' }, { createdAt: 'desc' }]; break;
    default: orderBy = [{ inStock: 'desc' }, { allowPrebook: 'desc' }, { createdAt: 'desc' }];
  }

  const fetchWithWhere = (effectiveWhere: any) => Promise.all([
    prisma.product.findMany({
      where: effectiveWhere,
      include: {
        shop: {
          select: {
            id: true, name: true, slug: true,
            latitude: true, longitude: true, address: true, city: true,
            averageRating: true, isVerified: true,
            isOpen: true, deliveryEnabled: true,
            logo: true, coverImage: true,
          },
        },
        promotedListings: {
          where: { isActive: true, endDate: { gte: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            isActive: true,
            startDate: true,
            endDate: true,
            budget: true,
            spent: true,
            geoMode: true,
            targetRadiusKm: true,
            targetCities: true,
            objective: true,
            negativeKeywords: { select: { keyword: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: effectiveWhere }),
  ]);

  let [products, total] = await fetchWithWhere(where);

  // Fallback: if geo-constrained query yields nothing, retry globally with same filters.
  if (hasGeo && products.length === 0) {
    const fallbackWhere = {
      ...where,
      shop: { ...shopWhereBase },
    };
    [products, total] = await fetchWithWhere(fallbackWhere);
  }

  // Add distance info if location provided
  let results = products.map((product) => {
    const normalized = normalizeProductImages(product);
    // Pick the first live campaign whose geo targeting includes this buyer.
    const liveListing = ((product as any).promotedListings || []).find((l: any) => {
      if (!isSponsoredActive(l)) return false;

      // Negative keywords suppression check
      if (query && Array.isArray(l.negativeKeywords) && l.negativeKeywords.length > 0) {
        const normalizedQuery = query.trim().toLowerCase();
        const hasNegativeMatch = l.negativeKeywords.some((nk: any) =>
          normalizedQuery.includes(nk.keyword.trim().toLowerCase())
        );
        if (hasNegativeMatch) return false;
      }

      if (hasGeo) {
        return evaluateGeoTarget(l, product.shop as any, { lat: latitude, lng: longitude, city }).eligible;
      }

      if (city) {
        return (
          evaluateGeoTarget(l, product.shop as any, { city }).eligible ||
          (product.shop?.city && product.shop.city.toLowerCase() === city.toLowerCase())
        );
      }

      return true;
    });
    const isSponsored = Boolean(liveListing);
    const hasShopCoords =
      typeof product.shop?.latitude === 'number' &&
      typeof product.shop?.longitude === 'number' &&
      (product.shop.latitude !== 0 || product.shop.longitude !== 0);
    const computedDist =
      hasGeo && hasShopCoords
        ? Number(haversineDistance(latitude, longitude, product.shop.latitude, product.shop.longitude).toFixed(1))
        : undefined;

    return {
      ...normalized,
      isSponsored,
      sponsoredListingId: isSponsored ? liveListing.id : null,
      sponsoredPriority: isSponsored ? 1 : 0,
      shopDistance_km: computedDist,
      distance_km: computedDist,
    };
  });

  // Ad impressions are now tracked via a dedicated POST /ads/impression endpoint
  // to avoid blocking search results and overcounting from API polling.

  // Sponsored listings are boosted for relevant searches.
  results.sort((a, b) => (b.sponsoredPriority || 0) - (a.sponsoredPriority || 0));

  // Sort by distance if requested and location available
  if (sort === 'distance' && hasGeo) {
    results.sort((a, b) => {
      const sponsoredDiff = (b.sponsoredPriority || 0) - (a.sponsoredPriority || 0);
      if (sponsoredDiff !== 0) return sponsoredDiff;
      return (a.shopDistance_km ?? Number.MAX_SAFE_INTEGER) - (b.shopDistance_km ?? Number.MAX_SAFE_INTEGER);
    });
  }

  // Log search keyword stats
  if (query && query.trim().length > 0 && results.length > 0) {
    const shopIds = [...new Set(results.map(r => r.shopId))];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const keyword = query.trim().toLowerCase();
    
    // Run async without awaiting to avoid blocking search response
    Promise.all(shopIds.map(shopId => 
      prisma.searchKeywordStat.upsert({
        where: {
          shopId_keyword_date: {
            shopId,
            keyword,
            date: today,
          }
        },
        update: { searches: { increment: 1 } },
        create: { shopId, keyword, date: today, searches: 1, clicks: 0 },
      })
    )).catch(e => console.error('Error logging search keyword stats:', e));
  }

  return {
    products: results,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get products from the same category or matching keywords at nearby shops for price comparison
 */
export const getComparableProducts = async (
  productId: string,
  latitude?: number,
  longitude?: number,
  radius: number = 25
) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { 
      id: true,
      name: true, 
      category: true, 
      brand: true, 
      tags: true,
      shopId: true,
      shop: { select: { latitude: true, longitude: true } } 
    },
  });

  if (!product) return [];

  const stopWords = new Set(['and', 'for', 'the', 'with', 'from', 'pack', 'size', 'original', 'item', 'best', 'shop']);
  const rawWords = product.name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const keywordConditions: any[] = rawWords.length > 0
    ? rawWords.map((word) => ({ name: { contains: word, mode: 'insensitive' } }))
    : [{ name: { contains: product.name.trim(), mode: 'insensitive' } }];

  const orConditions: any[] = [
    ...keywordConditions,
    ...(product.brand ? [{ brand: { equals: product.brand, mode: 'insensitive' } }] : []),
    ...(product.tags && product.tags.length > 0 ? [{ tags: { hasSome: product.tags } }] : []),
  ];

  const shopWhereBase: any = { isActive: true };
  const baseWhere: any = {
    id: { not: productId },
    shopId: { not: product.shopId },
    isActive: true,
    OR: orConditions,
  };

  const lat = latitude || product.shop?.latitude;
  const lng = longitude || product.shop?.longitude;
  const hasValidGeo = lat != null && lng != null && !(lat === 0 && lng === 0);

  let products: any[] = [];

  if (hasValidGeo) {
    const bbox = getBoundingBox(lat, lng, radius);
    const geoWhere = {
      ...baseWhere,
      shop: {
        ...shopWhereBase,
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      },
    };

    products = await prisma.product.findMany({
      where: geoWhere,
      include: {
        shop: {
          select: { id: true, name: true, slug: true, latitude: true, longitude: true, address: true, city: true, averageRating: true, logo: true, coverImage: true },
        },
      },
      orderBy: { price: 'asc' },
      take: 12,
    });
  }

  // Fallback: If no geo results (or invalid geo), search globally
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: {
        ...baseWhere,
        shop: shopWhereBase,
      },
      include: {
        shop: {
          select: { id: true, name: true, slug: true, latitude: true, longitude: true, address: true, city: true, averageRating: true, logo: true, coverImage: true },
        },
      },
      orderBy: { price: 'asc' },
      take: 12,
    });
  }

  return products.map((item) => {
    const normalized = normalizeProductImages(item);
    const itemLat = item.shop?.latitude;
    const itemLng = item.shop?.longitude;
    const itemHasGeo = itemLat != null && itemLng != null && !(itemLat === 0 && itemLng === 0);

    return {
      ...normalized,
      shopDistance_km: hasValidGeo && itemHasGeo
        ? haversineDistance(lat, lng, itemLat, itemLng)
        : undefined,
    };
  });
};

export interface PersonalizedCandidatesParams {
  userId?: string;
  categories?: string[];
  subCategories?: string[];
  keywords?: string[];
  shopIds?: string[];
  excludeIds?: string[];
  latitude?: number;
  longitude?: number;
  radius?: number;
  limit?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scalable DB-backed candidate retrieval for huge catalogs (10k-500k+ products):
 * fetches targeted in-stock/pre-bookable candidates matching buyer categories, subcategories,
 * keywords, shops, and server-side user visits/wishlist, plus diverse high-rated fallback.
 */
export const getPersonalizedCandidates = async (params: PersonalizedCandidatesParams) => {
  const {
    userId,
    categories = [],
    subCategories = [],
    keywords = [],
    shopIds = [],
    excludeIds = [],
    latitude,
    longitude,
    radius = 50,
    limit = 60,
  } = params;

  const clampedLimit = Math.min(Math.max(Number(limit) || 60, 10), 100);
  const categorySet = new Set<string>(
    categories
      .map((c) => String(c || '').trim().toLowerCase())
      .filter((c) => c.length >= 2 && c !== 'all')
      .slice(0, 12)
  );
  const subCategoryList = subCategories
    .map((s) => String(s || '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, 15);
  const keywordList = keywords
    .map((k) => String(k || '').trim())
    .filter((k) => k.length >= 2)
    .slice(0, 10);
  const shopIdSet = new Set<string>(
    shopIds.map((s) => String(s || '').trim()).filter((id) => UUID_REGEX.test(id)).slice(0, 10)
  );
  const validExcludeIds = excludeIds
    .map((id) => String(id || '').trim())
    .filter((id) => UUID_REGEX.test(id))
    .slice(0, 40);

  // Merge logged-in buyer's server-side category visits & wishlist interests seamlessly
  if (userId && UUID_REGEX.test(userId)) {
    const [visits, wishlistRows] = await Promise.all([
      prisma.userCategoryVisit.findMany({
        where: { userId },
        orderBy: { visitCount: 'desc' },
        take: 6,
      }).catch(() => []),
      prisma.wishlist.findMany({
        where: { userId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { category: true, subCategory: true, shopId: true } } },
      }).catch(() => []),
    ]);

    for (const v of visits as any[]) {
      const cat = String(v?.category || '').trim().toLowerCase();
      if (cat && cat !== 'all') categorySet.add(cat);
    }
    for (const w of wishlistRows as any[]) {
      const p = w?.product;
      if (!p) continue;
      if (p.category) categorySet.add(String(p.category).trim().toLowerCase());
      if (p.subCategory && subCategoryList.length < 18) subCategoryList.push(String(p.subCategory).trim());
      if (p.shopId && UUID_REGEX.test(p.shopId)) shopIdSet.add(p.shopId);
    }
  }

  // Expand canonical category keys to stored aliases for accurate indexed SQL lookup
  const expandedCategories = new Set<string>();
  for (const catKey of categorySet) {
    expandedCategories.add(catKey);
    const aliases = SEARCH_CATEGORY_ALIASES[catKey];
    if (aliases) {
      for (const a of aliases) expandedCategories.add(a);
    }
  }

  const orClauses: any[] = [];
  for (const alias of Array.from(expandedCategories).slice(0, 40)) {
    orClauses.push({ category: { equals: alias, mode: 'insensitive' as const } });
  }
  for (const sub of subCategoryList) {
    orClauses.push({ subCategory: { contains: sub, mode: 'insensitive' as const } });
  }
  for (const kw of keywordList) {
    orClauses.push({ name: { contains: kw, mode: 'insensitive' as const } });
    orClauses.push({ brand: { contains: kw, mode: 'insensitive' as const } });
    orClauses.push({ subCategory: { contains: kw, mode: 'insensitive' as const } });
  }
  if (shopIdSet.size > 0) {
    orClauses.push({ shopId: { in: Array.from(shopIdSet) } });
  }
  if (keywordList.length > 0) {
    orClauses.push({ tags: { hasSome: keywordList.map((k) => k.toLowerCase()) } });
  }

  const hasGeo = latitude != null && longitude != null && !(latitude === 0 && longitude === 0);
  const shopWhereBase: any = { isActive: true };
  if (hasGeo) {
    const bbox = getBoundingBox(latitude!, longitude!, Math.max(1, Number(radius) || 50));
    shopWhereBase.latitude = { gte: bbox.minLat, lte: bbox.maxLat };
    shopWhereBase.longitude = { gte: bbox.minLng, lte: bbox.maxLng };
  }

  const baseActiveWhere: any = {
    isActive: true,
    OR: [{ inStock: true }, { allowPrebook: true }],
    shop: shopWhereBase,
    ...(validExcludeIds.length > 0 ? { id: { notIn: validExcludeIds } } : {}),
  };

  const productInclude = {
    shop: {
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        averageRating: true,
        isVerified: true,
        isOpen: true,
        deliveryEnabled: true,
        logo: true,
        coverImage: true,
      },
    },
  };

  let targeted: any[] = [];
  if (orClauses.length > 0) {
    targeted = await prisma.product.findMany({
      where: {
        ...baseActiveWhere,
        AND: [{ OR: orClauses }],
      },
      include: productInclude,
      orderBy: [{ inStock: 'desc' }, { averageRating: 'desc' }, { orderCount: 'desc' }, { createdAt: 'desc' }],
      take: clampedLimit,
    });
  }

  // Fallback fill with diverse nearby popular/top-rated active stock when targeted pool < limit
  let discovery: any[] = [];
  if (targeted.length < clampedLimit) {
    const takenIds = targeted.map((p) => p.id);
    discovery = await prisma.product.findMany({
      where: {
        ...baseActiveWhere,
        id: { notIn: [...validExcludeIds, ...takenIds] },
      },
      include: productInclude,
      orderBy: [{ inStock: 'desc' }, { averageRating: 'desc' }, { orderCount: 'desc' }, { createdAt: 'desc' }],
      take: clampedLimit - targeted.length,
    });
  }

  const formatRow = (item: any) => {
    const normalized = normalizeProductImages(item);
    const itemLat = item.shop?.latitude;
    const itemLng = item.shop?.longitude;
    const itemHasGeo =
      typeof itemLat === 'number' &&
      typeof itemLng === 'number' &&
      (itemLat !== 0 || itemLng !== 0);
    const distKm =
      hasGeo && itemHasGeo
        ? Number(haversineDistance(latitude!, longitude!, itemLat, itemLng).toFixed(1))
        : undefined;

    return {
      ...normalized,
      shopDistance_km: distKm,
      distance_km: distKm,
    };
  };

  const combined = [...targeted, ...discovery].map(formatRow);
  return {
    products: combined,
    targetedCount: targeted.length,
    total: combined.length,
  };
};
