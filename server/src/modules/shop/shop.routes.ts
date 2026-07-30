import { Router } from 'express';
import shopController from './shop.controller';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware';
import { uploadSingle, handleUploadError } from '../../middleware/upload.middleware';
import { cacheMiddleware } from '../../middleware/cache.middleware';

const router = Router();

// Public routes
router.get('/nearby', cacheMiddleware(300), shopController.getNearbyShops.bind(shopController));
router.get('/slug/:slug', cacheMiddleware(300), shopController.getShopBySlug.bind(shopController));
router.get('/:id', cacheMiddleware(300), shopController.getShopById.bind(shopController));

// Authenticated routes
router.post(
	'/upload-image',
	authenticate,
	authorize('SELLER', 'ADMIN'),
	(req, res, next) => uploadSingle(req, res, (err: any) => handleUploadError(err, req, res, next)),
	shopController.uploadShopImage.bind(shopController)
);
router.post('/', authenticate, authorize('SELLER', 'ADMIN'), shopController.createShop.bind(shopController));
router.put('/:id', authenticate, authorize('SELLER', 'ADMIN'), shopController.updateShop.bind(shopController));
router.get('/me/shops', authenticate, authorize('SELLER', 'ADMIN'), shopController.getMyShops.bind(shopController));
router.get('/:id/analytics', authenticate, authorize('SELLER', 'ADMIN'), shopController.getAnalytics.bind(shopController));

// Save/unsave
router.post('/:id/save', authenticate, shopController.toggleSaveShop.bind(shopController));
router.get('/me/saved', authenticate, shopController.getSavedShops.bind(shopController));

export default router;
