import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheDeletePattern } from '../../config/redis';
import { nanoid } from 'nanoid';
import { sendOrderConfirmationEmail } from '../../utils/emailService';
import { createRazorpayRefund } from '../../config/razorpay';
import walletService, { WALLET_CONFIG } from '../wallet/wallet.service';
import notificationService from '../notification/notification.service';

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
    items: { productId: string; quantity: number; price: number; name: string; campaignId?: string }[];
    deliveryType: string;
    deliveryAddress?: any;
    paymentMethod: string;
    notes?: string;
    couponCode?: string;
    coinsToUse?: number;
  }) {
    // Verify shop exists and is open
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (!shop.isActive) throw new AppError('Shop is not active.', 400);
    // if (shop.ownerId === userId) {
    //   throw new AppError('You cannot place an order on your own shop.', 400);
    // }

    // Determine delivery type
    const effectiveDeliveryType = data.deliveryType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';

    // Verify all products exist, are in stock, and belong to the shop
    const productIds = data.items.map(i => i.productId);
        const now = new Date();
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId, isActive: true },
      include: {
        flashSales: {
          where: { isActive: true, startTime: { lte: now }, endTime: { gte: now } }
        },
        promotedListings: {
          where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
          select: { id: true }
        }
      }
    });

    if (products.length !== data.items.length) {
      throw new AppError('Some products are unavailable or do not belong to this shop.', 400);
    }

    const outOfStock = products.filter(p => !p.inStock || (typeof p.quantity === 'number' && p.quantity <= 0));
    if (outOfStock.length > 0) {
      throw new AppError(`Out of stock: ${outOfStock.map(p => p.name).join(', ')}`, 400);
    }

    const insufficientStock = data.items.filter(item => {
      const p = products.find(prod => prod.id === item.productId);
      return p && typeof p.quantity === 'number' && p.quantity < item.quantity;
    });
    if (insufficientStock.length > 0) {
      const names = insufficientStock.map(item => {
        const p = products.find(prod => prod.id === item.productId)!;
        return `${p.name} (only ${p.quantity} left)`;
      });
      throw new AppError(`Insufficient stock for: ${names.join(', ')}`, 400);
    }

    // Calculate totals using actual DB prices (not client-submitted prices)
        let subtotal = 0;
    const orderItems = data.items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      let actualPrice = product.price;
      if (product.flashSales && product.flashSales.length > 0) {
        const fs = product.flashSales[0];
        actualPrice = +(product.price * (1 - fs.discount / 100)).toFixed(2);
      }
      const itemTotal = actualPrice * item.quantity;
      subtotal += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: actualPrice,
        total: itemTotal,
      };
    });

    // Calculate delivery fee
    let deliveryFee = 0; // Booking platform, no delivery fee

    // Coupon discount (placeholder)
    let discount = 0;
    if (data.couponCode) {
      // TODO: Implement coupon validation
      discount = 0;
    }

    const total = subtotal + deliveryFee - discount;
    const orderNumber = `CLS${Date.now().toString(36).toUpperCase()}${nanoid(4).toUpperCase()}`;
    const orderCampaignId = data.items.find(i => i.campaignId)?.campaignId;

    // ============= WALLET COIN USAGE =============
    let coinsUsed = 0;
    let coinsCredited = 0;
    if (data.coinsToUse && data.coinsToUse > 0) {
      const wallet = await walletService.getOrCreateBuyerWallet(userId);
      const maxUsable = walletService.calculateMaxCoinUsage(wallet.balance, total);
      coinsUsed = Math.min(data.coinsToUse, maxUsable);
      coinsUsed = Math.floor(coinsUsed * 100) / 100; // Round to 2 decimal places
      if (coinsUsed > 0) {
        coinsCredited = coinsUsed; // Same amount goes to seller ad wallet
      }
    }

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
          isDelivery: effectiveDeliveryType === 'DELIVERY',
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
          coinsUsed,
          coinsCredited,
          buyerNote: data.notes || null,
          adCampaignId: orderCampaignId || null,
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

        // Update PromotedListing revenue and conversions for each attributed item
        // We process attributions per campaign to handle multiple different campaigns in one order correctly
        const campaignTotals = new Map<string, { revenue: number, conversions: number }>();
        for (const item of orderItems) {
          // orderItems doesn't have campaignId, we need to look at data.items
          const originalItem = data.items.find(i => i.productId === item.productId);
          const product = products.find(p => p.id === item.productId);
          
          // SECURITY FIX: Only attribute if the client's campaignId exactly matches the database's active campaignId for this product
          const activeCampaign = (originalItem?.campaignId && product?.promotedListings?.find(l => l.id === originalItem.campaignId))
            || product?.promotedListings?.[0];
          if (activeCampaign) {
            const current = campaignTotals.get(activeCampaign.id) || { revenue: 0, conversions: 0 };
            campaignTotals.set(activeCampaign.id, {
              revenue: current.revenue + item.total,
              conversions: current.conversions + item.quantity
            });
          }
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        for (const [campaignId, stats] of campaignTotals.entries()) {
          await tx.promotedListing.update({
            where: { id: campaignId },
            data: { 
              revenue: { increment: stats.revenue },
              conversions: { increment: stats.conversions }
            }
          });

          await tx.adDailyMetricRollup.upsert({
            where: {
              promotedListingId_date_hour: {
                promotedListingId: campaignId,
                date: today,
                hour: 0,
              }
            },
            update: {
              conversions: { increment: stats.conversions },
              revenue: { increment: stats.revenue },
            },
            create: {
              promotedListingId: campaignId,
              date: today,
              hour: 0,
              impressions: 0,
              clicks: 0,
              spend: 0,
              views: 0,
              cartAdds: 0,
              conversions: stats.conversions,
              revenue: stats.revenue,
              uniqueReach: 0,
            }
          });
        }

      // Real-time ShopAnalytics update (reusing today)
      await tx.shopAnalytics.upsert({
        where: { shopId_date: { shopId: data.shopId, date: today } },
        update: { orders: { increment: 1 }, revenue: { increment: total } },
        create: { shopId: data.shopId, date: today, views: 0, uniqueViews: 0, orders: 1, revenue: total, calls: 0, whatsappClicks: 0, directions: 0 }
      });

      // ============= WALLET TRANSACTIONS =============
      if (coinsUsed > 0) {
        // 1. Debit buyer wallet
        const buyerWallet = await tx.buyerWallet.findUnique({ where: { userId } });
        if (!buyerWallet || buyerWallet.balance < coinsUsed) {
          throw new Error('Insufficient wallet balance for coin usage.');
        }
        const newBuyerBalance = buyerWallet.balance - coinsUsed;
        await tx.buyerWallet.update({
          where: { userId },
          data: {
            balance: { decrement: coinsUsed },
            spent: { increment: coinsUsed },
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'BOOKING_DEBIT',
            amount: coinsUsed,
            direction: 'DEBIT',
            balanceAfter: newBuyerBalance,
            description: `Coins used on order #${orderNumber}`,
            referenceId: newOrder.id,
            referenceType: 'ORDER',
          },
        });
      }

      return newOrder;
    });

    // Send confirmation email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      sendOrderConfirmationEmail(user.email, orderNumber, total).catch(() => { });
    }

    // Invalidate Redis caches for real-time fresh analytics
    await Promise.all([
      cacheDelete(`shop:${data.shopId}:ads`),
      cacheDelete(`shop:${data.shopId}:analytics`),
      cacheDelete(`shop:${data.shopId}:daily-metrics`),
    ]).catch(() => {});

    // Notify seller in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifyShopNewOrder(data.shopId, order);
        orderSocket.getIO().to(`shop:${data.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: data.shopId,
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.warn('Socket emit failed for new order:', e);
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
          returnRequests: true,
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
        returnRequests: true,
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
          returnRequests: true,
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
      CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
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
        status,
        note: note || (status === 'CANCELLED' ? 'Declined by seller' : undefined),
        cancelledBy: status === 'CANCELLED' ? 'SELLER' : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }],
    };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (order.paymentMethod === 'COD') {
        updateData.paymentStatus = 'COMPLETED';
      }
    }

    // Referral activation: when an order is delivered, check if this buyer
    // was referred and this is their first delivered order — activate the referral.
    let referralActivation = null;

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
      if (status === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(order.status)) {
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

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        // Decrement product orderCounts and shop totalOrders
        for (const item of updatedOrder.items) {
          await tx.product.updateMany({
            where: { id: item.productId, orderCount: { gt: 0 } },
            data: { orderCount: { decrement: 1 } },
          });
        }
        await tx.shop.updateMany({
          where: { id: order.shopId, totalOrders: { gt: 0 } },
          data: { totalOrders: { decrement: 1 } },
        });

        const orderDate = new Date(order.createdAt);
        orderDate.setUTCHours(0, 0, 0, 0);
        await tx.shopAnalytics.upsert({
          where: { shopId_date: { shopId: order.shopId, date: orderDate } },
          update: { orders: { decrement: 1 }, revenue: { decrement: order.total } },
          create: { shopId: order.shopId, date: orderDate, views: 0, uniqueViews: 0, orders: 0, revenue: 0, calls: 0, whatsappClicks: 0, directions: 0 }
        });

        // REVERSE AD ATTRIBUTION (PromotedListing + AdDailyMetricRollup)
        if (updatedOrder.adCampaignId) {
          const reversedConversions = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
          const reversedRevenue = updatedOrder.items.reduce((sum, item) => sum + item.total, 0);
          
          await tx.promotedListing.updateMany({
            where: { id: updatedOrder.adCampaignId },
            data: {
              revenue: { decrement: reversedRevenue },
              conversions: { decrement: reversedConversions }
            }
          });

          await tx.adDailyMetricRollup.updateMany({
            where: {
              promotedListingId: updatedOrder.adCampaignId,
              date: orderDate,
              hour: 0,
            },
            data: {
              conversions: { decrement: reversedConversions },
              revenue: { decrement: reversedRevenue },
            }
          });
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

    // Notify buyer and seller in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifyCustomerOrderUpdate(orderId, status, note);
        orderSocket.notifySellerOrderUpdate(updated.shopId, orderId, status, note);
      }
    } catch (e) {
      console.warn('Socket emit failed for order update:', e);
    }

    // Post-delivery: activate referral rewards (non-blocking) and credit seller ad wallet
    if (status === 'DELIVERED') {
      this.processDeliveryReferral(order.userId).catch(() => {});
      
      if (order.coinsCredited > 0) {
        walletService.creditSellerAdWallet(
          order.shopId,
          order.coinsCredited,
          `Ad credit from delivered order #${order.orderNumber}`,
          orderId,
          'ORDER'
        ).catch((err) => console.error('Failed to credit seller ad wallet on delivery:', err));
      }
    }

    // ============= REFUND COINS ON CANCELLATION =============
    if (status === 'CANCELLED' && order.coinsUsed > 0) {
      try {
        // 1. Refund buyer wallet
        const wallet = await prisma.buyerWallet.findUnique({ where: { userId: order.userId } });
        if (wallet) {
          await walletService.creditBuyerWallet(
            order.userId,
            order.coinsUsed,
            'BOOKING_REFUND',
            `Coins refunded from cancelled order #${order.orderNumber}`,
            orderId,
            'ORDER',
          );
        }
      } catch (walletError) {
        console.error('Wallet refund error on order status cancellation:', walletError);
      }
    }

    return updated;
  }

  /**
   * Post-delivery processing: activates referral rewards if applicable.
   * Called after order status is set to DELIVERED.
   */
  private async processDeliveryReferral(userId: string) {
    try {
      const result = await walletService.activateReferralIfEligible(userId);
      if (result && result.amountCredited > 0) {
        // Send push notification to referrer
        await notificationService.createNotification(result.referrerId, {
          title: '🎉 Referral Reward!',
          body: `You earned ₹${result.amountCredited} coins! Your friend completed their first booking.`,
          type: 'REFERRAL_REWARD',
          relatedId: userId,
        });
      }
      return result;
    } catch (error) {
      // Non-blocking: don't fail the order update if referral processing errors
      console.error('Referral activation error:', error);
      return null;
    }
  }

  /**
   * Cancel order (by buyer)
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== userId) throw new AppError('Not authorized.', 403);

    const cancellableStatuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          ...(order.paymentStatus === 'COMPLETED' ? { paymentStatus: 'REFUND_PENDING' } : {}),
          statusHistory: [...toStatusHistory(order.statusHistory), {
            status: 'CANCELLED',
            note: reason || 'Cancelled by buyer',
            cancelledBy: 'BUYER',
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
          }],
        },
        include: { items: true },
      });

      // Restore stock if stock was already deducted (CONFIRMED, PREPARING, READY_FOR_PICKUP)
      if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof (product as any).quantity === 'number') {
            const newQuantity = (product as any).quantity + item.quantity;
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

      // Decrement product orderCounts and shop totalOrders
      for (const item of updatedOrder.items) {
        await tx.product.updateMany({
          where: { id: item.productId, orderCount: { gt: 0 } },
          data: { orderCount: { decrement: 1 } },
        });
      }
      await tx.shop.updateMany({
        where: { id: order.shopId, totalOrders: { gt: 0 } },
        data: { totalOrders: { decrement: 1 } },
      });

      // Real-time ShopAnalytics update (decrement)
      const today = new Date(order.createdAt);
      today.setUTCHours(0, 0, 0, 0);
      await tx.shopAnalytics.upsert({
        where: { shopId_date: { shopId: order.shopId, date: today } },
        update: { orders: { decrement: 1 }, revenue: { decrement: order.total } },
        create: { shopId: order.shopId, date: today, views: 0, uniqueViews: 0, orders: 0, revenue: 0, calls: 0, whatsappClicks: 0, directions: 0 }
      });

      // Reverse Ad Attribution if order was attributed to a campaign
      if (updatedOrder.adCampaignId) {
        const reversedConversions = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
        const reversedRevenue = updatedOrder.items.reduce((sum, item) => sum + item.total, 0);

        await tx.promotedListing.updateMany({
          where: { id: updatedOrder.adCampaignId },
          data: {
            revenue: { decrement: reversedRevenue },
            conversions: { decrement: reversedConversions }
          }
        });

        await tx.adDailyMetricRollup.updateMany({
          where: {
            promotedListingId: updatedOrder.adCampaignId,
            date: today,
            hour: 0,
          },
          data: {
            conversions: { decrement: reversedConversions },
            revenue: { decrement: reversedRevenue },
          }
        });
      }

      return updatedOrder;
    });

    // ============= REFUND COINS ON CANCELLATION =============
    if (order.coinsUsed > 0) {
      try {
        // 1. Refund buyer wallet
        const wallet = await prisma.buyerWallet.findUnique({ where: { userId } });
        if (wallet) {
          // Restore with same expiry (90 days from now)
          await walletService.creditBuyerWallet(
            userId,
            order.coinsUsed,
            'BOOKING_REFUND',
            `Coins refunded from cancelled order #${order.orderNumber}`,
            orderId,
            'ORDER',
          );
        }
      } catch (walletError) {
        // Non-blocking: log but don't fail the cancellation
        console.error('Wallet refund error on order cancellation:', walletError);
      }
    }

    // Invalidate product caches when stock is restored
    if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
      try {
        for (const item of result.items) {
          await cacheDelete(`product:${item.productId}`);
        }
        await cacheDeletePattern(`shop:${result.shopId}*`);
      } catch (err) {
        console.error('Failed to invalidate product cache on order cancellation:', err);
      }
    }

    // Notify seller in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifySellerOrderUpdate(result.shopId, orderId, 'CANCELLED', reason || 'Cancelled by buyer');
        orderSocket.notifyCustomerOrderUpdate(orderId, 'CANCELLED', reason || 'Cancelled by buyer');
      }
    } catch (e) {
      console.warn('Socket emit failed for order cancellation:', e);
    }

    // Trigger Razorpay Refund if applicable
    if (order.razorpayPaymentId && (order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'PAID')) {
      try {
        await createRazorpayRefund(order.razorpayPaymentId, order.total, { orderId });
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED' },
        });
      } catch (error: any) {
        console.error(`Refund failed for order ${orderId}: ${error.message || error.description}`);
        // We log the error but don't throw because the cancellation is already committed.
        // In a real production system, this would go to a DLQ for retry.
      }
    }

    return result;
  }

  /**
   * Request a return for an order
   */
  async requestReturn(orderId: string, userId: string, data: { reason: string; description?: string; photos?: string[] }) {
    const order = await prisma.order.findUnique({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'DELIVERED') throw new AppError('Can only return delivered orders', 400);
    
    // Check if return exists
    const existing = await prisma.returnRequest.findFirst({ where: { orderId } });
    if (existing) throw new AppError('Return request already exists for this order', 400);

    const returnReq = await prisma.returnRequest.create({
      data: {
        orderId,
        userId,
        reason: data.reason,
        description: data.description,
        photos: data.photos || [],
        refundAmount: order.total
      }
    });

    return returnReq;
  }

  /**
   * Update a return request status (for sellers)
   */
  async updateReturnStatus(returnId: string, userId: string, status: 'APPROVED' | 'REJECTED' | 'REFUNDED', note?: string) {
    const returnReq = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: { include: { shop: true } } }
    });

    if (!returnReq) throw new AppError('Return request not found', 404);
    
    // Validate if the user is the owner of the shop or admin
    if (returnReq.order.shop.ownerId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') throw new AppError('Unauthorized to update this return', 403);
    }

    const updated = await prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status,
        sellerNote: note
      }
    });

    if (status === 'REFUNDED') {
      const history = toStatusHistory(returnReq.order.statusHistory);
      history.push({
        status: 'REFUNDED',
        note: note || 'Refund processed',
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      });

      // Trigger actual Razorpay Refund if applicable
      if (returnReq.order.razorpayPaymentId) {
        try {
          await createRazorpayRefund(
            returnReq.order.razorpayPaymentId,
            returnReq.refundAmount,
            { returnId: returnReq.id }
          );
        } catch (error: any) {
          throw new AppError(`Razorpay refund failed: ${error.message || error.description}`, 500);
        }
      }

      await prisma.order.update({
        where: { id: returnReq.orderId },
        data: {
          status: 'REFUNDED',
          paymentStatus: 'REFUNDED',
          statusHistory: history,
        }
      });

      // Reverse seller ad wallet credit if coins were credited
      if (returnReq.order.coinsCredited > 0) {
        walletService.debitSellerAdWallet(
          returnReq.order.shopId,
          returnReq.order.coinsCredited,
          `Ad credit reversed from refunded order #${returnReq.order.orderNumber}`,
          returnReq.order.id,
          'ORDER'
        ).catch((err) => console.error('Failed to reverse ad credit on return refund:', err));
      }
    }

    return updated;
  }
}

export default new OrderService();
