import { Router } from 'express';
import authController from './auth.controller';
import { authLimiter, otpLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();

// POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, authController.sendOTP.bind(authController));

// POST /api/auth/verify-otp
router.post('/verify-otp', authLimiter, authController.verifyOTP.bind(authController));

// POST /api/auth/register
router.post('/register', authLimiter, authController.register.bind(authController));

// POST /api/auth/refresh-token
router.post('/refresh-token', authController.refreshToken.bind(authController));

export default router;
