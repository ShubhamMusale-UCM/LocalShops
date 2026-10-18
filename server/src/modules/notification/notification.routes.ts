import { Router } from 'express';
import notificationController from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications.bind(notificationController));

// Mark as read
router.post('/:id/read', notificationController.markAsRead.bind(notificationController));

// Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead.bind(notificationController));

// Delete notification
router.delete('/:id', notificationController.deleteNotification.bind(notificationController));

// Test notification (for development)
router.post('/test', notificationController.sendTestNotification.bind(notificationController));

// Register/update FCM token for the authenticated user
router.post('/register-token', notificationController.registerToken.bind(notificationController));

// Broadcast campaigns for sellers
router.get('/campaigns', notificationController.getCampaigns.bind(notificationController));
router.post('/campaign/:id/cancel', notificationController.cancelCampaign.bind(notificationController));
router.delete('/campaign/:id', notificationController.deleteCampaign.bind(notificationController));

export default router;
