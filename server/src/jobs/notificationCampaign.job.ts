import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import notificationService from '../modules/notification/notification.service';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

type CampaignSegment = 'ALL' | 'BUYERS' | 'SELLERS' | 'DELIVERY_PARTNERS' | 'NEW_USERS' | 'INACTIVE';

type NotificationCampaignPayload = {
  campaignId: string;
  title: string;
  message: string;
  userSegment: CampaignSegment;
  maxSend?: number;
};

export const notificationCampaignQueue = new Queue<NotificationCampaignPayload>('notification-campaign', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
});

const notificationCampaignWorker = new Worker<NotificationCampaignPayload>(
  'notification-campaign',
  async (job: Job<NotificationCampaignPayload>) => {
    const { campaignId, title, message, userSegment, maxSend = 10000 } = job.data;

    const where: any = {};

    if (userSegment === 'BUYERS' || userSegment === 'SELLERS' || userSegment === 'DELIVERY_PARTNERS') {
      where.role = userSegment === 'BUYERS' ? 'BUYER' : userSegment === 'SELLERS' ? 'SELLER' : 'DELIVERY_PARTNER';
    }

    if (userSegment === 'NEW_USERS') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    }

    if (userSegment === 'INACTIVE') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      where.updatedAt = { lte: thirtyDaysAgo };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
      take: maxSend,
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await notificationService.createNotification(user.id, {
          title,
          description: message,
          type: 'PROMOTION',
          relatedId: campaignId,
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    return { campaignId, sent, failed, total: users.length };
  },
  { connection }
);

export async function scheduleNotificationCampaign(
  title: string,
  message: string,
  userSegment: CampaignSegment,
  scheduleTime?: Date
) {
  const campaignId = `campaign-${Date.now()}`;
  const delay = scheduleTime ? Math.max(0, scheduleTime.getTime() - Date.now()) : 0;

  await notificationCampaignQueue.add('notification-campaign', {
    campaignId,
    title,
    message,
    userSegment,
  }, {
    delay,
  });

  return campaignId;
}

export async function scheduleDailyPromotionalNotifications() {
  await notificationCampaignQueue.add('daily-buyers', {
    campaignId: `daily-buyers-${Date.now()}`,
    title: 'Check out new products near you!',
    message: 'Fresh items just added by shops near your area',
    userSegment: 'BUYERS',
  }, { repeat: { every: 24 * 60 * 60 * 1000 } });

  await notificationCampaignQueue.add('daily-sellers', {
    campaignId: `daily-sellers-${Date.now()}`,
    title: 'Your daily sales report is ready',
    message: "Check your dashboard for today's performance",
    userSegment: 'SELLERS',
  }, { repeat: { every: 24 * 60 * 60 * 1000 } });
}

notificationCampaignWorker.on('completed', () => {
  console.log('Notification campaign job completed');
});

notificationCampaignWorker.on('failed', (_job, err) => {
  console.error('Notification campaign job failed:', err.message);
});

export default notificationCampaignQueue;
