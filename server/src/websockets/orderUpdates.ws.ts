import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';

class OrderUpdatesSocket {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupAuthMiddleware();
    this.setupEventHandlers();
  }

  private setupAuthMiddleware() {
    this.io.use((socket, next) => {
      const rawToken =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers?.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);

      if (rawToken) {
        try {
          const decoded = jwt.verify(rawToken, env.JWT_SECRET) as any;
          (socket as any).user = {
            id: decoded.userId || decoded.id,
            role: decoded.role,
          };
        } catch {
          // Allow connection to proceed as guest/unauthenticated for public order tracking,
          // but mark user as null so protected room checks can enforce ownership when needed.
          (socket as any).user = null;
        }
      }
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Order tracking client connected: ${socket.id}`);

      /**
       * Subscribe to order updates
       */
      socket.on('order:subscribe', async (data) => {
        const orderId = data?.orderId;
        if (!orderId) return;

        const authUser = (socket as any).user;
        if (authUser?.id && authUser.role !== 'ADMIN') {
          const order = await prisma.order
            .findUnique({
              where: { id: orderId },
              select: { userId: true, shop: { select: { ownerId: true } } },
            })
            .catch(() => null);
          if (order && order.userId !== authUser.id && order.shop?.ownerId !== authUser.id) {
            socket.emit('error:unauthorized', { room: `order:${orderId}`, error: 'Not authorized for this order room.' });
            return;
          }
        }

        socket.join(`order:${orderId}`);
        console.log(`Client subscribed to order ${orderId}`);
      });

      /**
       * Unsubscribe from order
       */
      socket.on('order:unsubscribe', (data) => {
        const { orderId } = data || {};
        if (!orderId) return;

        socket.leave(`order:${orderId}`);
        console.log(`Client unsubscribed from order ${orderId}`);
      });

      /**
       * Subscribe to shop orders (for seller — verifies shop ownership when authenticated)
       */
      socket.on('shop:subscribe', async (data) => {
        const shopId = data?.shopId;
        if (!shopId) return;

        const authUser = (socket as any).user;
        if (authUser?.id && authUser.role !== 'ADMIN') {
          const shop = await prisma.shop
            .findUnique({ where: { id: shopId }, select: { ownerId: true } })
            .catch(() => null);
          if (shop && shop.ownerId !== authUser.id) {
            socket.emit('error:unauthorized', { room: `shop:${shopId}`, error: 'Not authorized to subscribe to this shop.' });
            return;
          }
        }

        socket.join(`shop:${shopId}`);
        console.log(`Seller subscribed to shop ${shopId}`);
      });

      /**
       * Unsubscribe from shop (for seller)
       */
      socket.on('shop:unsubscribe', (data) => {
        const { shopId } = data;

        socket.leave(`shop:${shopId}`);
        console.log(`Seller unsubscribed from shop ${shopId}`);
      });

      /**
       * Disconnect
       */
      socket.on('disconnect', () => {
        console.log(`Order tracking client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcast order status update
   */
  public broadcastOrderStatusUpdate(orderId: string, status: string, orderDetails?: any) {
    this.io.to(`order:${orderId}`).emit('order:status-update', {
      orderId,
      status,
      timestamp: new Date(),
      details: orderDetails,
    });
  }

  /**
   * Notify shop of new order
   */
  public notifyShopNewOrder(shopId: string, order: any) {
    this.io.to(`shop:${shopId}`).emit('shop:new-order', {
      order,
      timestamp: new Date(),
    });
  }

  /**
   * Notify seller of order update
   */
  public notifySellerOrderUpdate(shopId: string, orderId: string, status: string, note?: string) {
    this.io.to(`shop:${shopId}`).emit('shop:order-update', {
      orderId,
      status,
      note,
      timestamp: new Date(),
    });
  }

  /**
   * Notify customer of order update
   */
  public notifyCustomerOrderUpdate(orderId: string, status: string, note?: string) {
    this.io.to(`order:${orderId}`).emit('customer:order-update', {
      orderId,
      status,
      note,
      timestamp: new Date(),
    });
  }

  public getIO() {
    return this.io;
  }
}

export default OrderUpdatesSocket;
