import { Router } from 'express';
import reviewController from './review.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/shop/:shopId', reviewController.getByShop.bind(reviewController));
router.get('/product/:productId', reviewController.getByProduct.bind(reviewController));

// Authenticated routes
router.post('/', authenticate, reviewController.create.bind(reviewController));
router.post('/:id/helpful', authenticate, reviewController.markHelpful.bind(reviewController));
router.post('/:id/reply', authenticate, authorize('SELLER', 'ADMIN'), reviewController.reply.bind(reviewController));

export default router;
