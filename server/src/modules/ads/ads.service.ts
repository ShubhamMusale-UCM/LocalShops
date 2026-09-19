import prisma from '../../config/database';
import { TargetGender } from '@prisma/client';
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
    duration: number,
    targetGender: TargetGender = 'ALL'
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
          targetGender,
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
          targetGender,
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
        shop: { select: { ownerId: true } },
      },
    });

    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
    const budgetRemaining = Math.max(0, ad.budget - ad.spent);

    const cpa = ad.conversions && ad.conversions > 0 ? (ad.spent / ad.conversions) : 0;
    const cpm = ad.impressions > 0 ? (ad.spent / ad.impressions) * 1000 : 0;
    const cvr = ad.clicks > 0 ? ((ad.conversions || 0) / ad.clicks) * 100 : 0;
    const aov = ad.conversions && ad.conversions > 0 ? ((ad.revenue || 0) / ad.conversions) : 0;

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
        cpa: Number(cpa.toFixed(2)),
        cpm: Number(cpm.toFixed(2)),
        cvr: Number(cvr.toFixed(2)),
        aov: Number(aov.toFixed(2)),
        budgetRemaining,
        isLive: !!ad.product?.isActive && isCampaignLive(ad),
        isDeletedProduct: !ad.product?.isActive,
      },
    };
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

  async processBatchTelemetry(events: { campaignId: string; productId: string; type: 'impression' | 'click' | 'view' | 'cart_add' | 'conversion'; keyword?: string; productPrice?: number; timestamp: number; deviceId?: string }[]) {
    if (!events || events.length === 0) return;

    const impressionsMap = new Map<string, number>();
    const clicksMap = new Map<string, number>();
    const viewsMap = new Map<string, number>();
    const cartAddsMap = new Map<string, number>();
    const conversionsMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    
    // Map of CampaignId_Keyword -> { impressions, clicks }
    const keywordStatsMap = new Map<string, { impressions: number; clicks: number }>();

    // FRAUD PROTECTION: deduplicate clicks per campaign within this batch
    // A legitimate user can only generate 1 meaningful click per campaign per batch window.
    // We track by campaignId AND deviceId to allow different users to click the same ad.
    const seenClickCampaigns = new Set<string>();
    
    // For calculating reach
    const newImpressionLogs: { promotedListingId: string; deviceId: string }[] = [];

    events.forEach(e => {
      if (e.type === 'impression') {
        impressionsMap.set(e.campaignId, (impressionsMap.get(e.campaignId) || 0) + 1);
        if (e.deviceId) {
          newImpressionLogs.push({ promotedListingId: e.campaignId, deviceId: e.deviceId });
        }
      }
      if (e.type === 'click') {
        // Only count unique clicks per user per campaign per batch
        // Fallback to random if deviceId is missing to avoid blocking legitimate untracked clicks
        const clickKey = `${e.campaignId}_${e.deviceId || Math.random()}`;
        if (!seenClickCampaigns.has(clickKey)) {
          seenClickCampaigns.add(clickKey);
          clicksMap.set(e.campaignId, (clicksMap.get(e.campaignId) || 0) + 1);
        }
        // Already counted — silently drop the duplicate click event
      }
      if (e.type === 'view') viewsMap.set(e.campaignId, (viewsMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'cart_add') cartAddsMap.set(e.campaignId, (cartAddsMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'conversion') {
        conversionsMap.set(e.campaignId, (conversionsMap.get(e.campaignId) || 0) + 1);
        if (e.productPrice) {
          revenueMap.set(e.campaignId, (revenueMap.get(e.campaignId) || 0) + e.productPrice);
        }
      }
      
      if (e.keyword && e.keyword.trim().length > 0) {
        const kw = e.keyword.trim().toLowerCase();
        const key = `${e.campaignId}_${kw}`;
        const existing = keywordStatsMap.get(key) || { impressions: 0, clicks: 0 };
        if (e.type === 'impression') existing.impressions += 1;
        if (e.type === 'click') existing.clicks += 1;
        keywordStatsMap.set(key, existing);
      }
    });

    // Hard cap: no campaign can receive more than 50 clicks per batch (burst fraud guard)
    clicksMap.forEach((count, id) => {
      if (count > 50) clicksMap.set(id, 50);
    });

    // Collect all unique campaign IDs across all event types
    const allCampaignIds = Array.from(new Set([
      ...impressionsMap.keys(),
      ...clicksMap.keys(),
      ...viewsMap.keys(),
      ...cartAddsMap.keys(),
      ...conversionsMap.keys(),
    ]));

    try {
      const campaigns = await prisma.promotedListing.findMany({
        where: { id: { in: allCampaignIds } },
        include: { product: { select: { category: true } } }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Process unique reach
      const uniqueReachMap = new Map<string, number>();
      if (newImpressionLogs.length > 0) {
        // Find existing logs for these campaign+device combinations to filter out duplicates
        const existingLogs = await prisma.adImpressionLog.findMany({
          where: {
            OR: newImpressionLogs.map(log => ({
              promotedListingId: log.promotedListingId,
              deviceId: log.deviceId
            }))
          },
          select: { promotedListingId: true, deviceId: true }
        });

        const existingSet = new Set(existingLogs.map(l => `${l.promotedListingId}_${l.deviceId}`));
        const newUniqueLogs = newImpressionLogs.filter(log => !existingSet.has(`${log.promotedListingId}_${log.deviceId}`));

        // Deduplicate the new logs array itself so we don't count the same device twice in one batch
        const uniqueToInsert = Array.from(new Set(newUniqueLogs.map(l => `${l.promotedListingId}_${l.deviceId}`)))
          .map(str => {
            const [promotedListingId, deviceId] = str.split('_');
            return { promotedListingId, deviceId };
          });

        if (uniqueToInsert.length > 0) {
          await prisma.adImpressionLog.createMany({
            data: uniqueToInsert,
            skipDuplicates: true
          });

          // Aggregate reach counts
          uniqueToInsert.forEach(log => {
            uniqueReachMap.set(log.promotedListingId, (uniqueReachMap.get(log.promotedListingId) || 0) + 1);
          });
        }
      }

      const ops: any[] = [];

      for (const campaign of campaigns) {
        const impCount = impressionsMap.get(campaign.id) || 0;
        const clickCount = clicksMap.get(campaign.id) || 0;
        const viewCount = viewsMap.get(campaign.id) || 0;
        const cartAddCount = cartAddsMap.get(campaign.id) || 0;
        const convCount = conversionsMap.get(campaign.id) || 0;
        const revAmount = revenueMap.get(campaign.id) || 0;

        let totalCost = 0;
        let newSpent = campaign.spent;
        
        if (clickCount > 0) {
          // Second-Price Auction Logic
          // Find the second highest competitor bid in the same category
          const competitors = await prisma.promotedListing.findMany({
            where: {
              isActive: true,
              id: { not: campaign.id },
              product: { category: campaign.product?.category }
            },
            select: { bidPerClick: true, qualityScore: true }
          });

          // Sort competitors by Ad Rank
          const sortedCompetitors = competitors.sort((a, b) => {
            return (b.bidPerClick * (b.qualityScore || 5)) - (a.bidPerClick * (a.qualityScore || 5));
          });

          // The second price is the highest competitor's bid + ₹0.1, capped at our max bid
          let actualCostPerClick = campaign.bidPerClick;
          if (sortedCompetitors.length > 0) {
            const nextHighestBid = sortedCompetitors[0].bidPerClick;
            actualCostPerClick = Math.min(campaign.bidPerClick, nextHighestBid + 0.1);
          }

          totalCost = actualCostPerClick * clickCount;
          newSpent += totalCost;
        }

        const uniqueReachCount = uniqueReachMap.get(campaign.id) || 0;

        if (impCount > 0 || clickCount > 0 || viewCount > 0 || cartAddCount > 0 || convCount > 0 || uniqueReachCount > 0) {
          ops.push(prisma.promotedListing.update({
            where: { id: campaign.id },
            data: {
              ...(impCount > 0 && { impressions: { increment: impCount } }),
              ...(viewCount > 0 && { views: { increment: viewCount } }),
              ...(cartAddCount > 0 && { cartAdds: { increment: cartAddCount } }),
              ...(convCount > 0 && { conversions: { increment: convCount } }),
              ...(revAmount > 0 && { revenue: { increment: revAmount } }),
              ...(uniqueReachCount > 0 && { uniqueReach: { increment: uniqueReachCount } }),
              ...(clickCount > 0 && {
                clicks: { increment: clickCount },
                spent: { increment: totalCost },
                isActive: newSpent >= campaign.budget ? false : campaign.isActive
              })
            }
          }));

          // DEDUCT FROM SHOP WALLET
          // This is critical to prevent infinite free ads
          if (clickCount > 0 && totalCost > 0 && campaign.shopId) {
            ops.push(prisma.shop.update({
              where: { id: campaign.shopId },
              data: { adWalletBalance: { decrement: totalCost } }
            }));
          }
        }

        // Write daily rollup for trend data (upsert so it's idempotent)
        if (impCount > 0 || clickCount > 0 || viewCount > 0 || cartAddCount > 0 || convCount > 0 || uniqueReachCount > 0) {
          const clickCost = totalCost;

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
              views: { increment: viewCount },
              cartAdds: { increment: cartAddCount },
              conversions: { increment: convCount },
              revenue: { increment: revAmount },
              uniqueReach: { increment: uniqueReachCount },
            },
            create: {
              promotedListingId: campaign.id,
              date: today,
              hour: 0,
              impressions: impCount,
              clicks: clickCount,
              spend: clickCost,
              views: viewCount,
              cartAdds: cartAddCount,
              conversions: convCount,
              revenue: revAmount,
              uniqueReach: uniqueReachCount,
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
      const safeImpressions = Math.max(campaign.impressions || 0, campaign.clicks || 0);
      const rawCtr = safeImpressions > 0 ? (campaign.clicks / safeImpressions) * 100 : 0;
      const ctr = Math.min(100, Math.max(0, rawCtr));
      const budgetRemaining = Math.max(0, campaign.budget - campaign.spent);
      const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0;
      const isDeletedProduct = !campaign.product.isActive;
      const isLive = !isDeletedProduct && isCampaignLive(campaign);
      
      // Only return real DB keyword stats — never fabricate dummy fallback keywords
      const topKeywords = (campaign.keywordStats || [])
        .sort((a, b) => b.impressions - a.impressions)
        .map(kw => ({ keyword: kw.keyword, impressions: kw.impressions, clicks: kw.clicks }));

      const cpa = campaign.conversions ? campaign.spent / campaign.conversions : 0;
      const cvr = campaign.clicks ? (campaign.conversions || 0) / campaign.clicks * 100 : 0;
      const aov = campaign.conversions ? (campaign.revenue || 0) / campaign.conversions : 0;
      const cpm = campaign.impressions ? (campaign.spent / campaign.impressions) * 1000 : 0;
      const reach = campaign.uniqueReach || 0;
      const frequency = reach > 0 ? campaign.impressions / reach : 0;

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
        views: campaign.views || 0,
        cartAdds: campaign.cartAdds || 0,
        impressions: campaign.impressions,
        reach,
        frequency: Number(frequency.toFixed(2)),
        searchAppearances: campaign.impressions,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        cpa: Number(cpa.toFixed(2)),
        cvr: Number(cvr.toFixed(2)),
        aov: Number(aov.toFixed(2)),
        cpm: Number(cpm.toFixed(2)),
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
        totalReach: (acc.totalReach || 0) + (campaign.reach || 0),
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
        totalReach: 0,
      }
    );

    const overallCtr = totals.totalImpressions > 0
      ? (totals.totalClicks / totals.totalImpressions) * 100
      : 0;

    const overallCpa = totals.totalConversions > 0 ? totals.totalSpent / totals.totalConversions : 0;
    const overallCvr = totals.totalClicks > 0 ? (totals.totalConversions / totals.totalClicks) * 100 : 0;
    const overallAov = totals.totalConversions > 0 ? totals.totalRevenue / totals.totalConversions : 0;
    const overallCpm = totals.totalImpressions > 0 ? (totals.totalSpent / totals.totalImpressions) * 1000 : 0;
    const overallFrequency = totals.totalReach > 0 ? totals.totalImpressions / totals.totalReach : 0;

    const result = {
      summary: {
        ...totals,
        totalSpent: Number(totals.totalSpent.toFixed(2)),
        totalBudget: Number(totals.totalBudget.toFixed(2)),
        overallCtr: Number(overallCtr.toFixed(2)),
        overallCpa: Number(overallCpa.toFixed(2)),
        overallCvr: Number(overallCvr.toFixed(2)),
        overallAov: Number(overallAov.toFixed(2)),
        overallCpm: Number(overallCpm.toFixed(2)),
        overallFrequency: Number(overallFrequency.toFixed(2)),
      },
      campaigns: campaignAnalytics,
    };

    await cacheSet(cacheKey, result, 30);
    return result;
  }

  async renewAdBudget(adId: string, additionalBudget: number, durationDays: number = 30) {
    if (additionalBudget < 100) {
      throw new AppError('Additional budget must be at least ₹100', 400);
    }

    const ad = await prisma.promotedListing.findUnique({ where: { id: adId } });
    if (!ad) throw new AppError('Ad not found', 404);

    const now = new Date();
    const startDate = ad.endDate > now ? ad.endDate : now;

    return prisma.promotedListing.update({
      where: { id: adId },
      data: {
        budget: { increment: additionalBudget },
        isActive: true,
        endDate: new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000),
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
        hour: 0, // Enforced by schema fix to avoid double-counting
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        views: true,
        cartAdds: true,
      },
    });

    // Aggregate by date across all campaigns
    const byDate = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number; views: number; cartAdds: number; }>();
    for (const r of rollups) {
      const key = r.date.toISOString().split('T')[0];
      const existing = byDate.get(key) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, views: 0, cartAdds: 0 };
      byDate.set(key, {
        impressions: existing.impressions + r.impressions,
        clicks: existing.clicks + r.clicks,
        spend: Number((existing.spend + r.spend).toFixed(2)),
        conversions: existing.conversions + r.conversions,
        views: existing.views + (r.views || 0),
        cartAdds: existing.cartAdds + (r.cartAdds || 0),
      });
    }

    return Array.from(byDate.entries()).map(([date, metrics]) => ({ date, ...metrics }));
  }

  async getTrendingProducts(limit: number = 10, query?: string, category?: string, lat?: number, lng?: number, userGender?: string) {
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

    // Audience Targeting: Filter by Gender
    if (userGender && userGender !== 'OTHER') {
      whereClause.OR = [
        { targetGender: 'ALL' },
        { targetGender: userGender }
      ];
    } else {
      // If we don't know the user's gender, or it's OTHER, only show ALL
      whereClause.targetGender = 'ALL';
    }

    // Ensure the seller has a positive wallet balance
    whereClause.shop = {
      adWalletBalance: { gt: 0 }
    };

    if (lat !== undefined && lng !== undefined) {
      const bbox = getBoundingBox(lat, lng, 50); // 50km radius by default for trending
      whereClause.shop = {
        ...whereClause.shop,
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      };
    }

    if (query) {
      whereClause.negativeKeywords = {
        none: { keyword: { equals: query, mode: 'insensitive' } }
      };
    }

    const listings = await prisma.promotedListing.findMany({
      where: whereClause,
      include: {
        product: {
          include: { shop: { select: { id: true, name: true, logo: true, coverImage: true, latitude: true, longitude: true } } },
        },
      },
      take: limit * 5, // Fetch extra for AdRank memory sorting
    });

    const now = new Date().getTime();
    
    const validListings = listings
      .filter((l) => {
        if (l.spent >= l.budget) return false;

        // BUDGET PACING ALGORITHM (Evenly Distributed)
        // We calculate the ideal spend at this precise millisecond.
        const campaignDurationMs = new Date(l.endDate).getTime() - new Date(l.startDate).getTime();
        const elapsedMs = now - new Date(l.startDate).getTime();
        
        if (campaignDurationMs > 0 && elapsedMs > 0) {
          const idealSpend = l.budget * (elapsedMs / campaignDurationMs);
          
          // If we have spent more than the ideal spend, we are over-pacing.
          if (l.spent > idealSpend) {
            // Probabilistic throttle: The more we over-spend, the higher the chance of being hidden.
            // Example: Ideal is 50, spent is 100. Ratio is 50/100 = 0.5. Throttle probability is 50%.
            const throttleProbability = 1 - (idealSpend / l.spent);
            if (Math.random() < throttleProbability) {
              return false; // Skip this ad to let time catch up
            }
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by Ad Rank: Bid * Quality Score
        const rankA = a.bidPerClick * (a.qualityScore || 5);
        const rankB = b.bidPerClick * (b.qualityScore || 5);
        return rankB - rankA;
      })
      .slice(0, limit);

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
