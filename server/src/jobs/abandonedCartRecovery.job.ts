/**
 * Automated Abandoned Cart Recovery Job
 *
 * Detects items in buyers' carts left for > 24 hours (or shop-configured delay).
 * Generates an exclusive, single-use, user-limited and shop-limited discount voucher.
 * Dispatches push & in-app notifications to re-engage the buyer.
 */

import { Queue, Worker, Job } from 'bullmq';
import { nanoid } from 'nanoid';
import prisma from '../config/database';
import notificationService from '../modules/notification/notification.service';
import shopService from '../modules/shop/shop.service';
import { logger } from '../utils/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const abandonedCartRecoveryQueue = new Queue('abandoned-cart-recovery', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    backoff: { type: 'exponential', delay: 30000 },
  },
});

export interface ProcessRecoveryResult {
  scannedCount: number;
  vouchersIssued: number;
  notificationsSent: number;
}

/**
 * Scan abandoned carts and issue exclusive recovery vouchers
 */
export async function processAbandonedCarts(defaultCutoffHours = 24): Promise<ProcessRecoveryResult> {
  const cutoffDate = new Date(Date.now() - defaultCutoffHours * 60 * 60 * 1000);

  // Find candidate items left for >= cutoff, not yet notified
  const candidateItems = await prisma.cartItem.findMany({
    where: {
      recoveryNotifiedAt: null,
      createdAt: { lte: cutoffDate },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          shopId: true,
          shop: {
            select: {
              id: true,
              name: true,
              isOpen: true,
            },
          },
        },
      },
    },
    take: 200,
  });

  if (!candidateItems || candidateItems.length === 0) {
    return { scannedCount: 0, vouchersIssued: 0, notificationsSent: 0 };
  }

  // Group items by buyer and shop: key = `${userId}:${shopId}`
  const userShopGroups = new Map<string, typeof candidateItems>();

  for (const item of candidateItems) {
    const shopId = item.shopId || item.product?.shopId;
    if (!shopId || !item.userId) continue;

    const groupKey = `${item.userId}::${shopId}`;
    if (!userShopGroups.has(groupKey)) {
      userShopGroups.set(groupKey, []);
    }
    userShopGroups.get(groupKey)!.push(item);
  }

  let vouchersIssued = 0;
  let notificationsSent = 0;

  for (const [groupKey, items] of userShopGroups.entries()) {
    try {
      const [userId, shopId] = groupKey.split('::');
      const sampleItem = items[0];
      const shopName = sampleItem.product?.shop?.name || 'Local Store';

      // 1. Fetch shop's extended recovery settings
      const shopSettings = await shopService.getExtendedShopSettings(shopId);

      // If seller explicitly disabled recovery, skip notifying for this shop
      if (shopSettings.abandonedCartRecoveryEnabled === false) {
        continue;
      }

      // Check shop specific delay (default 24 hours)
      const shopRequiredHours = typeof shopSettings.abandonedCartHours === 'number' && shopSettings.abandonedCartHours > 0
        ? shopSettings.abandonedCartHours
        : defaultCutoffHours;

      const shopCutoffDate = new Date(Date.now() - shopRequiredHours * 60 * 60 * 1000);
      const isAgedEnough = items.some((item) => new Date(item.createdAt) <= shopCutoffDate);
      if (!isAgedEnough) {
        continue;
      }

      // 2. Prevent duplicate active vouchers: check if user already has an active voucher for this shop
      const existingVoucher = await prisma.cartVoucher.findFirst({
        where: {
          userId,
          shopId,
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
      });

      if (existingVoucher) {
        // Mark items notified to prevent re-scanning without spamming
        await prisma.cartItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: {
            recoveryNotifiedAt: new Date(),
            recoveryVoucherCode: existingVoucher.code,
          },
        });
        continue;
      }

      // 3. Determine discount percentage (seller custom or standard 10%)
      const discountPercent = typeof shopSettings.abandonedCartDiscountPercent === 'number' &&
        shopSettings.abandonedCartDiscountPercent >= 1 &&
        shopSettings.abandonedCartDiscountPercent <= 50
          ? Math.round(shopSettings.abandonedCartDiscountPercent)
          : 10;

      // Unique exclusive voucher code
      const voucherCode = `SAVE${discountPercent}-${nanoid(5).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour validity

      // 4. Create CartVoucher record (locked to this userId & shopId)
      await prisma.cartVoucher.create({
        data: {
          userId,
          shopId,
          code: voucherCode,
          discountPercent,
          maxDiscount: 250,
          expiresAt,
          isUsed: false,
        },
      });
      vouchersIssued++;

      // 5. Update CartItems with voucher reference and notified timestamp
      await prisma.cartItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: {
          recoveryNotifiedAt: new Date(),
          recoveryVoucherCode: voucherCode,
          shopId,
        },
      });

      // 6. Send push & in-app notification to buyer
      const itemNames = items.map((i) => i.product?.name).filter(Boolean).slice(0, 2).join(', ');
      const title = `🛒 Special ${discountPercent}% OFF waiting in your cart!`;
      const body = items.length === 1
        ? `Your item "${itemNames}" from ${shopName} is waiting! Use code ${voucherCode} within 24h to save ${discountPercent}%.`
        : `Your items (${itemNames}...) from ${shopName} are waiting! Use code ${voucherCode} within 24h to save ${discountPercent}%.`;

      await notificationService.createNotification(userId, {
        title,
        body,
        type: 'PROMOTION',
        actionUrl: `/cart?voucher=${voucherCode}`,
      }).catch((notifErr) => {
        logger.warn('Failed to send abandoned cart recovery notification:', notifErr);
      });

      notificationsSent++;
    } catch (groupErr) {
      logger.error(`Error processing recovery for group ${groupKey}:`, groupErr);
    }
  }

  return {
    scannedCount: candidateItems.length,
    vouchersIssued,
    notificationsSent,
  };
}

/**
 * BullMQ Worker processing abandoned cart recovery
 */
export const abandonedCartRecoveryWorker = new Worker(
  'abandoned-cart-recovery',
  async (job: Job) => {
    logger.info(`Starting abandoned cart recovery job ${job.id}`);
    const cutoffHours = (job.data && job.data.cutoffHours) ? Number(job.data.cutoffHours) : 24;
    const result = await processAbandonedCarts(cutoffHours);
    logger.info(
      `Abandoned cart recovery complete: ${result.scannedCount} items scanned, ${result.vouchersIssued} vouchers issued, ${result.notificationsSent} notifications sent.`
    );
    return result;
  },
  { connection }
);

abandonedCartRecoveryWorker.on('failed', (job, err) => {
  logger.error(`Abandoned cart recovery job ${job?.id} failed:`, err);
});

/**
 * Schedule recurring abandoned cart recovery check every hour
 */
export async function scheduleAbandonedCartRecovery(): Promise<void> {
  const existingRepeatables = await abandonedCartRecoveryQueue.getRepeatableJobs();
  for (const job of existingRepeatables) {
    await abandonedCartRecoveryQueue.removeRepeatableByKey(job.key);
  }

  // Run every hour
  await abandonedCartRecoveryQueue.add(
    'process-abandoned-carts',
    { cutoffHours: 24 },
    {
      repeat: {
        pattern: '0 * * * *',
      },
    }
  );
  logger.info('Abandoned cart recovery job scheduled (every hour)');
}

export default abandonedCartRecoveryQueue;
