import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import paymentService from './payment.service';
import orderService from '../order/order.service';
import prisma from '../../config/database';
import { cacheGet, cacheSet } from '../../config/redis';

export class PaymentController {
  /**
   * Create a payment order from cart items (unified endpoint for both order creation and payment)
   */
  async createProductPaymentOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { cartItems, deliveryAddress, paymentMethod, deliveryType, clientRequestId } = req.body;
      const skipPaymentVerification = process.env.SKIP_PAYMENT_VERIFICATION === 'true';

      const idempotencyKey =
        typeof clientRequestId === 'string' && clientRequestId.trim().length > 0
          ? `checkout:idempotency:${req.user!.id}:${clientRequestId.trim()}`
          : null;

      if (idempotencyKey) {
        const cachedResponse = await cacheGet<any>(idempotencyKey);
        if (cachedResponse) {
          res.status(201).json(cachedResponse);
          return;
        }
      }
      
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        res.status(400).json({ error: 'cartItems array required.' });
        return;
      }
      if (!paymentMethod) {
        res.status(400).json({ error: 'paymentMethod required.' });
        return;
      }

      // Group items by shop (can only have one shop per order in this system)
      const shopIds = [...new Set(cartItems.map(i => i.shopId))];
      if (shopIds.length > 1) {
        res.status(400).json({ error: 'Can only order from one shop at a time.' });
        return;
      }
      const shopId = shopIds[0];

      // Create the order first
      const order = await orderService.createOrder(req.user!.id, {
        shopId,
        items: cartItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          name: item.name || '',
          campaignId: item.campaignId,
        })),
        deliveryType: deliveryType || 'PICKUP',
        deliveryAddress: deliveryAddress || {},
        paymentMethod: paymentMethod === 'COD' ? 'COD' : 'ONLINE',
        notes: req.body.notes,
      });

      // If COD or testing bypass mode, return order directly without Razorpay
      if (paymentMethod === 'COD' || skipPaymentVerification) {
        if (paymentMethod !== 'COD' && skipPaymentVerification) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'CONFIRMED',
              paymentStatus: 'COMPLETED',
            },
          });
        }

        const responsePayload = {
          success: true,
          id: order.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          bypassed: paymentMethod !== 'COD' && skipPaymentVerification,
          message:
            paymentMethod === 'COD'
              ? 'Order placed successfully. Please arrange collection directly with the seller.'
              : 'Order placed successfully (testing bypass mode).',
        };

        if (idempotencyKey) {
          await cacheSet(idempotencyKey, responsePayload, 120);
        }

        res.status(201).json(responsePayload);
        return;
      }

      // For online payment, create Razorpay order
      const paymentOrder = await paymentService.createPaymentOrder(order.id, req.user!.id);
      const responsePayload = {
        ...paymentOrder,
        orderId: order.id,
        orderNumber: order.orderNumber,
      };

      if (idempotencyKey) {
        await cacheSet(idempotencyKey, responsePayload, 120);
      }

      res.status(201).json(responsePayload);
    } catch (error: any) {
      console.error('PAYMENT_ERROR:', error);
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  /**
   * Create payment for an existing order
   */
  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.body;
      if (!orderId) { res.status(400).json({ error: 'orderId required.' }); return; }
      const result = await paymentService.createPaymentOrder(orderId, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async verify(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
        res.status(400).json({ error: 'Missing payment verification data.' }); return;
      }
      const order = await paymentService.verifyPayment(
        { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId },
        req.user!.id
      );
      res.json(order);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const event = req.body.event;
      const result = await paymentService.handleWebhook(event, req.body.payload, signature);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async createSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId, plan } = req.body;
      if (!shopId || !plan) { res.status(400).json({ error: 'shopId and plan required.' }); return; }
      const result = await paymentService.createSubscriptionPayment(shopId, req.user!.id, plan);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async activateSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId, plan, paymentId } = req.body;
      const shop = await paymentService.activateSubscription(shopId, req.user!.id, plan, paymentId);
      res.json(shop);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new PaymentController();
