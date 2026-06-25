import { Redis as IORedis } from 'ioredis';

const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

/**
 * Checks if an alert should be sent based on deduplication rules.
 * Uses Redis to store recent alert signatures with a TTL.
 * 
 * @param projectId The project ID
 * @param alertType The type of alert (e.g., 'threshold', 'spike')
 * @param entityId The ID of the specific entity (e.g., conversation ID)
 * @param ttlSeconds How long to suppress identical alerts (default: 3600s = 1hr)
 * @returns true if the alert is new and should be sent, false if it's a duplicate
 */
export async function checkAndSetDedup(
  projectId: string,
  alertType: string,
  entityId: string,
  ttlSeconds: number = 3600,
): Promise<boolean> {
  const key = `dedup:alert:${projectId}:${alertType}:${entityId}`;
  
  // setnx returns 1 if key was set (meaning it didn't exist), 0 if it already existed
  const result = await redis.setnx(key, '1');
  
  if (result === 1) {
    await redis.expire(key, ttlSeconds);
    return true; // Not a duplicate
  }
  
  return false; // Duplicate
}

/**
 * Check if a project has exceeded its alert rate limit.
 * 
 * @param projectId The project ID
 * @param maxAlerts Maximum alerts allowed per hour
 * @returns true if under limit, false if rate limited
 */
export async function checkRateLimit(projectId: string, maxAlerts: number = 10): Promise<boolean> {
  const hourKey = `ratelimit:alert:${projectId}:${new Date().toISOString().slice(0, 13)}`; // Group by hour
  
  const current = await redis.incr(hourKey);
  if (current === 1) {
    await redis.expire(hourKey, 3600);
  }
  
  return current <= maxAlerts;
}

