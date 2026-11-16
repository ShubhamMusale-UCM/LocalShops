/**
 * Scheduled Daily Showroom Digest Job (SEL-3)
 *
 * Runs automatically every evening at 20:00 IST for all merchants
 * with dailyDigest enabled. Compiles real-time metrics (bookings, revenue,
 * active floor holds, and low stock items), enforces idempotency via Redis,
 * and sends real-time notifications to the shop owner.
 */

import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import notificationService from '../modules/notification/notification.service';
import shopService from '../modules/shop/shop.service';
import { logger } from '../utils/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const dailyDigestQueue = new Queue('daily-digest', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
    backoff: { type: 'exponential', delay: 30000 },
  },
});

/**
 * Process daily digests for all eligible shops
 */
export async function processDailyDigests(targetDate = new Date()): Promise<{
  processedShops: number;
  digestsSent: number;
  skippedCount: number;
}> {
  const timeZone = 'Asia/Kolkata';
  const todayStr = targetDate.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD

  // Find all active shops with their settings
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    include: {
      settings: true,
      owner: { select: { id: true, name: true, phone: true } },
    },
  });

  let processedShops = 0;
  let digestsSent = 0;
  let skippedCount = 0;

  for (const shop of shops) {
    try {
      processedShops++;

      // Check toggles from shopSettings or fallback to shop_extended_settings
      const toggles: any = shop.settings?.notificationToggles || {};
      let isDigestEnabled = Boolean(toggles.dailyDigest);

      if (!isDigestEnabled) {
        // Check legacy JSON table
        const extRows = await prisma.$queryRawUnsafe<Array<{ settings: any }>>(
          `SELECT settings FROM shop_extended_settings WHERE shop_id = $1`,
          shop.id
        );
        if (Array.isArray(extRows) && extRows.length > 0) {
          isDigestEnabled = Boolean(extRows[0].settings?.dailyDigest);
        }
      }

      if (!isDigestEnabled) {
        skippedCount++;
        continue;
      }

      // Idempotency: digest:{shopId}:{YYYY-MM-DD}
      const idempotencyKey = `digest:${shop.id}:${todayStr}`;
      const alreadySent = await cacheGet(idempotencyKey);
      if (alreadySent) {
        skippedCount++;
        continue;
      }

      // Generate report
      const report = await shopService.getDailyDigestReport(shop.id, shop.ownerId);

      const title = `📊 Daily Digest — ${shop.name}`;
      const body = `Today: ${report.todayBookingsCount} bookings (₹${report.todayRevenue.toLocaleString('en-IN')}), ${report.activeHoldsCount} active holds, ${report.lowStockCount} items low stock.`;

      // Send in-app notification & push to seller
      await notificationService.createNotification(shop.ownerId, {
        title,
        body,
        type: 'SYSTEM',
        relatedId: shop.id,
        actionUrl: '/seller/dashboard',
        data: {
          type: 'DAILY_DIGEST',
          shopId: shop.id,
          date: todayStr,
          stats: {
            todayOrders: report.todayBookingsCount,
            todayRevenue: report.todayRevenue,
            activeHolds: report.activeHoldsCount,
            lowStockCount: report.lowStockCount,
          },
        },
      });

      // Mark idempotent key with 24 hours TTL
      await cacheSet(idempotencyKey, { sentAt: new Date().toISOString() }, 86400);

      digestsSent++;
      logger.info(`Daily digest sent for shop ${shop.name} (${shop.id})`);
    } catch (err: any) {
      logger.error(`Error sending daily digest for shop ${shop.id}: ${err?.message || err}`, { stack: err?.stack });
    }
  }

  logger.info(`Daily digest run complete: ${digestsSent} sent, ${skippedCount} skipped, ${processedShops} scanned.`);
  return { processedShops, digestsSent, skippedCount };
}

// Background Worker
export const dailyDigestWorker = new Worker(
  'daily-digest',
  async (job: Job) => {
    logger.info(`Starting daily digest job: ${job.name}`);
    return processDailyDigests();
  },
  { connection }
);

dailyDigestWorker.on('completed', (job) => {
  logger.info(`Daily digest job ${job.id} completed`);
});

dailyDigestWorker.on('failed', (job, err) => {
  logger.error(`Daily digest job ${job?.id} failed:`, err);
});

/**
 * Schedule repeatable BullMQ job at 20:00 IST daily
 */
export async function scheduleDailyDigestJob() {
  try {
    // BullMQ cron: every day at 20:00 (8:00 PM IST)
    // 20:00 IST is 14:30 UTC
    await dailyDigestQueue.add(
      'daily-digest-cron',
      {},
      {
        repeat: {
          pattern: '30 14 * * *', // 14:30 UTC = 20:00 IST
        },
        removeOnComplete: true,
      }
    );
    logger.info('Daily digest job scheduled (daily at 20:00 IST)');
  } catch (error) {
    logger.error('Failed to schedule daily digest job:', error);
  }
}

export default dailyDigestQueue;
