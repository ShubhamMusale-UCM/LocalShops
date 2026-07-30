import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheSet, cacheGet, cacheDelete } from '../../config/redis';
import { SubscriptionPlan } from '@prisma/client';

export class SubscriptionService {
  /**
   * Get all available subscription plans
   */
  async getPlans() {
    const plans = [
      {
        id: 'free',
        name: 'FREE',
        price: 0,
        billingCycle: 'monthly',
        features: [
          'List up to 10 products',
          'Basic shop profile',
          'No promotions',
          'Email support',
        ],
        maxProducts: 10,
        maxPromotedListings: 0,
      },
      {
        id: 'starter',
        name: 'STARTER',
        price: 499,
        billingCycle: 'monthly',
        features: [
          'List up to 50 products',
          'Basic analytics',
          '1 promoted listing/month',
          'Priority email support',
        ],
        maxProducts: 50,
        maxPromotedListings: 1,
      },
      {
        id: 'professional',
        name: 'PROFESSIONAL',
        price: 1999,
        billingCycle: 'monthly',
        features: [
          'Unlimited products',
          'Advanced analytics',
          '5 promoted listings/month',
          'Support + marketing tools',
          'AI-powered product suggestions',
        ],
        maxProducts: 999,
        maxPromotedListings: 5,
      },
      {
        id: 'premium',
        name: 'PREMIUM',
        price: 4999,
        billingCycle: 'monthly',
        features: [
          'Unlimited everything',
          'Premium analytics',
          'Unlimited promoted listings',
          'Priority 24/7 support',
          'Dedicated account manager',
          'Delivery partner access',
          'White-label options',
        ],
        maxProducts: 9999,
        maxPromotedListings: 9999,
      },
    ];

    return plans;
  }

  /**
   * Create subscription for a seller
   */
  async createSubscription(userId: string, planId: string) {
    const plans = await this.getPlans();
    const plan = plans.find((p) => p.id === planId);

    if (!plan) throw new AppError('Plan not found', 404);

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId, isActive: true },
      select: { id: true },
    });

    if (!shop) {
      throw new AppError('No active shop found for this seller', 400);
    }

    await prisma.subscription.updateMany({
      where: { shopId: shop.id, isActive: true },
      data: { isActive: false },
    });

    const subscription = await prisma.subscription.create({
      data: {
        shopId: shop.id,
        plan: plan.name as SubscriptionPlan,
        amount: plan.price,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
      },
    });

    await cacheDelete(`user:${userId}:subscription`);

    return subscription;
  }

  /**
   * Renew subscription
   */
  async renewSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) throw new AppError('Subscription not found', 404);

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    return updated;
  }

  /**
   * Get user's active subscription
   */
  async getUserSubscription(userId: string) {
    const shops = await prisma.shop.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const shopIds = shops.map((shop) => shop.id);
    if (!shopIds.length) {
      return null;
    }

    return await prisma.subscription.findFirst({
      where: { shopId: { in: shopIds }, isActive: true },
      orderBy: { endDate: 'desc' },
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });

    return updated;
  }

  /**
   * Get subscription usage
   */
  async getSubscriptionUsage(userId: string) {
    const [subscription, productCount, promotedCount] = await Promise.all([
      this.getUserSubscription(userId),
      prisma.product.count({ where: { shop: { ownerId: userId } } }),
      prisma.promotedListing.count({
        where: { shop: { ownerId: userId }, isActive: true },
      }),
    ]);

    const plan = (await this.getPlans()).find(
      (p) => p.name === subscription?.plan
    );

    return {
      subscription,
      productCount,
      promotedCount,
      limits: {
        maxProducts: plan?.maxProducts || 10,
        maxPromotedListings: plan?.maxPromotedListings || 0,
      },
      usage: {
        productsPercent: (productCount / (plan?.maxProducts || 10)) * 100,
        promotedPercent: (promotedCount / (plan?.maxPromotedListings || 1)) * 100,
      },
    };
  }
}

export default new SubscriptionService();
