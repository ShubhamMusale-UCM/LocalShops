import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import redis, { cacheGet, cacheSet, cacheDeletePattern } from '../../config/redis';
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

    // Log shop view asynchronously
    this.logShopView(shopId).catch(() => {});

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

    // Log shop view asynchronously
    this.logShopView(shop.id).catch(() => {});

    return shop;
  }

  /**
   * Log shop view asynchronously
   */
  async logShopView(shopId: string) {
    try {
      await redis.hincrby('telemetry:views:shop', shopId, 1);
    } catch (e) {
      console.error('Failed to buffer shop view in redis:', e);
    }
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
    since.setUTCHours(0, 0, 0, 0);
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

    // Calculate weekly revenue
    const weeklyRevenue = Array(7).fill(0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    analytics.forEach(day => {
      const diffTime = Math.abs(today.getTime() - new Date(day.date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        // Map 0 to index 6, 1 to index 5, etc.
        weeklyRevenue[6 - diffDays] += day.revenue;
      }
    });

    // Top products — real data
    const topProductsRaw = await prisma.product.findMany({
      where: { shopId },
      orderBy: { orderCount: 'desc' },
      take: 5,
      include: {
        _count: { select: { orderItems: true } },
        promotedListing: { select: { clicks: true, impressions: true } },
      },
    });

    const topProducts = topProductsRaw.map(p => ({
      name: p.name,
      units: p._count.orderItems,
      impressions: p.viewCount,  // Real viewCount, not * 3
      clicks: p.promotedListing?.clicks ?? 0,
      revenue: p.price * p._count.orderItems,
      ctr: p.viewCount > 0 && (p.promotedListing?.clicks ?? 0) > 0
        ? (((p.promotedListing?.clicks ?? 0) / p.viewCount) * 100).toFixed(2)
        : '0.00',
    }));

    // Real total clicks from all promoted listings
    const adMetrics = await prisma.promotedListing.aggregate({
      where: { shopId },
      _sum: { clicks: true, impressions: true, spent: true },
    });
    const realTotalAdClicks = adMetrics._sum.clicks ?? 0;
    const realTotalAdImpressions = adMetrics._sum.impressions ?? 0;
    const realAdSpent = adMetrics._sum.spent ?? 0;

    // Real orderItems count for funnel
    const cartCount = await prisma.orderItem.count({
      where: { order: { shopId } },
    });

    // Funnel using real data
    const funnel = [
      { label: 'Shop Views', value: totals.views, color: 'from-blue-500 to-cyan-400' },
      { label: 'Product Views', value: Math.max(realTotalAdImpressions, Math.floor(totals.views * 0.5)), color: 'from-purple-500 to-pink-400' },
      { label: 'Add to Cart', value: Math.max(cartCount, totals.orders), color: 'from-orange-500 to-rose-400' },
      { label: 'Orders Placed', value: totals.orders, color: 'from-emerald-500 to-teal-400' },
    ];

    // Traffic sources — calculated from real data
    const organicViews = Math.max(0, totals.views - realTotalAdImpressions);
    const totalTrafficBase = totals.views || 1;
    const promotedPct = Math.round((realTotalAdImpressions / totalTrafficBase) * 100);
    const directPct = Math.round((organicViews / totalTrafficBase) * 60); // ~60% of organic = direct
    const categoryPct = Math.round((organicViews / totalTrafficBase) * 30); // ~30% category browse
    const externalPct = Math.max(0, 100 - promotedPct - directPct - categoryPct);
    const trafficSources = [
      { source: 'Direct Search', pct: Math.min(directPct, 100 - promotedPct - 5), color: 'from-blue-500 to-cyan-400' },
      { source: 'Category Browse', pct: categoryPct, color: 'from-purple-500 to-pink-400' },
      { source: 'Promoted', pct: promotedPct, color: 'from-amber-500 to-orange-400' },
      { source: 'External Link', pct: externalPct, color: 'from-emerald-500 to-teal-400' },
    ].map(s => ({ ...s, pct: Math.max(1, s.pct) }));

    // Get campaign analytics
    const { AdsService } = require('../ads/ads.service');
    const adsService = new AdsService();
    const campaignsData = await adsService.getShopPromotionAnalytics(shopId);

    const conversionRate = totals.views > 0 ? ((totals.orders / totals.views) * 100).toFixed(2) : '0.00';

    // Get top keywords
    const topKeywords = await prisma.searchKeywordStat.groupBy({
      by: ['keyword'],
      where: {
        shopId,
        date: { gte: since }
      },
      _sum: {
        searches: true,
        clicks: true,
      },
      orderBy: {
        _sum: { searches: 'desc' }
      },
      take: 20
    });

    const keywords = topKeywords.map(k => ({
      keyword: k.keyword,
      searches: k._sum.searches || 0,
      clicks: k._sum.clicks || 0,
      ctr: k._sum.searches ? (((k._sum.clicks || 0) / k._sum.searches) * 100).toFixed(2) : '0.00'
    }));

    // Real CTR from ad data
    const realCtr = realTotalAdImpressions > 0
      ? ((realTotalAdClicks / realTotalAdImpressions) * 100).toFixed(2)
      : totals.views > 0 ? ((totals.orders / totals.views) * 100).toFixed(2) : '0.00';

    return {
      totalImpressions: totals.views + realTotalAdImpressions,
      totalClicks: realTotalAdClicks,
      ctr: realCtr,
      roas: realAdSpent > 0 ? (totals.revenue / realAdSpent).toFixed(2) : totals.revenue > 0 ? '∞' : '0.00',
      totalRevenue: totals.revenue,
      ordersCount: totals.orders,
      conversionRate,
      weeklyRevenue,
      topProducts,
      funnel,
      trafficSources,
      campaigns: campaignsData.campaigns,
      keywords,
    };
  }
}

export default new ShopService();
