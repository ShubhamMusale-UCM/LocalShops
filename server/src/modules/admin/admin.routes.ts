import { Router } from 'express';
import AdminController from './admin.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/overview', AdminController.getOverview);
router.get('/analytics', AdminController.getAnalytics);

router.get('/users', AdminController.getUsers);
router.patch('/users/:userId/role', AdminController.updateUserRole);
router.patch('/users/:userId/status', AdminController.updateUserStatus);

router.get('/shops', AdminController.getShops);
router.patch('/shops/:shopId/status', AdminController.setShopStatus);
router.patch('/shops/:shopId/verify', AdminController.setShopVerification);

router.get('/reviews/flagged', AdminController.getFlaggedReviews);
router.post('/reviews/:reviewId/resolve', AdminController.resolveReviewReport);

// Marketing
router.post('/notifications/marketing', AdminController.sendMarketingNotification);

export default router;
