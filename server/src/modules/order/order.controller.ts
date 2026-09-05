import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import orderService from './order.service';
import { createOrderSchema, updateOrderStatusSchema, orderQuerySchema } from './order.validator';

export class OrderController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = createOrderSchema.parse(req.body);
      const order = await orderService.createOrder(req.user!.id, validated);
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
}

export default new OrderController();
