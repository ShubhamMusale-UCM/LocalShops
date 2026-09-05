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

export default router;
