import { Response } from 'express';
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
}

export default new NotificationController();
