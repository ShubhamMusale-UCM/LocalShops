import { Router } from 'express';
import walletController from './wallet.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// ============= BUYER WALLET =============

// GET /api/wallet/balance — Buyer wallet balance & summary
router.get('/balance', walletController.getBalance.bind(walletController));

// GET /api/wallet/history — Buyer wallet transaction history
router.get('/history', walletController.getHistory.bind(walletController));

// POST /api/wallet/calculate-usage — Preview coin usage for an order
router.post(
  '/calculate-usage',
  walletController.calculateUsage.bind(walletController),
);

// GET /api/wallet/referral-status — Referral earnings & activation status
router.get(
  '/referral-status',
  walletController.getReferralStatus.bind(walletController),
);

// ============= SELLER AD WALLET =============

// GET /api/wallet/ad-wallet/:shopId — Seller ad wallet balance
router.get(
  '/ad-wallet/:shopId',
  walletController.getAdWalletBalance.bind(walletController),
);

// GET /api/wallet/ad-wallet/:shopId/history — Seller ad wallet transaction history
router.get(
  '/ad-wallet/:shopId/history',
  walletController.getAdWalletHistory.bind(walletController),
);

// POST /api/wallet/ad-wallet/:shopId/calculate-split — Ad payment split calculator
router.post(
  '/ad-wallet/:shopId/calculate-split',
  walletController.calculateAdSplit.bind(walletController),
);

// POST /api/wallet/topup/initiate — Initiate ad wallet top-up
router.post(
  '/topup/initiate',
  walletController.initiateTopup.bind(walletController),
);

// POST /api/wallet/topup/verify — Verify ad wallet top-up
router.post(
  '/topup/verify',
  walletController.verifyTopup.bind(walletController),
);

export default router;
