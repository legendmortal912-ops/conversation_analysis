import { logger } from '../utils/logger.js';

/**
 * Fires immediately if a flag is marked as 'critical' severity.
 */
export async function checkCriticalFlagTrigger(
  projectId: string,
  conversationId: string,
  severity: string,
  pattern: string
): Promise<{ triggered: boolean; message: string }> {
  if (severity.toLowerCase() === 'critical') {
    logger.warn({ projectId, conversationId, pattern }, 'Critical flag detected');
    return {
      triggered: true,
      message: `CRITICAL Flag: A highly manipulative pattern ("${pattern}") was detected in conversation ${conversationId}. Immediate review recommended.`,
    };
  }

  return { triggered: false, message: '' };
}
