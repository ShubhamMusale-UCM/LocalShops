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
  async logShopView(shopId: string, viewerId?: string) {
    try {
      await redis.hincrby('telemetry:views:shop', shopId, 1);
      if (viewerId) {
        const dateKey = new Date().toISOString().slice(0, 10);
        await Promise.all([
          redis.pfadd(`hll:shop:view:${dateKey}:${shopId}`, viewerId),
          redis.expire(`hll:shop:view:${dateKey}:${shopId}`, 172800),
        ]);
      }
      const { runTelemetrySyncNow } = require('../../jobs/telemetrySync.job');
      await runTelemetrySyncNow().catch(() => {});
    } catch (e) {
      console.error('Failed to buffer shop view in redis:', e);
    }
  }

  /**
   * Log high-intent offline showroom action (direction, call, whatsapp)
   */
  async logShopIntent(shopId: string, type: 'call' | 'whatsapp' | 'direction', userOrDeviceId: string) {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Deduplicate per user/device per 30 mins in Redis
      const dedupKey = `dedup:shop_intent:${type}:${shopId}:${userOrDeviceId}`;
      const isFirst = await redis.set(dedupKey, '1', 'EX', 1800, 'NX');
      if (!isFirst) return;

      const fieldMap: Record<string, any> = {
        call: { calls: { increment: 1 } },
        whatsapp: { whatsappClicks: { increment: 1 } },
        direction: { directions: { increment: 1 } },
      };

      await prisma.shopAnalytics.upsert({
        where: { shopId_date: { shopId, date: today } },
        update: fieldMap[type],
        create: {
          shopId,
          date: today,
          calls: type === 'call' ? 1 : 0,
          whatsappClicks: type === 'whatsapp' ? 1 : 0,
          directions: type === 'direction' ? 1 : 0,
          views: 0,
          uniqueViews: 0,
          productImpressions: 0,
          productDetailViews: 0,
          cartAdds: 0,
          orders: 0,
          revenue: 0,
        },
      });

      await cacheDeletePattern(`shop:${shopId}:analytics*`).catch(() => {});
      try {
        const { orderSocket } = require('../../app');
        if (orderSocket) {
          orderSocket.getIO().to(`shop:${shopId}`).emit('shop:ad-analytics-updated', {
            shopId,
            timestamp: new Date(),
          });
        }
      } catch (_) {}
    } catch (e) {
      console.error('Failed to log shop intent:', e);
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

    const cacheKey = `shop:${shopId}:analytics:${days}`;
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) return cachedData;

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
        productImpressions: acc.productImpressions + ((day as any).productImpressions || 0),
        productDetailViews: acc.productDetailViews + ((day as any).productDetailViews || 0),
        cartAdds: acc.cartAdds + ((day as any).cartAdds || 0),
        orders: acc.orders + day.orders,
        revenue: acc.revenue + day.revenue,
        calls: acc.calls + day.calls,
        whatsappClicks: acc.whatsappClicks + day.whatsappClicks,
        directions: acc.directions + day.directions,
      }),
      {
        views: 0,
        uniqueViews: 0,
        productImpressions: 0,
        productDetailViews: 0,
        cartAdds: 0,
        orders: 0,
        revenue: 0,
        calls: 0,
        whatsappClicks: 0,
        directions: 0,
      }
    );

    // Calculate 7-day trailing data (ALWAYS 7 days regardless of the top filter) using SQL groupBy / bounded daily rollups
    const sevenDaysAgoStart = new Date(todayStart.getTime() - 6 * 86400000);

    const [past7DaysOrdersRaw, past7DaysAnalytics, past7DaysAdRollups] = await Promise.all([
      prisma.$queryRaw<{ day_str: string; revenue: number; cnt: number }[]>`
        SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day_str,
               COALESCE(SUM(total), 0)::float AS revenue,
               COUNT(*)::int AS cnt
        FROM "Order"
        WHERE "shopId" = ${shopId}
          AND "createdAt" >= ${sevenDaysAgoStart}
          AND status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY day_str
      `,
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

    past7DaysOrdersRaw.forEach((row) => {
      const target = new Date(`${row.day_str}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyRevenue[6 - diffDays] += Number(row.revenue || 0);
        weeklyOrders[6 - diffDays] += Number(row.cnt || 0);
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

    // Top products — real data with daily analytics filtered by selected period
    const topProductsRaw = await prisma.product.findMany({
      where: { shopId },
      orderBy: [{ orderCount: 'desc' }, { viewCount: 'desc' }],
      take: 20,
      include: {
        promotedListings: { select: { clicks: true, impressions: true } },
        _count: { select: { wishlistedBy: true, cartItems: true } },
      },
    });

    const topProductIds = topProductsRaw.map((p) => p.id);
    const [topProductsDailyAgg, topProductsOrderItemsAgg] =
      topProductIds.length > 0
        ? await Promise.all([
            prisma.productDailyAnalytics.groupBy({
              by: ['productId'],
              where: { productId: { in: topProductIds }, date: { gte: since } },
              _sum: {
                impressions: true,
                detailViews: true,
                cartAdds: true,
                unitsSold: true,
                revenue: true,
              },
            }),
            prisma.orderItem.groupBy({
              by: ['productId'],
              where: {
                productId: { in: topProductIds },
                order: { createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
              },
              _sum: { quantity: true, total: true },
            }),
          ])
        : [[], []];

    const dailyAggMap = new Map(
      topProductsDailyAgg.map((d) => [
        d.productId,
        {
          impressions: d._sum.impressions || 0,
          views: d._sum.detailViews || 0,
          cartAdds: d._sum.cartAdds || 0,
        },
      ])
    );
    const orderItemsAggMap = new Map(
      topProductsOrderItemsAgg.map((o) => [
        o.productId,
        {
          unitsSold: o._sum.quantity || 0,
          revenue: o._sum.total || 0,
        },
      ])
    );

    const periodDays = Math.max(1, (now.getTime() - since.getTime()) / 86400000);

    const topProducts = topProductsRaw.map(p => {
      const orderAgg = orderItemsAggMap.get(p.id) || { unitsSold: 0, revenue: 0 };
      const unitsSold = orderAgg.unitsSold;
      const revenue = orderAgg.revenue;
      const adImpressions = (p.promotedListings || []).reduce((a, l) => a + (l.impressions || 0), 0);
      const adClicks = (p.promotedListings || []).reduce((a, l) => a + (l.clicks || 0), 0);

      // Period daily telemetry aggregated in PostgreSQL
      const periodDaily = dailyAggMap.get(p.id) || { impressions: 0, views: 0, cartAdds: 0 };

      const lifetimeViews = p.viewCount ?? 0;
      const periodViews = periodDaily.views || 0;
      const periodImpressions = periodDaily.impressions || 0;

      // views: Always guarantee lifetime views match ManageProductsScreen inventory count
      const views = lifetimeViews;

      // impressions: Organic feed views + ad impressions, fallback to at least total views
      const impressions = periodImpressions > 0 
        ? periodImpressions 
        : Math.max(adImpressions, periodViews, lifetimeViews);

      const ctr = impressions > 0
        ? Math.min(100, Math.max(0, ((adClicks > 0 ? adClicks : periodViews) / impressions) * 100)).toFixed(2)
        : '0.00';

      const dailyVelocity = unitsSold / periodDays;
      const daysOfStockLeft = p.quantity !== null && p.quantity !== undefined
        ? (p.quantity <= 0 ? 0 : dailyVelocity > 0 ? Math.floor(p.quantity / dailyVelocity) : null)
        : null;
      
      return {
        id: p.id,
        name: p.name,
        images: p.images || [],
        price: p.price,
        category: p.category,
        inStock: p.inStock,
        quantity: p.quantity,
        units: unitsSold,
        orderCount: p.orderCount ?? 0,
        viewCount: lifetimeViews,
        views: lifetimeViews,
        periodViews,
        periodImpressions,
        impressions,
        clicks: adClicks,
        revenue: revenue,
        ctr,
        wishlistCount: (p as any)._count?.wishlistedBy || 0,
        inCartCount: (p as any)._count?.cartItems || 0,
        daysOfStockLeft,
      };
    });

    // Parallelize all independent database & Redis aggregations for sub-30ms cold execution
    const periodDurationMs = Math.max(86400000, now.getTime() - since.getTime());
    const prevPeriodStart = new Date(since.getTime() - periodDurationMs);
    const { AdsService } = require('../ads/ads.service');
    const adsService = new AdsService();

    const [
      adMetrics,
      cartCount,
      abandonedCartSql,
      orderMetrics,
      orderStatusGroups,
      adAttributionGroups,
      recentSlaOrders,
      customerRetentionSql,
      oosViewsVal,
      prevOrderMetrics,
      productViewsAgg,
      activeProductsCount,
      campaignsData,
      initialTopKeywords,
    ] = await Promise.all([
      prisma.adDailyMetricRollup.aggregate({
        where: { promotedListing: { shopId }, date: { gte: since } },
        _sum: { clicks: true, impressions: true, spend: true },
      }),
      prisma.orderItem.count({
        where: { order: { shopId, createdAt: { gte: since } } },
      }),
      prisma.$queryRaw<{ cnt: number; val: number }[]>`
        SELECT COUNT(ci.id)::int AS cnt,
               COALESCE(SUM(ci.quantity * p.price), 0)::float AS val
        FROM "CartItem" ci
        JOIN "Product" p ON p.id = ci."productId"
        WHERE p."shopId" = ${shopId}
      `,
      prisma.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: {
          shopId,
          createdAt: { gte: since },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ['adCampaignId'],
        where: {
          shopId,
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.findMany({
        where: {
          shopId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: {
          statusHistory: true,
          createdAt: true,
        },
      }),
      prisma.$queryRaw<{ total_buyers: number; repeat_buyers: number }[]>`
        SELECT COUNT(*)::int AS total_buyers,
               COUNT(*) FILTER (WHERE cnt > 1)::int AS repeat_buyers
        FROM (
          SELECT "userId", COUNT(*) AS cnt
          FROM "Order"
          WHERE "shopId" = ${shopId}
            AND status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY "userId"
        ) sub
      `,
      redis.hget(`telemetry:shop:oos_views:${todayStr}`, shopId),
      prisma.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: prevPeriodStart, lt: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.product.aggregate({
        where: { shopId, isActive: true },
        _sum: { viewCount: true },
      }),
      prisma.product.count({ where: { shopId, inStock: true } }),
      adsService.getShopPromotionAnalytics(shopId),
      prisma.searchKeywordStat.groupBy({
        by: ['keyword'],
        where: {
          shopId,
          date: { gte: since },
        },
        _sum: {
          searches: true,
          clicks: true,
        },
        orderBy: {
          _sum: { searches: 'desc' },
        },
        take: 25,
      }),
    ]);

    let realTotalAdClicks = adMetrics._sum?.clicks ?? 0;
    let realTotalAdImpressions = adMetrics._sum?.impressions ?? 0;
    let realAdSpent = adMetrics._sum?.spend ?? 0;

    const abandonedCartCount = Number(abandonedCartSql[0]?.cnt ?? 0);
    const abandonedCartValue = Number(abandonedCartSql[0]?.val ?? 0);
    const activeCartCount = abandonedCartCount;

    const realRevenue = orderMetrics._sum.total || 0;
    const realOrdersCount = orderMetrics._count.id || 0;

    let realizedRevenue = 0;
    let deliveredOrdersCount = 0;
    let pendingRevenue = 0;
    let pendingOrdersCount = 0;
    let lostRevenue = 0;
    let lostOrdersCount = 0;

    for (const group of orderStatusGroups) {
      const amt = group._sum.total || 0;
      const cnt = group._count.id || 0;
      if (group.status === 'DELIVERED') {
        realizedRevenue += amt;
        deliveredOrdersCount += cnt;
      } else if (['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(group.status)) {
        pendingRevenue += amt;
        pendingOrdersCount += cnt;
      } else if (['CANCELLED', 'REFUNDED'].includes(group.status)) {
        lostRevenue += amt;
        lostOrdersCount += cnt;
      }
    }

    const totalPlacedOrders = deliveredOrdersCount + pendingOrdersCount + lostOrdersCount;
    const cancellationRate = totalPlacedOrders > 0
      ? Number(((lostOrdersCount / totalPlacedOrders) * 100).toFixed(1))
      : 0;

    let organicRevenue = 0;
    let organicOrders = 0;
    let promotedRevenue = 0;
    let promotedOrders = 0;

    for (const grp of adAttributionGroups) {
      const amt = grp._sum.total || 0;
      const cnt = grp._count.id || 0;
      if (grp.adCampaignId) {
        promotedRevenue += amt;
        promotedOrders += cnt;
      } else {
        organicRevenue += amt;
        organicOrders += cnt;
      }
    }

    const acceptanceTimes: number[] = [];
    for (const o of recentSlaOrders) {
      const history = Array.isArray(o.statusHistory) ? o.statusHistory : [];
      const placedEntry = history.find((h: any) => h.status === 'PLACED');
      const confirmedEntry = history.find((h: any) => h.status === 'CONFIRMED');
      if (confirmedEntry && (confirmedEntry as any).updatedAt) {
        const placedTime = placedEntry && (placedEntry as any).updatedAt
          ? new Date((placedEntry as any).updatedAt).getTime()
          : new Date(o.createdAt).getTime();
        const confirmedTime = new Date((confirmedEntry as any).updatedAt).getTime();
        const diffMin = (confirmedTime - placedTime) / 60000;
        if (diffMin >= 0 && diffMin < 10080) { // under 7 days
          acceptanceTimes.push(diffMin);
        }
      }
    }

    const avgAcceptanceMinutes = acceptanceTimes.length > 0
      ? Math.round(acceptanceTimes.reduce((a, b) => a + b, 0) / acceptanceTimes.length)
      : null;

    let slaSpeed: 'fast' | 'moderate' | 'slow' | 'none' = 'none';
    let slaLabel = 'No recent orders';
    if (avgAcceptanceMinutes !== null) {
      if (avgAcceptanceMinutes <= 15) {
        slaSpeed = 'fast';
        slaLabel = 'Lightning Fast (<15m)';
      } else if (avgAcceptanceMinutes <= 45) {
        slaSpeed = 'moderate';
        slaLabel = `Standard (~${avgAcceptanceMinutes}m)`;
      } else {
        slaSpeed = 'slow';
        slaLabel = 'Needs Attention (>45m)';
      }
    }

    const fulfillmentSla = {
      avgMinutes: avgAcceptanceMinutes,
      speed: slaSpeed,
      label: slaLabel,
      samplesCount: acceptanceTimes.length,
    };

    const revenueBreakdown = {
      realizedRevenue,
      deliveredOrdersCount,
      pendingRevenue,
      pendingOrdersCount,
      lostRevenue,
      lostOrdersCount,
      cancellationRate,
    };

    const totalUniqueBuyers = Number(customerRetentionSql[0]?.total_buyers ?? 0);
    const repeatBuyers = Number(customerRetentionSql[0]?.repeat_buyers ?? 0);
    const repeatBuyerRate = totalUniqueBuyers > 0
      ? Number(((repeatBuyers / totalUniqueBuyers) * 100).toFixed(1))
      : 0;

    const missedOosViews = parseInt(oosViewsVal || '0', 10);

    const previousRevenue = prevOrderMetrics._sum.total || 0;
    const previousOrdersCount = prevOrderMetrics._count.id || 0;
    const revenueGrowth = previousRevenue > 0
      ? (((realRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)
      : realRevenue > 0
      ? '100.0'
      : '0.0';

    const realProductViews = productViewsAgg._sum.viewCount ?? 0;

    // If adDailyMetricRollup was unpopulated, reconcile with real campaign summary
    if (campaignsData?.summary) {
      if (realTotalAdClicks === 0 && campaignsData.summary.totalClicks > 0) {
        realTotalAdClicks = campaignsData.summary.totalClicks;
      }
      if (realTotalAdImpressions === 0 && campaignsData.summary.totalImpressions > 0) {
        realTotalAdImpressions = campaignsData.summary.totalImpressions;
      }
      if (realAdSpent === 0 && campaignsData.summary.totalSpent > 0) {
        realAdSpent = campaignsData.summary.totalSpent;
      }
    }

    // Top-of-Funnel Total Store & Catalog Reach (ensures monotonic non-increasing stages)
    const rawShopViews = totals.views || 0;
    const topOfFunnelReach = Math.max(
      rawShopViews + realTotalAdImpressions + (totals.productImpressions || 0),
      realProductViews,
      realOrdersCount
    );

    const periodProductViews = totals.productDetailViews > 0
      ? Math.max(totals.productDetailViews, realOrdersCount)
      : Math.max(realProductViews, realOrdersCount);
    const periodCartAdds = Math.max(totals.cartAdds, activeCartCount, cartCount, realOrdersCount);

    const funnel = [
      { label: 'Shop Views', value: Math.max(topOfFunnelReach, periodProductViews), color: 'from-blue-500 to-cyan-400' },
      { label: 'Product Views', value: periodProductViews, color: 'from-purple-500 to-pink-400' },
      { label: 'Add to Cart', value: periodCartAdds, color: 'from-orange-500 to-rose-400' },
      { label: 'Orders Placed', value: realOrdersCount, color: 'from-emerald-500 to-teal-400' },
    ];

    // Traffic sources — calculated from real data including reconciled ad impressions
    const totalTrafficBase = rawShopViews + realTotalAdImpressions;
    let trafficSources: { source: string; pct: number; color: string }[] = [];
    if (totalTrafficBase > 0) {
      const promotedPct = Math.round((realTotalAdImpressions / totalTrafficBase) * 100);
      const organicPct = Math.max(0, 100 - promotedPct);
      trafficSources = [
        { source: 'Organic Views', pct: organicPct, color: 'from-blue-500 to-cyan-400' },
        { source: 'Promoted Ads', pct: promotedPct, color: 'from-amber-500 to-orange-400' },
      ].filter(s => s.pct > 0);
    }

    const conversionRate = topOfFunnelReach > 0
      ? Math.min(100, (realOrdersCount / topOfFunnelReach) * 100).toFixed(2)
      : '0.00';

    let topKeywordsResult = initialTopKeywords;
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
      topKeywordsResult = fallbackKeywords as any;
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

    const winningKeywords = keywords.filter((k: any) => k.clicks > 0);
    const searchGaps = keywords.filter((k: any) => k.clicks === 0 && k.searches >= 2);

    const revenueSplit = {
      organicRevenue,
      organicOrders,
      promotedRevenue,
      promotedOrders,
      adSpend: realAdSpent,
      promotedRoas: realAdSpent > 0 ? (promotedRevenue / realAdSpent).toFixed(2) : '0.00',
      blendedRoas: safeRoas,
    };

    const response = {
      totalImpressions: totals.views + realTotalAdImpressions,
      totalClicks: realTotalAdClicks,
      ctr: realCtr,
      roas: safeRoas,
      totalRevenue: realRevenue,
      ordersCount: realOrdersCount,
      previousRevenue,
      previousOrdersCount,
      revenueGrowth,
      activeProductsCount,
      conversionRate,
      weeklyRevenue,
      weeklyViews,
      weeklyOrders,
      topProducts,
      funnel,
      trafficSources,
      campaigns: campaignsData.campaigns,
      keywords,
      winningKeywords,
      searchGaps,
      showroomLeads: {
        calls: totals.calls,
        whatsappClicks: totals.whatsappClicks,
        directions: totals.directions,
        totalLeads: totals.calls + totals.whatsappClicks + totals.directions,
      },
      revenueBreakdown,
      revenueSplit,
      fulfillmentSla,
      customerRetention: {
        totalBuyers: totalUniqueBuyers,
        repeatBuyers,
        repeatBuyerRate,
      },
      abandonedCarts: {
        count: abandonedCartCount,
        value: abandonedCartValue,
      },
      missedOosViews,
    };

    await cacheSet(cacheKey, response, 60);
    return response;
  }

  /**
   * Helper: calculate Haversine distance in kilometers between two GPS coordinates
   */
  private calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }

  /**
   * Get all followers with real order statistics, distance calculations, and loyalty tiers
   */
  async getShopFollowers(shopId: string) {
    const [shop, followers] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, latitude: true, longitude: true, city: true, slug: true }
      }),
      prisma.savedShop.findMany({
        where: { shopId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true,
              latitude: true,
              longitude: true,
              createdAt: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const userIds = followers.map(f => f.userId);
    const orderAggregates = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        shopId,
        userId: { in: userIds },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _count: { id: true },
      _sum: { total: true },
    });
    const orderMap = new Map(
      orderAggregates.map(o => [o.userId, { ordersCount: o._count.id, totalSpent: o._sum.total || 0 }])
    );

    return followers.map(f => {
      const stats = orderMap.get(f.userId) || { ordersCount: 0, totalSpent: 0 };
      const badge = stats.ordersCount >= 3 ? 'VIP Buyer' : stats.ordersCount >= 1 ? 'Regular Buyer' : 'Follower';
      
      let distanceKm: number | null = null;
      if (
        shop?.latitude != null &&
        shop?.longitude != null &&
        f.user.latitude != null &&
        f.user.longitude != null
      ) {
        distanceKm = this.calculateHaversineDistanceKm(
          shop.latitude,
          shop.longitude,
          f.user.latitude,
          f.user.longitude
        );
      }

      return {
        id: f.user.id,
        name: f.user.name,
        email: f.user.email,
        phone: f.user.phone,
        city: f.user.city || shop?.city || 'Local',
        followedAt: f.createdAt,
        ordersCount: stats.ordersCount,
        totalSpent: stats.totalSpent,
        badge,
        distanceKm,
      };
    });
  }

  /**
   * Broadcast a notification to shop followers with corridor/radius & product deep-linking support
   */
  async broadcastToFollowers(
    shopId: string,
    payload: {
      title: string;
      body: string;
      type: 'PROMOTION' | 'FLASH_SALE' | 'NEW_PRODUCT' | 'SYSTEM';
      city?: string;
      corridor?: string;
      productId?: string;
      imageUrl?: string;
    }
  ) {
    const [followers, shop] = await Promise.all([
      this.getShopFollowers(shopId),
      prisma.shop.findUnique({ where: { id: shopId } }),
    ]);

    // Apply corridor or city filtering
    let targetFollowers = followers;
    if (payload.corridor && payload.corridor !== 'all_city') {
      if (payload.corridor === 'immediate' || payload.corridor === 'walk_in') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm <= 2);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      } else if (payload.corridor === 'commercial' || payload.corridor === '3_5_km') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm > 2 && f.distanceKm <= 5);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      } else if (payload.corridor === 'suburban' || payload.corridor === '5_10_km') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm > 5 && f.distanceKm <= 10);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      }
    } else if (payload.city && payload.city !== 'all_city' && payload.city !== 'All') {
      const cityFiltered = followers.filter(f => 
        f.city && f.city.toLowerCase() === payload.city?.toLowerCase()
      );
      if (cityFiltered.length > 0) {
        targetFollowers = cityFiltered;
      }
    }

    if (targetFollowers.length === 0) return { success: true, count: 0, pushSent: 0 };

    const relatedId = payload.productId || shopId;
    const actionUrl = payload.productId ? `/product/${payload.productId}` : `/shop/${shop?.slug || shopId}`;

    let sentCount = 0;
    const BROADCAST_CHUNK_SIZE = 25;
    for (let i = 0; i < targetFollowers.length; i += BROADCAST_CHUNK_SIZE) {
      const chunk = targetFollowers.slice(i, i + BROADCAST_CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((follower) =>
          notificationService.createNotification(follower.id, {
            title: payload.title,
            body: payload.body,
            type: payload.type,
            icon: shop?.logo || undefined,
            image: payload.imageUrl || undefined,
            relatedId,
            actionUrl,
          })
        )
      );
      sentCount += results.filter((r) => r.status === 'fulfilled').length;
    }

    return { success: true, count: targetFollowers.length, pushSent: sentCount };
  }
}

export default new ShopService();
