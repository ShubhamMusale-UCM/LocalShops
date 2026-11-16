import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import orderService from './order.service';
import { createOrderSchema, updateOrderStatusSchema, orderQuerySchema } from './order.validator';
import reviewService from '../review/review.service';
import { processAndUploadImage } from '../../utils/imageProcessor';

export class OrderController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = createOrderSchema.parse(req.body);
      const rawDevice = req.headers['x-device-id'] ? String(req.headers['x-device-id']).trim() : '';
      const deviceActorId = rawDevice ? (rawDevice.startsWith('anon_') ? rawDevice : `anon_${rawDevice}`) : undefined;
      const order = await orderService.createOrder(req.user!.id, validated, deviceActorId);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  async getMyOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const params = orderQuerySchema.parse(req.query);
      const result = await orderService.getUserOrders(req.user!.id, params);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const order = await orderService.getOrderById(req.params.id, req.user!.id);
      res.json(order);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const params = orderQuerySchema.parse(req.query);
      const result = await orderService.getShopOrders(req.params.shopId, req.user!.id, params);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, note } = updateOrderStatusSchema.parse(req.body);
      const order = await orderService.updateOrderStatus(req.params.id, req.user!.id, status, note);
      res.json(order);
    } catch (error: any) {
      console.error('updateStatus error:', error);
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async cancel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const order = await orderService.cancelOrder(req.params.id, req.user!.id, reason);
      res.json(order);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async requestReturn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reason, description, photos } = req.body;
      const returnReq = await orderService.requestReturn(req.params.id, req.user!.id, { reason, description, photos });
      res.status(201).json(returnReq);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async updateReturnStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, note } = req.body;
      const returnReq = await orderService.updateReturnStatus(req.params.returnId, req.user!.id, status, note);
      res.json(returnReq);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async addReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { rating, comment } = req.body;
      const orderId = req.params.id;
      
      const order = await orderService.getOrderById(orderId, req.user!.id);
      if (!order) throw new Error('Order not found');
      
      const productId = order.items?.[0]?.productId;
      if (!productId) throw new Error('Order has no items');
      
      const files = req.files as Express.Multer.File[] | undefined;
      const photos: string[] = [];
      
      if (files && files.length > 0) {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:5000';
        const publicBaseUrl = `${protocol}://${host}`;
        
        for (const file of files) {
          const processed = await processAndUploadImage(file.buffer, 'reviews', false, publicBaseUrl, file.mimetype);
          photos.push(processed.full);
        }
      }
      
      const reviewPayload = {
        shopId: order.shopId,
        productId,
        orderId,
        rating: Number(rating),
        comment,
        photos
      };
      
      const review = await reviewService.createReview(req.user!.id, reviewPayload);
      res.status(201).json(review);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async clearCancelled(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await orderService.clearCancelledOrders(req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async archiveShopOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await orderService.archiveShopOrder(req.params.shopId, req.user!.id, req.params.orderId);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async restoreShopOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await orderService.restoreShopOrder(req.params.shopId, req.user!.id, req.params.orderId);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getArchivedOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const orders = await orderService.getArchivedOrders(req.params.shopId, req.user!.id);
      res.json({ orders });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async exportOrdersCsv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const csv = await orderService.exportOrdersCsv(req.params.shopId, req.user!.id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="orders-${req.params.shopId}.csv"`);
      res.status(200).send(csv);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async clearShopRejected(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await orderService.clearShopRejectedOrders(req.params.shopId, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async downloadSlipPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pdfBuffer, orderNumber } = await orderService.generateOrderSlip(id, req.user!.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="dispatch-slip-${orderNumber}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).send(pdfBuffer);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new OrderController();
