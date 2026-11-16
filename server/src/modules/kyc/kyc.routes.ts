import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import kycController from './kyc.controller';

const router = Router();

router.use(authenticate);

// Seller KYC document submission & status
router.post('/shops/:id/kyc', kycController.submitKyc.bind(kycController));
router.get('/shops/:id/kyc', kycController.getShopKyc.bind(kycController));

// Admin review endpoints
router.get('/admin/kyc/queue', kycController.getAdminQueue.bind(kycController));
router.put('/admin/kyc/:id/review', kycController.reviewKyc.bind(kycController));

export default router;
