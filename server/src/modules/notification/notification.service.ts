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
  async registerDevice(userId: string, data: { token: string; platform?: string }) {
    if (!data.token) {
      throw new AppError('Token is required', 400);
    }

    const platform = (data.platform || 'ANDROID').toUpperCase();

    // Upsert into user_devices
    const device = await prisma.userDevice.upsert({
      where: { token: data.token },
      update: {
        userId,
        platform,
        lastSeen: new Date(),
      },
      create: {
        userId,
        token: data.token,
        platform,
        lastSeen: new Date(),
      },
    });

    // Also sync User.fcmToken for legacy single-token lookups
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: data.token },
    }).catch(() => {});

    return { success: true, device };
  }

  async unregisterDevice(token: string) {
    if (!token) return { success: true };

    await prisma.userDevice.deleteMany({
      where: { token },
    });

    await prisma.user.updateMany({
      where: { fcmToken: token },
      data: { fcmToken: null },
    }).catch(() => {});

    return { success: true };
  }

  async registerFcmToken(userId: string, fcmToken: string, platform?: string) {
    return this.registerDevice(userId, { token: fcmToken, platform });
  }

  /**
   * Send high-priority closed-app push alert to shop owner & staff with custom sound (SEL-4)
   */
  async sendHighPriorityOrderAlert(sellerUserIds: string[], order: {
    id: string;
    orderNumber?: string;
    total?: number;
    items?: any[];
    shopId?: string;
  }) {
    if (!sellerUserIds || sellerUserIds.length === 0) return { sentCount: 0 };

    // 1. Check shop settings for sound alert preference
    let soundEnabled = true;
    if (order.shopId) {
      try {
        const settings = await prisma.shopSettings.findUnique({
          where: { shopId: order.shopId },
          select: { notificationToggles: true },
        });
        const toggles = settings?.notificationToggles as any;
        if (toggles && toggles.soundAlerts === false) {
          soundEnabled = false;
        }
      } catch (_) {}
    }

    // 2. Fetch all registered devices for seller users
    const devices = await prisma.userDevice.findMany({
      where: { userId: { in: sellerUserIds } },
    });

    // Also check User.fcmToken for any seller users
    const users = await prisma.user.findMany({
      where: { id: { in: sellerUserIds } },
      select: { id: true, fcmToken: true },
    });

    const tokenMap = new Map<string, { token: string; platform: string; userId: string }>();
    for (const d of devices) {
      tokenMap.set(d.token, { token: d.token, platform: d.platform, userId: d.userId });
    }
    for (const u of users) {
      if (u.fcmToken && !tokenMap.has(u.fcmToken)) {
        tokenMap.set(u.fcmToken, { token: u.fcmToken, platform: 'ANDROID', userId: u.id });
      }
    }

    const allTokens = Array.from(tokenMap.values());
    if (allTokens.length === 0) {
      return { sentCount: 0, totalDevices: 0 };
    }

    const orderNum = order.orderNumber || order.id.slice(0, 8);
    const orderTotal = Math.round(Number(order.total) || 0);
    const itemsCount = (order.items && order.items.length) || 1;
    const title = '🚨 New Order Received!';
    const body = `Order #${orderNum} • ₹${orderTotal} (${itemsCount} ${itemsCount === 1 ? 'item' : 'items'})`;
    const actionUrl = `/seller/orders?id=${order.id}`;

    const dataPayload: Record<string, string> = {
      type: 'NEW_ORDER',
      orderId: order.id,
      orderNumber: String(orderNum),
      amount: String(orderTotal),
      itemsCount: String(itemsCount),
      actionUrl,
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    };

    let sentCount = 0;
    const staleTokens: string[] = [];

    for (const dev of allTokens) {
      const isIOS = dev.platform.toUpperCase() === 'IOS';
      const soundName = soundEnabled
        ? (isIOS ? 'order_bell.aiff' : 'order_bell')
        : 'default';

      const message: any = {
        token: dev.token,
        notification: {
          title,
          body,
        },
        data: dataPayload,
        android: {
          priority: 'high' as const,
          ttl: 60 * 1000, // 60s
          notification: {
            channelId: 'new_orders',
            sound: soundName,
            priority: 'max' as const,
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [0, 250, 250, 250],
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 60),
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: soundName,
              badge: 1,
            },
          },
        },
      };

      try {
        if (firebaseAdmin && typeof (firebaseAdmin as any).messaging === 'function') {
          await (firebaseAdmin as any).messaging().send(message);
          sentCount++;
        }
      } catch (err: any) {
        console.warn(`[OrderAlert] FCM dispatch failed for token ${dev.token.slice(0, 15)}...:`, err?.message || err);
        const errCode = err?.code || '';
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(dev.token);
        }
      }
    }

    if (staleTokens.length > 0) {
      await prisma.userDevice.deleteMany({
        where: { token: { in: staleTokens } },
      }).catch(() => {});
      await prisma.user.updateMany({
        where: { fcmToken: { in: staleTokens } },
        data: { fcmToken: null },
      }).catch(() => {});
    }

    return { sentCount, totalDevices: allTokens.length };
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
    type: 'ORDER' | 'REVIEW' | 'PROMOTION' | 'DELIVERY' | 'SYSTEM' | 'FLASH_SALE' | 'NEW_PRODUCT' | 'REFERRAL_REWARD' | 'WALLET_ALERT';
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

    // In-app real-time socket delivery to authenticated user room
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket && typeof orderSocket.getIO === 'function') {
        orderSocket.getIO().to(`user:${userId}`).emit('notification:new', notification);
      }
    } catch (_) {}

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
   * Clear all read notifications for user
   */
  async clearReadNotifications(userId: string) {
    const result = await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });

    await cacheDelete(`user:${userId}:notifications`);

    return { success: true, count: result.count };
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

  async sendNotification(payload: { userId: string; title: string; body: string; type?: string; data?: any }) {
    return this.createNotification(payload.userId, {
      title: payload.title,
      description: payload.body,
      type: (payload.type || 'SYSTEM') as any,
      relatedId: payload.data?.orderId || payload.data?.ticketId || payload.data?.productId,
    });
  }
}

export default new NotificationService();
