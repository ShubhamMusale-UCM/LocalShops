import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import cartService from './cart.service';

function resolveCartActorIds(req: AuthRequest): { primaryId: string | null; deviceActorId: string | null } {
  const rawDevice = req.headers['x-device-id'] ? String(req.headers['x-device-id']).trim() : '';
  const deviceActorId = rawDevice ? (rawDevice.startsWith('anon_') ? rawDevice : `anon_${rawDevice}`) : null;
  const primaryId = req.user?.id || deviceActorId;
  return { primaryId, deviceActorId };
}

export const CartController = {
  syncCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { primaryId, deviceActorId } = resolveCartActorIds(req);
      if (!primaryId) {
        res.json({ status: 'success', data: { items: [], count: 0, vouchers: [] } });
        return;
      }
      const items = Array.isArray(req.body) ? req.body : (req.body?.items || []);
      const result = await cartService.syncCart(primaryId, items, deviceActorId);
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
      const { primaryId, deviceActorId } = resolveCartActorIds(req);
      if (!primaryId) {
        res.json({ status: 'success', data: { items: [], count: 0, vouchers: [] } });
        return;
      }
      const result = await cartService.getCart(primaryId, deviceActorId);
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
      const { primaryId } = resolveCartActorIds(req);
      if (!primaryId) {
        res.json({ status: 'success', data: { success: true } });
        return;
      }
      const shopId = req.query.shopId as string | undefined;
      const result = await cartService.clearCart(primaryId, shopId);
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
      const { primaryId, deviceActorId } = resolveCartActorIds(req);
      if (!primaryId) {
        res.json({ status: 'success', data: [] });
        return;
      }
      const shopId = req.query.shopId as string | undefined;
      const vouchers = await cartService.getUserVouchers(primaryId, shopId, deviceActorId);
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
      const { primaryId, deviceActorId } = resolveCartActorIds(req);
      if (!primaryId) {
        res.status(401).json({ status: 'fail', message: 'User or device identification required' });
        return;
      }

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

      const result = await cartService.validateAndApplyVoucher(code, primaryId, shopId, parsedSubtotal, deviceActorId);
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
