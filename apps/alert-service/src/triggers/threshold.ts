import { logger } from '../utils/logger.js';

export interface AlertContext {
  projectId: string;
  orgId: string;
  conversationId: string;
  tiltScore: number;
  projectThreshold: number;
}

/**
 * Checks if a conversation's TiltScore falls below the project's configured threshold.
 */
export async function checkThresholdTrigger(context: AlertContext): Promise<{ triggered: boolean; message: string }> {
  if (context.tiltScore < context.projectThreshold) {
    logger.info({ ...context }, 'Threshold trigger activated');
    return {
      triggered: true,
      message: `Conversation ${context.conversationId} ended with TiltScore ${context.tiltScore}, which is below your threshold of ${context.projectThreshold}.`,
    };
  }

  return { triggered: false, message: '' };
}
