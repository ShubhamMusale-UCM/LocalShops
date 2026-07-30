import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const subscriptionRenewalQueue = new Queue('subscription-renewal', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

const subscriptionRenewalWorker = new Worker(
  'subscription-renewal',
  async (_job: Job) => {
    const today = new Date();

    const expired = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: { lte: today },
      },
      select: {
        id: true,
      },
    });

    let processed = 0;

    for (const subscription of expired) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });
      processed += 1;
    }

    return { processed, total: expired.length };
  },
  { connection }
);

export async function scheduleSubscriptionRenewal() {
  await subscriptionRenewalQueue.add('subscription-renewal', {}, {
    repeat: { every: 24 * 60 * 60 * 1000 },
  });
}

subscriptionRenewalWorker.on('completed', () => {
  console.log('Subscription renewal job completed');
});

subscriptionRenewalWorker.on('failed', (_job, err) => {
  console.error('Subscription renewal job failed:', err.message);
});

export default subscriptionRenewalQueue;
