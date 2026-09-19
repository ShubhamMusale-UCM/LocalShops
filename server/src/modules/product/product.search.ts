import prisma from '../../config/database';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import { Prisma } from '@prisma/client';

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

interface SearchParams {
  query?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
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

  // Category filter
  if (category) where.category = category;
  if (subCategory) where.subCategory = subCategory;
  if (brand) where.brand = { contains: brand, mode: 'insensitive' };
  if (inStock !== undefined) where.inStock = inStock;

  // Sort
  let orderBy: any;
  switch (sort) {
    case 'price_asc': orderBy = { price: 'asc' }; break;
    case 'price_desc': orderBy = { price: 'desc' }; break;
    case 'rating': orderBy = { averageRating: 'desc' }; break;
    case 'popularity': orderBy = { orderCount: 'desc' }; break;
    case 'newest': orderBy = { createdAt: 'desc' }; break;
    case 'relevance': orderBy = { createdAt: 'desc' }; break;
    default: orderBy = { createdAt: 'desc' };
  }

  const fetchWithWhere = (effectiveWhere: any) => Promise.all([
    prisma.product.findMany({
      where: effectiveWhere,
      include: {
        shop: {
          select: {
            id: true, name: true, slug: true,
            latitude: true, longitude: true,
            averageRating: true, isVerified: true,
            isOpen: true, deliveryEnabled: true,
            logo: true, coverImage: true,
          },
        },
        promotedListing: {
          select: {
            id: true,
            isActive: true,
            startDate: true,
            endDate: true,
            budget: true,
            spent: true,
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
    const isSponsored = isSponsoredActive((product as any).promotedListing);

    return {
      ...normalized,
      isSponsored,
      sponsoredListingId: isSponsored ? (product as any).promotedListing?.id : null,
      sponsoredPriority: isSponsored ? 1 : 0,
      shopDistance_km: hasGeo
        ? haversineDistance(latitude, longitude, product.shop.latitude, product.shop.longitude)
        : undefined,
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
      return (a.shopDistance_km || 0) - (b.shopDistance_km || 0);
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
          select: { id: true, name: true, slug: true, latitude: true, longitude: true, averageRating: true, logo: true, coverImage: true },
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
          select: { id: true, name: true, slug: true, latitude: true, longitude: true, averageRating: true, logo: true, coverImage: true },
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
