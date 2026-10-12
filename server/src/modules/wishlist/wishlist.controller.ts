import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import wishlistService from './wishlist.service';

export const WishlistController = {
  getWishlist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const items = await wishlistService.getWishlist(req.user!.id);
      res.json({
        status: 'success',
        data: items
      });
    } catch (error) {
      next(error);
    }
  },

  toggleWishlist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        res.status(400).json({ status: 'fail', message: 'productId is required' });
        return;
      }
      
      const result = await wishlistService.toggleWishlist(req.user!.id, productId);
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  clearWishlist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await wishlistService.clearWishlist(req.user!.id);
      res.json({
        status: 'success',
        message: 'Wishlist cleared'
      });
    } catch (error) {
      next(error);
    }
  }
};
