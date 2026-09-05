import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheGet, cacheSet } from '../../config/redis';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';

const isCampaignLive = (campaign: {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  budget: number;
  spent: number;
}) => {
  const now = new Date();
  return (
    campaign.isActive &&
    campaign.startDate <= now &&
    campaign.endDate >= now &&
    campaign.spent < campaign.budget
  );
};

export class AdsService {
  async createSponsoredListing(
    shopId: string,
    productId: string,
    budgetPerDay: number,
    bidPerClick: number,
    startDate: Date,
    duration: number
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isActive: true },
    });

    if (!product || product.shopId !== shopId) {
      throw new AppError('Product not found for this shop', 404);
    }

    if (!product.isActive) {
      throw new AppError('Cannot promote a deleted/inactive product', 400);
    }

    if (budgetPerDay < 100) {
      throw new AppError('Minimum daily budget is ₹100', 400);
    }

    if (duration < 1) {
      throw new AppError('Duration must be at least 1 day', 400);
    }

    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    const budget = budgetPerDay * duration;

    const existing = await prisma.promotedListing.findUnique({
      where: { productId },
    });

    let campaign;
    if (existing) {
      campaign = await prisma.promotedListing.update({
        where: { productId },
        data: {
          budget,
          spent: 0,
          bidPerClick,
          startDate,
          endDate,
          isActive: true,
          impressions: 0,
          clicks: 0,
        },
        include: {
          product: { select: { id: true, name: true, images: true, price: true } },
          shop: { select: { id: true, name: true, logo: true, coverImage: true } },
        },
      });
    } else {
      campaign = await prisma.promotedListing.create({
        data: {
          shopId,
          productId,
          budget,
          spent: 0,
          bidPerClick,
          impressions: 0,
          clicks: 0,
          startDate,
          endDate,
          isActive: true,
        },
        include: {
          product: { select: { id: true, name: true, images: true, price: true } },
          shop: { select: { id: true, name: true, logo: true, coverImage: true } },
        },
      });
    }

    await cacheDelete(`shop:${shopId}:ads`);
    return campaign;
  }

  async getShopAds(shopId: string) {
    const cacheKey = `shop:${shopId}:ads`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached as any[];
    }

    const ads = await prisma.promotedListing.findMany({
      where: {
        shopId,
      },
      include: {
        product: { select: { id: true, name: true, images: true, price: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const adsWithState = ads.map((ad) => {
      const isDeletedProduct = !ad.product?.isActive;
      const isLive = !isDeletedProduct && isCampaignLive(ad);

      return {
        ...ad,
        isLive,
        isDeletedProduct,
        state: isLive ? 'LIVE' : 'HISTORY',
      };
    });

    if (adsWithState.length > 0) {
      await cacheSet(cacheKey, adsWithState, 600);
    }

    return adsWithState;
  }

  async updateAdPerformance(adId: string, impressions: number, clicks: number, spent: number) {
    const updated = await prisma.promotedListing.update({
      where: { id: adId },
      data: {
        impressions: { increment: Math.max(0, impressions) },
        clicks: { increment: Math.max(0, clicks) },
        spent: { increment: Math.max(0, spent) },
      },
    });

    if (updated.spent >= updated.budget) {
      await this.pauseAd(adId);
    }

    return updated;
  }

  async pauseAd(adId: string) {
    return prisma.promotedListing.update({
      where: { id: adId },
      data: { isActive: false },
    });
  }

  async resumeAd(adId: string) {
    const ad = await prisma.promotedListing.findUnique({ where: { id: adId } });
    if (!ad) throw new AppError('Ad not found', 404);

    if (ad.endDate < new Date()) {
      throw new AppError('Ad campaign has already expired. Please create a new one.', 400);
    }

    if (ad.spent >= ad.budget) {
      throw new AppError('Ad budget exhausted. Please renew budget.', 400);
    }

    return prisma.promotedListing.update({
      where: { id: adId },
      data: { isActive: true },
    });
  }

  async getAdAnalytics(adId: string) {
    const ad = await prisma.promotedListing.findUnique({
      where: { id: adId },
      include: {
        product: { select: { id: true, name: true, price: true, isActive: true } },
      },
    });

    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
    const budgetRemaining = Math.max(0, ad.budget - ad.spent);

    return {
      ad,
      metrics: {
        ctr: Number(ctr.toFixed(2)),
        clicks: ad.clicks,
        impressions: ad.impressions,
        searchAppearances: ad.impressions,
        conversions: ad.conversions || 0,
        revenue: ad.revenue || 0,
        spent: ad.spent,
        budget: ad.budget,
        cpc: ad.clicks > 0 ? Number((ad.spent / ad.clicks).toFixed(2)) : 0,
        budgetRemaining,
        isLive: !!ad.product?.isActive && isCampaignLive(ad),
        isDeletedProduct: !ad.product?.isActive,
      },
    };
  }

  async trackAdClick(adId: string) {
    const ad = await prisma.promotedListing.findUnique({
      where: { id: adId },
      include: { product: { select: { isActive: true } } },
    });
    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    if (!ad.product?.isActive) {
      throw new AppError('Ad is inactive because product was deleted', 400);
    }

    if (!isCampaignLive(ad)) {
      throw new AppError('Ad campaign is not live', 400);
    }

    const durationDays = Math.max(
      1,
      Math.ceil((ad.endDate.getTime() - ad.startDate.getTime()) / (24 * 60 * 60 * 1000))
    );
    const estimatedCostPerClick = Math.max(1, Number((ad.budget / Math.max(durationDays * 50, 1)).toFixed(2)));

    const updated = await prisma.promotedListing.update({
      where: { id: adId },
      data: {
        clicks: { increment: 1 },
        spent: { increment: estimatedCostPerClick },
      },
    });

    if (updated.spent >= updated.budget && updated.isActive) {
      await prisma.promotedListing.update({
        where: { id: adId },
        data: { isActive: false },
      });
      updated.isActive = false;
    }

    // Invalidate Redis cache so seller dashboard reflects the click
    await cacheDelete(`shop:${ad.shopId}:ads`);
    await cacheDelete(`shop:${ad.shopId}:analytics`);

    return updated;
  }

  async trackAdImpressions(adIds: string[]) {
    if (!adIds || adIds.length === 0) return;

    // Remove duplicates
    const uniqueAdIds = Array.from(new Set(adIds));

    try {
      // Bulk update impressions in a single query to prevent DB locking and scaling issues
      await prisma.promotedListing.updateMany({
        where: { id: { in: uniqueAdIds } },
        data: { impressions: { increment: 1 } },
      });
    } catch (error) {
      console.warn('Failed to track ad impressions in bulk:', error);
    }

    return { success: true, count: uniqueAdIds.length };
  }

  async processBatchTelemetry(events: { campaignId: string; productId: string; type: 'impression' | 'click' | 'conversion'; keyword?: string; timestamp: number }[]) {
    if (!events || events.length === 0) return;

    const impressionsMap = new Map<string, number>();
    const clicksMap = new Map<string, number>();
    const conversionsMap = new Map<string, number>();
    
    // Map of CampaignId_Keyword -> { impressions, clicks }
    const keywordStatsMap = new Map<string, { impressions: number; clicks: number }>();

    events.forEach(e => {
      if (e.type === 'impression') impressionsMap.set(e.campaignId, (impressionsMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'click') clicksMap.set(e.campaignId, (clicksMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'conversion') conversionsMap.set(e.campaignId, (conversionsMap.get(e.campaignId) || 0) + 1);
      
      if (e.keyword && e.keyword.trim().length > 0) {
        const kw = e.keyword.trim().toLowerCase();
        const key = `${e.campaignId}_${kw}`;
        const existing = keywordStatsMap.get(key) || { impressions: 0, clicks: 0 };
        if (e.type === 'impression') existing.impressions += 1;
        if (e.type === 'click') existing.clicks += 1;
        keywordStatsMap.set(key, existing);
      }
    });

    // Collect all unique campaign IDs across all event types
    const allCampaignIds = Array.from(new Set([
      ...impressionsMap.keys(),
      ...clicksMap.keys(),
      ...conversionsMap.keys(),
    ]));

    try {
      const campaigns = await prisma.promotedListing.findMany({
        where: { id: { in: allCampaignIds } }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const ops: any[] = [];

      for (const campaign of campaigns) {
        const impCount = impressionsMap.get(campaign.id) || 0;
        const clickCount = clicksMap.get(campaign.id) || 0;
        const convCount = conversionsMap.get(campaign.id) || 0;

        let totalCost = 0;
        let newSpent = campaign.spent;
        
        if (clickCount > 0) {
          totalCost = campaign.bidPerClick * clickCount;
          newSpent += totalCost;
        }

        if (impCount > 0 || clickCount > 0 || convCount > 0) {
          ops.push(prisma.promotedListing.update({
            where: { id: campaign.id },
            data: {
              ...(impCount > 0 && { impressions: { increment: impCount } }),
              ...(convCount > 0 && { conversions: { increment: convCount } }),
              ...(clickCount > 0 && {
                clicks: { increment: clickCount },
                spent: { increment: totalCost },
                isActive: newSpent >= campaign.budget ? false : campaign.isActive
              })
            }
          }));
        }

        // Write daily rollup for trend data (upsert so it's idempotent)
        if (impCount > 0 || clickCount > 0 || convCount > 0) {
          const clickCost = clickCount > 0 ? campaign.bidPerClick * clickCount : 0;

          ops.push(prisma.adDailyMetricRollup.upsert({
            where: {
              promotedListingId_date_hour: {
                promotedListingId: campaign.id,
                date: today,
                hour: 0, // Using 0 instead of null to avoid Prisma unique index bug
              }
            },
            update: {
              impressions: { increment: impCount },
              clicks: { increment: clickCount },
              spend: { increment: clickCost },
              conversions: { increment: convCount },
            },
            create: {
              promotedListingId: campaign.id,
              date: today,
              hour: 0,
              impressions: impCount,
              clicks: clickCount,
              spend: clickCost,
              conversions: convCount,
            }
          }));
        }
      }

      // Add keyword stats upserts
      for (const [key, stats] of keywordStatsMap.entries()) {
        const [campaignId, ...kwParts] = key.split('_');
        const keyword = kwParts.join('_');
        
        ops.push(prisma.campaignKeywordStat.upsert({
          where: {
            promotedListingId_keyword_date: {
              promotedListingId: campaignId,
              keyword,
              date: today,
            }
          },
          update: {
            impressions: { increment: stats.impressions },
            clicks: { increment: stats.clicks }
          },
          create: {
            promotedListingId: campaignId,
            keyword,
            date: today,
            impressions: stats.impressions,
            clicks: stats.clicks
          }
        }));
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
        
        // Invalidate Redis cache so seller dashboard shows fresh data
        const shopIds = Array.from(new Set(campaigns.map(c => c.shopId)));
        await Promise.all(shopIds.flatMap(id => [
          cacheDelete(`shop:${id}:ads`),
          cacheDelete(`shop:${id}:analytics`)
        ]));
      }
    } catch (error) {
      console.warn('Failed to process batch telemetry:', error);
    }
  }

  async getShopPromotionAnalytics(shopId: string) {
    const cacheKey = `shop:${shopId}:analytics`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const campaigns = await prisma.promotedListing.findMany({
      where: { shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            tags: true,
            category: true,
            images: true,
            price: true,
            isActive: true,
          },
        },
        keywordStats: {
          select: {
            keyword: true,
            impressions: true,
            clicks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const campaignAnalytics = campaigns.map((campaign) => {
      const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
      const budgetRemaining = Math.max(0, campaign.budget - campaign.spent);
      const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0;
      const isDeletedProduct = !campaign.product.isActive;
      const isLive = !isDeletedProduct && isCampaignLive(campaign);
      
      // Combine DB keyword stats with product tags as fallback
      let topKeywords = campaign.keywordStats
        .sort((a, b) => b.impressions - a.impressions)
        .map(kw => ({ keyword: kw.keyword, impressions: kw.impressions, clicks: kw.clicks }));
        
      if (topKeywords.length === 0) {
        topKeywords = [campaign.product.name, campaign.product.category, ...(campaign.product.tags || [])]
          .flatMap((raw) => String(raw || '').toLowerCase().split(/\s+/))
          .map((word) => word.trim())
          .filter((word) => word.length > 2)
          .slice(0, 8)
          .map(kw => ({ keyword: kw, impressions: 0, clicks: 0 }));
      }

      return {
        id: campaign.id,
        productId: campaign.productId,
        productName: campaign.product.name,
        productImage: campaign.product.images?.[0] || null,
        budget: campaign.budget,
        spent: campaign.spent,
        clicks: campaign.clicks,
        conversions: campaign.conversions || 0,
        revenue: campaign.revenue || 0,
        impressions: campaign.impressions,
        searchAppearances: campaign.impressions,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        budgetRemaining: Number(budgetRemaining.toFixed(2)),
        isActive: campaign.isActive,
        isLive,
        isDeletedProduct,
        state: isLive ? 'LIVE' : 'HISTORY',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        topKeywords,
      };
    });

    const totals = campaignAnalytics.reduce(
      (acc, campaign) => ({
        totalCampaigns: acc.totalCampaigns + 1,
        activeCampaigns: acc.activeCampaigns + (campaign.isLive ? 1 : 0),
        totalSearchAppearances: acc.totalSearchAppearances + campaign.searchAppearances,
        totalImpressions: acc.totalImpressions + campaign.impressions,
        totalClicks: acc.totalClicks + campaign.clicks,
        totalConversions: (acc.totalConversions || 0) + (campaign.conversions || 0),
        totalRevenue: (acc.totalRevenue || 0) + (campaign.revenue || 0),
        totalBudget: acc.totalBudget + campaign.budget,
        totalSpent: acc.totalSpent + campaign.spent,
      }),
      {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalSearchAppearances: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalRevenue: 0,
        totalBudget: 0,
        totalSpent: 0,
      }
    );

    const overallCtr = totals.totalImpressions > 0
      ? (totals.totalClicks / totals.totalImpressions) * 100
      : 0;

    const result = {
      summary: {
        ...totals,
        totalSpent: Number(totals.totalSpent.toFixed(2)),
        totalBudget: Number(totals.totalBudget.toFixed(2)),
        overallCtr: Number(overallCtr.toFixed(2)),
      },
      campaigns: campaignAnalytics,
    };

    await cacheSet(cacheKey, result, 30);
    return result;
  }

  async renewAdBudget(adId: string, additionalBudget: number) {
    if (additionalBudget < 100) {
      throw new AppError('Additional budget must be at least ₹100', 400);
    }

    return prisma.promotedListing.update({
      where: { id: adId },
      data: {
        budget: { increment: additionalBudget },
        isActive: true,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Get daily metric rollups for a shop's campaigns (used for trend charts)
   * Returns last N days of aggregated data across all campaigns for the shop.
   */
  async getShopDailyMetrics(shopId: string, days: number = 14) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days + 1);

    const rollups = await prisma.adDailyMetricRollup.findMany({
      where: {
        promotedListing: { shopId },
        date: { gte: since },
        OR: [{ hour: null }, { hour: 0 }], // Support legacy null rows and new 0 rows
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
      },
    });

    // Aggregate by date across all campaigns
    const byDate = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number; }>();
    for (const r of rollups) {
      const key = r.date.toISOString().split('T')[0];
      const existing = byDate.get(key) || { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      byDate.set(key, {
        impressions: existing.impressions + r.impressions,
        clicks: existing.clicks + r.clicks,
        spend: Number((existing.spend + r.spend).toFixed(2)),
        conversions: existing.conversions + r.conversions,
      });
    }

    return Array.from(byDate.entries()).map(([date, metrics]) => ({ date, ...metrics }));
  }

  async getTrendingProducts(limit: number = 10, query?: string, category?: string, lat?: number, lng?: number) {
    if (lat === undefined || lng === undefined) {
      return [];
    }

    const whereClause: any = {
      isActive: true,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
      product: { 
        is: { 
          isActive: true,
          ...(category && category !== 'all' && { category }),
          ...(query && {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } }
            ]
          })
        } 
      },
    };

    if (lat !== undefined && lng !== undefined) {
      const bbox = getBoundingBox(lat, lng, 50); // 50km radius by default for trending
      whereClause.shop = {
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      };
    }

    const listings = await prisma.promotedListing.findMany({
      where: whereClause,
      include: {
        product: {
          include: { shop: { select: { id: true, name: true, logo: true, coverImage: true, latitude: true, longitude: true } } },
        },
      },
      orderBy: [
        { clicks: 'desc' },
        { impressions: 'desc' },
      ],
      take: limit * 3, // Fetch extra to account for memory filtering
    });

    const validListings = listings.filter((l) => l.spent < l.budget).slice(0, limit);

    return validListings.map((listing) => {
      const product = listing.product;
      const distance = (lat !== undefined && lng !== undefined)
        ? haversineDistance(lat, lng, product.shop.latitude, product.shop.longitude)
        : null;

      return {
        ...product,
        isBoosted: true,
        isSponsored: true,
        sponsoredListingId: listing.id,
        campaignId: listing.id,
        shopDistance_km: distance,
      };
    });
  }
}

export default new AdsService();
