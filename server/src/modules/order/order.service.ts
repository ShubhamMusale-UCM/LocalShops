import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheDeletePattern } from '../../config/redis';
import { nanoid } from 'nanoid';
import { sendOrderConfirmationEmail } from '../../utils/emailService';

const toStatusHistory = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const formatDeliveryAddress = (deliveryAddress?: any): string | null => {
  if (!deliveryAddress || typeof deliveryAddress !== 'object') {
    return null;
  }

  const parts = [
    deliveryAddress.address,
    deliveryAddress.landmark,
    deliveryAddress.city,
    deliveryAddress.pincode,
  ]
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  if (!parts.length) {
    return null;
  }

  return parts.join(', ');
};

export class OrderService {
  /**
   * Create a new order
   */
  async createOrder(userId: string, data: {
    shopId: string;
    items: { productId: string; quantity: number; price: number; name: string }[];
    deliveryType: string;
    deliveryAddress?: any;
    paymentMethod: string;
    notes?: string;
    couponCode?: string;
  }) {
    // Verify shop exists and is open
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (!shop.isActive) throw new AppError('Shop is not active.', 400);

    // Graceful fallback: Platform is now booking-only. All orders are PICKUP.
    // Address may still be collected for analytics.
    const effectiveDeliveryType = 'PICKUP';

    // Verify all products exist, are in stock, and belong to the shop
    const productIds = data.items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId, isActive: true },
    });

    if (products.length !== data.items.length) {
      throw new AppError('Some products are unavailable or do not belong to this shop.', 400);
    }

    const outOfStock = products.filter(p => !p.inStock);
    if (outOfStock.length > 0) {
      throw new AppError(`Out of stock: ${outOfStock.map(p => p.name).join(', ')}`, 400);
    }

    // Calculate totals using actual DB prices (not client-submitted prices)
    let subtotal = 0;
    const orderItems = data.items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      };
    });

    // Platform operates as a booking platform; no delivery fee is charged.
    let deliveryFee = 0;

    // Coupon discount (placeholder)
    let discount = 0;
    if (data.couponCode) {
      // TODO: Implement coupon validation
      discount = 0;
    }

    const total = subtotal + deliveryFee - discount;
    const orderNumber = `CLS${Date.now().toString(36).toUpperCase()}${nanoid(4).toUpperCase()}`;

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          shopId: data.shopId,
          statusHistory: [{
            status: 'PLACED',
            note: 'Order placed',
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
          }],
          subtotal,
          deliveryFee,
          discount,
          total,
          isDelivery: false,
          deliveryAddress: formatDeliveryAddress(data.deliveryAddress),
          deliveryLatitude:
            typeof data.deliveryAddress?.latitude === 'number'
              ? data.deliveryAddress.latitude
              : null,
          deliveryLongitude:
            typeof data.deliveryAddress?.longitude === 'number'
              ? data.deliveryAddress.longitude
              : null,
          paymentMethod: data.paymentMethod as any,
          paymentStatus: 'PENDING',
          buyerNote: data.notes || null,
          items: { create: orderItems },
        },
        include: {
          items: true,
          shop: { select: { id: true, name: true, phone: true } },
        },
      });

      // Update product order counts
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { orderCount: { increment: 1 } },
        });
      }

      // Update shop order count
      await tx.shop.update({
        where: { id: data.shopId },
        data: { totalOrders: { increment: 1 } },
      });

      return newOrder;
    });

    // Send confirmation email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      sendOrderConfirmationEmail(user.email, orderNumber, total).catch(() => { });
    }

    return order;
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string, params: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params;

    const where: any = { userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, images: true, price: true } },
            },
          },
          shop: { select: { id: true, name: true, slug: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Get order by ID (for buyer or shop owner)
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, images: true, price: true } },
          },
        },
        shop: { select: { id: true, name: true, phone: true, ownerId: true, address: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Only buyer or shop owner can view
    if (order.userId !== userId && order.shop.ownerId !== userId) {
      throw new AppError('Not authorized.', 403);
    }

    return order;
  }

  /**
   * Get orders for a specific shop (seller view)
   */
  async getShopOrders(shopId: string, ownerId: string, params: { status?: string; page?: number; limit?: number }) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const { status, page = 1, limit = 20 } = params;
    const where: any = { shopId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, images: true, price: true } },
            },
          },
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, userId: string, status: string, note?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Only shop owner or admin can update status
    if (order.shop.ownerId !== userId) {
      throw new AppError('Not authorized to update this order.', 403);
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PLACED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
      READY_FOR_PICKUP: ['DELIVERED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(`Cannot change status from ${order.status} to ${status}.`, 400);
    }

    const updateData: any = {
      status,
      statusHistory: [...toStatusHistory(order.statusHistory), {
        status, note, updatedAt: new Date().toISOString(), updatedBy: userId,
      }],
    };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (order.paymentMethod === 'COD') {
        updateData.paymentStatus = 'COMPLETED';
      }
    }

    if (status === 'CANCELLED') {
      if (order.paymentStatus === 'COMPLETED') {
        updateData.paymentStatus = 'REFUND_PENDING';
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: { items: true, shop: { select: { name: true } } },
      });

      // Deduct stock when confirming
      if (status === 'CONFIRMED' && order.status === 'PLACED') {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof product.quantity === 'number') {
            const newQuantity = Math.max(0, product.quantity - item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQuantity,
                inStock: newQuantity > 0
              }
            });
          }
        }
      }

      // Restore stock when cancelling an already confirmed order
      if (status === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof product.quantity === 'number') {
            const newQuantity = product.quantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQuantity,
                inStock: newQuantity > 0
              }
            });
          }
        }
      }

      return updatedOrder;
    });

    // Invalidate product caches when stock changes
    if (
      (status === 'CONFIRMED' && order.status === 'PLACED') ||
      (status === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status))
    ) {
      try {
        for (const item of updated.items) {
          await cacheDelete(`product:${item.productId}`);
        }
        await cacheDeletePattern(`shop:${updated.shopId}*`);
      } catch (err) {
        console.error('Failed to invalidate product cache on order status update:', err);
      }
    }

    return updated;
  }

  /**
   * Cancel order (by buyer)
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== userId) throw new AppError('Not authorized.', 403);

    const cancellableStatuses = ['PLACED', 'CONFIRMED'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          statusHistory: [...toStatusHistory(order.statusHistory), {
            status: 'CANCELLED', note: reason, updatedAt: new Date().toISOString(), updatedBy: userId,
          }],
        },
        include: { items: true },
      });

      // Restore stock if it was confirmed
      if (order.status === 'CONFIRMED') {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof product.quantity === 'number') {
            const newQuantity = product.quantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQuantity,
                inStock: newQuantity > 0
              }
            });
          }
        }
      }

      return updatedOrder;
    });

    // Invalidate product caches when stock is restored
    if (order.status === 'CONFIRMED') {
      try {
        for (const item of result.items) {
          await cacheDelete(`product:${item.productId}`);
        }
        await cacheDeletePattern(`shop:${result.shopId}*`);
      } catch (err) {
        console.error('Failed to invalidate product cache on order cancellation:', err);
      }
    }

    return result;
  }
}

export default new OrderService();
