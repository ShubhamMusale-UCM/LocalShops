import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import { cacheGet, cacheSet, cacheDeletePattern } from '../../config/redis';
import slugify from 'slugify';
import { nanoid } from 'nanoid';

export class ShopService {
  /**
   * Create a new shop
   */
  async createShop(ownerId: string, data: any) {
    // Check subscription limit
    const existingShops = await prisma.shop.count({ where: { ownerId, isActive: true } });
    if (existingShops >= 3) {
      throw new AppError('Maximum 3 shops per account.', 400);
    }

    const slug = slugify(data.name, { lower: true, strict: true }) + '-' + nanoid(4);

    const shop = await prisma.shop.create({
      data: {
        ...data,
        ownerId,
        slug,
        subCategories: data.subCategories || [],
        photos: data.photos || [],
      },
    });

    await cacheDeletePattern('shops:nearby:*');
    return shop;
  }

  /**
   * Get shop by ID with related data
   */
  async getShopById(shopId: string) {
    const cacheKey = `shop:${shopId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        products: {
          where: { isActive: true },
          take: 20,
          orderBy: { orderCount: 'desc' },
        },
        stories: {
          where: { expiresAt: { gte: new Date() } },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { products: true, reviews: true, orders: true, savedBy: true },
        },
      },
    });

    if (!shop) throw new AppError('Shop not found.', 404);

    await cacheSet(cacheKey, shop, 600); // 10 min cache
    return shop;
  }

  /**
   * Get shop by slug
   */
  async getShopBySlug(slug: string) {
    const shop = await prisma.shop.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        _count: { select: { products: true, reviews: true } },
      },
    });
    if (!shop) throw new AppError('Shop not found.', 404);
    return shop;
  }

  /**
   * Find nearby shops using bounding box + distance calculation
   */
  async getNearbyShops(params: {
    latitude: number;
    longitude: number;
    radius?: number;
    category?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const {
      latitude, longitude,
      radius = 5,
      category,
      page = 1,
      limit = 20,
      sort = 'distance',
    } = params;

    const cacheKey = `shops:nearby:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${radius}:${category || 'all'}:${sort}:${page}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const bbox = getBoundingBox(latitude, longitude, radius);

    const where: any = {
      isActive: true,
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };

    if (category) where.category = category;

    let orderBy: any;
    switch (sort) {
      case 'rating': orderBy = { averageRating: 'desc' }; break;
      case 'popularity': orderBy = { totalOrders: 'desc' }; break;
      case 'newest': orderBy = { createdAt: 'desc' }; break;
      default: orderBy = { createdAt: 'desc' }; // Distance sorted post-query
    }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        include: {
          _count: { select: { products: true, reviews: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shop.count({ where }),
    ]);

    // Calculate distance and filter by exact radius
    const shopsWithDistance = shops
      .map(shop => ({
        ...shop,
        distance_km: haversineDistance(latitude, longitude, shop.latitude, shop.longitude),
      }))
      .filter(shop => shop.distance_km <= radius);

    // Sort by distance if requested
    if (sort === 'distance') {
      shopsWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    }

    const result = {
      shops: shopsWithDistance,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await cacheSet(cacheKey, result, 300); // 5 min cache
    return result;
  }

  /**
   * Update shop
   */
  async updateShop(shopId: string, ownerId: string, data: any) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const updated = await prisma.shop.update({ where: { id: shopId }, data });
    await cacheDeletePattern(`shop:${shopId}`);
    await cacheDeletePattern('shops:nearby:*');
    return updated;
  }

  /**
   * Get shops owned by a user
   */
  async getMyShops(ownerId: string) {
    return prisma.shop.findMany({
      where: { ownerId, isActive: true },
      include: {
        _count: { select: { products: true, orders: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Save/unsave a shop
   */
  async toggleSaveShop(userId: string, shopId: string) {
    const existing = await prisma.savedShop.findUnique({
      where: { userId_shopId: { userId, shopId } },
    });

    if (existing) {
      await prisma.savedShop.delete({ where: { id: existing.id } });
      return { saved: false };
    }

    await prisma.savedShop.create({ data: { userId, shopId } });
    return { saved: true };
  }

  /**
   * Get saved shops for a user
   */
  async getSavedShops(userId: string) {
    return prisma.savedShop.findMany({
      where: { userId },
      include: {
        shop: {
          include: { _count: { select: { products: true, reviews: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get shop analytics (for shop owner)
   */
  async getShopAnalytics(shopId: string, ownerId: string, days: number = 30) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const analytics = await prisma.shopAnalytics.findMany({
      where: { shopId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    const totals = analytics.reduce(
      (acc, day) => ({
        views: acc.views + day.views,
        uniqueViews: acc.uniqueViews + day.uniqueViews,
        orders: acc.orders + day.orders,
        revenue: acc.revenue + day.revenue,
        calls: acc.calls + day.calls,
        whatsappClicks: acc.whatsappClicks + day.whatsappClicks,
        directions: acc.directions + day.directions,
      }),
      { views: 0, uniqueViews: 0, orders: 0, revenue: 0, calls: 0, whatsappClicks: 0, directions: 0 }
    );

    return { totals, daily: analytics };
  }
}

export default new ShopService();
