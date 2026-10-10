import { Router } from 'express';
import { WishlistController } from './wishlist.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// All wishlist routes require authentication
router.use(protect);

router.get('/', WishlistController.getWishlist);
router.post('/toggle', WishlistController.toggleWishlist);
router.delete('/', WishlistController.clearWishlist);

export default router;
