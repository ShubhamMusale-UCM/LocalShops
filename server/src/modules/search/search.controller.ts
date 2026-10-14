import { Request, Response, NextFunction } from 'express';
import searchService from './search.service';
import { AppError } from '../../middleware/errorHandler.middleware';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth.middleware';

// Fire-and-forget user search history tracking
const trackUserSearchHistory = (userId: string | undefined, keyword: string) => {
  if (!userId || !keyword || keyword.trim().length < 2) return;
  const kw = keyword.trim().toLowerCase();
  prisma.userSearchHistory.create({
    data: { userId, keyword: kw }
  }).catch(() => {});
};

// Fire-and-forget keyword stat tracking — never blocks the response
const trackKeywordStats = (keyword: string, products: any[]) => {
  if (!keyword || keyword.trim().length < 2 || products.length === 0) return;
  const kw = keyword.trim().toLowerCase();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Collect unique shopIds from matched products
  const shopIds = Array.from(new Set(products.map((p: any) => p.shopId).filter(Boolean)));
  
  // Fire and forget — don't await this
  Promise.all(shopIds.map(shopId =>
    prisma.searchKeywordStat.upsert({
      where: { shopId_keyword_date: { shopId, keyword: kw, date: today } },
      update: { searches: { increment: 1 } },
      create: { shopId, keyword: kw, date: today, searches: 1, clicks: 0 },
    }).catch(() => {}) // Silently ignore DB errors
  )).catch(() => {});
};

// Fire-and-forget impression tracking — never blocks the response
const trackProductImpressions = (products: any[]) => {
  if (!products || products.length === 0) return;

  const productIds = products.map((p: any) => p.id).filter(Boolean);
  const campaignIds = products.filter((p: any) => p.isSponsored && p.campaignId).map((p: any) => p.campaignId);

  if (productIds.length > 0) {
    prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {}); // Silently ignore DB errors
  }

  // Ad impressions are tracked securely via client-side telemetry when the ad becomes viewable,
  // so we do not increment promotedListing.impressions here to prevent double counting.
};

export const SearchController = {
  /**
   * Search products with filters
   */
  searchProducts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { q, category, minPrice, maxPrice, minRating, shopId, limit = 20, offset = 0, lat, lng } = req.query;

      const queryStr = (q as string) || '';

      const results = await searchService.searchProducts(
        queryStr,
        {
          category: category as string,
          minPrice: minPrice ? parseInt(minPrice as string) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
          minRating: minRating ? parseFloat(minRating as string) : undefined,
          shopId: shopId as string,
        },
        parseInt(limit as string),
        parseInt(offset as string),
        lat ? parseFloat(lat as string) : undefined,
        lng ? parseFloat(lng as string) : undefined,
        (req.user as any)?.gender,
        ((req.query.city as string) || (req.user as any)?.city || undefined),
        req.user?.id
      );

      // Track keyword stats (non-blocking fire-and-forget)
      if (queryStr && results.products.length > 0) {
        trackKeywordStats(queryStr, results.products);
        trackUserSearchHistory(req.user?.id, queryStr);
      }

      // Track product views / impressions (non-blocking fire-and-forget)
      if (results.products.length > 0) {
        trackProductImpressions(results.products);
      }

      res.json({
        status: 'success',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  },


  /**
   * Search nearby shops by geo-location
   */
  searchNearbyShops: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { latitude, longitude, maxDistance = 5000, keyword, limit = 20 } = req.query;

      if (!latitude || !longitude)
        throw new AppError('Latitude and longitude required', 400);

      const shops = await searchService.searchNearbyShops(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseInt(maxDistance as string),
        keyword as string,
        parseInt(limit as string)
      );

      res.json({
        status: 'success',
        data: shops,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Search nearby products by geo-location
   */
  searchNearbyProducts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { latitude, longitude, maxDistance = 10000, category, limit = 20 } = req.query;

      if (!latitude || !longitude)
        throw new AppError('Latitude and longitude required', 400);

      const products = await searchService.searchNearbyProducts(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseInt(maxDistance as string),
        category as string,
        parseInt(limit as string)
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
   * Get search suggestions
   */
  getSuggestions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q) {
        return res.json({
          status: 'success',
          data: [],
        });
      }

      const suggestions = await searchService.getSearchSuggestions(
        q as string,
        parseInt(limit as string)
      );

      res.json({
        status: 'success',
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Advanced search with multiple filters
   */
  advancedSearch: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        query: req.query.q as string,
        category: req.query.category as string,
        minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
        minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
        shopId: req.query.shopId as string,
        latitude: req.query.latitude ? parseFloat(req.query.latitude as string) : undefined,
        longitude: req.query.longitude ? parseFloat(req.query.longitude as string) : undefined,
        maxDistance: req.query.maxDistance ? parseInt(req.query.maxDistance as string) : undefined,
        sortBy: req.query.sortBy as 'price' | 'rating' | 'newest' | 'popularity',
      };

      const results = await searchService.advancedSearch(
        filters,
        parseInt((req.query.limit as string) || '20'),
        parseInt((req.query.offset as string) || '0')
      );

      // Track product views / impressions (non-blocking fire-and-forget)
      if (results.products && results.products.length > 0) {
        trackProductImpressions(results.products);
        if (filters.query) {
          trackUserSearchHistory(req.user?.id, filters.query);
        }
      }

      res.json({
        status: 'success',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default SearchController;
