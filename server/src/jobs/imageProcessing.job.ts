import { Queue, Worker, Job } from 'bullmq';
import axios from 'axios';
import { processAndUploadImage } from '../utils/imageProcessor';
import prisma from '../config/database';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

type ImageJobPayload = {
  imageUrl: string;
  entityType: 'product' | 'shop';
  entityId: string;
};

export const imageProcessingQueue = new Queue<ImageJobPayload>('image-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

const imageProcessingWorker = new Worker<ImageJobPayload>(
  'image-processing',
  async (job: Job<ImageJobPayload>) => {
    const { imageUrl, entityType, entityId } = job.data;

    const response = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const processed = await processAndUploadImage(buffer, entityType === 'product' ? 'products' : 'shops');

    if (entityType === 'product') {
      await prisma.product.update({
        where: { id: entityId },
        data: { images: { set: [processed.full] } },
      });
    } else {
      await prisma.shop.update({
        where: { id: entityId },
        data: {
          logo: processed.full,
          coverImage: processed.card,
        },
      });
    }

    return { entityType, entityId, image: processed.full };
  },
  { connection }
);

export async function queueImageProcessing(
  imageUrl: string,
  entityType: 'product' | 'shop',
  entityId: string
) {
  await imageProcessingQueue.add('image-process', {
    imageUrl,
    entityType,
    entityId,
  });
}

imageProcessingWorker.on('completed', () => {
  console.log('Image processing job completed');
});

imageProcessingWorker.on('failed', (_job, err) => {
  console.error('Image processing job failed:', err.message);
});

export default imageProcessingQueue;
