import { Request, Response, NextFunction } from 'express';
import adsService from './ads.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';
import prisma from '../../config/database';

export const AdsController = {
  /**
   * Create sponsored listing
   */
  createAd: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId, shopId, budgetPerDay, bidPerClick, duration } = req.body;

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

      const ad = await adsService.createSponsoredListing(
        shopId,
        productId,
        Number(budgetPerDay),
        Number(bidPerClick),
        new Date(),
        Number(duration)
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
      const ad = await prisma.promotedListing.findUnique({
        where: { id: adId },
        include: { shop: true },
      });

      if (!ad || ad.shop.ownerId !== req.user!.id) {
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
      const { additionalBudget } = req.body;

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

      const ad = await adsService.renewAdBudget(adId, additionalBudget);

      res.json({
        status: 'success',
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get trending products
   */
  getTrendingProducts: async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { limit = 10, q, category, lat, lng } = _req.query;

      const products = await adsService.getTrendingProducts(
        parseInt(limit as string), 
        q as string, 
        category as string,
        lat ? parseFloat(lat as string) : undefined,
        lng ? parseFloat(lng as string) : undefined
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
   * Track sponsored click from buyer search/listing UI
   */
  trackAdClick: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { adId } = req.params;
      const updated = await adsService.trackAdClick(adId);

      res.json({
        status: 'success',
        data: {
          id: updated.id,
          clicks: updated.clicks,
          spent: updated.spent,
        },
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
};

export default AdsController;
