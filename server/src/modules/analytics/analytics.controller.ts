import { Request, Response, NextFunction } from 'express';
import analyticsService from './analytics.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';

export const AnalyticsController = {
  /**
   * Get seller dashboard analytics
   */
  getSellerAnalytics: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { dateRange = 'month' } = req.query;

      const analytics = await analyticsService.getSellerAnalytics(
        req.user!.id,
        (dateRange as 'week' | 'month' | 'year') || 'month'
      );

      res.json({
        status: 'success',
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get daily sales trend
   */
  getDailySalesTrend: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { days = 30 } = req.query;

      const trend = await analyticsService.getDailySalesTrend(
        req.user!.id,
        parseInt(days as string)
      );

      res.json({
        status: 'success',
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get product performance
   */
  getProductPerformance: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { limit = 10 } = req.query;

      const performance = await analyticsService.getProductPerformance(
        req.user!.id,
        parseInt(limit as string)
      );

      res.json({
        status: 'success',
        data: performance,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get category analytics
   */
  getCategoryAnalytics: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const analytics = await analyticsService.getCategoryAnalytics(req.user!.id);

      res.json({
        status: 'success',
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer insights
   */
  getCustomerInsights: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const insights = await analyticsService.getCustomerInsights(req.user!.id);

      res.json({
        status: 'success',
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get review analytics
   */
  getReviewAnalytics: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const reviews = await analyticsService.getReviewAnalytics(req.user!.id);

      res.json({
        status: 'success',
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get ad performance analytics
   */
  getAdAnalytics: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const ads = await analyticsService.getAdAnalytics(req.user!.id);

      res.json({
        status: 'success',
        data: ads,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate seller report
   */
  generateReport: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { format = 'json' } = req.query;

      const report = await analyticsService.generateSellerReport(
        req.user!.id,
        (format as 'json' | 'csv') || 'json'
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="seller-report.csv"');
        res.send(report);
      } else {
        res.json({
          status: 'success',
          data: report,
        });
      }
    } catch (error) {
      next(error);
    }
  },
};

export default AnalyticsController;
