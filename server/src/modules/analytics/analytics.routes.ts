import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/seller', AnalyticsController.getSellerAnalytics);
router.get('/daily-sales', AnalyticsController.getDailySalesTrend);
router.get('/products', AnalyticsController.getProductPerformance);
router.get('/categories', AnalyticsController.getCategoryAnalytics);
router.get('/customers', AnalyticsController.getCustomerInsights);
router.get('/reviews', AnalyticsController.getReviewAnalytics);
router.get('/ads', AnalyticsController.getAdAnalytics);
router.get('/report', AnalyticsController.generateReport);

export default router;
