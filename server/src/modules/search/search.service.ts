import adsService from '../ads/ads.service';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheGet, cacheSet } from '../../config/redis';
import { haversineDistance } from '../../utils/geoUtils';

export class SearchService {
  /**
   * Search products with filters (name, category, price, rating)
   */
  async searchProducts(
    query: string,
    filters: {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      shopId?: string;
    } = {},
    limit: number = 20,
    offset: number = 0,
    lat?: number,
    lng?: number,
    userGender?: string,
    city?: string,
    userId?: string
  ) {
    const formattedQuery = query.trim().replace(/[&|!():<>'"]/g, '').split(/\s+/).filter(Boolean).join(' | ');

    const cleanQuery = query.trim();
    let fuzzyIds: string[] = [];
    if (cleanQuery) {
      const fuzzyMatches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Product" 
        WHERE word_similarity(${cleanQuery}, name) >= 0.25 
           OR word_similarity(${cleanQuery}, description) >= 0.25
           OR word_similarity(${cleanQuery}, brand) >= 0.25
           OR name ILIKE ${'%' + cleanQuery + '%'}
           OR description ILIKE ${'%' + cleanQuery + '%'}
           OR brand ILIKE ${'%' + cleanQuery + '%'}
      `;
      fuzzyIds = fuzzyMatches.map(m => m.id);
    }

    const searchCondition = formattedQuery || fuzzyIds.length > 0
      ? {
          OR: [
            ...(formattedQuery ? [
              { name: { search: formattedQuery } },
              { description: { search: formattedQuery } },
              { category: { search: formattedQuery } },
              { name: { contains: cleanQuery, mode: 'insensitive' } },
            ] : []),
            ...(fuzzyIds.length > 0 ? [{ id: { in: fuzzyIds } }] : []),
          ],
        }
      : {};

    const whereClause: any = {
      isActive: true,
      shop: { isActive: true },
      ...searchCondition,
      ...(filters.category && { category: filters.category }),
      ...(filters.minPrice && { price: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
      ...(filters.shopId && { shopId: filters.shopId }),
    };

    const now = new Date();

    // 1. Fetch Sponsored Products dynamically (only on first page)
    let sponsoredProducts: any[] = [];
    if ((cleanQuery || filters.category) && offset === 0) {
      const activeSponsored = await adsService.serveAds({
        limit: 3,
        query: cleanQuery,
        category: filters.category,
        lat,
        lng,
        city,
        userId,
        userGender
      });
        
      sponsoredProducts = activeSponsored.map(ad => ({
        ...ad.product,
        isBoosted: true,
        isSponsored: true,
        campaignId: ad.id,
        sponsoredListingId: ad.id,
        shopDistance_km: (ad as any).geo?.distanceKm != null ? Number((ad as any).geo.distanceKm.toFixed(1)) : null,
        distance_km: (ad as any).geo?.distanceKm != null ? Number((ad as any).geo.distanceKm.toFixed(1)) : null,
      }));
    }

    // 2. Fetch organic products (excluding the injected sponsored ones)
    const sponsoredIds = sponsoredProducts.map(p => p.id);
    const organicWhereClause = sponsoredIds.length > 0 
      ? { ...whereClause, id: { notIn: sponsoredIds } }
      : whereClause;

    const products = await prisma.product.findMany({
      where: organicWhereClause,
      include: {
        shop: { select: { id: true, name: true, slug: true, logo: true, coverImage: true, averageRating: true, address: true, city: true, latitude: true, longitude: true } },
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    let filtered = products;
    if (filters.minRating) {
      filtered = products.filter((p) => (p.averageRating || 0) >= filters.minRating!);
    }

    const mappedOrganic = filtered.map((p) => {
      let shopDistance_km: number | null = null;
      if (lat != null && lng != null && p.shop?.latitude != null && p.shop?.longitude != null && (p.shop.latitude !== 0 || p.shop.longitude !== 0)) {
        shopDistance_km = Number(haversineDistance(lat, lng, p.shop.latitude, p.shop.longitude).toFixed(1));
      }
      return {
        ...p,
        isBoosted: false,
        isSponsored: false,
        shopDistance_km,
        distance_km: shopDistance_km,
      };
    });

    const finalProducts = offset === 0 ? [...sponsoredProducts, ...mappedOrganic] : mappedOrganic;
    const total = await prisma.product.count({ where: whereClause });

    return { products: finalProducts, total, limit, offset };
  }

  /**
   * Search shops with geo-proximity
   */
  async searchNearbyShops(
    latitude: number,
    longitude: number,
    maxDistance: number = 5000, // meters
    keyword?: string,
    limit: number = 20
  ) {
    const maxDistKm = maxDistance / 1000;
    const shops = await prisma.shop.findMany({
      where: {
        isActive: true,
        NOT: { AND: [{ latitude: 0 }, { longitude: 0 }] },
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 5,
    });

    return shops
      .map((shop) => {
        const distKm = haversineDistance(latitude, longitude, shop.latitude, shop.longitude);
        return {
          ...shop,
          distance: Math.round(distKm * 1000),
          distance_km: Number(distKm.toFixed(1)),
        };
      })
      .filter((shop) => shop.distance_km <= maxDistKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * Search products by geo-proximity to user
   */
  async searchNearbyProducts(
    latitude: number,
    longitude: number,
    maxDistance: number = 10000, // meters
    category?: string,
    limit: number = 20
  ) {
    const maxDistKm = maxDistance / 1000;
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        inStock: true,
        ...(category ? { category } : {}),
        shop: {
          isActive: true,
          NOT: { AND: [{ latitude: 0 }, { longitude: 0 }] },
        },
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            city: true,
            address: true,
            logo: true,
          },
        },
      },
      take: limit * 5,
    });

    return products
      .map((p) => {
        const distKm = haversineDistance(latitude, longitude, p.shop.latitude, p.shop.longitude);
        return {
          ...p,
          shopName: p.shop.name,
          shopLatitude: p.shop.latitude,
          shopLongitude: p.shop.longitude,
          distance: Math.round(distKm * 1000),
          shopDistance_km: Number(distKm.toFixed(1)),
          distance_km: Number(distKm.toFixed(1)),
        };
      })
      .filter((p) => p.distance_km <= maxDistKm)
      .sort((a, b) => a.distance - b.distance || a.price - b.price)
      .slice(0, limit);
  }

  /**
   * Get search suggestions based on popular queries
   */
  async getSearchSuggestions(query: string, limit: number = 10) {
    const cacheKey = `search-suggestions:${query}`;
    let suggestions = await cacheGet(cacheKey);

    if (!suggestions) {
      const products = await prisma.product.findMany({
        select: { name: true, category: true },
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        distinct: ['category'],
        take: limit,
      });

      const categories = await prisma.product.groupBy({
        by: ['category'],
        where: {
          isActive: true,
          category: { contains: query, mode: 'insensitive' },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });

      suggestions = {
        products: products.map((p) => p.name),
        categories: categories.map((c) => c.category),
      };

      await cacheSet(cacheKey, suggestions, 3600);
    }

    return suggestions;
  }

  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(
    filters: {
      query?: string;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      shopId?: string;
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      sortBy?: 'price' | 'rating' | 'newest' | 'popularity';
    },
    limit: number = 20,
    offset: number = 0
  ) {
    let nearbyShopIds: string[] | undefined = undefined;

    // 1. PostGIS distance filtering for nearby shops
    if (filters.latitude && filters.longitude && filters.maxDistance) {
      const shops = await prisma.$queryRaw<any[]>`
        SELECT s.id
        FROM "Shop" s
        JOIN "User" u ON s."ownerId" = u."id"
        WHERE u.role = 'SELLER'
          AND s."isActive" = true
          AND ST_Distance(
            ST_MakePoint(u."longitude", u."latitude")::geography,
            ST_MakePoint(${filters.longitude}, ${filters.latitude})::geography
          ) <= ${filters.maxDistance}
      `;
      nearbyShopIds = shops.map((s) => s.id);

      // If geo-filtered and no shops are nearby, return empty
      if (nearbyShopIds.length === 0) {
        return { products: [], total: 0, limit, offset };
      }
    }

    const formattedQuery = (filters.query || '').trim().replace(/[&|!():<>'"]/g, '').split(/\s+/).filter(Boolean).join(' | ');

    const searchCondition = formattedQuery
      ? {
          OR: [
            { name: { search: formattedQuery } },
            { description: { search: formattedQuery } },
            { category: { search: formattedQuery } },
            { name: { contains: (filters.query || '').trim(), mode: 'insensitive' } },
          ],
        }
      : {};

    const whereClause: any = {
      isActive: true,
      shop: { isActive: true },
      ...searchCondition,
      ...(filters.category && { category: filters.category }),
      ...(filters.minPrice && { price: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
      ...(filters.shopId && { shopId: filters.shopId }),
      ...(nearbyShopIds && { shopId: { in: nearbyShopIds } }),
    };

    const now = new Date();

    // 1. Fetch Sponsored Products dynamically (only on first page)
    let sponsoredProducts: any[] = [];
    if ((filters.query || filters.category) && offset === 0) {
      const activeSponsored = await adsService.serveAds({
        limit: 3,
        query: filters.query,
        category: filters.category,
        lat: filters.latitude,
        lng: filters.longitude,
        city: (filters as any).city,
        userId: (filters as any).userId,
        userGender: (filters as any).userGender,
      });
        
      sponsoredProducts = activeSponsored.map(ad => ({
        ...ad.product,
        isBoosted: true,
        isSponsored: true,
        campaignId: ad.id,
        sponsoredListingId: ad.id,
      }));
    }

    // 2. Fetch organic products (excluding the injected sponsored ones)
    const sponsoredIds = sponsoredProducts.map(p => p.id);
    const organicWhereClause = sponsoredIds.length > 0 
      ? { ...whereClause, id: { notIn: sponsoredIds } }
      : whereClause;

    const products = await prisma.product.findMany({
      where: organicWhereClause,
      include: {
        shop: { select: { id: true, name: true, slug: true, logo: true, coverImage: true, averageRating: true, address: true, city: true } },
      },
      skip: offset,
      take: limit,
      orderBy:
        filters.sortBy === 'price'
          ? { price: 'asc' }
          : filters.sortBy === 'newest'
            ? { createdAt: 'desc' }
            : filters.sortBy === 'popularity'
              ? { orderCount: 'desc' }
              : { createdAt: 'desc' },
    });

    let filtered = products;

    if (filters.minRating) {
      filtered = filtered.filter((p) => (p.averageRating || 0) >= filters.minRating!);
    }

    const mappedOrganic = filtered.map((p) => ({
      ...p,
      isBoosted: false,
      isSponsored: false,
    }));

    const finalProducts = offset === 0 ? [...sponsoredProducts, ...mappedOrganic] : mappedOrganic;
    const total = await prisma.product.count({ where: whereClause });

    return { products: finalProducts, total, limit, offset };
  }
}

export default new SearchService();
