import { Router } from 'express';
import { SubscriptionController } from './subscription.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/plans', SubscriptionController.getPlans);

// Protected routes
router.use(authenticate);

router.get('/my-subscription', SubscriptionController.getUserSubscription);
router.get('/usage', SubscriptionController.getUsage);

router.post('/create', SubscriptionController.createSubscription);
router.put('/upgrade', SubscriptionController.upgradeSubscription);
router.post('/cancel', SubscriptionController.cancelSubscription);

export default router;
