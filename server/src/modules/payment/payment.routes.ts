import { Router } from 'express';
import paymentController from './payment.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Webhook (no auth — called by Razorpay)
router.post('/webhook', paymentController.webhook.bind(paymentController));

// Authenticated routes
router.post('/create-order', authenticate, paymentController.createProductPaymentOrder.bind(paymentController));
router.post('/create-payment-order', authenticate, paymentController.createOrder.bind(paymentController));
router.post('/verify', authenticate, paymentController.verify.bind(paymentController));

// Subscription (seller only)
router.post('/subscription', authenticate, authorize('SELLER', 'ADMIN'), paymentController.createSubscription.bind(paymentController));
router.post('/subscription/activate', authenticate, authorize('SELLER', 'ADMIN'), paymentController.activateSubscription.bind(paymentController));

export default router;
