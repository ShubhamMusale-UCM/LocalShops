import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheGet, cacheSet } from '../../config/redis';

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
    _bidPerClick: number,
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
          startDate,
          endDate,
          isActive: true,
          impressions: 0,
          clicks: 0,
        },
        include: {
          product: { select: { id: true, name: true, images: true, price: true } },
          shop: { select: { id: true, name: true } },
        },
      });
    } else {
      campaign = await prisma.promotedListing.create({
        data: {
          shopId,
          productId,
          budget,
          spent: 0,
          impressions: 0,
          clicks: 0,
          startDate,
          endDate,
          isActive: true,
        },
        include: {
          product: { select: { id: true, name: true, images: true, price: true } },
          shop: { select: { id: true, name: true } },
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

    return prisma.promotedListing.update({
      where: { id: adId },
      data: {
        clicks: { increment: 1 },
        spent: { increment: estimatedCostPerClick },
      },
    });
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

  async getShopPromotionAnalytics(shopId: string) {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const campaignAnalytics = campaigns.map((campaign) => {
      const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
      const budgetRemaining = Math.max(0, campaign.budget - campaign.spent);
      const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0;
      const isDeletedProduct = !campaign.product.isActive;
      const isLive = !isDeletedProduct && isCampaignLive(campaign);
      const topKeywords = [campaign.product.name, campaign.product.category, ...(campaign.product.tags || [])]
        .flatMap((raw) => String(raw || '').toLowerCase().split(/\s+/))
        .map((word) => word.trim())
        .filter((word) => word.length > 2)
        .slice(0, 8);

      return {
        id: campaign.id,
        productId: campaign.productId,
        productName: campaign.product.name,
        productImage: campaign.product.images?.[0] || null,
        budget: campaign.budget,
        spent: campaign.spent,
        clicks: campaign.clicks,
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
        totalSpent: acc.totalSpent + campaign.spent,
        totalBudget: acc.totalBudget + campaign.budget,
      }),
      {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalSearchAppearances: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalSpent: 0,
        totalBudget: 0,
      }
    );

    const overallCtr = totals.totalImpressions > 0
      ? (totals.totalClicks / totals.totalImpressions) * 100
      : 0;

    return {
      summary: {
        ...totals,
        totalSpent: Number(totals.totalSpent.toFixed(2)),
        totalBudget: Number(totals.totalBudget.toFixed(2)),
        overallCtr: Number(overallCtr.toFixed(2)),
      },
      campaigns: campaignAnalytics,
    };
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

  async getTrendingProducts(limit: number = 10) {
    const listings = await prisma.promotedListing.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        product: { is: { isActive: true } },
      },
      include: {
        product: {
          include: { shop: { select: { id: true, name: true } } },
        },
      },
      orderBy: [
        { clicks: 'desc' },
        { impressions: 'desc' },
      ],
      take: limit,
    });

    return listings.map((listing) => ({
      ...listing.product,
      isSponsored: true,
      sponsoredListingId: listing.id,
    }));
  }
}

export default new AdsService();
