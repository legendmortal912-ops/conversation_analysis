import { Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { processAlertJob } from './alert-worker.js';
import { processDigestJob } from './digest-worker.js';

const redisConnection = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export async function initWorkers(): Promise<void> {
  const alertWorker = new Worker('alert-delivery', processAlertJob, {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 20, // 20 alerts
      duration: 1000, // per second across all projects
    },
  });

  alertWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Alert delivery job completed');
  });

  alertWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Alert delivery job failed');
  });

  const digestWorker = new Worker('alert-digest', processDigestJob, {
    connection: redisConnection,
    concurrency: 1, // Run one at a time
  });

  digestWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Digest job completed');
  });

  digestWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Digest job failed');
  });

  logger.info('Alert and digest workers started');
}

