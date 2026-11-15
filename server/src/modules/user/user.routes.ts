import { Router } from 'express';
import userController from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', userController.getProfile.bind(userController));

// PUT /api/users/profile
router.put('/profile', userController.updateProfile.bind(userController));

// POST /api/users/upgrade-to-seller
router.post('/upgrade-to-seller', userController.upgradeToSeller.bind(userController));

// PUT /api/users/location
router.put('/location', userController.updateLocation.bind(userController));

// GET /api/users/referrals
router.get('/referrals', userController.getReferrals.bind(userController));

// POST /api/users/support
router.post('/support', userController.createSupportTicket.bind(userController));

// GET /api/users/support
router.get('/support', userController.getSupportTickets.bind(userController));

// GET /api/users/category-visits
router.get('/category-visits', userController.getCategoryVisits.bind(userController));

// POST /api/users/category-visits
router.post('/category-visits', userController.recordCategoryVisit.bind(userController));

// GET /api/users/alert-preferences
router.get('/alert-preferences', userController.getAlertPreferences.bind(userController));

// PUT /api/users/alert-preferences
router.put('/alert-preferences', userController.updateAlertPreferences.bind(userController));

// Account Deletion & Data Portability (DPDP & Google Play Compliance)
router.post('/delete-request', userController.requestAccountDeletion.bind(userController));
router.post('/me/delete-request', userController.requestAccountDeletion.bind(userController));

router.post('/cancel-deletion', userController.cancelAccountDeletion.bind(userController));
router.post('/me/cancel-deletion', userController.cancelAccountDeletion.bind(userController));

router.get('/export', userController.exportUserData.bind(userController));
router.get('/me/export', userController.exportUserData.bind(userController));

export default router;
