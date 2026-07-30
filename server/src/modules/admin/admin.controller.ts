import { Request, Response, NextFunction } from 'express';
import adminService from './admin.service';
import { scheduleNotificationCampaign } from '../../jobs/notificationCampaign.job';

const parsePageLimit = (query: any) => ({
  page: Number(query.page || 1),
  limit: Number(query.limit || 20),
});

export const AdminController = {
  getOverview: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminService.getPlatformOverview();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  getUsers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parsePageLimit(req.query);
      const data = await adminService.getUsers({
        page,
        limit,
        role: req.query.role as any,
        search: req.query.search as string | undefined,
      });
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  updateUserRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminService.updateUserRole(req.params.userId, req.body.role);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  getShops: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parsePageLimit(req.query);
      const data = await adminService.getShops(page, limit, req.query.search as string | undefined);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  setShopStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminService.setShopStatus(req.params.shopId, Boolean(req.body.isActive));
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  setShopVerification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminService.setShopVerification(req.params.shopId, Boolean(req.body.isVerified));
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  getFlaggedReviews: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parsePageLimit(req.query);
      const data = await adminService.getFlaggedReviews(page, limit);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  resolveReviewReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminService.resolveReviewReport(
        req.params.reviewId,
        req.body.action as 'dismiss' | 'remove'
      );
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  },

  sendMarketingNotification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, message, userSegment, scheduleTime } = req.body;
      const campaignId = await scheduleNotificationCampaign(
        title, 
        message, 
        userSegment || 'ALL', 
        scheduleTime ? new Date(scheduleTime) : undefined
      );
      res.json({ status: 'success', data: { campaignId, message: 'Notification campaign scheduled successfully.' } });
    } catch (error) {
      next(error);
    }
  },
};

export default AdminController;
