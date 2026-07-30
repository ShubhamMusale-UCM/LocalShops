import { Queue, Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { SentimentType } from '@prisma/client';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const reviewSentimentQueue = new Queue('review-sentiment', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

const analyzeSentiment = (text: string): SentimentType => {
  const posKeywords = ['good', 'great', 'excellent', 'amazing', 'perfect', 'loved', 'fantastic', 'awesome', 'best'];
  const negKeywords = ['bad', 'terrible', 'awful', 'poor', 'hate', 'hated', 'worst', 'disappointing', 'broken'];

  const lowerText = text.toLowerCase();
  const posCount = posKeywords.filter((kw) => lowerText.includes(kw)).length;
  const negCount = negKeywords.filter((kw) => lowerText.includes(kw)).length;

  if (posCount > negCount) return 'POSITIVE';
  if (negCount > posCount) return 'NEGATIVE';
  return 'NEUTRAL';
};

const reviewSentimentWorker = new Worker(
  'review-sentiment',
  async (_job: Job) => {
    const reviews = await prisma.review.findMany({
      where: { sentiment: null },
      select: { id: true, comment: true },
      take: 100,
    });

    let processed = 0;

    for (const review of reviews) {
      const sentiment = analyzeSentiment(review.comment || '');
      await prisma.review.update({
        where: { id: review.id },
        data: { sentiment },
      });
      processed += 1;
    }

    return { processed, total: reviews.length };
  },
  { connection }
);

export async function scheduleReviewSentimentAnalysis() {
  await reviewSentimentQueue.add('review-sentiment', {}, {
    repeat: { every: 60 * 60 * 1000 },
  });
}

reviewSentimentWorker.on('completed', () => {
  console.log('Review sentiment job completed');
});

reviewSentimentWorker.on('failed', (_job, err) => {
  console.error('Review sentiment job failed:', err.message);
});

export default reviewSentimentQueue;
