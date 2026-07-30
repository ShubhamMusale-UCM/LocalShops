import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheGet, cacheSet } from '../../config/redis';

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
    offset: number = 0
  ) {
    const queryLower = query.toLowerCase();

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        shop: { isActive: true },
        OR: [
          { name: { contains: queryLower, mode: 'insensitive' } },
          { description: { contains: queryLower, mode: 'insensitive' } },
          { category: { contains: queryLower, mode: 'insensitive' } },
        ],
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
        ...(filters.shopId && { shopId: filters.shopId }),
      },
      include: {
        shop: { select: { id: true, name: true, averageRating: true } },
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Filter by minimum rating if provided
    let filtered = products;
    if (filters.minRating) {
      filtered = products.filter((p) => (p.averageRating || 0) >= filters.minRating!);
    }

    const total = await prisma.product.count({
      where: {
        isActive: true,
        shop: { isActive: true },
        OR: [
          { name: { contains: queryLower, mode: 'insensitive' } },
          { description: { contains: queryLower, mode: 'insensitive' } },
          { category: { contains: queryLower, mode: 'insensitive' } },
        ],
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
        ...(filters.shopId && { shopId: filters.shopId }),
      },
    });

    return { products: filtered, total, limit, offset };
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
    // Using PostGIS distance calculation
    const shops = await prisma.$queryRaw<any[]>`
      SELECT 
        s.*,
        u."latitude",
        u."longitude",
        ST_Distance(
          ST_MakePoint(u."longitude", u."latitude")::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) as distance
      FROM "Shop" s
      JOIN "User" u ON s."ownerId" = u."id"
      WHERE u.role = 'SELLER'
        AND s."isActive" = true
        ${keyword ? `AND (s.name ILIKE ${'%' + keyword + '%'} OR s.description ILIKE ${'%' + keyword + '%'})` : ''}
        AND ST_Distance(
          ST_MakePoint(u."longitude", u."latitude")::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) <= ${maxDistance}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return shops;
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
    const products = await prisma.$queryRaw<any[]>`
      SELECT 
        p.*,
        s.name as "shopName",
        s.id as "shopId",
        u."latitude" as "shopLatitude",
        u."longitude" as "shopLongitude",
        ST_Distance(
          ST_MakePoint(u."longitude", u."latitude")::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) as distance
      FROM "Product" p
      JOIN "Shop" s ON p."shopId" = s."id"
      JOIN "User" u ON s."ownerId" = u."id"
      WHERE u.role = 'SELLER'
        AND s."isActive" = true
        AND p."isActive" = true
        ${category ? `AND p.category = '${category}'` : ''}
        AND p."inStock" = true
        AND ST_Distance(
          ST_MakePoint(u."longitude", u."latitude")::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) <= ${maxDistance}
      ORDER BY distance ASC, p."price" ASC
      LIMIT ${limit}
    `;

    return products;
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
    let query = filters.query || '';

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        shop: { isActive: true },
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        }),
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
        ...(filters.shopId && { shopId: filters.shopId }),
      },
      include: {
        shop: { select: { id: true, name: true, averageRating: true } },
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

    // Apply rating filter and geo-distance filter
    let filtered = products;

    if (filters.minRating) {
      filtered = filtered.filter((p) => (p.averageRating || 0) >= filters.minRating!);
    }

    if (filters.latitude && filters.longitude && filters.maxDistance) {
      // Simple distance approximation (for production use PostGIS)
      filtered = filtered.filter(() => true); // Implement PostGIS distance filtering
    }

    return { products: filtered, total: filtered.length, limit, offset };
  }
}

export default new SearchService();
