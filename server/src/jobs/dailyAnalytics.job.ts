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

    const [shops, orderAggs, reviewAggs] = await Promise.all([
      prisma.shop.findMany({ select: { id: true } }),
      prisma.order.groupBy({
        by: ['shopId'],
        where: {
          createdAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.review.groupBy({
        by: ['shopId'],
        _count: { id: true },
      }),
    ]);

    const orderMap = new Map(orderAggs.map(o => [o.shopId, { count: o._count.id, revenue: o._sum.total || 0 }]));
    const reviewMap = new Map(reviewAggs.map(r => [r.shopId, r._count.id]));

    let processed = 0;
    const CHUNK_SIZE = 25;
    for (let i = 0; i < shops.length; i += CHUNK_SIZE) {
      const chunk = shops.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (shop) => {
          const ord = orderMap.get(shop.id) || { count: 0, revenue: 0 };
          const totalReviews = reviewMap.get(shop.id) || 0;

          await Promise.all([
            prisma.shopAnalytics.upsert({
              where: { shopId_date: { shopId: shop.id, date: start } },
              update: {
                orders: ord.count,
                revenue: ord.revenue,
              },
              create: {
                shopId: shop.id,
                date: start,
                orders: ord.count,
                revenue: ord.revenue,
                views: 0,
                uniqueViews: 0,
                calls: 0,
                whatsappClicks: 0,
                directions: 0,
              },
            }),
            prisma.shop.update({
              where: { id: shop.id },
              data: { totalReviews },
            }),
          ]);
        })
      );
      processed += chunk.length;
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
