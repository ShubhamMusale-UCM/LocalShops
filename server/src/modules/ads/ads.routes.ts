import { Router } from 'express';
import { AdsController } from './ads.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public route
router.get('/trending', AdsController.getTrendingProducts);
router.post('/impression', AdsController.trackImpressions);
router.post('/:adId/click', AdsController.trackAdClick);

// Protected routes for sellers
router.use(authenticate);

router.post('/create', AdsController.createAd);
router.get('/shop/:shopId', AdsController.getShopAds);
router.get('/shop/:shopId/analytics', AdsController.getShopPromotionAnalytics);
router.get('/:adId/analytics', AdsController.getAdAnalytics);
router.post('/:adId/pause', AdsController.pauseAd);
router.post('/:adId/resume', AdsController.resumeAd);
router.post('/:adId/renew-budget', AdsController.renewBudget);

export default router;
