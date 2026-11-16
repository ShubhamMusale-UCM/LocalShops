/**
 * Booking Reminder Job (SEL-3)
 *
 * Enqueues a delayed BullMQ job for scheduled pickup orders at slotStart - 15 minutes.
 * Worker verifies active status, verifies merchant bookingAlerts toggle,
 * and sends real-time push and in-app notifications to both seller and buyer.
 */

import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import notificationService from '../modules/notification/notification.service';
import { logger } from '../utils/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const bookingReminderQueue = new Queue('booking-reminder', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
    backoff: { type: 'exponential', delay: 10000 },
  },
});

/**
 * Schedule a delayed reminder job for an order
 */
export async function scheduleBookingReminder(orderId: string, slotStartTime: Date) {
  try {
    const reminderTimeMs = slotStartTime.getTime() - 15 * 60 * 1000;
    const delay = Math.max(0, reminderTimeMs - Date.now());

    // Idempotent job id: reminder_${orderId} (BullMQ custom id cannot contain :)
    const jobId = `reminder_${orderId}`;

    // Remove existing if rescheduled
    const existing = await bookingReminderQueue.getJob(jobId);
    if (existing) {
      await existing.remove().catch(() => {});
    }

    await bookingReminderQueue.add(
      'sendReminder',
      { orderId },
      {
        delay,
        jobId,
      }
    );

    logger.info(`Scheduled booking reminder for order ${orderId} in ${Math.round(delay / 1000)}s`);
  } catch (error: any) {
    logger.warn(`Failed to schedule booking reminder for order ${orderId}: ${error?.message || error}`, { stack: error?.stack });
  }
}

/**
 * Cancel a scheduled reminder job (e.g. on order cancellation)
 */
export async function cancelBookingReminder(orderId: string) {
  try {
    const jobId = `reminder_${orderId}`;
    const job = await bookingReminderQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Cancelled booking reminder for order ${orderId}`);
    }
  } catch (error) {
    logger.warn(`Failed to cancel booking reminder for order ${orderId}:`, error);
  }
}

/**
 * Process an individual reminder job
 */
export async function processReminderJob(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: {
        include: {
          settings: true,
          owner: { select: { id: true, name: true, phone: true } },
        },
      },
      user: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!order || !order.pickupSlotStart) return { skipped: true, reason: 'Order not found or has no slot' };

  // Only send reminders for active upcoming orders
  const activeStatuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];
  if (!activeStatuses.includes(order.status)) {
    return { skipped: true, reason: `Order status is ${order.status}` };
  }

  const slotStartIst = new Date(order.pickupSlotStart).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const toggles: any = order.shop.settings?.notificationToggles || {};
  const sellerAlertsEnabled = toggles.bookingAlerts !== false;

  // 1. Notify Seller if enabled
  if (sellerAlertsEnabled && order.shop.owner?.id) {
    await notificationService
      .createNotification(order.shop.owner.id, {
        title: '⏰ Customer Pickup in 15 mins!',
        body: `Order #${order.orderNumber} for ${order.user?.name || 'Customer'} is scheduled for pickup at ${slotStartIst}.`,
        type: 'ORDER_UPDATE',
        relatedId: order.id,
        actionUrl: `/seller/orders?id=${order.id}`,
      })
      .catch((err) => logger.warn(`Failed to send seller reminder: ${err.message}`));
  }

  // 2. Notify Buyer
  if (order.userId && !order.userId.startsWith('anon_')) {
    await notificationService
      .createNotification(order.userId, {
        title: '⏰ Pickup Reminder: 15 Mins Away!',
        body: `Your booking #${order.orderNumber} at ${order.shop.name} is scheduled for pickup at ${slotStartIst}. Please visit the showroom.`,
        type: 'ORDER_UPDATE',
        relatedId: order.id,
        actionUrl: `/orders?id=${order.id}`,
      })
      .catch((err) => logger.warn(`Failed to send buyer reminder: ${err.message}`));
  }

  return { success: true, orderId: order.id };
}

// Background Worker
export const bookingReminderWorker = new Worker(
  'booking-reminder',
  async (job: Job) => {
    if (job.name === 'sendReminder') {
      return processReminderJob(job.data.orderId);
    }
  },
  { connection }
);

bookingReminderWorker.on('completed', (job) => {
  logger.info(`Booking reminder job ${job.id} completed`);
});

bookingReminderWorker.on('failed', (job, err) => {
  logger.error(`Booking reminder job ${job?.id} failed:`, err);
});

export default bookingReminderQueue;
