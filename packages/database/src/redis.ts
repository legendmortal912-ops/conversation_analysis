/**
 * @module database/redis
 * Redis client singleton and BullMQ queue/worker factory.
 *
 * Uses ioredis for the Redis connection and BullMQ for
 * job queue management (conversation processing, alert delivery, etc.).
 */

import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import type { ConnectionOptions, Processor, WorkerOptions, QueueOptions } from 'bullmq';

// ── Redis Client Singleton ─────────────────────────────────────────────

/** Global augmentation to persist Redis across hot-reloads. */
const globalForRedis = globalThis as unknown as {
  __redis: Redis | undefined;
};

/**
 * Creates a Redis client from environment variables.
 *
 * Environment variables:
 * - `REDIS_URL` — full Redis connection URL (e.g. "redis://127.0.0.1:6379")
 * - `REDIS_HOST` — Redis host (default: "localhost")
 * - `REDIS_PORT` — Redis port (default: 6379)
 * - `REDIS_PASSWORD` — Redis password (optional)
 * - `REDIS_DB` — Redis database index (default: 0)
 */
function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'];

  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });
  }

  return new Redis({
    host: process.env['REDIS_HOST'] ?? '127.0.0.1',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });
}

/**
 * Shared Redis client instance.
 *
 * In production, a single instance is created and reused.
 * In development, cached on `globalThis` to survive hot-reloading.
 *
 * @example
 * ```ts
 * import { redis } from '@convoguard/database';
 *
 * await redis.set('key', 'value');
 * const val = await redis.get('key');
 * ```
 */
export const redis: Redis = globalForRedis.__redis ?? createRedisClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForRedis.__redis = redis;
}

/**
 * Gracefully closes the Redis connection.
 * Call this during application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

// ── BullMQ Connection ──────────────────────────────────────────────────

/**
 * Returns BullMQ-compatible connection options using the shared Redis client config.
 * BullMQ creates its own connections internally, so we pass config rather than the client.
 */
function getBullMQConnection(): ConnectionOptions {
  const redisUrl = process.env['REDIS_URL'];

  if (redisUrl) {
    // Parse the URL to extract components
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1) || '0', 10),
    };
  }

  return {
    host: process.env['REDIS_HOST'] ?? '127.0.0.1',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
  };
}

// ── Queue Names ────────────────────────────────────────────────────────

/**
 * Well-known queue names used across ConvoGuard services.
 */
export const QUEUE_NAMES = {
  /** Processes incoming conversation turns through the detection pipeline. */
  TURN_PROCESSING: 'convoguard:turn-processing',
  /** Runs the TiltScore computation after new flags are detected. */
  SCORING: 'convoguard:scoring',
  /** Delivers alerts (webhook, Slack, email) to configured channels. */
  ALERT_DELIVERY: 'convoguard:alert-delivery',
  /** Generates reports (PDF, CSV). */
  REPORT_GENERATION: 'convoguard:report-generation',
  /** Processes hash-chain checkpointing batches. */
  CHAIN_CHECKPOINT: 'convoguard:chain-checkpoint',
  /** Records usage events for billing. */
  USAGE_TRACKING: 'convoguard:usage-tracking',
} as const;

// ── Queue Factory ──────────────────────────────────────────────────────

/**
 * Creates a BullMQ queue for producing jobs.
 *
 * @param name - Queue name (use QUEUE_NAMES constants)
 * @param opts - Additional BullMQ queue options
 * @returns A configured BullMQ Queue instance
 *
 * @example
 * ```ts
 * import { createQueue, QUEUE_NAMES } from '@convoguard/database';
 *
 * const turnQueue = createQueue(QUEUE_NAMES.TURN_PROCESSING);
 * await turnQueue.add('process-turn', { turnId: 'trn_abc123' });
 * ```
 */
export function createQueue<TData = unknown>(
  name: string,
  opts: Partial<QueueOptions> = {}
): Queue<TData> {
  return new Queue<TData>(name, {
    connection: getBullMQConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
    ...opts,
  });
}

/**
 * Creates a BullMQ worker for consuming jobs from a queue.
 *
 * @param name - Queue name to consume from (use QUEUE_NAMES constants)
 * @param processor - The job processor function
 * @param opts - Additional BullMQ worker options
 * @returns A configured BullMQ Worker instance
 *
 * @example
 * ```ts
 * import { createWorker, QUEUE_NAMES } from '@convoguard/database';
 *
 * const worker = createWorker(
 *   QUEUE_NAMES.TURN_PROCESSING,
 *   async (job) => {
 *     const { turnId } = job.data;
 *     // Process the turn...
 *   },
 *   { concurrency: 5 }
 * );
 *
 * worker.on('completed', (job) => console.log(`Done: ${job.id}`));
 * worker.on('failed', (job, err) => console.error(`Failed: ${job?.id}`, err));
 * ```
 */
export function createWorker<TData = unknown, TResult = unknown>(
  name: string,
  processor: Processor<TData, TResult>,
  opts: Partial<WorkerOptions> = {}
): Worker<TData, TResult> {
  return new Worker<TData, TResult>(name, processor, {
    connection: getBullMQConnection(),
    concurrency: 1,
    ...opts,
  });
}

