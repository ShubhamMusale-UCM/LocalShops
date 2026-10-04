/**
 * Wallet Expiry Background Job
 *
 * Runs daily to:
 * 1. Expire buyer wallet coins past their 90-day expiry
 * 2. Expire seller ad wallet credits past their 180-day expiry
 * 3. Send warning notifications 7 days before expiry
 */

import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import walletService from '../modules/wallet/wallet.service';
import notificationService from '../modules/notification/notification.service';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const walletExpiryQueue = new Queue('wallet-expiry', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    backoff: { type: 'exponential', delay: 60000 },
  },
});

const walletExpiryWorker = new Worker(
  'wallet-expiry',
  async (_job: Job) => {
    const results = {
      expired: { processed: 0, totalExpired: 0 },
      warnings: { sent: 0 },
    };

    // 1. Process expired coins (both buyer and seller)
    try {
      results.expired = await walletService.processExpiredCoins();
    } catch (error) {
      console.error('Error processing expired coins:', error);
    }

    // 2. Send expiry warning notifications (7 days before)
    try {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 7);

      const soonExpiringCredits = await prisma.walletTransaction.findMany({
        where: {
          direction: 'CREDIT',
          isExpired: false,
          expiresAt: {
            not: null,
            gt: new Date(),
            lte: warningDate,
          },
          type: { in: ['REFERRAL_CREDIT', 'ADMIN_CREDIT', 'BOOKING_REFUND'] },
        },
        include: {
          wallet: {
            select: { userId: true },
          },
        },
      });

      // Group by user to avoid duplicate notifications
      const userIds = new Set(
        soonExpiringCredits.map((c) => c.wallet.userId),
      );

      for (const userId of userIds) {
        const userCredits = soonExpiringCredits.filter(
          (c) => c.wallet.userId === userId,
        );
        const totalExpiring = userCredits.reduce(
          (sum, c) => sum + c.amount,
          0,
        );

        // Check if we already sent a notification for this batch today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'WALLET_ALERT',
            createdAt: { gte: today },
          },
        });

        if (!existingNotification && totalExpiring > 0) {
          await notificationService.createNotification(userId, {
            title: '⏰ Coins Expiring Soon!',
            body: `Your ₹${totalExpiring} coins will expire in 7 days. Use them on your next booking!`,
            type: 'WALLET_ALERT',
          });
          results.warnings.sent++;
        }
      }
    } catch (error) {
      console.error('Error sending expiry warnings:', error);
    }

    return results;
  },
  { connection },
);

export async function scheduleWalletExpiry() {
  await walletExpiryQueue.add(
    'wallet-expiry',
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 }, // Every 24 hours
    },
  );
}

walletExpiryWorker.on('completed', (_job, result) => {
  console.log('✅ Wallet expiry job completed:', result);
});

walletExpiryWorker.on('failed', (_job, err) => {
  console.error('❌ Wallet expiry job failed:', err.message);
});

export default walletExpiryQueue;
