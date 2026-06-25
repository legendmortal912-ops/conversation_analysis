import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

/**
 * Shared Redis connection for BullMQ queues.
 * maxRetriesPerRequest: null is required by BullMQ.
 */
export const redisConnection = new IORedis(
  process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null,
  },
);

/**
 * The main 'analysis' queue.
 * Ingest routes enqueue jobs here; the Python analysis-worker consumes them.
 *
 * Job payload shape expected by workers:
 * {
 *   conversation_id: string;
 *   model_id: string;        // registered model / project id
 *   firm_id: string;         // org id resolved from api_key
 *   turns: TurnPayload[];
 * }
 */
export const analysisQueue = new Queue('analysis', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
