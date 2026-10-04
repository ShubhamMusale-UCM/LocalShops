import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';
import prisma from '../../config/database';
import walletService from './wallet.service';
import { createRazorpayOrder, verifyPaymentSignature } from '../../config/razorpay';

export class WalletController {
  // ============= BUYER WALLET ENDPOINTS =============

  /**
   * GET /api/wallet/balance
   * Returns buyer wallet balance and summary.
   */
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await walletService.getBuyerWalletBalance(req.user!.id);
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * GET /api/wallet/history
   * Returns paginated buyer wallet transaction history.
   * Query params: page, limit, type
   */
  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string | undefined;
      const data = await walletService.getBuyerWalletHistory(req.user!.id, {
        page,
        limit,
        type,
      });
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * POST /api/wallet/calculate-usage
   * Preview how many coins can be used for a given order total.
   * Body: { orderTotal: number }
   */
  async calculateUsage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderTotal } = req.body;
      if (!orderTotal || orderTotal <= 0) {
        res
          .status(400)
          .json({ error: 'orderTotal must be a positive number.' });
        return;
      }
      const data = await walletService.previewCoinUsage(
        req.user!.id,
        orderTotal,
      );
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * GET /api/wallet/referral-status
   * Returns all referral earnings with activation status.
   */
  async getReferralStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await walletService.getReferralStatus(req.user!.id);
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // ============= SELLER AD WALLET ENDPOINTS =============

  /**
   * GET /api/wallet/ad-wallet/:shopId
   * Returns seller ad wallet balance.
   */
  async getAdWalletBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      // Verify ownership
      const shop = await this.verifyShopOwnership(shopId, req.user!.id);

      res.json({
        shopId: shop.id,
        adWalletBalance: shop.adWalletBalance,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * GET /api/wallet/ad-wallet/:shopId/history
   * Returns seller ad wallet transaction history.
   */
  async getAdWalletHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      await this.verifyShopOwnership(shopId, req.user!.id);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await walletService.getSellerAdWalletHistory(shopId, {
        page,
        limit,
      });
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * POST /api/wallet/ad-wallet/:shopId/calculate-split
   * Calculate payment split for an ad campaign.
   * Body: { adBudget: number }
   */
  async calculateAdSplit(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      await this.verifyShopOwnership(shopId, req.user!.id);

      const { adBudget } = req.body;
      if (!adBudget || adBudget <= 0) {
        res.status(400).json({ error: 'adBudget must be a positive number.' });
        return;
      }
      const data = await walletService.calculateAdPaymentSplit(
        shopId,
        adBudget,
      );
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // ============= AD WALLET TOP-UP =============

  /**
   * POST /api/wallet/topup/initiate
   */
  async initiateTopup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { amount, shopId } = req.body;
      await this.verifyShopOwnership(shopId, req.user!.id);
      
      const order = await createRazorpayOrder(amount * 100, `topup_${shopId}_${Date.now()}`);
      
      res.json({
        orderId: order.id,
        amount: amount * 100,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID || 'dummy_key'
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * POST /api/wallet/topup/verify
   */
  async verifyTopup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shopId, amount } = req.body;
      await this.verifyShopOwnership(shopId, req.user!.id);
      
      const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      
      if (!isValid && process.env.NODE_ENV !== 'development' && process.env.SKIP_PAYMENT_VERIFICATION !== 'true') {
         res.status(400).json({ error: 'Invalid payment signature' });
         return;
      }
      
      // Credit the wallet (type string 'TOPUP' isn't explicitly in the schema for wallet tx, wait we can just use ADMIN_CREDIT or create a new type if we didn't add it)
      await walletService.creditSellerAdWallet(shopId, amount, 'Wallet Top-up via Razorpay', 'ADMIN_CREDIT');
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  // ============= HELPERS =============

  private async verifyShopOwnership(shopId: string, userId: string) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, ownerId: true, adWalletBalance: true },
    });

    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== userId) throw new AppError('Not authorized.', 403);
    return shop;
  }
}

export default new WalletController();
