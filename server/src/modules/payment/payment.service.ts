import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../../config/razorpay';

export class PaymentService {
  /**
   * Create a Razorpay order for online payment
   */
  async createPaymentOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ 
      where: { id: orderId },
      include: { shop: true }
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== userId) throw new AppError('Not authorized.', 403);
    if (order.paymentStatus === 'COMPLETED') throw new AppError('Payment already completed.', 400);

    let transfers: any[] = [];
    if (order.shop.razorpayAccountId) {
      // Platform keeps platformFee, seller gets the rest
      const sellerAmount = (order.total - order.platformFee) * 100;
      transfers = [{
        account: order.shop.razorpayAccountId,
        amount: Math.round(sellerAmount),
        currency: 'INR',
        notes: { orderId: order.id },
        linked_account_notes: ['orderId'],
        on_hold: 0
      }];
    }

    const razorpayOrder = await createRazorpayOrder(order.total, order.orderNumber, undefined, transfers);

    // Store razorpay order ID against our order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        razorpayOrderId: razorpayOrder.id,
        paymentStatus: 'INITIATED',
      },
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: order.total * 100,
      currency: 'INR',
      orderNumber: order.orderNumber,
      prefill: {
        contact: order.userId, // Will be resolved to phone in controller
      },
    };
  }

  /**
   * Verify payment after Razorpay checkout
   * TESTING BYPASS: Set SKIP_PAYMENT_VERIFICATION=true in .env to bypass verification
   */
  async verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    orderId: string;
  }, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== userId) throw new AppError('Not authorized.', 403);

    // ═══════════════════════════════════════════════════════════════════
    // TESTING BYPASS: Skip Razorpay verification for testing
    // In production, this bypass is strictly disabled.
    // ═══════════════════════════════════════════════════════════════════
    const SKIP_PAYMENT_VERIFICATION = process.env.NODE_ENV !== 'production' && process.env.SKIP_PAYMENT_VERIFICATION === 'true';
    
    if (SKIP_PAYMENT_VERIFICATION) {
      console.log(`✅ TESTING MODE: Payment verification bypassed for order ${data.orderId}`);
      
      // Mark order as completed without verification
      const updatedOrder = await prisma.order.update({
        where: { id: data.orderId },
        data: {
          razorpayPaymentId: data.razorpay_payment_id,
          paymentStatus: 'COMPLETED',
          status: 'CONFIRMED',
          statusHistory: [...(order.statusHistory as any[] || []), {
            status: 'CONFIRMED',
            note: 'Payment received (TESTING - verification bypassed)',
            updatedAt: new Date().toISOString(),
          }],
        },
        include: { items: true, shop: { select: { name: true } } },
      });
      return updatedOrder;
    }

    // Verify signature (production mode)
    const isValid = verifyPaymentSignature(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    );

    if (!isValid) {
      await prisma.order.update({
        where: { id: data.orderId },
        data: { paymentStatus: 'FAILED' },
      });
      throw new AppError('Payment verification failed.', 400);
    }

    // Update order with payment details
    const updatedOrder = await prisma.order.update({
      where: { id: data.orderId },
      data: {
        razorpayPaymentId: data.razorpay_payment_id,
        paymentStatus: 'COMPLETED',
        status: 'CONFIRMED',
        statusHistory: [...(order.statusHistory as any[] || []), {
          status: 'CONFIRMED',
          note: 'Payment received',
          updatedAt: new Date().toISOString(),
        }],
      },
      include: { items: true, shop: { select: { name: true } } },
    });

    return updatedOrder;
  }

  /**
   * Handle Razorpay webhook events
   */
  async handleWebhook(event: string, payload: any, signature: string) {
    // Validate webhook signature
    const rawBody = JSON.stringify(payload);
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('Invalid webhook signature.', 400);
    }

    switch (event) {
      case 'payment.captured': {
        const paymentId = payload.payment?.entity?.id;
        const razorpayOrderId = payload.payment?.entity?.order_id;

        if (paymentId && razorpayOrderId) {
          const order = await prisma.order.findFirst({
            where: { razorpayOrderId },
          });

          if (order && order.paymentStatus !== 'COMPLETED') {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                razorpayPaymentId: paymentId,
                paymentStatus: 'COMPLETED',
                status: 'CONFIRMED',
              },
            });
          }
        }
        break;
      }

      case 'payment.failed': {
        const razorpayOrderId = payload.payment?.entity?.order_id;
        if (razorpayOrderId) {
          await prisma.order.updateMany({
            where: { razorpayOrderId },
            data: { paymentStatus: 'FAILED' },
          });
        }
        break;
      }

      case 'refund.processed': {
        const paymentId = payload.refund?.entity?.payment_id;
        if (paymentId) {
          await prisma.order.updateMany({
            where: { razorpayPaymentId: paymentId },
            data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
          });
        }
        break;
      }
    }

    return { received: true };
  }

  /**
   * Create a subscription payment for seller plans
   */
  async createSubscriptionPayment(shopId: string, ownerId: string, plan: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const planPrices: Record<string, number> = {
      STARTER: 499,
      PROFESSIONAL: 999,
      PREMIUM: 1999,
    };

    const amount = planPrices[plan];
    if (!amount) throw new AppError('Invalid subscription plan.', 400);

    const receipt = `SUB_${shopId.slice(0, 8)}_${Date.now()}`;
    const razorpayOrder = await createRazorpayOrder(amount, receipt);

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: amount * 100,
      currency: 'INR',
      plan,
      shopId,
    };
  }

  /**
   * Activate subscription after payment
   */
  async activateSubscription(shopId: string, ownerId: string, plan: string, paymentId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1); // Monthly subscription

    return prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionPlan: plan as any,
        subscriptionStart: now,
        subscriptionEnd: end,
      },
    });
  }
}

export default new PaymentService();
