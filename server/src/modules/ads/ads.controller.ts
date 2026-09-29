import { Request, Response, NextFunction } from 'express';
import adsService from './ads.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';
import prisma from '../../config/database';
import { createRazorpayOrder, verifyPaymentSignature } from '../../config/razorpay';
import { nanoid } from 'nanoid';

export const AdsController = {
  /**
   * Create sponsored listing
   */
  createAd: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId, shopId, budgetPerDay, bidPerClick, duration, targetGender = 'ALL' } = req.body;

      if (!productId || !shopId || !budgetPerDay || !bidPerClick || !duration) {
        throw new AppError('Missing required fields', 400);
      }

      // Verify shop ownership
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (shop?.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const totalBudget = Number(budgetPerDay) * Number(duration);
      if (shop.adWalletBalance < 100) {
        throw new AppError(`Insufficient ad wallet balance to start campaign. Need at least ₹100, have ₹${shop.adWalletBalance}`, 402);
      }

      const ad = await adsService.createSponsoredListing(
        shopId,
        productId,
        Number(budgetPerDay),
        Number(bidPerClick),
        new Date(),
        Number(duration),
        targetGender
      );

      res.status(201).json({
        status: 'success',
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get shop's ads
   */
  getShopAds: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId } = req.params;

      // Verify shop ownership
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (shop?.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const ads = await adsService.getShopAds(shopId);

      res.json({
        status: 'success',
        data: ads,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get aggregated promotion analytics for seller shop
   */
  getShopPromotionAnalytics: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId } = req.params;

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (shop?.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const analytics = await adsService.getShopPromotionAnalytics(shopId);

      res.json({
        status: 'success',
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get daily trend metrics for a shop (for chart rendering)
   */
  getShopDailyMetrics: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId } = req.params;
      const days = parseInt((req.query.days as string) || '14');

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (shop?.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const metrics = await adsService.getShopDailyMetrics(shopId, days);

      res.json({
        status: 'success',
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get ad analytics
   */
  getAdAnalytics: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { adId } = req.params;

      const analytics = await adsService.getAdAnalytics(adId);

      // Verify ownership
      if (analytics.ad.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      res.json({
        status: 'success',
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Pause ad
   */
  pauseAd: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const ad = await adsService.pauseAd(adId);

      res.json({
        status: 'success',
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resume ad
   */
  resumeAd: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const ad = await adsService.resumeAd(adId);

      res.json({
        status: 'success',
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Renew ad budget
   */
  renewBudget: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;
      const { additionalBudget, durationDays } = req.body;

      if (!additionalBudget) {
        throw new AppError('Additional budget required', 400);
      }

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      if (existing.shop.adWalletBalance < 100) {
        throw new AppError(`Insufficient ad wallet balance to renew campaign. Need at least ₹100, have ₹${existing.shop.adWalletBalance}`, 402);
      }

      const ad = await adsService.renewAdBudget(adId, additionalBudget, durationDays);

      res.json({
        status: 'success',
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get personalized ads
   */
  getPersonalizedAds: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { limit = 10, lat, lng } = req.query;
      const user = req.user as any;
      const parsedLimit = parseInt(limit as string);
      const parsedLat = lat ? parseFloat(lat as string) : undefined;
      const parsedLng = lng ? parseFloat(lng as string) : undefined;

      let products;
      if (!user) {
        products = await adsService.getTrendingProducts(
          parsedLimit, undefined, undefined, parsedLat, parsedLng
        );
      } else {
        products = await adsService.getPersonalizedAds(
          user.id, parsedLimit, parsedLat, parsedLng, user?.gender
        );
      }

      res.json({
        status: 'success',
        data: products,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get trending products
   */
  getTrendingProducts: async (
    req: any,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { limit = 10, q, category, lat, lng } = req.query;

      const products = await adsService.getTrendingProducts(
        parseInt(limit as string), 
        q as string, 
        category as string,
        lat ? parseFloat(lat as string) : undefined,
        lng ? parseFloat(lng as string) : undefined,
        req.user?.gender
      );

      res.json({
        status: 'success',
        data: products,
      });
    } catch (error) {
      next(error);
    }
  },



  /**
   * Track sponsored impressions from buyer UI (fire and forget)
   */
  trackImpressions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { adIds } = req.body;
      
      if (!Array.isArray(adIds)) {
        res.status(400).json({ status: 'error', message: 'adIds must be an array' });
        return;
      }

      // Execute asynchronously to not block the client
      adsService.trackAdImpressions(adIds);

      res.json({
        status: 'success',
        message: 'Impressions tracking queued',
      });
    } catch (error) {
      next(error);
    }
  },
  /**
   * Process batched ad telemetry (impressions, clicks)
   */
  processBatchTelemetry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events)) {
        res.status(400).json({ status: 'error', message: 'events must be an array' });
        return;
      }
      
      // Fire and forget
      adsService.processBatchTelemetry(events).catch(err => {
        console.error('Failed to process batch telemetry:', err);
      });

      res.status(202).json({
        status: 'success',
        message: 'Batch telemetry accepted',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get negative keywords
   */
  getNegativeKeywords: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const keywords = await prisma.negativeKeyword.findMany({
        where: { promotedListingId: adId },
      });

      res.json({ status: 'success', data: keywords });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add negative keyword
   */
  addNegativeKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;
      const { keyword } = req.body;

      if (!keyword) throw new AppError('Keyword required', 400);

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const added = await prisma.negativeKeyword.create({
        data: {
          promotedListingId: adId,
          keyword: keyword.trim().toLowerCase(),
        }
      });

      res.json({ status: 'success', data: added });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove negative keyword
   */
  removeNegativeKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { adId, keywordId } = req.params;

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      await prisma.negativeKeyword.delete({
        where: { id: keywordId, promotedListingId: adId },
      });

      res.json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  },

  topUpWallet: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { amount, shopId } = req.body;
      if (!amount || amount < 100) throw new AppError('Minimum top-up amount is ₹100', 400);

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new AppError('Shop not found', 404);
      if (shop.ownerId !== req.user?.id) throw new AppError('Unauthorized', 403);

      const receipt = `TOPUP_${nanoid(8)}`;
      const order = await createRazorpayOrder(amount, receipt, { shopId });

      res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (error) {
      next(error);
    }
  },

  verifyTopUpWallet: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shopId, amount } = req.body;

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new AppError('Shop not found', 404);
      if (shop.ownerId !== req.user?.id) throw new AppError('Unauthorized', 403);

      const SKIP_PAYMENT_VERIFICATION = process.env.NODE_ENV !== 'production' && process.env.SKIP_PAYMENT_VERIFICATION === 'true';

      if (!SKIP_PAYMENT_VERIFICATION) {
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) throw new AppError('Invalid payment signature', 400);
      }

      const updatedShop = await prisma.shop.update({
        where: { id: shopId },
        data: { adWalletBalance: { increment: amount } }
      });

      res.status(200).json({
        success: true,
        message: 'Wallet topped up successfully',
        newBalance: updatedShop.adWalletBalance,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default AdsController;
