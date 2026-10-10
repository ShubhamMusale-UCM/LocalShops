import { Router } from 'express';
import productController from './product.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { searchLimiter, uploadLimiter } from '../../middleware/rateLimiter.middleware';
import { uploadMultiple, handleUploadError, uploadCsv } from '../../middleware/upload.middleware';
import { cacheMiddleware } from '../../middleware/cache.middleware';

const router = Router();

// Public routes
router.get('/search', searchLimiter, cacheMiddleware(180), productController.searchProducts.bind(productController));
router.get('/trending', cacheMiddleware(180), productController.getTrending.bind(productController));
router.get('/shop/:shopId', cacheMiddleware(180), productController.getShopProducts.bind(productController));
router.post('/:id/click', productController.logProductClick.bind(productController));
router.get('/:id', cacheMiddleware(300), productController.getProduct.bind(productController));
router.get('/:id/compare', cacheMiddleware(300), productController.compareProducts.bind(productController));

// Authenticated seller routes
router.post(
	'/upload-images',
	authenticate,
	authorize('SELLER', 'ADMIN'),
	uploadLimiter,
	(req, res, next) => uploadMultiple(req, res, (err: any) => handleUploadError(err, req, res, next)),
	productController.uploadProductImages.bind(productController)
);
router.post(
	'/shop/:shopId/bulk-import',
	authenticate,
	authorize('SELLER', 'ADMIN'),
	uploadLimiter,
	(req, res, next) => uploadCsv(req, res, (err: any) => handleUploadError(err, req, res, next)),
	productController.bulkImport.bind(productController)
);
router.get('/seller/shop/:shopId', authenticate, authorize('SELLER', 'ADMIN'), productController.getSellerShopProducts.bind(productController));
router.post('/shop/:shopId', authenticate, authorize('SELLER', 'ADMIN'), productController.createProduct.bind(productController));
router.put('/shop/:shopId/bulk-update', authenticate, authorize('SELLER', 'ADMIN'), productController.bulkUpdate.bind(productController));
router.put('/:id', authenticate, authorize('SELLER', 'ADMIN'), productController.updateProduct.bind(productController));
router.delete('/:id', authenticate, authorize('SELLER', 'ADMIN'), productController.deleteProduct.bind(productController));

export default router;
