import { logger } from '../utils/logger.js';
import { Redis as IORedis } from 'ioredis';

const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379');

/**
 * Detects if a specific manipulation pattern doubles in frequency compared to the previous hour.
 */
export async function checkPatternSurgeTrigger(
  projectId: string,
  pattern: string
): Promise<{ triggered: boolean; message: string }> {
  const currentHour = new Date().toISOString().slice(0, 13);
  const previousHourDate = new Date();
  previousHourDate.setHours(previousHourDate.getHours() - 1);
  const previousHour = previousHourDate.toISOString().slice(0, 13);

  const currentKey = `stats:hourly:patterns:${projectId}:${pattern}:${currentHour}`;
  const prevKey = `stats:hourly:patterns:${projectId}:${pattern}:${previousHour}`;

  const currentCount = await redis.incr(currentKey);
  if (currentCount === 1) await redis.expire(currentKey, 3600 * 2);

  const prevCountStr = await redis.get(prevKey);
  const prevCount = Number(prevCountStr ?? '0');

  // Need at least 5 instances in previous hour to establish a baseline
  if (prevCount >= 5 && currentCount >= prevCount * 2) {
    logger.warn({ projectId, pattern, currentCount, prevCount }, 'Pattern surge detected');
    return {
      triggered: true,
      message: `Surge in "${pattern}" detected! There have been ${currentCount} instances this hour, compared to ${prevCount} in the previous hour.`,
    };
  }

  return { triggered: false, message: '' };
}


