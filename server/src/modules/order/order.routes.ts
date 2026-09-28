import { Router } from 'express';
import orderController from './order.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { orderLimiter } from '../../middleware/rateLimiter.middleware';
import { uploadPhotos } from '../../middleware/upload.middleware';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// Buyer routes
router.post('/', orderLimiter, orderController.create.bind(orderController));
router.get('/', orderController.getMyOrders.bind(orderController));
router.get('/:id', orderController.getById.bind(orderController));
router.post('/:id/cancel', orderController.cancel.bind(orderController));
router.post('/:id/return', orderController.requestReturn.bind(orderController));
router.post('/:id/review', uploadPhotos, orderController.addReview.bind(orderController));

// Seller routes
router.get('/shop/:shopId', authorize('SELLER', 'ADMIN'), orderController.getShopOrders.bind(orderController));
router.put('/:id/status', authorize('SELLER', 'ADMIN'), orderController.updateStatus.bind(orderController));
router.put('/return/:returnId/status', authorize('SELLER', 'ADMIN'), orderController.updateReturnStatus.bind(orderController));

export default router;
