import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth.middleware';
import CartController from './cart.controller';

const router = Router();

// Support both authenticated users and anonymous sessions identified via X-Device-Id
router.use(optionalAuth);

router.post('/sync', CartController.syncCart);
router.get('/', CartController.getCart);
router.delete('/', CartController.clearCart);
router.get('/vouchers', CartController.getVouchers);
router.post('/validate-voucher', CartController.validateVoucher);

export default router;
