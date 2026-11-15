/**
 * Dedicated Background Worker Entrypoint (ENG-9)
 *
 * Allows running BullMQ job processors in an isolated worker container
 * (`node dist/worker.js`) separate from the stateless HTTP API instances.
 */

import './config/env';
import prisma from './config/database';
import { initializeBackgroundJobs, shutdownBackgroundJobs } from './jobs';
import { logger } from './utils/logger';

async function startWorker() {
  try {
    await prisma.$connect();
    logger.info('Worker connected to PostgreSQL database');
    await initializeBackgroundJobs();
    logger.info('Dedicated BullMQ background worker started');
  } catch (err: any) {
    logger.error('Failed to start background worker', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received by worker, shutting down gracefully...');
  await shutdownBackgroundJobs();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received by worker, shutting down gracefully...');
  await shutdownBackgroundJobs();
  await prisma.$disconnect();
  process.exit(0);
});

startWorker();
