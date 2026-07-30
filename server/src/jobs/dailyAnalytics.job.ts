import { Queue, Worker } from 'bullmq';
import prisma from '../config/database';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const dailyAnalyticsQueue = new Queue('daily-analytics', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

const dailyAnalyticsWorker = new Worker(
  'daily-analytics',
  async () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const shops = await prisma.shop.findMany({ select: { id: true } });
    let processed = 0;

    for (const shop of shops) {
      const [orders, totalReviews] = await Promise.all([
        prisma.order.findMany({
          where: {
            shopId: shop.id,
            createdAt: { gte: start, lte: end },
            status: { not: 'CANCELLED' },
          },
          select: { total: true },
        }),
        prisma.review.count({ where: { shopId: shop.id } }),
      ]);

      const revenue = orders.reduce((sum, order) => sum + order.total, 0);

      await prisma.shopAnalytics.upsert({
        where: { shopId_date: { shopId: shop.id, date: start } },
        update: {
          orders: orders.length,
          revenue,
        },
        create: {
          shopId: shop.id,
          date: start,
          orders: orders.length,
          revenue,
          views: 0,
          uniqueViews: 0,
          calls: 0,
          whatsappClicks: 0,
          directions: 0,
        },
      });

      await prisma.shop.update({
        where: { id: shop.id },
        data: { totalReviews },
      });

      processed += 1;
    }

    return { processed, total: shops.length };
  },
  { connection }
);

export async function scheduleDailyAnalytics() {
  await dailyAnalyticsQueue.add('daily-analytics', {}, {
    repeat: { every: 24 * 60 * 60 * 1000 },
  });
}

dailyAnalyticsWorker.on('completed', () => {
  console.log('Daily analytics job completed');
});

dailyAnalyticsWorker.on('failed', (_job, err) => {
  console.error('Daily analytics job failed:', err.message);
});

export default dailyAnalyticsQueue;
