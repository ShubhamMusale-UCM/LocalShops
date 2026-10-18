import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import redis, { cacheGet, cacheSet, cacheDeletePattern } from '../../config/redis';
import slugify from 'slugify';
import { nanoid } from 'nanoid';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

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
          include: {
            promotedListings: {
              where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
              select: { id: true }
            }
          }
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

    if (!shop || !shop.isActive) throw new AppError('Shop not found.', 404);
    
    // Log shop view asynchronously
    this.logShopView(shop.id).catch(() => {});
    
    return shop;
  }

  /**
   * Search shops by name or description
   */
  async searchShops(query: string) {
    if (!query) return [];
    return prisma.shop.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ],
        isActive: true,
      },
      take: 20,
    });
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
    await Promise.all([
      cacheDeletePattern(`shop:${shopId}*`),
      cacheDeletePattern(`*${shopId}*`),
      cacheDeletePattern('shops:nearby:*'),
    ]);
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

    const timeZone = 'Asia/Kolkata';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
    const todayStart = new Date(`${todayStr}T00:00:00+05:30`);

    let since: Date;
    if (days === 1) {
      since = todayStart;
    } else {
      since = new Date(todayStart.getTime() - (days - 1) * 86400000);
    }

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

    // Calculate 7-day trailing data (ALWAYS 7 days regardless of the top filter)
    const sevenDaysAgoStart = new Date(todayStart.getTime() - 6 * 86400000);

    const [past7DaysOrders, past7DaysAnalytics, past7DaysAdRollups] = await Promise.all([
      prisma.order.findMany({
        where: {
          shopId,
          createdAt: { gte: sevenDaysAgoStart },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        select: { total: true, createdAt: true },
      }),
      prisma.shopAnalytics.findMany({
        where: { shopId, date: { gte: sevenDaysAgoStart } },
        select: { date: true, views: true },
      }),
      prisma.adDailyMetricRollup.findMany({
        where: { promotedListing: { shopId }, date: { gte: sevenDaysAgoStart } },
        select: { date: true, views: true, impressions: true },
      }),
    ]);

    const weeklyRevenue = Array(7).fill(0);
    const weeklyOrders = Array(7).fill(0);
    const weeklyViews = Array(7).fill(0);

    past7DaysOrders.forEach((o) => {
      const orderDateStr = new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone });
      const target = new Date(`${orderDateStr}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyRevenue[6 - diffDays] += o.total;
        weeklyOrders[6 - diffDays] += 1;
      }
    });

    past7DaysAnalytics.forEach((a) => {
      const aDateStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone });
      const target = new Date(`${aDateStr}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyViews[6 - diffDays] += a.views;
      }
    });

    past7DaysAdRollups.forEach((a) => {
      const aDateStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone });
      const target = new Date(`${aDateStr}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyViews[6 - diffDays] += (a.views || a.impressions || 0);
      }
    });

    // Top products — real data with full metadata
    const topProductsRaw = await prisma.product.findMany({
      where: { shopId },
      orderBy: [{ orderCount: 'desc' }, { viewCount: 'desc' }],
      take: 20,
      include: {
        orderItems: {
          where: { order: { createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
          select: { quantity: true, price: true }
        },
        promotedListings: { select: { clicks: true, impressions: true } },
      },
    });

    const topProducts = topProductsRaw.map(p => {
      const unitsSold = p.orderItems.reduce((acc, item) => acc + item.quantity, 0);
      const revenue = p.orderItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
      const adImpressions = (p.promotedListings || []).reduce((a, l) => a + (l.impressions || 0), 0);
      const adClicks = (p.promotedListings || []).reduce((a, l) => a + (l.clicks || 0), 0);
      const safeProdImpressions = Math.max(adImpressions, adClicks);
      
      return {
        id: p.id,
        name: p.name,
        images: p.images || [],
        price: p.price,
        category: p.category,
        inStock: p.inStock,
        units: unitsSold,
        orderCount: p.orderCount ?? 0,
        impressions: p.viewCount,  // Organic views
        clicks: adClicks,
        revenue: revenue,
        ctr: safeProdImpressions > 0 && adClicks > 0
          ? Math.min(100, Math.max(0, (adClicks / safeProdImpressions) * 100)).toFixed(2)
          : '0.00',
      };
    });

    // Real total clicks from daily rollups by date range
    const adMetrics = await prisma.adDailyMetricRollup.aggregate({
      where: { promotedListing: { shopId }, date: { gte: since } },
      _sum: { clicks: true, impressions: true, spend: true },
    });
    const realTotalAdClicks = adMetrics._sum?.clicks ?? 0;
    const realTotalAdImpressions = adMetrics._sum?.impressions ?? 0;
    const realAdSpent = adMetrics._sum?.spend ?? 0;

    // Real orderItems count for funnel
    const cartCount = await prisma.orderItem.count({
      where: { order: { shopId, createdAt: { gte: since } } },
    });

    // Real gross sales and order count
    const orderMetrics = await prisma.order.aggregate({
      where: {
        shopId,
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { total: true },
      _count: { id: true },
    });
    const realRevenue = orderMetrics._sum.total || 0;
    const realOrdersCount = orderMetrics._count.id || 0;

    // Previous period revenue & orders comparison for genuine growth rate
    const periodDurationMs = Math.max(86400000, now.getTime() - since.getTime());
    const prevPeriodStart = new Date(since.getTime() - periodDurationMs);
    const prevOrderMetrics = await prisma.order.aggregate({
      where: {
        shopId,
        createdAt: { gte: prevPeriodStart, lt: since },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { total: true },
      _count: { id: true },
    });
    const previousRevenue = prevOrderMetrics._sum.total || 0;
    const previousOrdersCount = prevOrderMetrics._count.id || 0;
    const revenueGrowth = previousRevenue > 0
      ? (((realRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)
      : realRevenue > 0
      ? '100.0'
      : '0.0';

    // Real product view counts from DB (all active products for this shop)
    const productViewsAgg = await prisma.product.aggregate({
      where: { shopId, isActive: true },
      _sum: { viewCount: true },
    });
    const realProductViews = productViewsAgg._sum.viewCount ?? 0;

    // Funnel using 100% real data
    const funnel = [
      { label: 'Shop Views', value: totals.views, color: 'from-blue-500 to-cyan-400' },
      { label: 'Product Views', value: realProductViews, color: 'from-purple-500 to-pink-400' },
      { label: 'Add to Cart', value: cartCount, color: 'from-orange-500 to-rose-400' },
      { label: 'Orders Placed', value: realOrdersCount, color: 'from-emerald-500 to-teal-400' },
    ];

    // Traffic sources — calculated from real data (no dummy multipliers)
    const totalTrafficBase = totals.views + realTotalAdImpressions;
    let trafficSources: { source: string; pct: number; color: string }[] = [];
    if (totalTrafficBase > 0) {
      const promotedPct = Math.round((realTotalAdImpressions / totalTrafficBase) * 100);
      const organicPct = Math.max(0, 100 - promotedPct);
      trafficSources = [
        { source: 'Organic Views', pct: organicPct, color: 'from-blue-500 to-cyan-400' },
        { source: 'Promoted Ads', pct: promotedPct, color: 'from-amber-500 to-orange-400' },
      ].filter(s => s.pct > 0);
    }

    // Get campaign analytics
    const { AdsService } = require('../ads/ads.service');
    const adsService = new AdsService();
    const campaignsData = await adsService.getShopPromotionAnalytics(shopId);

    const conversionRate = totals.views > 0 ? ((totals.orders / totals.views) * 100).toFixed(2) : '0.00';

    // Get top keywords
    let topKeywordsResult = await prisma.searchKeywordStat.groupBy({
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
      take: 25
    });

    if (topKeywordsResult.length === 0) {
      const fallbackKeywords = await prisma.searchKeywordStat.groupBy({
        by: ['keyword'],
        where: { shopId },
        _sum: {
          searches: true,
          clicks: true,
        },
        orderBy: {
          _sum: { searches: 'desc' }
        },
        take: 25
      });
      topKeywordsResult = fallbackKeywords as any; // Type workaround for Prisma generics
    }

    const keywords = topKeywordsResult.map(k => ({
      keyword: k.keyword,
      searches: k._sum.searches || 0,
      clicks: k._sum.clicks || 0,
      ctr: k._sum.searches ? (((k._sum.clicks || 0) / k._sum.searches) * 100).toFixed(2) : '0.00'
    }));

    // Real CTR from ad data — strictly 0.00 if no impressions or no clicks
    const safeAdImpressions = Math.max(realTotalAdImpressions, realTotalAdClicks);
    const realCtr = safeAdImpressions > 0 && realTotalAdClicks > 0
      ? Math.min(100, Math.max(0, (realTotalAdClicks / safeAdImpressions) * 100)).toFixed(2)
      : '0.00';

    const safeRoas = realAdSpent > 0 ? (realRevenue / realAdSpent).toFixed(2) : '0.00';

    return {
      totalImpressions: totals.views + realTotalAdImpressions,
      totalClicks: realTotalAdClicks,
      ctr: realCtr,
      roas: safeRoas,
      totalRevenue: realRevenue,
      ordersCount: realOrdersCount,
      previousRevenue,
      previousOrdersCount,
      revenueGrowth,
      activeProductsCount: await prisma.product.count({ where: { shopId, inStock: true } }),
      conversionRate,
      weeklyRevenue,
      weeklyViews,
      weeklyOrders,
      topProducts,
      funnel,
      trafficSources,
      campaigns: campaignsData.campaigns,
      keywords,
    };
  }

  /**
   * Get all followers (users who saved the shop)
   */
  async getShopFollowers(shopId: string) {
    const followers = await prisma.savedShop.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return followers.map(f => ({
      ...f.user,
      followedAt: f.createdAt,
      city: f.user.city || 'Unknown'
    }));
  }

  /**
   * Broadcast a notification to shop followers
   */
  async broadcastToFollowers(shopId: string, payload: { title: string, body: string, type: 'PROMOTION' | 'FLASH_SALE' | 'NEW_PRODUCT' | 'SYSTEM', city?: string, imageUrl?: string }) {
    const followers = await this.getShopFollowers(shopId);
    
    // Filter by city if provided
    const targetFollowers = payload.city 
      ? followers.filter(f => f.city.toLowerCase() === payload.city?.toLowerCase())
      : followers;

    if (targetFollowers.length === 0) return { success: true, count: 0 };

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    
    let sentCount = 0;
    for (const follower of targetFollowers) {
      // In-app notification handles push notification internally
      try {
        await notificationService.createNotification(follower.id, {
          title: payload.title,
          body: payload.body,
          type: payload.type,
          icon: shop?.logo || undefined,
          image: payload.imageUrl || undefined,
          relatedId: shopId,
        });
        sentCount++;
      } catch (e) {
        // Ignore errors to continue broadcasting
      }
    }

    return { success: true, count: targetFollowers.length, pushSent: sentCount };
  }
}

export default new ShopService();
