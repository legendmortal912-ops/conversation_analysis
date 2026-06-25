import { logger } from '../utils/logger.js';
import { Redis as IORedis } from 'ioredis';

const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

/**
 * Detects if the rate of flagged turns in a project spikes above 30% in a 1-hour window.
 */
export async function checkFlagSpikeTrigger(
  projectId: string,
  isFlaggedTurn: boolean
): Promise<{ triggered: boolean; message: string }> {
  const currentHour = new Date().toISOString().slice(0, 13);
  const totalKey = `stats:hourly:turns:${projectId}:${currentHour}`;
  const flaggedKey = `stats:hourly:flags:${projectId}:${currentHour}`;

  // Increment total turns and potentially flagged turns
  const [totalStr, flaggedStr] = await Promise.all([
    redis.incr(totalKey),
    isFlaggedTurn ? redis.incr(flaggedKey) : redis.get(flaggedKey),
  ]);

  const total = Number(totalStr);
  const flagged = Number(flaggedStr ?? '0');

  // Set expiry on first increment
  if (total === 1) await redis.expire(totalKey, 3600 * 2);
  if (isFlaggedTurn && flagged === 1) await redis.expire(flaggedKey, 3600 * 2);

  // Require a minimum sample size before triggering spike alerts
  if (total < 10) return { triggered: false, message: '' };

  const rate = flagged / total;
  
  if (rate > 0.30) {
    logger.warn({ projectId, rate, total, flagged }, 'Flag spike detected');
    return {
      triggered: true,
      message: `High manipulation rate detected! ${(rate * 100).toFixed(1)}% of turns (${flagged}/${total}) in the last hour have been flagged for manipulation.`,
    };
  }

  return { triggered: false, message: '' };
}

