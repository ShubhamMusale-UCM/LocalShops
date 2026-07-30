import { Server as SocketIOServer, Socket } from 'socket.io';

class OrderUpdatesSocket {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Order tracking client connected: ${socket.id}`);

      /**
       * Subscribe to order updates
       */
      socket.on('order:subscribe', (data) => {
        const { orderId } = data;

        socket.join(`order:${orderId}`);
        console.log(`Client subscribed to order ${orderId}`);
      });

      /**
       * Unsubscribe from order
       */
      socket.on('order:unsubscribe', (data) => {
        const { orderId } = data;

        socket.leave(`order:${orderId}`);
        console.log(`Client unsubscribed from order ${orderId}`);
      });

      /**
       * Subscribe to shop orders (for seller)
       */
      socket.on('shop:subscribe', (data) => {
        const { shopId } = data;

        socket.join(`shop:${shopId}`);
        console.log(`Seller subscribed to shop ${shopId}`);
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
  public notifySellerOrderUpdate(shopId: string, orderId: string, status: string) {
    this.io.to(`shop:${shopId}`).emit('shop:order-update', {
      orderId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Notify customer of order update
   */
  public notifyCustomerOrderUpdate(orderId: string, status: string) {
    this.io.to(`order:${orderId}`).emit('customer:order-update', {
      orderId,
      status,
      timestamp: new Date(),
    });
  }

  public getIO() {
    return this.io;
  }
}

export default OrderUpdatesSocket;
