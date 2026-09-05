import { Queue, Worker } from 'bullmq';
import prisma from '../config/database';
import redis from '../config/redis';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const telemetrySyncQueue = new Queue('telemetry-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

const telemetrySyncWorker = new Worker(
  'telemetry-sync',
  async () => {
    const timestamp = Date.now();
    const tempProductKey = `telemetry:views:product:processing:${timestamp}`;
    const tempShopKey = `telemetry:views:shop:processing:${timestamp}`;

    let productViewsProcessed = 0;
    let shopViewsProcessed = 0;

    try {
      // 1. Rename to avoid race conditions and gather data atomically
      await redis.rename('telemetry:views:product', tempProductKey).catch(() => null);
      await redis.rename('telemetry:views:shop', tempShopKey).catch(() => null);

      const productViews = await redis.hgetall(tempProductKey);
      const shopViews = await redis.hgetall(tempShopKey);

      const productIds = Object.keys(productViews);
      const shopIds = Object.keys(shopViews);

      // 2. Process Product Views (Batch Update)
      if (productIds.length > 0) {
        await prisma.$transaction(
          productIds.map((id) =>
            prisma.product.update({
              where: { id },
              data: { viewCount: { increment: parseInt(productViews[id], 10) } },
            })
          )
        );
        productViewsProcessed = productIds.length;
      }

      // 3. Process Shop Views (Batch Upsert)
      if (shopIds.length > 0) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        await prisma.$transaction(
          shopIds.map((id) =>
            prisma.shopAnalytics.upsert({
              where: { shopId_date: { shopId: id, date: today } },
              update: { views: { increment: parseInt(shopViews[id], 10) } },
              create: {
                shopId: id,
                date: today,
                views: parseInt(shopViews[id], 10),
                uniqueViews: 1,
                orders: 0,
                revenue: 0,
                calls: 0,
                whatsappClicks: 0,
                directions: 0,
              },
            })
          )
        );
        shopViewsProcessed = shopIds.length;
      }

    } finally {
      // 4. Cleanup
      await redis.del(tempProductKey).catch(() => null);
      await redis.del(tempShopKey).catch(() => null);
    }

    return { productViewsProcessed, shopViewsProcessed };
  },
  { connection }
);

export async function scheduleTelemetrySync() {
  await telemetrySyncQueue.add('telemetry-sync', {}, {
    repeat: { every: 60 * 1000 }, // Run every 60 seconds
  });
}

telemetrySyncWorker.on('completed', (job, result) => {
  if (result.productViewsProcessed > 0 || result.shopViewsProcessed > 0) {
    console.log(`✅ Telemetry sync completed: ${result.productViewsProcessed} products, ${result.shopViewsProcessed} shops`);
  }
});

telemetrySyncWorker.on('failed', (_job, err) => {
  console.error('❌ Telemetry sync job failed:', err.message);
});

export default telemetrySyncQueue;
