/**
 * Showroom Priority Hold Expiry Job (ENG-9)
 *
 * Automatically cancels unclaimed PICKUP orders in PLACED or CONFIRMED status
 * after the hold window expires (default 180 minutes / 3 hours),
 * restores stock ONLY if it was deducted (CONFIRMED), refunds any wallet coins,
 * records an immutable audit log entry, and notifies both buyer & seller.
 */

import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { cacheDelete, cacheDeletePattern } from '../config/redis';
import walletService from '../modules/wallet/wallet.service';
import { recordAuditLog } from '../utils/auditLogger';
import { logger } from '../utils/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const holdExpiryQueue = new Queue('hold-expiry', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    backoff: { type: 'exponential', delay: 30000 },
  },
});

export async function processExpiredHolds(minCheckMinutes = 15): Promise<{ expiredCount: number; expiredOrderIds: string[] }> {
  const minCutoffDate = new Date(Date.now() - minCheckMinutes * 60 * 1000);

  const candidates = await prisma.order.findMany({
    where: {
      isDelivery: false,
      status: { in: ['PLACED', 'CONFIRMED'] },
      createdAt: { lte: minCutoffDate },
    },
    include: { items: true },
    take: 100,
  });

  const expiredOrderIds: string[] = [];

  for (const order of candidates) {
    try {
      const orderHoldMins = (order as any).holdDurationMinutes || 180;
      const ageMs = Date.now() - new Date(order.createdAt).getTime();
      if (ageMs < orderHoldMins * 60 * 1000) {
        continue;
      }

      const holdLabel = orderHoldMins >= 60
        ? `${+(orderHoldMins / 60).toFixed(1)}h`
        : `${orderHoldMins}m`;
      const expiryNote = `Showroom hold window (${holdLabel}) expired automatically`;

      const wasStockDeducted = order.status === 'CONFIRMED';

      const didExpire = await prisma.$transaction(async (tx) => {
        // Idempotent guard inside transaction
        const fresh = await tx.order.findUnique({ where: { id: order.id } });
        if (!fresh || !['PLACED', 'CONFIRMED'].includes(fresh.status)) {
          return false;
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            statusHistory: [
              ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
              {
                status: 'CANCELLED',
                note: expiryNote,
                cancelledBy: 'SYSTEM',
                updatedAt: new Date().toISOString(),
              },
            ] as any,
          },
        });

        // Restore stock ONLY if stock was deducted on CONFIRMED
        if (wasStockDeducted) {
          for (const item of order.items) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product && typeof product.quantity === 'number') {
              const newQty = product.quantity + item.quantity;
              await tx.product.update({
                where: { id: item.productId },
                data: { quantity: newQty, inStock: newQty > 0 },
              });
            }
          }
        }

        return true;
      });

      if (!didExpire) continue;

      expiredOrderIds.push(order.id);

      // Refund buyer coins if used
      if (order.coinsUsed > 0) {
        await walletService
          .creditBuyerWallet(
            order.userId,
            order.coinsUsed,
            'BOOKING_REFUND',
            `Coins refunded from expired hold #${order.orderNumber}`,
            order.id,
            'ORDER'
          )
          .catch(() => {});
      }

      // Invalidate caches
      for (const item of order.items) {
        await cacheDelete(`product:${item.productId}`).catch(() => {});
      }
      await cacheDeletePattern(`shop:${order.shopId}*`).catch(() => {});

      // Audit log
      await recordAuditLog({
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        action: 'ORDER_HOLD_EXPIRED_BY_SYSTEM',
        entityType: 'ORDER',
        entityId: order.id,
        metadata: {
          shopId: order.shopId,
          previousStatus: order.status,
          stockRestored: wasStockDeducted,
        },
      });

      // Real-time socket notification to customer and seller
      try {
        const { orderSocket } = require('../app');
        if (orderSocket) {
          orderSocket.notifyCustomerOrderUpdate(
            order.id,
            'CANCELLED',
            expiryNote
          );
          orderSocket.notifySellerOrderUpdate(
            order.shopId,
            order.id,
            'CANCELLED',
            expiryNote
          );
        }
      } catch (_) {}
    } catch (err: any) {
      logger.error('Failed to expire hold order', { orderId: order.id, error: err.message });
    }
  }

  return { expiredCount: expiredOrderIds.length, expiredOrderIds };
}

const holdExpiryWorker = new Worker(
  'hold-expiry',
  async (_job: Job) => {
    return processExpiredHolds(15);
  },
  { connection }
);

holdExpiryWorker.on('failed', (job, err) => {
  logger.error('Hold expiry job failed', { jobId: job?.id, error: err.message });
});

export async function scheduleHoldExpiry() {
  await holdExpiryQueue.add(
    'expire-unclaimed-holds',
    {},
    {
      jobId: 'repeatable-hold-expiry',
      repeat: { every: 5 * 60 * 1000 }, // Every 5 minutes
    }
  );
}

export default holdExpiryQueue;
