import { Response } from 'express';
import prisma from '../../config/database';
import notificationService from './notification.service';
import { AppError } from '../../middleware/errorHandler.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

class NotificationController {
  async registerToken(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    const { fcmToken } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    if (!fcmToken || typeof fcmToken !== 'string') {
      throw new AppError('Valid fcmToken is required', 400);
    }

    const result = await notificationService.registerFcmToken(userId, fcmToken);
    res.json(result);
  }

  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);
      const { page, limit, unreadOnly } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        unreadOnly: unreadOnly === 'true',
      });

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const notification = await notificationService.markAsRead(id, userId);

      res.json(notification);
    } catch (error) {
      throw error;
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const result = await notificationService.markAllAsRead(userId);

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const result = await notificationService.deleteNotification(id, userId);

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  async sendTestNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);
      const { title, description } = req.body;

      const notification = await notificationService.createNotification(userId, {
        title,
        description,
        type: 'SYSTEM',
      });

      res.json(notification);
    } catch (error) {
      throw error;
    }
  }

  async getCampaigns(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const shops = await prisma.shop.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);

      if (shopIds.length === 0) {
        return res.json({ status: 'success', data: [] });
      }

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          title, 
          body as message, 
          type,
          MIN(id) as id,
          COUNT(*)::int as "recipientCount", 
          COUNT(*)::int as "sentCount",
          MAX("createdAt") as "sentAt"
        FROM "Notification"
        WHERE data->>'relatedId' = ANY(${shopIds})
        GROUP BY title, body, type, DATE_TRUNC('minute', "createdAt")
        ORDER BY "sentAt" DESC
        LIMIT 50
      `;

      const campaigns = rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        status: 'SENT',
        recipientCount: r.recipientCount || 0,
        sentCount: r.sentCount || 0,
        sentAt: r.sentAt,
        type: r.type === 'SYSTEM' ? 'TRANSACTIONAL' : 'PROMOTIONAL',
      }));

      res.json({ status: 'success', data: campaigns });
    } catch (error) {
      throw error;
    }
  }

  async cancelCampaign(req: AuthRequest, res: Response) {
    try {
      res.json({ status: 'success', message: 'Campaign cancelled' });
    } catch (error) {
      throw error;
    }
  }

  async deleteCampaign(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);
      const { id } = req.params;

      const shops = await prisma.shop.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);

      if (shopIds.length > 0) {
        await prisma.$executeRaw`
          DELETE FROM "Notification" 
          WHERE title IN (SELECT title FROM "Notification" WHERE id = ${id}) 
            AND body IN (SELECT body FROM "Notification" WHERE id = ${id})
            AND data->>'relatedId' = ANY(${shopIds})
        `;
      }

      res.json({ status: 'success', message: 'Campaign deleted' });
    } catch (error) {
      throw error;
    }
  }
}

export default new NotificationController();
