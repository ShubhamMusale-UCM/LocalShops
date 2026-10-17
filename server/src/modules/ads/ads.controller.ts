import { Request, Response, NextFunction } from 'express';
import adsService from './ads.service';
import walletService from '../wallet/wallet.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';
import { bidForObjective, MAX_TARGET_RADIUS_KM, MIN_DAILY_BUDGET } from './ads.targeting';
import prisma from '../../config/database';
import { createRazorpayOrder, verifyPaymentSignature } from '../../config/razorpay';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const AdsController = {
  /**
   * Create sponsored listing
   */
  createAd: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        productId: z.string().min(1),
        shopId: z.string().min(1),
        budgetPerDay: z.number().positive().min(MIN_DAILY_BUDGET).max(1000000), // Min 200 rupees, Max 1M
        bidPerClick: z.number().positive().min(1).max(100).optional(), // Ignored: bid is set server-side per objective
        duration: z.number().int().positive().min(1).max(365), // Max 1 year
        targetGender: z.enum(['ALL', 'MALE', 'FEMALE']).default('ALL'),
        objective: z.enum(['AWARENESS', 'TRAFFIC', 'CONVERSIONS']).default('TRAFFIC'),
        geoMode: z.enum(['RADIUS', 'CITIES']).default('RADIUS'),
        targetRadiusKm: z.number().min(1).max(MAX_TARGET_RADIUS_KM).optional(),
        targetCities: z.array(z.string().trim().min(2).max(50)).max(10).optional(),
        razorpay_order_id: z.string().optional(),
        razorpay_payment_id: z.string().optional(),
        razorpay_signature: z.string().optional(),
      }).superRefine((val, ctx) => {
        if (val.geoMode === 'RADIUS' && val.targetRadiusKm === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetRadiusKm'], message: 'targetRadiusKm is required for RADIUS targeting' });
        }
        if (val.geoMode === 'CITIES' && (!val.targetCities || val.targetCities.length === 0)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetCities'], message: 'At least one city is required for CITIES targeting' });
        }
      });

      const validated = schema.parse(req.body);
      const { productId, shopId, budgetPerDay, duration, targetGender, objective, geoMode, targetRadiusKm, targetCities, razorpay_order_id, razorpay_payment_id, razorpay_signature } = validated;
      const bidPerClick = bidForObjective(objective);

      if (bidPerClick > budgetPerDay) {
        throw new AppError('Bid per click cannot be greater than budget per day', 400);
      }

      // Verify shop ownership
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (shop?.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
      }

      const totalBudget = Number(budgetPerDay) * Number(duration);

      // --- SPLIT PAYMENT LOGIC ---
      const split = await walletService.calculateAdPaymentSplit(shopId, totalBudget);

      const bypassSellerPayment = process.env.BYPASS_SELLER_PAYMENT === 'true' || process.env.NODE_ENV !== 'production';
      if (!split.isFullWalletPayment && !bypassSellerPayment) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          throw new AppError(`Insufficient wallet balance. Need ₹${totalBudget}, have ₹${split.walletBalance}. Please provide Razorpay payment details for the remaining ₹${split.razorpayAmount}.`, 402);
        }

        const SKIP_PAYMENT_VERIFICATION = process.env.NODE_ENV !== 'production' && process.env.SKIP_PAYMENT_VERIFICATION === 'true';
        if (!SKIP_PAYMENT_VERIFICATION) {
          const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
          if (!isValid) throw new AppError('Invalid payment signature', 400);
        }

        // Auto-top-up the wallet with the Razorpay amount so the creation can succeed
        // Using walletService provides idempotency (replay protection) via razorpay_payment_id
        await walletService.creditSellerAdWallet(
          shopId,
          split.razorpayAmount,
          `Ad payment split top-up (Razorpay ID: ${razorpay_payment_id})`,
          razorpay_payment_id,
          'AD_CAMPAIGN'
        );
      }
      // ---------------------------

      const ad = await adsService.createSponsoredListing(
        shopId,
        productId,
        Number(budgetPerDay),
        Number(bidPerClick),
        new Date(),
        Number(duration),
        targetGender,
        { objective, geoMode, targetRadiusKm, targetCities }
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
      const daysStr = req.query.days as string;
      const days = daysStr ? z.number().int().positive().max(90).parse(parseInt(daysStr)) : 14;

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
      const schema = z.object({
        additionalBudget: z.number().positive().min(100).max(1000000),
        durationDays: z.number().int().positive().min(1).max(365).default(30)
      });
      const { additionalBudget, durationDays } = schema.parse(req.body);

      const existing = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });
      if (!existing || existing.shop.ownerId !== req.user!.id) {
        throw new AppError('Unauthorized', 403);
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
      const { limit = 10, lat, lng, city } = req.query;
      const user = req.user as any;
      const parsedLimit = parseInt(limit as string);
      const parsedLat = lat ? parseFloat(lat as string) : undefined;
      const parsedLng = lng ? parseFloat(lng as string) : undefined;
      const buyerCity = (city as string) || user?.city || undefined;

      let products;
      if (!user) {
        products = await adsService.serveAds({
          limit: parsedLimit,
          lat: parsedLat,
          lng: parsedLng,
          city: buyerCity
        });
      } else {
        
        const recentSearches = await prisma.userSearchHistory.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { keyword: true }
        });
        const keywords = recentSearches.map((s: any) => s.keyword);

        products = await adsService.serveAds({
          limit: parsedLimit,
          keywords: keywords,
          lat: parsedLat,
          lng: parsedLng,
          city: buyerCity,
          userId: user.id,
          userGender: user?.gender
        });
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
      const { limit = 10, q, category, lat, lng, city } = req.query;
      const user = req.user as any;

      let keywords: string[] | undefined;
      if (user?.id && !q) {
        const recentSearches = await prisma.userSearchHistory.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { keyword: true }
        });
        keywords = recentSearches.map((s: any) => s.keyword).filter(Boolean);
      }

      const products = await adsService.serveAds({
        limit: parseInt(limit as string), 
        query: q as string, 
        keywords: keywords,
        category: category as string,
        lat: lat ? parseFloat(lat as string) : undefined,
        lng: lng ? parseFloat(lng as string) : undefined,
        city: (city as string) || user?.city || undefined,
        userId: user?.id,
        userGender: user?.gender,
      });

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
      let order: any;
      try {
        order = await createRazorpayOrder(amount, receipt, { shopId });
      } catch (orderErr) {
        if (process.env.BYPASS_SELLER_PAYMENT === 'true' || process.env.NODE_ENV !== 'production') {
          order = {
            id: `order_mock_${nanoid(10)}`,
            amount: Math.round(amount * 100),
            currency: 'INR',
          };
        } else {
          throw orderErr;
        }
      }

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

      const SKIP_PAYMENT_VERIFICATION =
        process.env.BYPASS_SELLER_PAYMENT === 'true' ||
        process.env.SKIP_PAYMENT_VERIFICATION === 'true' ||
        process.env.NODE_ENV !== 'production';

      if (!SKIP_PAYMENT_VERIFICATION) {
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) throw new AppError('Invalid payment signature', 400);
      }

      
      const { shop: updatedShop } = await walletService.creditSellerAdWallet(
        shopId,
        amount,
        `Wallet top-up (Razorpay ID: ${razorpay_payment_id})`,
        razorpay_payment_id,
        'TOPUP'
      );

      res.status(200).json({
        success: true,
        message: 'Wallet topped up successfully',
        newBalance: updatedShop?.adWalletBalance,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Preview split payment for ads
   */
  calculatePayment: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId, budgetPerDay, duration } = req.body;
      if (!shopId || !budgetPerDay || !duration) throw new AppError('Missing required fields', 400);

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (shop?.ownerId !== req.user!.id) throw new AppError('Unauthorized', 403);

      
      const budget = Number(budgetPerDay) * Number(duration);
      const split = await walletService.calculateAdPaymentSplit(shopId, budget);
      
      res.json({ status: 'success', data: split });
    } catch (error) {
      next(error);
    }
  },
};

export default AdsController;
