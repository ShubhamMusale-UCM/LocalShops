import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheSet, cacheGet, cacheDelete } from '../../config/redis';
import firebaseAdmin from '../../config/firebase';

const toStringRecord = (value: Record<string, unknown>): Record<string, string> =>
  Object.entries(value).reduce<Record<string, string>>((acc, [key, val]) => {
    if (val !== undefined && val !== null) {
      acc[key] = String(val);
    }
    return acc;
  }, {});

export class NotificationService {
  async registerFcmToken(userId: string, fcmToken: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    return { success: true };
  }

  /**
   * Send push notification
   */
  async sendPushNotification(userId: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    image?: string;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      throw new AppError('FCM token not found for user', 400);
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.image,
      },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await firebaseAdmin.messaging().send(message);
      console.log('FCM notification sent:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('FCM error:', error);
      throw error;
    }
  }

  /**
   * Create in-app notification
   */
  async createNotification(userId: string, data: {
    title: string;
    body?: string;
    description?: string;
    type: 'ORDER' | 'REVIEW' | 'PROMOTION' | 'DELIVERY' | 'SYSTEM' | 'FLASH_SALE' | 'NEW_PRODUCT';
    relatedId?: string;
    icon?: string;
    image?: string;
    actionUrl?: string;
  }) {
    const bodyText = data.body || data.description || '';

    const notification = await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        body: bodyText,
        type: data.type,
        data: {
          relatedId: data.relatedId,
          icon: data.icon,
          image: data.image,
          actionUrl: data.actionUrl,
        },
        isRead: false,
      },
    });

    // Also send push notification if enabled
    try {
      await this.sendPushNotification(userId, {
        title: data.title,
        body: bodyText,
        data: toStringRecord({
          type: data.type,
          relatedId: data.relatedId,
          actionUrl: data.actionUrl,
        }),
        image: data.image || data.icon,
      });
    } catch (error) {
      console.warn('Push notification failed, but in-app notification created');
    }

    // Invalidate cache
    await cacheDelete(`user:${userId}:notifications`);

    return notification;
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(userId: string, params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    const { page = 1, limit = 20, unreadOnly = false } = params || {};

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    await cacheDelete(`user:${userId}:notifications`);

    return updated;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    await cacheDelete(`user:${userId}:notifications`);

    return { success: true };
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404);
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    await cacheDelete(`user:${userId}:notifications`);

    return { success: true };
  }

  /**
   * Send order notifications to seller and buyer
   */
  async notifyOrderUpdate(orderId: string, status: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!order) return;

    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Your order has been confirmed',
      PREPARING: 'Shop is preparing your order',
      READY_FOR_PICKUP: 'Your order is ready for pickup',
      OUT_FOR_DELIVERY: 'Your order is on the way',
      DELIVERED: 'Your order has been delivered',
      CANCELLED: 'Your order has been cancelled',
    };

    // Notify buyer
    await this.createNotification(order.userId, {
      title: 'Order Update',
      description: statusMessages[status] || 'Order status updated',
      type: 'ORDER',
      relatedId: orderId,
      actionUrl: `/orders/${orderId}`,
    });

    // Notify seller
    await this.createNotification(order.shop.ownerId, {
      title: 'Order Status',
      description: `Order ${orderId} is now ${status.toLowerCase()}`,
      type: 'ORDER',
      relatedId: orderId,
      actionUrl: `/seller/orders/${orderId}`,
    });
  }

  /**
   * Send promotional notification to users
   */
  async sendPromotionalNotification(userIds: string[], payload: {
    title: string;
    description: string;
    image?: string;
    actionUrl?: string;
  }) {
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        title: payload.title,
        body: payload.description,
        type: 'PROMOTION',
        data: {
          icon: payload.image,
          actionUrl: payload.actionUrl,
        },
        isRead: false,
      })),
    });

    // Send push notifications
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });

    for (const user of users) {
      if (user.fcmToken) {
        try {
          await this.sendPushNotification(user.id, {
            title: payload.title,
            body: payload.description,
            image: payload.image,
          });
        } catch (error) {
          console.error(`Failed to send push to ${user.id}`, error);
        }
      }
    }

    return { success: true, count: notifications.count };
  }
  /**
   * Notify seller of low stock
   */
  async notifyLowStock(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { shop: { select: { ownerId: true, name: true } } },
    });

    if (!product) return;

    await this.createNotification(product.shop.ownerId, {
      title: 'Low Stock Alert',
      description: `${product.name} is running low on stock. Please restock soon.`,
      type: 'SYSTEM',
      relatedId: productId,
      actionUrl: `/seller/products/${productId}`,
    });
  }

  /**
   * Notify seller of a new review
   */
  async notifyNewReview(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { 
        shop: { select: { ownerId: true, name: true } },
        product: { select: { name: true } }
      },
    });

    if (!review) return;

    const itemName = review.product ? review.product.name : review.shop.name;
    const ratingStars = '⭐'.repeat(review.rating);

    await this.createNotification(review.shop.ownerId, {
      title: 'New Review Received',
      description: `You received a ${review.rating}-star review for ${itemName}. ${ratingStars}`,
      type: 'REVIEW',
      relatedId: reviewId,
      actionUrl: `/seller/reviews`,
    });
  }
}

export default new NotificationService();
