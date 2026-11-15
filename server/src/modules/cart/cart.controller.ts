import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import cartService from './cart.service';

export const CartController = {
  syncCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const items = req.body.items || [];
      const result = await cartService.syncCart(req.user!.id, items);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await cartService.getCart(req.user!.id);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  clearCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const result = await cartService.clearCart(req.user!.id, shopId);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getVouchers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const vouchers = await cartService.getUserVouchers(req.user!.id, shopId);
      res.json({
        status: 'success',
        data: vouchers,
      });
    } catch (error) {
      next(error);
    }
  },

  validateVoucher: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { code, shopId, subtotal } = req.body;
      const parsedSubtotal = parseFloat(subtotal);
      if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
        res.status(400).json({ status: 'fail', message: 'Valid subtotal required' });
        return;
      }
      if (!shopId) {
        res.status(400).json({ status: 'fail', message: 'shopId is required' });
        return;
      }

      const result = await cartService.validateAndApplyVoucher(code, req.user!.id, shopId, parsedSubtotal);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default CartController;
