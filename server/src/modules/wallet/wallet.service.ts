import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

// ============= CONFIGURATION =============

const WALLET_CONFIG = {
  /** Amount credited per successful referral (in ₹) */
  REFERRAL_AMOUNT: 50,
  /** Maximum wallet balance a buyer can hold */
  MAX_BUYER_BALANCE: 500,
  /** Maximum percentage of order total payable with coins */
  MAX_COIN_USAGE_PERCENT: 20,
  /** Maximum absolute coin usage per order (in ₹) */
  MAX_COIN_USAGE_ABSOLUTE: 100,
  /** Number of days before buyer coins expire */
  BUYER_COIN_EXPIRY_DAYS: 90,
  /** Number of days before seller ad wallet credits expire */
  SELLER_CREDIT_EXPIRY_DAYS: 180,
  /** Maximum seller ad wallet balance */
  MAX_SELLER_AD_WALLET: 2000,
  /** Maximum referrals a user can make per month */
  MAX_REFERRALS_PER_MONTH: 20,
} as const;

export { WALLET_CONFIG };

export class WalletService {
  // ============= BUYER WALLET =============

  /**
   * Get or create buyer wallet for a user.
   * Ensures every buyer always has a wallet record.
   */
  async getOrCreateBuyerWallet(userId: string) {
    let wallet = await prisma.buyerWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await prisma.buyerWallet.create({
        data: { userId, balance: 0, lifetime: 0, spent: 0, expired: 0 },
      });
    }

