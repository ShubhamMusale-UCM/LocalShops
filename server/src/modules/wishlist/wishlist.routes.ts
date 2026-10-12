import { Router } from 'express';
import { WishlistController } from './wishlist.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

router.get('/', WishlistController.getWishlist);
router.post('/toggle', WishlistController.toggleWishlist);
router.delete('/', WishlistController.clearWishlist);

export default router;
