import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import CartController from './cart.controller';

const router = Router();

// All cart endpoints require authentication
router.use(authenticate);

router.post('/sync', CartController.syncCart);
router.get('/', CartController.getCart);
router.delete('/', CartController.clearCart);
router.get('/vouchers', CartController.getVouchers);
router.post('/validate-voucher', CartController.validateVoucher);

export default router;
