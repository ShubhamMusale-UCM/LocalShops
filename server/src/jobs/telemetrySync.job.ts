import { Queue, Worker } from 'bullmq';
import prisma from '../config/database';
import redis, { cacheDelete, cacheDeletePattern } from '../config/redis';

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

async function getAndClearHash(key: string): Promise<Record<string, string>> {
  const tempKey = `${key}:processing:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
  try {
    await redis.rename(key, tempKey);
    const data = await redis.hgetall(tempKey);
    await redis.del(tempKey);
    return data || {};
  } catch {
    return {};
  }
}

export async function runTelemetrySyncNow() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateKey = today.toISOString().slice(0, 10);

  let productViewsProcessed = 0;
  let shopViewsProcessed = 0;
  const affectedShopIds = new Set<string>();
  const affectedProductIds = new Set<string>();

  try {
    // 1. Gather all buffered telemetry hashes atomically
    const [
      legacyProductViews,
      legacyShopViews,
      prodImpHash,
      prodViewHash,
      prodCartHash,
      shopProdImpHash,
      shopProdViewHash,
      shopCartHash,
    ] = await Promise.all([
      getAndClearHash('telemetry:views:product'),
      getAndClearHash('telemetry:views:shop'),
      getAndClearHash(`telemetry:prod:imp:${dateKey}`),
      getAndClearHash(`telemetry:prod:view:${dateKey}`),
      getAndClearHash(`telemetry:prod:cart:${dateKey}`),
      getAndClearHash(`telemetry:shop:prod_imp:${dateKey}`),
      getAndClearHash(`telemetry:shop:prod_view:${dateKey}`),
      getAndClearHash(`telemetry:shop:cart:${dateKey}`),
    ]);

    // 2. Process Product Daily Analytics & Lifetime viewCount
    const allProductIds = Array.from(
      new Set([
        ...Object.keys(legacyProductViews),
        ...Object.keys(prodImpHash),
        ...Object.keys(prodViewHash),
        ...Object.keys(prodCartHash),
      ])
    );

    if (allProductIds.length > 0) {
      const productRecords = await prisma.product.findMany({
        where: { id: { in: allProductIds } },
        select: { id: true, shopId: true },
      });
      const productShopMap = new Map(productRecords.map((p) => [p.id, p.shopId]));

      // Process in concurrent chunks of 25 to avoid N+1 serial bottleneck while protecting DB pool
      const CHUNK_SIZE = 25;
      for (let i = 0; i < allProductIds.length; i += CHUNK_SIZE) {
        const chunk = allProductIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (pid) => {
            const shopId = productShopMap.get(pid);
            if (!shopId) return;

            const impCount = parseInt(prodImpHash[pid] || '0', 10);
            const viewCount =
              parseInt(prodViewHash[pid] || '0', 10) +
              parseInt(legacyProductViews[pid] || '0', 10);
            const cartCount = parseInt(prodCartHash[pid] || '0', 10);

            if (impCount === 0 && viewCount === 0 && cartCount === 0) return;

            affectedShopIds.add(shopId);
            affectedProductIds.add(pid);

            const [uniqueImp, uniqueView] = await Promise.all([
              redis.pfcount(`hll:prod:imp:${dateKey}:${pid}`).catch(() => 0),
              redis.pfcount(`hll:prod:view:${dateKey}:${pid}`).catch(() => 0),
            ]);

            await Promise.all([
              prisma.productDailyAnalytics.upsert({
                where: { productId_date: { productId: pid, date: today } },
                update: {
                  ...(impCount > 0 && { impressions: { increment: impCount } }),
                  ...(uniqueImp > 0 && { uniqueImpressions: uniqueImp }),
                  ...(viewCount > 0 && { detailViews: { increment: viewCount } }),
                  ...(uniqueView > 0 && { uniqueDetailViews: uniqueView }),
                  ...(cartCount > 0 && { cartAdds: { increment: cartCount } }),
                },
                create: {
                  productId: pid,
                  shopId,
                  date: today,
                  impressions: impCount,
                  uniqueImpressions: uniqueImp > 0 ? uniqueImp : (impCount > 0 ? 1 : 0),
                  detailViews: viewCount,
                  uniqueDetailViews: uniqueView > 0 ? uniqueView : (viewCount > 0 ? 1 : 0),
                  cartAdds: cartCount,
                },
              }),
              ...(viewCount > 0
                ? [
                    prisma.product
                      .update({
                        where: { id: pid },
                        data: { viewCount: { increment: viewCount } },
                      })
                      .catch(() => {}),
                  ]
                : []),
            ]);
          })
        );
      }
      productViewsProcessed = allProductIds.length;
    }

    // 3. Process Shop Daily Analytics
    const allShopIds = Array.from(
      new Set([
        ...Object.keys(legacyShopViews),
        ...Object.keys(shopProdImpHash),
        ...Object.keys(shopProdViewHash),
        ...Object.keys(shopCartHash),
      ])
    );

    if (allShopIds.length > 0) {
      const SHOP_CHUNK_SIZE = 25;
      for (let i = 0; i < allShopIds.length; i += SHOP_CHUNK_SIZE) {
        const chunk = allShopIds.slice(i, i + SHOP_CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (sid) => {
            const storefrontViews = parseInt(legacyShopViews[sid] || '0', 10);
            const prodImpCount = parseInt(shopProdImpHash[sid] || '0', 10);
            const prodViewCount = parseInt(shopProdViewHash[sid] || '0', 10);
            const cartCount = parseInt(shopCartHash[sid] || '0', 10);

            if (
              storefrontViews === 0 &&
              prodImpCount === 0 &&
              prodViewCount === 0 &&
              cartCount === 0
            ) {
              return;
            }

            affectedShopIds.add(sid);

            const uniqueViews = await redis
              .pfcount(`hll:shop:view:${dateKey}:${sid}`)
              .catch(() => 0);

            await prisma.shopAnalytics.upsert({
              where: { shopId_date: { shopId: sid, date: today } },
              update: {
                ...(storefrontViews > 0 && { views: { increment: storefrontViews } }),
                ...(uniqueViews > 0 && { uniqueViews }),
                ...(prodImpCount > 0 && { productImpressions: { increment: prodImpCount } }),
                ...(prodViewCount > 0 && { productDetailViews: { increment: prodViewCount } }),
                ...(cartCount > 0 && { cartAdds: { increment: cartCount } }),
              },
              create: {
                shopId: sid,
                date: today,
                views: storefrontViews,
                uniqueViews: uniqueViews > 0 ? uniqueViews : (storefrontViews > 0 ? 1 : 0),
                productImpressions: prodImpCount,
                productDetailViews: prodViewCount,
                cartAdds: cartCount,
                orders: 0,
                revenue: 0,
                calls: 0,
                whatsappClicks: 0,
                directions: 0,
              },
            });
          })
        );
      }
      shopViewsProcessed = allShopIds.length;
    }

    // 4. Invalidate Redis caches & notify connected Seller screens in real time
    if (affectedShopIds.size > 0 || affectedProductIds.size > 0) {
      await Promise.all([
        ...Array.from(affectedShopIds).flatMap((sid) => [
          cacheDeletePattern(`shop:${sid}:analytics*`),
          cacheDeletePattern(`cache:shop_analytics:${sid}:*`),
          cacheDelete(`shop:${sid}:ads`),
          cacheDelete(`shop:${sid}`),
        ]),
        ...Array.from(affectedProductIds).map((pid) => cacheDelete(`product:${pid}`)),
      ]).catch(() => {});

      try {
        const { orderSocket } = require('../app');
        if (orderSocket) {
          affectedShopIds.forEach((sid) => {
            orderSocket.getIO().to(`shop:${sid}`).emit('shop:ad-analytics-updated', {
              shopId: sid,
              timestamp: new Date(),
            });
          });
        }
      } catch (_) {}
    }
  } catch (error) {
    console.error('Error in runTelemetrySyncNow:', error);
  }

  return { productViewsProcessed, shopViewsProcessed };
}

const telemetrySyncWorker = new Worker(
  'telemetry-sync',
  async () => {
    return await runTelemetrySyncNow();
  },
  { connection }
);

export async function scheduleTelemetrySync() {
  await telemetrySyncQueue.add(
    'telemetry-sync',
    {},
    {
      repeat: { every: 60 * 1000 }, // Run every 60 seconds
    }
  );
}
