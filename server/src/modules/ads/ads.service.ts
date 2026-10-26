import redis from '../../config/redis';
import prisma from '../../config/database';
import { TargetGender } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheGet, cacheSet } from '../../config/redis';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import { evaluateGeoTarget, bidForObjective, normalizeCity, MAX_TARGET_RADIUS_KM, MIN_DAILY_BUDGET } from './ads.targeting';

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
    _clientBidPerClick: number,
    startDate: Date,
    duration: number,
    targetGender: TargetGender = 'ALL',
    targeting: {
      objective?: 'AWARENESS' | 'TRAFFIC' | 'CONVERSIONS';
      geoMode?: 'RADIUS' | 'CITIES';
      targetRadiusKm?: number;
      targetCities?: string[];
    } = {}
  ) {
    const objective = targeting.objective || 'TRAFFIC';
    const geoMode = targeting.geoMode || 'RADIUS';
    const targetRadiusKm = Math.min(Math.max(targeting.targetRadiusKm ?? 5, 1), MAX_TARGET_RADIUS_KM);
    const targetCities = Array.from(new Set((targeting.targetCities || []).map(normalizeCity).filter(Boolean)));
    // Server decides the bid so the auction cannot be gamed from the client.
    const bidPerClick = bidForObjective(objective);

    if (geoMode === 'CITIES' && targetCities.length === 0) {
      throw new AppError('Select at least one target city.', 400);
    }

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

    if (budgetPerDay < MIN_DAILY_BUDGET) {
      throw new AppError(`Minimum daily budget is ₹${MIN_DAILY_BUDGET}`, 400);
    }

    if (duration < 1) {
      throw new AppError('Duration must be at least 1 day', 400);
    }

    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    const budget = budgetPerDay * duration;

    const campaign = await prisma.$transaction(async (tx) => {
      const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance", id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`;
      if (!lockedShop) throw new AppError('Shop not found', 404);

      if (lockedShop.adWalletBalance < budget) {
        const bypassPayment = process.env.BYPASS_SELLER_PAYMENT === 'true' || process.env.NODE_ENV !== 'production';
        if (!bypassPayment) {
          throw new AppError(`Insufficient ad wallet balance. Need ₹${budget}, have ₹${lockedShop.adWalletBalance}. Please top up your wallet.`, 402);
        }
        const shortage = budget - (lockedShop.adWalletBalance || 0);
        await tx.shop.update({
          where: { id: shopId },
          data: { adWalletBalance: { increment: shortage } }
        });
        lockedShop.adWalletBalance = budget;
      }

      const newBalance = lockedShop.adWalletBalance - budget;
      
      // Deduct budget upfront
      await tx.shop.update({
        where: { id: shopId },
        data: { adWalletBalance: newBalance }
      });

      await tx.sellerAdWalletTransaction.create({
        data: {
          shopId,
          type: 'AD_SPEND_DEBIT',
          amount: budget,
          direction: 'DEBIT',
          balanceAfter: newBalance,
          description: `Upfront budget deduction for ad campaign (Product: ${productId})`,
          referenceType: 'AD_CAMPAIGN',
        }
      });

      const existing = await tx.promotedListing.findFirst({
        where: { 
          productId,
          isActive: true,
          endDate: { gt: new Date() }
        },
      });

      if (existing) {
        throw new AppError('An active ad campaign already exists for this product. Pause or wait for it to expire before creating a new one.', 400);
      }

      return await tx.promotedListing.create({
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
          objective,
          geoMode,
          targetRadiusKm,
          targetCities,
          isActive: true,
        },
        include: {
          product: { select: { id: true, name: true, images: true, price: true } },
          shop: { select: { id: true, name: true, logo: true, coverImage: true } },
        },
      });
    });

    await Promise.all([
      cacheDelete(`shop:${shopId}:ads`),
      cacheDelete(`shop:${shopId}:analytics`),
      cacheDelete(`shop:${shopId}:daily-metrics`),
      cacheDelete(`product:${productId}`),
    ]).catch(() => {});

    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.getIO().to(`shop:${shopId}`).emit('shop:ad-analytics-updated', {
          shopId,
          timestamp: new Date(),
        });
      }
    } catch (_) {}
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
      await cacheSet(cacheKey, adsWithState, 30);
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
    const updated = await prisma.promotedListing.update({
      where: { id: adId },
      data: { isActive: false },
    });

    await Promise.all([
      cacheDelete(`shop:${updated.shopId}:ads`),
      cacheDelete(`shop:${updated.shopId}:analytics`),
      cacheDelete(`shop:${updated.shopId}:daily-metrics`),
      cacheDelete(`product:${updated.productId}`),
    ]).catch(() => {});

    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.getIO().to(`shop:${updated.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: updated.shopId,
          timestamp: new Date(),
        });
      }
    } catch (_) {}

    return updated;
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

    const updated = await prisma.promotedListing.update({
      where: { id: adId },
      data: { isActive: true },
    });

    await Promise.all([
      cacheDelete(`shop:${updated.shopId}:ads`),
      cacheDelete(`shop:${updated.shopId}:analytics`),
      cacheDelete(`shop:${updated.shopId}:daily-metrics`),
      cacheDelete(`product:${updated.productId}`),
    ]).catch(() => {});

    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.getIO().to(`shop:${updated.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: updated.shopId,
          timestamp: new Date(),
        });
      }
    } catch (_) {}

    return updated;
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
    const newImpressionLogs: { promotedListingId: string; deviceId: string }[] = [];

    // FRAUD PROTECTION: Cross-request click deduplication using Redis
    // A legitimate user can only generate 1 meaningful click per campaign per 1-hour window.
    await Promise.all(events.map(async (e) => {
      const deviceId = e.deviceId || (e as any).deviceId || 'device-anon';
      if (e.type === 'impression') {
        impressionsMap.set(e.campaignId, (impressionsMap.get(e.campaignId) || 0) + 1);
        newImpressionLogs.push({ promotedListingId: e.campaignId, deviceId });
      }
      let clickAcquired = false;
      if (e.type === 'click') {
        const clickKey = `adclick:${e.campaignId}:${deviceId}`;
        // SETNX with 1-hour expiration
        const acquired = await redis.set(clickKey, '1', 'EX', 3600, 'NX');
        if (acquired) {
          clickAcquired = true;
          clicksMap.set(e.campaignId, (clicksMap.get(e.campaignId) || 0) + 1);
        }
      }
      if (e.type === 'view') viewsMap.set(e.campaignId, (viewsMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'cart_add') cartAddsMap.set(e.campaignId, (cartAddsMap.get(e.campaignId) || 0) + 1);
      if (e.type === 'conversion') {
        conversionsMap.set(e.campaignId, (conversionsMap.get(e.campaignId) || 0) + 1);
        if (typeof e.productPrice === 'number' && e.productPrice > 0) {
          revenueMap.set(e.campaignId, (revenueMap.get(e.campaignId) || 0) + e.productPrice);
        }
      }
      if (e.keyword && e.keyword.trim().length > 0) {
        const kw = e.keyword.trim().toLowerCase();
        const key = `${e.campaignId}::${kw}`;
        const existing = keywordStatsMap.get(key) || { impressions: 0, clicks: 0 };
        if (e.type === 'impression') existing.impressions += 1;
        if (e.type === 'click' && clickAcquired) existing.clicks += 1;
        keywordStatsMap.set(key, existing);
      }
    }));

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

        const existingSet = new Set(existingLogs.map(l => `${l.promotedListingId}::${l.deviceId}`));
        const newUniqueLogs = newImpressionLogs.filter(log => !existingSet.has(`${log.promotedListingId}::${log.deviceId}`));

        // Deduplicate the new logs array itself so we don't count the same device twice in one batch
        const uniqueToInsert = Array.from(new Set(newUniqueLogs.map(l => `${l.promotedListingId}::${l.deviceId}`)))
          .map(str => {
            const [promotedListingId, deviceId] = str.split('::');
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
        const rawImpCount = impressionsMap.get(campaign.id) || 0;
        const clickCount = clicksMap.get(campaign.id) || 0;
        const impCount = Math.max(rawImpCount, clickCount);
        const viewCount = viewsMap.get(campaign.id) || 0;
        const cartAddCount = cartAddsMap.get(campaign.id) || 0;
        const conversionCount = conversionsMap.get(campaign.id) || 0;
        const revenueAmount = revenueMap.get(campaign.id) || 0;
        const uniqueReachCount = uniqueReachMap.get(campaign.id) || 0;

        if (impCount > 0 || clickCount > 0 || viewCount > 0 || cartAddCount > 0 || conversionCount > 0 || revenueAmount > 0 || uniqueReachCount > 0) {
          try {
            await prisma.$transaction(async (tx) => {
              let lockedSpent = campaign.spent;
              let budget = campaign.budget;
              let isActive = campaign.isActive;

              // Lock the campaign if we are charging clicks to ensure budget limits are strict
              if (clickCount > 0) {
                const [lockedCampaign] = await tx.$queryRaw<any[]>`SELECT spent, budget, "isActive" FROM "PromotedListing" WHERE id = ${campaign.id} FOR UPDATE`;
                if (lockedCampaign) {
                  lockedSpent = lockedCampaign.spent;
                  budget = lockedCampaign.budget;
                  isActive = lockedCampaign.isActive;
                }
              }

              let totalCost = 0;
              if (clickCount > 0 && isActive) {
                // Second-Price Auction Logic
                const competitors = await tx.promotedListing.findMany({
                  where: {
                    isActive: true,
                    id: { not: campaign.id },
                    product: { category: campaign.product?.category }
                  },
                  select: { bidPerClick: true, qualityScore: true }
                });

                const sortedCompetitors = competitors.sort((a, b) => {
                  return (b.bidPerClick * (b.qualityScore || 5)) - (a.bidPerClick * (a.qualityScore || 5));
                });

                let actualCostPerClick = campaign.bidPerClick;
                if (sortedCompetitors.length > 0) {
                  const nextHighestCompetitor = sortedCompetitors[0];
                  const nextHighestAdRank = nextHighestCompetitor.bidPerClick * (nextHighestCompetitor.qualityScore || 5);
                  const priceToBeat = nextHighestAdRank / (campaign.qualityScore || 5);
                  actualCostPerClick = Math.min(campaign.bidPerClick, priceToBeat + 0.1);
                }

                const remaining = budget - lockedSpent;
                const requestedCost = actualCostPerClick * clickCount;
                totalCost = Math.min(requestedCost, remaining > 0 ? remaining : 0);
              }

              const newSpent = lockedSpent + totalCost;
              const shouldDeactivate = newSpent >= budget;

              await tx.promotedListing.update({
                where: { id: campaign.id },
                data: {
                  ...(impCount > 0 && { impressions: { increment: impCount } }),
                  ...(viewCount > 0 && { views: { increment: viewCount } }),
                  ...(cartAddCount > 0 && { cartAdds: { increment: cartAddCount } }),
                  ...(conversionCount > 0 && { conversions: { increment: conversionCount } }),
                  ...(revenueAmount > 0 && { revenue: { increment: revenueAmount } }),
                  ...(uniqueReachCount > 0 && { uniqueReach: { increment: uniqueReachCount } }),
                  ...(clickCount > 0 && {
                    clicks: { increment: clickCount },
                    spent: { increment: totalCost },
                    isActive: shouldDeactivate ? false : isActive
                  })
                }
              });

              await tx.adDailyMetricRollup.upsert({
                where: {
                  promotedListingId_date_hour: {
                    promotedListingId: campaign.id,
                    date: today,
                    hour: 0,
                  }
                },
                update: {
                  impressions: { increment: impCount },
                  clicks: { increment: clickCount },
                  spend: { increment: totalCost },
                  views: { increment: viewCount },
                  cartAdds: { increment: cartAddCount },
                  conversions: { increment: conversionCount },
                  revenue: { increment: revenueAmount },
                  uniqueReach: { increment: uniqueReachCount },
                },
                create: {
                  promotedListingId: campaign.id,
                  date: today,
                  hour: 0,
                  impressions: impCount,
                  clicks: clickCount,
                  spend: totalCost,
                  views: viewCount,
                  cartAdds: cartAddCount,
                  conversions: conversionCount,
                  revenue: revenueAmount,
                  uniqueReach: uniqueReachCount,
                }
              });
            });
          } catch (err) {
            console.error(`Failed to process telemetry for campaign ${campaign.id}:`, err);
          }
        }
      }

      // Add keyword stats upserts
      for (const [key, stats] of keywordStatsMap.entries()) {
        const [campaignId, ...kwParts] = key.split('::');
        const keyword = kwParts.join('::');
        
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
      }

      // Invalidate Redis cache so seller dashboard shows fresh data immediately
      const shopIds = Array.from(new Set(campaigns.map(c => c.shopId)));
      const productIds = Array.from(new Set(campaigns.map(c => c.productId)));

      await Promise.all([
        ...shopIds.flatMap(id => [
          cacheDelete(`shop:${id}:ads`),
          cacheDelete(`shop:${id}:analytics`),
          cacheDelete(`shop:${id}:daily-metrics`),
        ]),
        ...productIds.map(pid => redis.del(`product:${pid}`)),
      ]).catch(() => {});

      // Broadcast real-time ad analytics update to active seller screens
      try {
        const { orderSocket } = require('../../app');
        if (orderSocket) {
          shopIds.forEach(id => {
            orderSocket.getIO().to(`shop:${id}`).emit('shop:ad-analytics-updated', {
              shopId: id,
              timestamp: new Date(),
            });
          });
        }
      } catch (_) {}

      // Telemetry processing completed
        
        // Invalidate Redis cache so seller dashboard shows fresh data
        // Duplicate removed
        // removed
          // cacheDelete 1
          // cacheDelete 2
        // end removed

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
        roas: campaign.spent > 0 ? Number(((campaign.revenue || 0) / campaign.spent).toFixed(2)) : 0,
        isActive: campaign.isActive,
        isLive,
        isDeletedProduct,
        state: isLive ? 'LIVE' : 'HISTORY',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        objective: campaign.objective,
        geoMode: campaign.geoMode,
        targetRadiusKm: campaign.targetRadiusKm,
        targetCities: campaign.targetCities,
        targetGender: campaign.targetGender,
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

    const overallCpc = totals.totalClicks > 0 ? totals.totalSpent / totals.totalClicks : 0;
    const overallRoas = totals.totalSpent > 0 ? totals.totalRevenue / totals.totalSpent : 0;
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
        overallCpc: Number(overallCpc.toFixed(2)),
        overallRoas: Number(overallRoas.toFixed(2)),
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

    const updated = await prisma.$transaction(async (tx) => {
      const ad = await tx.promotedListing.findUnique({ 
        where: { id: adId },
        include: { shop: true }
      });
      if (!ad) throw new AppError('Ad not found', 404);

      const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance", id FROM "Shop" WHERE id = ${ad.shopId} FOR UPDATE`;
      if (!lockedShop) throw new AppError('Shop not found', 404);

      if (lockedShop.adWalletBalance < additionalBudget) {
        const bypassPayment = process.env.BYPASS_SELLER_PAYMENT === 'true' || process.env.NODE_ENV !== 'production';
        if (!bypassPayment) {
          throw new AppError(`Insufficient ad wallet balance. Need ₹${additionalBudget}, have ₹${lockedShop.adWalletBalance}. Please top up your wallet.`, 402);
        }
        const shortage = additionalBudget - (lockedShop.adWalletBalance || 0);
        await tx.shop.update({
          where: { id: ad.shopId },
          data: { adWalletBalance: { increment: shortage } }
        });
        lockedShop.adWalletBalance = additionalBudget;
      }

      const newBalance = lockedShop.adWalletBalance - additionalBudget;

      await tx.shop.update({
        where: { id: ad.shopId },
        data: { adWalletBalance: newBalance }
      });

      await tx.sellerAdWalletTransaction.create({
        data: {
          shopId: ad.shopId,
          type: 'AD_SPEND_DEBIT',
          amount: additionalBudget,
          direction: 'DEBIT',
          balanceAfter: newBalance,
          description: `Upfront budget renewal for ad campaign (Ad: ${ad.id})`,
          referenceType: 'AD_CAMPAIGN',
        }
      });

      const now = new Date();
      const startDate = ad.endDate > now ? ad.endDate : now;

      return tx.promotedListing.update({
        where: { id: adId },
        data: {
          budget: { increment: additionalBudget },
          isActive: true,
          endDate: new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000),
        },
      });
    });

    await Promise.all([
      cacheDelete(`shop:${updated.shopId}:ads`),
      cacheDelete(`shop:${updated.shopId}:analytics`),
      cacheDelete(`shop:${updated.shopId}:daily-metrics`),
      cacheDelete(`product:${updated.productId}`),
    ]).catch(() => {});

    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.getIO().to(`shop:${updated.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: updated.shopId,
          timestamp: new Date(),
        });
      }
    } catch (_) {}

    return updated;
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
        promotedListingId: true,
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
    const campaignRollupTotals = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number; views: number; cartAdds: number; }>();

    for (const r of rollups) {
      const campId = r.promotedListingId;
      if (campId) {
        const prev = campaignRollupTotals.get(campId) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, views: 0, cartAdds: 0 };
        campaignRollupTotals.set(campId, {
          impressions: prev.impressions + r.impressions,
          clicks: prev.clicks + r.clicks,
          spend: prev.spend + r.spend,
          conversions: prev.conversions + r.conversions,
          views: prev.views + (r.views || 0),
          cartAdds: prev.cartAdds + (r.cartAdds || 0),
        });
      }

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

    // Include recent campaigns whose metrics have not yet been rolled up
    const campaigns = await prisma.promotedListing.findMany({
      where: {
        shopId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        createdAt: true,
        startDate: true,
        impressions: true,
        clicks: true,
        spent: true,
        conversions: true,
        views: true,
        cartAdds: true,
      },
    });

    for (const c of campaigns) {
      const rolled = campaignRollupTotals.get(c.id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, views: 0, cartAdds: 0 };
      const unrolledImpr = Math.max(0, c.impressions - rolled.impressions);
      const unrolledClicks = Math.max(0, c.clicks - rolled.clicks);
      const unrolledSpend = Math.max(0, Number((c.spent - rolled.spend).toFixed(2)));
      const unrolledConv = Math.max(0, c.conversions - rolled.conversions);
      const unrolledViews = Math.max(0, (c.views || 0) - rolled.views);
      const unrolledCartAdds = Math.max(0, (c.cartAdds || 0) - rolled.cartAdds);

      if (unrolledImpr > 0 || unrolledClicks > 0 || unrolledSpend > 0 || unrolledConv > 0) {
        const campaignDate = c.startDate || c.createdAt;
        const key = campaignDate.toISOString().split('T')[0];
        const existing = byDate.get(key) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, views: 0, cartAdds: 0 };
        byDate.set(key, {
          impressions: existing.impressions + unrolledImpr,
          clicks: existing.clicks + unrolledClicks,
          spend: Number((existing.spend + unrolledSpend).toFixed(2)),
          conversions: existing.conversions + unrolledConv,
          views: existing.views + unrolledViews,
          cartAdds: existing.cartAdds + unrolledCartAdds,
        });
      }
    }

    return Array.from(byDate.entries()).map(([date, metrics]) => ({ date, ...metrics }));
  }

  async serveAds(params: {
    limit: number;
    query?: string;
    keywords?: string[];
    category?: string;
    lat?: number;
    lng?: number;
    city?: string | null;
    userId?: string;
    userGender?: string;
  }) {
    const { limit = 10, query, keywords, category, lat, lng, city, userId, userGender } = params;
    
    if (lat === undefined || lng === undefined) {
      return [];
    }

    const whereClause: any = {
      isActive: true,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    };

    const productQuery: any = { isActive: true };
    if (category && category !== 'all') productQuery.category = category;
    
    const searchTerms = [];
    if (query) searchTerms.push(...query.split(' ').filter(k => k.trim().length > 0));
    if (keywords && keywords.length > 0) searchTerms.push(...keywords);
    
    if (searchTerms.length > 0) {
      productQuery.OR = searchTerms.map(kw => ({
        OR: [
          { name: { contains: kw, mode: 'insensitive' } },
          { description: { contains: kw, mode: 'insensitive' } },
          { category: { contains: kw, mode: 'insensitive' } }
        ]
      }));
    }
    
    if (query) {
      whereClause.negativeKeywords = {
        none: { keyword: { equals: query, mode: 'insensitive' } }
      };
    }
    
    whereClause.product = productQuery;

    if (userGender && userGender !== 'OTHER') {
      whereClause.OR = [
        { targetGender: 'ALL' },
        { targetGender: userGender }
      ];
    } else {
      whereClause.targetGender = 'ALL';
    }

    whereClause.shop = {};
    // Coarse prefilter only (widest allowed campaign radius). Exact radius/city targeting
    // is evaluated per-campaign below.
    const bbox = getBoundingBox(lat, lng, MAX_TARGET_RADIUS_KM);
    whereClause.shop = {
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };

    const listings = await prisma.promotedListing.findMany({
      where: whereClause,
      include: {
        product: {
          include: { shop: { select: { id: true, name: true, logo: true, coverImage: true, latitude: true, longitude: true, city: true } } },
        },
      },
      take: Math.max(limit * 20, 100),
    });

    const now = new Date().getTime();
    const buyer = { lat, lng, city };

    // Buyer intent signals, fetched when a CONVERSIONS campaign is in the candidate set.
    let intent: { categories: Set<string>; shopIds: Set<string>; productIds: Set<string>; searchKeywords: Set<string> } | null = null;
    if (userId && listings.some((l) => l.objective === 'CONVERSIONS')) {
      const cacheKey = `buyer:intent:${userId}`;
      const cached = await cacheGet(cacheKey) as { categories: string[]; shopIds: string[]; productIds: string[]; searchKeywords: string[] } | null;
      let raw = cached;
      if (!raw) {
        const [cartItems, wishlist, orders, searchHistory] = await Promise.all([
          prisma.cartItem.findMany({ where: { userId }, select: { product: { select: { id: true, category: true, shopId: true } } }, take: 50 }),
          prisma.wishlist.findMany({ where: { userId }, select: { product: { select: { id: true, category: true, shopId: true } } }, take: 50 }),
          prisma.order.findMany({ where: { userId }, select: { shopId: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
          prisma.userSearchHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { keyword: true } }),
        ]);
        const prods = [...cartItems, ...wishlist].map((r) => r.product).filter(Boolean);
        raw = {
          categories: Array.from(new Set(prods.map((p) => p.category))),
          shopIds: Array.from(new Set([...prods.map((p) => p.shopId), ...orders.map((o) => o.shopId)])),
          productIds: Array.from(new Set(prods.map((p) => p.id))),
          searchKeywords: Array.from(new Set((searchHistory || []).map((s: any) => s.keyword?.toLowerCase().trim()).filter(Boolean))),
        };
        await cacheSet(cacheKey, raw, 300);
      }
      intent = {
        categories: new Set(raw.categories),
        shopIds: new Set(raw.shopIds),
        productIds: new Set(raw.productIds),
        searchKeywords: new Set(raw.searchKeywords || []),
      };
    }

    const validListings = listings
      .map((l) => {
        const geo = evaluateGeoTarget(l as any, l.product.shop as any, buyer);
        return { l, geo };
      })
      .filter(({ l, geo }) => {
        if (!geo.eligible) return false;
        if (l.spent >= l.budget) return false;

        const campaignDurationMs = new Date(l.endDate).getTime() - new Date(l.startDate).getTime();
        const elapsedMs = now - new Date(l.startDate).getTime();

        if (campaignDurationMs <= 0 || elapsedMs <= 0) return true; // Failsafe

        const idealSpendRatio = elapsedMs / campaignDurationMs;
        const actualSpendRatio = l.spent / l.budget;

        // Deterministic pacing (cut off if spent > 150% of ideal)
        if (actualSpendRatio > idealSpendRatio * 1.5) return false;
        return true;
      })
      .map(({ l, geo }) => {
        const adRank = l.bidPerClick * (l.qualityScore || 5);
        const radius = l.geoMode === 'RADIUS' ? Math.max(l.targetRadiusKm || 5, 1) : 50;
        const proximity = geo.distanceKm === null ? 0 : Math.max(0, 1 - geo.distanceKm / radius);

        const campaignDurationMs = Math.max(new Date(l.endDate).getTime() - new Date(l.startDate).getTime(), 1);
        const idealSpendRatio = Math.min(1, Math.max(0, (now - new Date(l.startDate).getTime()) / campaignDurationMs));
        const actualSpendRatio = l.budget > 0 ? l.spent / l.budget : 1;
        const underDelivery = Math.max(0, idealSpendRatio - actualSpendRatio);
        // Laplace-smoothed CTR so brand new campaigns are not penalised or over-rewarded.
        const smoothedCtr = (l.clicks + 1) / (l.impressions + 20);

        let finalScore: number;
        switch (l.objective) {
          case 'AWARENESS':
            // Maximise distribution: ignore proximity, push campaigns that are behind schedule.
            finalScore = adRank + underDelivery * 10 + 2;
            break;
          case 'CONVERSIONS': {
            const matchesSearch = !!intent && Array.from(intent.searchKeywords).some((kw: string) => {
              const nameMatch = l.product.name ? l.product.name.toLowerCase().includes(kw) : false;
              const catMatch = l.product.category ? l.product.category.toLowerCase().includes(kw) : false;
              return nameMatch || catMatch;
            });
            const hasIntent = !!intent && (
              intent.productIds.has(l.productId) ||
              intent.shopIds.has(l.shopId) ||
              intent.categories.has(l.product.category) ||
              matchesSearch
            );
            finalScore = adRank * (hasIntent ? 1.5 : 0.6) + proximity * 5;
            break;
          }
          case 'TRAFFIC':
          default:
            finalScore = adRank * (1 + smoothedCtr * 5) + proximity * 5;
            break;
        }
        return { ...l, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    return validListings.map(({ finalScore, ...rest }) => rest);
  }

}

export default new AdsService();