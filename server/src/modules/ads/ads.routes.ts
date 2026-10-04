import { Router } from 'express';
import { AdsController } from './ads.controller';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware';

const router = Router();

// Public route (optional auth for gender targeting)
router.get('/personalized', optionalAuth, AdsController.getPersonalizedAds);
router.get('/trending', optionalAuth, AdsController.getTrendingProducts);
router.post('/telemetry/batch', AdsController.processBatchTelemetry);

// Protected routes for sellers
router.use(authenticate);

router.post('/wallet/topup', AdsController.topUpWallet);
router.post('/wallet/verify', AdsController.verifyTopUpWallet);
router.post('/calculate-payment', AdsController.calculatePayment);
router.post('/create', AdsController.createAd);
router.get('/shop/:shopId', AdsController.getShopAds);
router.get('/shop/:shopId/analytics', AdsController.getShopPromotionAnalytics);
router.get('/shop/:shopId/daily-metrics', AdsController.getShopDailyMetrics);
router.get('/:adId/analytics', AdsController.getAdAnalytics);
router.post('/:adId/pause', AdsController.pauseAd);
router.post('/:adId/resume', AdsController.resumeAd);
router.post('/:adId/renew-budget', AdsController.renewBudget);
router.get('/:adId/negative-keywords', AdsController.getNegativeKeywords);
router.post('/:adId/negative-keywords', AdsController.addNegativeKeyword);
router.delete('/:adId/negative-keywords/:keywordId', AdsController.removeNegativeKeyword);

export default router;
