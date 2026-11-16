import { Router } from 'express';
import shopController from './shop.controller';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware';
import { uploadSingle, handleUploadError } from '../../middleware/upload.middleware';
import { cacheMiddleware } from '../../middleware/cache.middleware';

const router = Router();

// Public routes
router.get('/search', shopController.searchShops.bind(shopController));
router.get('/nearby', cacheMiddleware(300), shopController.getNearbyShops.bind(shopController));
router.get('/slug/:slug', cacheMiddleware(300), shopController.getShopBySlug.bind(shopController));
router.get('/me/saved', authenticate, shopController.getSavedShops.bind(shopController));
router.get('/me/shops', authenticate, authorize('SELLER', 'ADMIN'), shopController.getMyShops.bind(shopController));
router.get('/:id', cacheMiddleware(300), shopController.getShopById.bind(shopController));
router.post('/:id/intent', shopController.logShopIntent.bind(shopController));

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
router.get('/:id/settings', authenticate, authorize('SELLER', 'ADMIN'), shopController.getShopSettings.bind(shopController));
router.put('/:id/settings', authenticate, authorize('SELLER', 'ADMIN'), shopController.updateShopSettings.bind(shopController));
router.get('/:id/daily-digest', authenticate, authorize('SELLER', 'ADMIN'), shopController.getDailyDigest.bind(shopController));
router.get('/:id/audit-logs', authenticate, authorize('SELLER', 'ADMIN'), shopController.getAuditLogs.bind(shopController));
router.get('/:id/analytics', authenticate, authorize('SELLER', 'ADMIN'), shopController.getAnalytics.bind(shopController));
router.get('/:id/followers', authenticate, authorize('SELLER', 'ADMIN'), shopController.getShopFollowers.bind(shopController));
router.post('/:id/broadcast', authenticate, authorize('SELLER', 'ADMIN'), shopController.broadcastToFollowers.bind(shopController));
router.get('/:id/cart-items', authenticate, authorize('SELLER', 'ADMIN'), shopController.getCartAdders.bind(shopController));
router.post('/:id/cart-discount', authenticate, authorize('SELLER', 'ADMIN'), shopController.sendCartDiscount.bind(shopController));
router.get('/:id/slots', optionalAuth, shopController.getShopSlots.bind(shopController));
router.get('/:id/closures', authenticate, authorize('SELLER', 'ADMIN'), shopController.getShopClosures.bind(shopController));
router.post('/:id/closures', authenticate, authorize('SELLER', 'ADMIN'), shopController.addShopClosure.bind(shopController));
router.delete('/:id/closures/:date', authenticate, authorize('SELLER', 'ADMIN'), shopController.deleteShopClosure.bind(shopController));
router.post('/:id/save', authenticate, shopController.toggleSaveShop.bind(shopController));

export default router;