    return wallet;
  }

  /**
   * Get buyer wallet balance and summary.
   */
  async getBuyerWalletBalance(userId: string) {
    const wallet = await this.getOrCreateBuyerWallet(userId);

    // Find next expiring credits
    const nextExpiry = await prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        direction: 'CREDIT',
        isExpired: false,
        expiresAt: { not: null, gt: new Date() },
        type: { in: ['REFERRAL_CREDIT', 'ADMIN_CREDIT', 'BOOKING_REFUND'] },
      },
      orderBy: { expiresAt: 'asc' },
      select: { amount: true, expiresAt: true },
    });

    return {
      balance: wallet.balance,
      lifetime: wallet.lifetime,
      spent: wallet.spent,
      expired: wallet.expired,
      nextExpiry: nextExpiry
        ? { amount: nextExpiry.amount, expiresAt: nextExpiry.expiresAt }
        : null,
    };
  }

  /**
   * Credit coins to a buyer's wallet (e.g., from a referral).
   * Returns the updated wallet and the transaction record.
   */
  async creditBuyerWallet(
    userId: string,
    amount: number,
    type: 'REFERRAL_CREDIT' | 'BOOKING_REFUND' | 'ADMIN_CREDIT',
    description: string,
    referenceId?: string,
    referenceType?: string,
    expiryDays?: number,
  ) {
    if (amount <= 0) throw new AppError('Credit amount must be positive.', 400);

    return await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      let wallet = await tx.buyerWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.buyerWallet.create({
          data: { userId, balance: 0, lifetime: 0, spent: 0, expired: 0 },
        });
      }

      // Idempotency check
      if (referenceId) {
        const existingTx = await tx.walletTransaction.findFirst({
          where: { walletId: wallet.id, referenceId, type },
        });
        if (existingTx) return { wallet, transaction: existingTx };
      }

      // Lock the row
      const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT balance, id FROM "BuyerWallet" WHERE "userId" = ${userId} FOR UPDATE`;
      if (!lockedWallet) throw new AppError('Wallet lock failed.', 500);

      // Idempotency check
      if (referenceId) {
        const existingTx = await tx.walletTransaction.findFirst({
          where: { walletId: lockedWallet.id, referenceId, type },
        });
        if (existingTx) {
          const walletState = await tx.buyerWallet.findUnique({ where: { userId } });
          return { wallet: walletState, transaction: existingTx };
        }
      }

      const currentBalance = lockedWallet.balance;
      if (currentBalance + amount > WALLET_CONFIG.MAX_BUYER_BALANCE) {
        throw new AppError(
          `Wallet balance cannot exceed ₹${WALLET_CONFIG.MAX_BUYER_BALANCE}. Current balance: ₹${currentBalance}.`,
          400,
        );
      }

      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + (expiryDays ?? WALLET_CONFIG.BUYER_COIN_EXPIRY_DAYS),
      );

      const newBalance = currentBalance + amount;

      const updatedWallet = await tx.buyerWallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          lifetime: { increment: amount },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: lockedWallet.id,
          type,
          amount,
          direction: 'CREDIT',
          balanceAfter: newBalance,
          description,
          referenceId,
          referenceType,
          expiresAt,
          isExpired: false,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Debit coins from a buyer's wallet (e.g., for a booking).
   * Uses FIFO (oldest credits consumed first).
   */
  async debitBuyerWallet(
    userId: string,
    amount: number,
    type: 'BOOKING_DEBIT' | 'EXPIRY_DEBIT' | 'ADMIN_DEBIT',
    description: string,
    referenceId?: string,
    referenceType?: string,
  ) {
    if (amount <= 0) throw new AppError('Debit amount must be positive.', 400);

    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.buyerWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.buyerWallet.create({
          data: { userId, balance: 0, lifetime: 0, spent: 0, expired: 0 },
        });
      }

      const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT balance, id FROM "BuyerWallet" WHERE "userId" = ${userId} FOR UPDATE`;
      if (!lockedWallet) throw new AppError('Wallet lock failed.', 500);

      // Idempotency check
      if (referenceId) {
        const existingTx = await tx.walletTransaction.findFirst({
          where: { walletId: lockedWallet.id, referenceId, type },
        });
        if (existingTx) {
          const walletState = await tx.buyerWallet.findUnique({ where: { userId } });
          return { wallet: walletState, transaction: existingTx };
        }
      }

      const currentBalance = lockedWallet.balance;
      if (currentBalance < amount) {
        throw new AppError(
          `Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${amount}.`,
          400,
        );
      }

      const newBalance = currentBalance - amount;

      const updatedWallet = await tx.buyerWallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          ...(type === 'EXPIRY_DEBIT'
            ? { expired: { increment: amount } }
            : { spent: { increment: amount } }),
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: lockedWallet.id,
          type,
          amount,
          direction: 'DEBIT',
          balanceAfter: newBalance,
          description,
          referenceId,
          referenceType,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Get buyer wallet transaction history with pagination.
   */
  async getBuyerWalletHistory(
    userId: string,
    params: { page?: number; limit?: number; type?: string },
  ) {
    const wallet = await this.getOrCreateBuyerWallet(userId);
    const { page = 1, limit = 20, type } = params;

    const where: any = { walletId: wallet.id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate how many coins a buyer can use for a given order total.
   * Returns the usable amount based on business rules.
   */
  calculateMaxCoinUsage(walletBalance: number, orderTotal: number): number {
    if (walletBalance <= 0 || orderTotal <= 0) return 0;

    const percentCap =
      (orderTotal * WALLET_CONFIG.MAX_COIN_USAGE_PERCENT) / 100;
    const absoluteCap = WALLET_CONFIG.MAX_COIN_USAGE_ABSOLUTE;
    const maxAllowed = Math.min(percentCap, absoluteCap);

    return Math.min(walletBalance, maxAllowed, orderTotal);
  }

  /**
   * Preview coin usage for an order (called from checkout).
   */
  async previewCoinUsage(userId: string, orderTotal: number) {
    const wallet = await this.getOrCreateBuyerWallet(userId);
    const maxUsable = this.calculateMaxCoinUsage(wallet.balance, orderTotal);

    return {
      walletBalance: wallet.balance,
      orderTotal,
      maxCoinUsage: Math.floor(maxUsable * 100) / 100, // floor to 2 decimals
      razorpayAmount: orderTotal - Math.floor(maxUsable * 100) / 100,
      usagePercentCap: WALLET_CONFIG.MAX_COIN_USAGE_PERCENT,
      usageAbsoluteCap: WALLET_CONFIG.MAX_COIN_USAGE_ABSOLUTE,
    };
  }

  // ============= SELLER AD WALLET =============

  /**
   * Credit the seller's ad wallet (e.g., when buyer uses coins on a booking).
   */
  async creditSellerAdWallet(
    shopId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ) {
    if (amount <= 0) throw new AppError('Credit amount must be positive.', 400);

    return await prisma.$transaction(async (tx) => {
      const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance", id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`;
      if (!lockedShop) throw new AppError('Shop not found or lock failed.', 404);

      // Idempotency check
      if (referenceId) {
        const existingTx = await tx.sellerAdWalletTransaction.findFirst({
          where: { shopId: lockedShop.id, referenceId, type: 'SELLER_AD_CREDIT' },
        });
        if (existingTx) {
          const shopState = await tx.shop.findUnique({ where: { id: shopId } });
          return { shop: shopState, transaction: existingTx };
        }
      }

      let currentBalance = lockedShop.adWalletBalance;
      let actualAmount = amount;

      if (currentBalance + amount > WALLET_CONFIG.MAX_SELLER_AD_WALLET) {
        const cappedAmount = WALLET_CONFIG.MAX_SELLER_AD_WALLET - currentBalance;
        if (cappedAmount <= 0) return { shop: await tx.shop.findUnique({ where: { id: shopId } }), transaction: null };
        actualAmount = cappedAmount;
      }

      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + WALLET_CONFIG.SELLER_CREDIT_EXPIRY_DAYS,
      );

      const newBalance = currentBalance + actualAmount;

      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { adWalletBalance: { increment: actualAmount } },
      });

      const transaction = await tx.sellerAdWalletTransaction.create({
        data: {
          shopId,
          type: 'SELLER_AD_CREDIT',
          amount: actualAmount,
          direction: 'CREDIT',
          balanceAfter: newBalance,
          description,
          referenceId,
          referenceType,
          expiresAt,
        },
      });

      return { shop: updatedShop, transaction };
    });
  }

  /**
   * Debit from seller's ad wallet (e.g., for ad boosting).
   */
  async debitSellerAdWallet(
    shopId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ) {
    if (amount <= 0) throw new AppError('Debit amount must be positive.', 400);

    return await prisma.$transaction(async (tx) => {
      const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance", id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`;
      if (!lockedShop) throw new AppError('Shop not found or lock failed.', 404);

      // Idempotency check
      if (referenceId) {
        const existingTx = await tx.sellerAdWalletTransaction.findFirst({
          where: { shopId: lockedShop.id, referenceId, type: 'AD_SPEND_DEBIT' },
        });
        if (existingTx) {
          const shopState = await tx.shop.findUnique({ where: { id: shopId } });
          return { shop: shopState, transaction: existingTx };
        }
      }

      const currentBalance = lockedShop.adWalletBalance;

      if (currentBalance < amount) {
        throw new AppError(
          `Insufficient ad wallet balance. Available: ₹${currentBalance}.`,
          400,
        );
      }

      const newBalance = currentBalance - amount;

      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { adWalletBalance: { decrement: amount } },
      });

      const transaction = await tx.sellerAdWalletTransaction.create({
        data: {
          shopId,
          type: 'AD_SPEND_DEBIT',
          amount,
          direction: 'DEBIT',
          balanceAfter: newBalance,
          description,
          referenceId,
          referenceType,
        },
      });

      return { shop: updatedShop, transaction };
    });
  }

  /**
   * Calculate split payment for ads: how much from wallet vs Razorpay.
   */
  async calculateAdPaymentSplit(shopId: string, adBudget: number) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { adWalletBalance: true },
    });
    if (!shop) throw new AppError('Shop not found.', 404);

    const walletUsable = Math.min(shop.adWalletBalance, adBudget);
    const razorpayAmount = adBudget - walletUsable;

    return {
      adBudget,
      walletBalance: shop.adWalletBalance,
      walletDeduction: walletUsable,
      razorpayAmount,
      isFullWalletPayment: razorpayAmount <= 0,
    };
  }

  /**
   * Get seller ad wallet transaction history.
   */
  async getSellerAdWalletHistory(
    shopId: string,
    params: { page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = params;

    const [transactions, total] = await Promise.all([
      prisma.sellerAdWalletTransaction.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sellerAdWalletTransaction.count({ where: { shopId } }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============= REFERRAL ACTIVATION =============

  /**
   * Activate a pending referral earning after the referred user completes
   * their first booking. Credits coins to the referrer's wallet.
   * Called internally from order completion flow.
   */
  async activateReferralIfEligible(referredUserId: string) {
    // Find pending referral where this user is the referred user
    const pendingReferral = await prisma.referralEarning.findFirst({
      where: {
        referredUserId,
        status: 'PENDING',
        isPaid: false,
      },
    });

    if (!pendingReferral) return null;

    // Check if the referred user has at least 1 DELIVERED order with a minimum value (e.g., ₹100)
    const validOrder = await prisma.order.findFirst({
      where: { userId: referredUserId, status: 'DELIVERED', total: { gte: 100 } },
    });

    if (!validOrder) return null;

    // Check referrer monthly rate limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyActivated = await prisma.referralEarning.count({
      where: {
        referrerId: pendingReferral.referrerId,
        status: 'ACTIVATED',
        activatedAt: { gte: monthStart },
      },
    });

    if (monthlyActivated >= WALLET_CONFIG.MAX_REFERRALS_PER_MONTH) {
      return null; // Silently skip — rate limited
    }

    // Activate the referral atomically
    const updateResult = await prisma.referralEarning.updateMany({
      where: { id: pendingReferral.id, status: 'PENDING', isPaid: false },
      data: {
        isPaid: true,
        status: 'ACTIVATED',
        activatedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Already activated concurrently
      return null;
    }

    // Credit the referrer's wallet
    try {
      const result = await this.creditBuyerWallet(
        pendingReferral.referrerId,
        pendingReferral.amount,
        'REFERRAL_CREDIT',
        `Referral reward: Your friend completed their first booking!`,
        pendingReferral.id,
        'REFERRAL',
      );

      return {
        referralId: pendingReferral.id,
        referrerId: pendingReferral.referrerId,
        amountCredited: pendingReferral.amount,
        walletBalance: result.wallet.balance,
      };
    } catch {
      // If wallet credit fails (e.g., max balance), still mark referral as activated
      // so it doesn't retry infinitely
      return {
        referralId: pendingReferral.id,
        referrerId: pendingReferral.referrerId,
        amountCredited: 0,
        walletBalance: null,
        note: 'Referral activated but wallet credit capped',
      };
    }
  }

  // ============= COIN EXPIRY (CRON JOB) =============

  /**
   * Process expired buyer wallet coins.
   * Finds credit transactions past their expiresAt that haven't been marked expired,
   * deducts the unused portion from the wallet balance.
   *
   * Called by the walletExpiry background job.
   */
  async processExpiredCoins(): Promise<{ processed: number; totalExpired: number }> {
    const now = new Date();

    const expiredCredits = await prisma.walletTransaction.findMany({
      where: {
        direction: 'CREDIT',
        isExpired: false,
        expiresAt: { not: null, lte: now },
        type: { in: ['REFERRAL_CREDIT', 'ADMIN_CREDIT', 'BOOKING_REFUND'] },
      },
      include: {
        wallet: { select: { userId: true, balance: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });

    let processed = 0;
    let totalExpired = 0;

    for (const credit of expiredCredits) {
      try {
        await prisma.$transaction(async (tx) => {
          const currentCredit = await tx.walletTransaction.findUnique({ where: { id: credit.id } });
          if (!currentCredit || currentCredit.isExpired) return;

          await tx.walletTransaction.update({
            where: { id: credit.id },
            data: { isExpired: true },
          });

          const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT balance, id FROM "BuyerWallet" WHERE "userId" = ${credit.wallet.userId} FOR UPDATE`;
          if (!lockedWallet) return;

          const currentBalance = lockedWallet.balance;
          const debitAmount = Math.min(credit.amount, currentBalance);
          if (debitAmount <= 0) return;

          const newBalance = currentBalance - debitAmount;
          await tx.buyerWallet.update({
            where: { userId: credit.wallet.userId },
            data: {
              balance: { decrement: debitAmount },
              expired: { increment: debitAmount },
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: lockedWallet.id,
              type: 'EXPIRY_DEBIT',
              amount: debitAmount,
              direction: 'DEBIT',
              balanceAfter: newBalance,
              description: `Coins expired (₹${debitAmount} from referral credit)`,
              referenceId: credit.id,
              referenceType: 'SYSTEM',
            },
          });

          totalExpired += debitAmount;
        });
      } catch (err) {
        // Skip on error
      }
      processed++;
    }

    const expiredSellerCredits = await prisma.sellerAdWalletTransaction.findMany({
      where: {
        direction: 'CREDIT',
        isExpired: false,
        expiresAt: { not: null, lte: now },
      },
      include: {
        shop: { select: { id: true, adWalletBalance: true } },
      },
    });

    for (const credit of expiredSellerCredits) {
      try {
        await prisma.$transaction(async (tx) => {
          const currentCredit = await tx.sellerAdWalletTransaction.findUnique({ where: { id: credit.id } });
          if (!currentCredit || currentCredit.isExpired) return;

          await tx.sellerAdWalletTransaction.update({
            where: { id: credit.id },
            data: { isExpired: true },
          });

          const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance", id FROM "Shop" WHERE id = ${credit.shop.id} FOR UPDATE`;
          if (!lockedShop) return;

          const currentBalance = lockedShop.adWalletBalance;
          const debitAmount = Math.min(credit.amount, currentBalance);
          if (debitAmount <= 0) return;

          const newBalance = currentBalance - debitAmount;
          await tx.shop.update({
            where: { id: credit.shop.id },
            data: { adWalletBalance: { decrement: debitAmount } },
          });

          await tx.sellerAdWalletTransaction.create({
            data: {
              shopId: lockedShop.id,
              type: 'EXPIRY_DEBIT',
              amount: debitAmount,
              direction: 'DEBIT',
              balanceAfter: newBalance,
              description: `Ad wallet credits expired (₹${debitAmount})`,
              referenceId: credit.id,
              referenceType: 'SYSTEM',
            },
          });

          totalExpired += debitAmount;
        });
      } catch (err) {
        // Skip on error
      }
    }

    return { processed, totalExpired };
  }

  // ============= REFERRAL STATUS =============

  async getReferralStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new AppError('User not found.', 404);

    const earnings = await prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = earnings.map(e => e.referredUserId);
    const referredUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true }
    });
    const userMap = new Map(referredUsers.map(u => [u.id, u]));

    const wallet = await this.getOrCreateBuyerWallet(userId);

    const pending = earnings.filter((e) => e.status === 'PENDING');
    const activated = earnings.filter((e) => e.status === 'ACTIVATED');

    return {
      referralCode: user.referralCode,
      walletBalance: wallet.balance,
      totalReferrals: earnings.length,
      totalEarned: activated.reduce((sum, e) => sum + e.amount, 0),
      pendingAmount: pending.reduce((sum, e) => sum + e.amount, 0),
      rewardPerReferral: WALLET_CONFIG.REFERRAL_AMOUNT,
      pendingReferrals: pending.map((e) => ({
        id: e.id,
        status: e.status,
        referredUser: userMap.get(e.referredUserId) || { name: 'Unknown User', avatar: null }
      })),
      completedReferrals: activated.map((e) => ({
        id: e.id,
        amountCredited: e.amount,
        referredUser: userMap.get(e.referredUserId) || { name: 'Unknown User', avatar: null }
      }))
    };
  }

  /**
   * Calculate how much of an ad budget can be covered by the seller's ad wallet,
   * and how much needs to be paid via Razorpay.
   */
}

export default new WalletService();
