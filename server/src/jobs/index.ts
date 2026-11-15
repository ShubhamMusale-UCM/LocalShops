/**
 * Background Jobs Initialization
 * All Bull queues are initialized and scheduled here
 */

import subscriptionRenewalQueue, {
  scheduleSubscriptionRenewal,
} from './subscriptionRenewal.job';
import reviewSentimentQueue, {
  scheduleReviewSentimentAnalysis,
} from './reviewSentiment.job';
import dailyAnalyticsQueue from './dailyAnalytics.job';
import { imageProcessingQueue } from './imageProcessing.job';
import notificationCampaignQueue, {
  scheduleDailyPromotionalNotifications,
} from './notificationCampaign.job';
import { telemetrySyncQueue, scheduleTelemetrySync } from './telemetrySync.job';
import walletExpiryQueue, { scheduleWalletExpiry } from './walletExpiry.job';
import holdExpiryQueue, { scheduleHoldExpiry } from './holdExpiry.job';
import abandonedCartRecoveryQueue, { scheduleAbandonedCartRecovery } from './abandonedCartRecovery.job';

/**
 * Initialize all background jobs
 */
export async function initializeBackgroundJobs() {
  console.log('Initializing background jobs...');

  try {
    // Schedule recurring jobs
    await scheduleSubscriptionRenewal();
    await scheduleReviewSentimentAnalysis();
    await scheduleDailyPromotionalNotifications();
    await scheduleTelemetrySync();
    await scheduleWalletExpiry();
    await scheduleHoldExpiry();
    await scheduleAbandonedCartRecovery();

    console.log('✅ All background jobs initialized successfully');

    return {
      subscriptionRenewal: subscriptionRenewalQueue,
      reviewSentiment: reviewSentimentQueue,
      dailyAnalytics: dailyAnalyticsQueue,
      imageProcessing: imageProcessingQueue,
      notificationCampaign: notificationCampaignQueue,
      telemetrySync: telemetrySyncQueue,
      walletExpiry: walletExpiryQueue,
      holdExpiry: holdExpiryQueue,
      abandonedCartRecovery: abandonedCartRecoveryQueue,
    };
  } catch (error) {
    console.error('Failed to initialize background jobs:', error);
    throw error;
  }
}

/**
 * Gracefully shut down all job queues
 */
export async function shutdownBackgroundJobs() {
  console.log('Shutting down background jobs...');

  try {
    await subscriptionRenewalQueue.close();
    await reviewSentimentQueue.close();
    await dailyAnalyticsQueue.close();
    await imageProcessingQueue.close();
    await notificationCampaignQueue.close();
    await telemetrySyncQueue.close();
    await walletExpiryQueue.close();
    await holdExpiryQueue.close();
    await abandonedCartRecoveryQueue.close();

    console.log('✅ All background jobs shut down successfully');
  } catch (error) {
    console.error('Error shutting down background jobs:', error);
  }
}

export {
  subscriptionRenewalQueue,
  reviewSentimentQueue,
  dailyAnalyticsQueue,
  imageProcessingQueue,
  notificationCampaignQueue,
  telemetrySyncQueue,
  walletExpiryQueue,
  holdExpiryQueue,
  abandonedCartRecoveryQueue,
};
